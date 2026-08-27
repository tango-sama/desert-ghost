// Thin, safe wrapper around the Meta Pixel's `fbq` global, plus the client
// half of the Pixel/CAPI pair. Kept separate from
// components/analytics/meta-pixel.tsx so any funnel component (order
// modals, product pages) can fire an event without importing React/Script
// concerns, and so the pixel ID never has to be threaded through call
// sites — it's already baked into `fbq` by the base snippet at init time.
//
// `fbq` is injected by the base pixel script (components/analytics/
// meta-pixel.tsx) and queues calls itself before the real script has
// loaded, so calling this immediately on mount is safe — no readiness
// check beyond "did the base component even render" (see NEXT_PUBLIC_
// META_PIXEL_ID handling there). If that env var is unset, `fbq` never
// exists and every call here is a silent no-op, so pages keep working
// with tracking simply off rather than throwing.
//
// SERVER BOUNDARY: this module must never import lib/meta-capi.ts. The
// server half is reached only by POSTing to /api/meta-capi, so
// `META_CAPI_ACCESS_TOKEN` has no path into a browser bundle.

type Fbq = (...args: unknown[]) => void;

function getFbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof fbq === "function" ? fbq : null;
}

/**
 * Fire a standard Meta Pixel event. `eventID` is the dedup key for the
 * server-side Conversions API copy of the same event — Meta collapses a
 * browser event and a server event that share an id into one conversion
 * instead of counting both. Any event sent through both channels MUST pass
 * the same id here that the server sends as `event_id`.
 */
export function trackPixelEvent(
  eventName: string,
  params?: Record<string, unknown>,
  options?: { eventID?: string }
): void {
  const fbq = getFbq();
  if (!fbq) return;
  if (options?.eventID) {
    fbq("track", eventName, params ?? {}, { eventID: options.eventID });
  } else {
    fbq("track", eventName, params ?? {});
  }
}

// Algerian local numbers here are always `0[567]XXXXXXXX` (see
// lib/delivery.ts's `isValidPhone`) — Meta's Advanced Matching expects a
// normalized, country-coded number so it can hash it consistently against
// what it hashes on Meta's own side (a phone stored as +2135... elsewhere).
// Exported so lib/meta-capi.ts (server-side, hashes for the Graph API call
// itself rather than relying on the client SDK) applies the same rule
// instead of duplicating it — note the server strips the `+` before
// hashing, which is what Meta's phone-hash spec requires.
export function normalizeDzPhone(phone: string): string {
  const digits = phone.replace(/\s+/g, "");
  return digits.startsWith("0") ? `+213${digits.slice(1)}` : digits;
}

// --------------------------------------------------------------------------
// Identity: external_id, _fbp, _fbc
// --------------------------------------------------------------------------

const VISITOR_ID_KEY = "ds_vid";

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match?.slice(name.length + 1);
}

/**
 * Stable pseudonymous visitor id, sent as Meta's `external_id` on both the
 * browser and server side of every event.
 *
 * Why this matters here specifically: this is a cash-on-delivery shop with
 * no customer accounts and no email field anywhere, so before an order is
 * placed Meta has nothing to match a visitor on except cookies. Events
 * carrying `external_id` stay linkable to each other (and to the eventual
 * Purchase) even when `_fbp` is missing — which is exactly the case on the
 * iOS/ITP traffic CAPI exists to recover. It's a random id, not derived
 * from anything about the person: no PII is created by this.
 *
 * Written by the base pixel script at page load (see
 * components/analytics/meta-pixel.tsx) so it is set before any event
 * fires; this reader re-creates it if storage was cleared mid-session.
 */
export function getVisitorId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    const created =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem(VISITOR_ID_KEY, created);
    return created;
  } catch {
    // Private mode / storage disabled — degrade to no external_id rather
    // than throwing inside a tracking call.
    return undefined;
  }
}

/**
 * Read `_fbc` (Meta's click id cookie), falling back to constructing it
 * from a `fbclid` URL parameter when the cookie is absent.
 *
 * The base pixel script normally writes `_fbc` itself on an ad-click
 * landing — but only if it actually loaded. When it's blocked, the click
 * id is still sitting in the URL, and it's the strongest attribution
 * signal there is. Meta's documented format is
 * `fb.<subdomainIndex>.<timestamp_ms>.<fbclid>`.
 */
export function getFbc(): string | undefined {
  const cookie = readCookie("_fbc");
  if (cookie) return cookie;
  if (typeof window === "undefined") return undefined;
  try {
    const fbclid = new URLSearchParams(window.location.search).get("fbclid");
    return fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Advanced Matching: hand Meta the customer's phone/name once a real
 * order/checkout form has validated them, so events get matched to a real
 * identity instead of just a browser cookie — the single biggest lever for
 * ad delivery/retargeting quality. Safe to call more than once (each call
 * just re-issues `fbq('init', ...)` with more matching data); only ever
 * call this with data that has already passed the same validation the
 * order itself required — never with a raw, unvalidated form field. The JS
 * SDK hashes these values client-side before they ever leave the browser;
 * do NOT pre-hash them here.
 *
 * `external_id` is included so the browser and the server agree on it: the
 * SDK lowercases+hashes it here, and lib/meta-capi.ts applies the same
 * normalization before hashing server-side.
 */
export function setAdvancedMatching(data: { phone?: string; firstName?: string }): void {
  const fbq = getFbq();
  if (!fbq) return;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!pixelId) return;

  const matched: Record<string, string> = {};
  if (data.phone) matched.ph = normalizeDzPhone(data.phone);
  if (data.firstName) matched.fn = data.firstName.trim().toLowerCase();
  const vid = getVisitorId();
  if (vid) matched.external_id = vid;
  if (Object.keys(matched).length === 0) return;

  fbq("init", pixelId, matched);
}

// --------------------------------------------------------------------------
// CAPI: server copies of Purchase and ViewContent
// --------------------------------------------------------------------------

/**
 * The Purchase dedup key, derived from the real Firestore order id so it is
 * STABLE: the same order always produces the same event id, on a retry or a
 * double submit alike, and Meta collapses the repeats. Built by this one
 * function on the browser and rebuilt identically server-side
 * (app/api/meta-capi/route.ts) — never a random value.
 */
export function purchaseEventId(orderId: string): string {
  return `purchase_${orderId}`;
}

/** Fresh dedup key for an event with no natural id of its own. */
function newEventId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${rand}`;
}

/**
 * Fire-and-forget POST to the server relay. Never awaited by callers and
 * never throws, so a network hiccup or an unconfigured
 * `META_CAPI_ACCESS_TOKEN` can never read as an order failure to the
 * customer — same "degrade gracefully, don't break checkout" rule as
 * `trackPixelEvent`. `keepalive` lets it survive the page navigation that
 * follows some success paths (the WhatsApp handoff opens immediately).
 */
function postCapi(body: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    fetch("/api/meta-capi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        eventSourceUrl: window.location.href,
        externalId: getVisitorId(),
        fbp: readCookie("_fbp"),
        fbc: getFbc(),
      }),
      keepalive: true,
    }).catch(() => {
      // Network failure — nothing to do; must never surface to the
      // customer-facing flow that called it.
    });
  } catch {
    // JSON/fetch construction failure — same rule.
  }
}

/**
 * Server copy of `Purchase`. Deliberately sends NOTHING but the order id:
 * the route re-reads the order from Firestore and derives value, contents
 * and customer matching from the stored document, so the reported value
 * can't be forged and can't drift from what was actually saved. See
 * app/api/meta-capi/route.ts.
 */
export function sendCapiPurchase(params: { orderId: string }): void {
  postCapi({ event: "Purchase", orderId: params.orderId });
}

/**
 * Fire `ViewContent` through BOTH channels with one shared event id.
 *
 * Generating the id here rather than at the call site is what guarantees
 * requirement "browser and server events use identical event IDs" — the
 * two copies are built from the same variable in the same function, so
 * they cannot drift apart.
 */
export function trackViewContent(params: {
  contentIds: (string | number)[];
  contentName?: string;
  value: number;
  currency?: string;
}): void {
  const eventId = newEventId("vc");

  // Each half is guarded independently so neither can take the other down,
  // and so this function as a whole cannot throw into the render/effect
  // that called it.
  try {
    trackPixelEvent(
      "ViewContent",
      {
        content_ids: params.contentIds,
        content_type: "product",
        contents: params.contentIds.map((id) => ({ id: String(id), quantity: 1 })),
        ...(params.contentName ? { content_name: params.contentName } : {}),
        value: params.value,
        currency: params.currency ?? "DZD",
      },
      { eventID: eventId }
    );
  } catch (err) {
    console.error("[DS] trackViewContent pixel", err);
  }

  try {
    postCapi({
      event: "ViewContent",
      eventId,
      contentIds: params.contentIds,
      contentName: params.contentName,
      value: params.value,
    });
  } catch (err) {
    console.error("[DS] trackViewContent capi", err);
  }
}

/**
 * Fire `Purchase` through BOTH channels for a CONFIRMED order.
 *
 * Only ever call this after `saveOrder()` has resolved — `orderId` is the
 * Firestore document id, which both proves the order exists and provides
 * the stable dedup key. Never call it from a click handler or from
 * validation. This function never throws: the Pixel call and the CAPI post
 * are each isolated, so neither a blocked `fbq` nor a failed fetch can
 * propagate into the order flow.
 */
export function trackPurchase(params: {
  orderId: string;
  /** Order line items, already saved to Firestore. */
  items: { id: string; price: number; qty: number }[];
  /** Order total including delivery — the same field the server reads. */
  value: number;
  currency?: string;
  phone?: string;
  firstName?: string;
  /** Human-facing order number (`DS-1234`). */
  orderNumber?: string;
}): void {
  const eventId = purchaseEventId(params.orderId);

  // EVERYTHING here is guarded. Several call sites invoke this from inside
  // the same try/catch that wraps `saveOrder()`, where an exception would
  // be reported to the customer as a failed order — so this function must
  // not be able to throw, including from the payload construction itself.
  try {
    const contents = (params.items ?? []).map((i) => ({
      id: String(i.id),
      quantity: i.qty,
      item_price: i.price,
    }));
    // Advanced Matching first: this is the point in the funnel where
    // phone/name have actually passed validation, so it's the first point
    // where handing them to Meta is safe/meaningful. Must precede the
    // track call so the event carries the matching data.
    setAdvancedMatching({ phone: params.phone, firstName: params.firstName });
    trackPixelEvent(
      "Purchase",
      {
        value: params.value,
        currency: params.currency ?? "DZD",
        content_type: "product",
        content_ids: contents.map((c) => c.id),
        contents,
        num_items: contents.reduce((n, c) => n + c.quantity, 0),
        ...(params.orderNumber ? { order_id: params.orderNumber } : {}),
      },
      { eventID: eventId }
    );
  } catch (err) {
    console.error("[DS] trackPurchase pixel", err);
  }

  // Server copy — same event id, derived independently from the same order
  // id on the server so the two always match. Guarded separately so a
  // failure above can never prevent the server-side recovery copy.
  try {
    sendCapiPurchase({ orderId: params.orderId });
  } catch (err) {
    console.error("[DS] trackPurchase capi", err);
  }
}

// Thin, safe wrapper around the Meta Pixel's `fbq` global. Kept separate
// from components/analytics/meta-pixel.tsx so any funnel component (order
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

type Fbq = (...args: unknown[]) => void;

function getFbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof fbq === "function" ? fbq : null;
}

/**
 * Fire a standard Meta Pixel event. `eventID` is the dedup key for a
 * future server-side Conversions API call for the same event (e.g. the
 * Firestore order id for Purchase) — passing it now costs nothing and
 * means CAPI can be added later without touching this call site again.
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
// This is the only shape ever passed to `setAdvancedMatching`/the CAPI
// route below, so no general-purpose phone parsing is needed. Exported so
// app/api/meta-capi/route.ts (server-side, hashes for the Graph API call
// itself rather than relying on the client SDK) can normalize the same way
// instead of duplicating this rule.
export function normalizeDzPhone(phone: string): string {
  const digits = phone.replace(/\s+/g, "");
  return digits.startsWith("0") ? `+213${digits.slice(1)}` : digits;
}

/**
 * Advanced Matching: hand Meta the customer's phone/name once a real
 * order/checkout form has validated them, so events get matched to a real
 * identity instead of just a browser cookie — the single biggest lever for
 * ad delivery/retargeting quality, and the one thing `fbq('init', ...)`
 * couldn't do at page-load time since nothing is known about the visitor
 * yet. Safe to call more than once (each call just re-issues `fbq('init',
 * ...)` with more matching data); only ever call this with data that has
 * already passed the same validation the order itself required — never
 * with a raw, unvalidated form field. The JS SDK hashes these values
 * client-side before they ever leave the browser; do NOT pre-hash them
 * here.
 */
export function setAdvancedMatching(data: { phone?: string; firstName?: string }): void {
  const fbq = getFbq();
  if (!fbq) return;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!pixelId) return;

  const matched: Record<string, string> = {};
  if (data.phone) matched.ph = normalizeDzPhone(data.phone);
  if (data.firstName) matched.fn = data.firstName.trim().toLowerCase();
  if (Object.keys(matched).length === 0) return;

  fbq("init", pixelId, matched);
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match?.slice(name.length + 1);
}

/**
 * Server-side Meta Conversions API (CAPI) — recovers `Purchase` events lost
 * client-side to ad-blockers/Safari ITP/iOS, which no client-side fix can
 * ever see. Fire-and-forget: never awaited by callers, and this function
 * itself never throws, so a network hiccup or a missing
 * `META_CAPI_ACCESS_TOKEN` (see app/api/meta-capi/route.ts) can never read
 * as an order failure to the customer — same "degrade gracefully, don't
 * break checkout" rule as `trackPixelEvent` itself. Pass the SAME
 * `eventId` as the `trackPixelEvent("Purchase", ..., { eventID })` call for
 * this same order so Meta dedupes the two instead of double-counting.
 * `_fbp`/`_fbc` (set by the base pixel script/an ad click landing) are read
 * here rather than threaded in by each call site, for the same reason the
 * pixel ID itself isn't threaded through `trackPixelEvent`'s call sites.
 */
export function sendCapiPurchase(params: {
  eventId: string;
  contentIds: (string | number)[];
  value: number;
  currency: string;
  phone?: string;
  firstName?: string;
}): void {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({
    ...params,
    eventSourceUrl: window.location.href,
    fbp: readCookie("_fbp"),
    fbc: readCookie("_fbc"),
  });
  // `keepalive` lets this survive a page navigation right after (e.g. the
  // WhatsApp handoff some of these success paths open immediately after).
  fetch("/api/meta-capi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Network failure — nothing to do; this must never surface to the
    // customer-facing order flow that called it.
  });
}

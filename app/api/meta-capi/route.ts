// Server-side Meta Conversions API (CAPI) relay — the server half of the
// Pixel/CAPI pair. Recovers events the browser Pixel never gets to send at
// all (ad-blockers, Safari ITP, iOS), which no client-side fix can close.
//
// Called fire-and-forget from lib/meta-pixel.ts alongside the matching
// `fbq('track', ...)` call — never instead of it — with the SAME event id,
// so Meta dedupes the pair instead of double-counting. Two events are
// wired: `Purchase` and `ViewContent`.
//
// WHY THE BROWSER ONLY SENDS AN ORDER ID FOR PURCHASE
// ---------------------------------------------------
// Orders are created with the CLIENT Firebase SDK (lib/firebase.ts
// `saveOrder`), so there is no server-side order-creation hook to hang
// Purchase off. Instead the browser posts nothing but `orderId`, and this
// route re-reads that order from Firestore with the Admin SDK and builds
// value/contents/user_data from the STORED document. Two consequences,
// both deliberate:
//   1. A Purchase can only be sent for an order that genuinely exists in
//      Firestore — this endpoint cannot be used to inject fake conversions
//      at an arbitrary value, which the previous client-supplied-`value`
//      version allowed to anyone with curl.
//   2. Purchase CAPI therefore requires FIREBASE_SERVICE_ACCOUNT_KEY as
//      well as META_CAPI_ACCESS_TOKEN. Without Admin credentials this
//      route cannot verify the order, and correctly sends nothing.
//
// Every failure path returns 200 `{ skipped: true }`. This endpoint's own
// problems must NEVER surface to the customer-facing order flow, which
// calls it fire-and-forget after the order is already saved.
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { buildUserData, sendMetaEvent, type MetaUserIdentifiers } from "@/lib/meta-capi";

export const dynamic = "force-dynamic";

const CURRENCY = "DZD";
// A stalled claim (serverless function killed mid-flight) must not lock an
// order out of ever sending. After this window the claim can be retaken.
const CLAIM_STALE_MS = 5 * 60 * 1000;
const MAX_CONTENT_IDS = 50;

type Body = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Identifiers every event carries regardless of type. */
function baseIdentifiers(req: NextRequest, body: Body): MetaUserIdentifiers {
  return {
    externalId: str(body.externalId),
    fbp: str(body.fbp),
    fbc: str(body.fbc),
    clientIpAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    clientUserAgent: req.headers.get("user-agent") ?? undefined,
  };
}

export async function POST(req: NextRequest) {
  // Bail out before touching Firestore. Without CAPI credentials nothing
  // can be sent, so claiming the order and stamping `meta.purchaseError`
  // on it would be pure write amplification against every order placed.
  if (!process.env.META_CAPI_ACCESS_TOKEN || !process.env.NEXT_PUBLIC_META_PIXEL_ID) {
    return NextResponse.json({ skipped: true, reason: "not_configured" });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ skipped: true });
  }

  const eventName = str(body.event);
  const eventSourceUrl = str(body.eventSourceUrl);

  if (eventName === "Purchase") return handlePurchase(req, body, eventSourceUrl);
  if (eventName === "ViewContent") return handleViewContent(req, body, eventSourceUrl);
  return NextResponse.json({ skipped: true });
}

// ---------------------------------------------------------------------------
// Purchase — Firestore-verified, idempotent
// ---------------------------------------------------------------------------

type OrderItem = { id?: unknown; price?: unknown; qty?: unknown };

async function handlePurchase(req: NextRequest, body: Body, eventSourceUrl: string | undefined) {
  const orderId = str(body.orderId);
  if (!orderId) return NextResponse.json({ skipped: true });

  const adb = getAdminDb();
  // No Admin credentials -> cannot verify the order exists, so send
  // nothing. Sending an unverified Purchase would be worse than sending
  // none: it would put unauditable values into ad optimization.
  if (!adb) return NextResponse.json({ skipped: true, reason: "no_admin_db" });

  // The event id is derived from the real Firestore order id, never
  // random — the browser builds the identical string, and a retry for the
  // same order therefore reuses the same id instead of minting a second
  // Purchase. See lib/meta-pixel.ts `purchaseEventId`.
  const eventId = `purchase_${orderId}`;
  const ref = adb.collection("orders").doc(orderId);

  // Claim the send inside a transaction so two concurrent calls for the
  // same order (double submit, a retried fetch) can never both proceed.
  let order: Record<string, unknown>;
  try {
    const claim = await adb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { ok: false as const, reason: "order_not_found" };
      const data = snap.data() as Record<string, unknown>;
      const meta = (data.meta ?? {}) as Record<string, unknown>;

      if (meta.purchaseSent === true) return { ok: false as const, reason: "already_sent" };
      const claimedAt = typeof meta.purchaseClaimedAt === "number" ? meta.purchaseClaimedAt : 0;
      if (meta.purchaseInFlight === true && Date.now() - claimedAt < CLAIM_STALE_MS) {
        return { ok: false as const, reason: "in_flight" };
      }

      // Dot paths, not a nested object — a merge write with a nested map
      // would replace the whole `meta` map and clobber sibling fields.
      tx.update(ref, {
        "meta.purchaseEventId": eventId,
        "meta.purchaseInFlight": true,
        "meta.purchaseClaimedAt": Date.now(),
      });
      return { ok: true as const, data };
    });

    if (!claim.ok) return NextResponse.json({ skipped: true, reason: claim.reason });
    order = claim.data;
  } catch (e) {
    console.error("[DS] meta-capi purchase claim", e instanceof Error ? e.message : e);
    return NextResponse.json({ skipped: true });
  }

  // --- Build the event from the STORED order, never from the request ---
  const items = Array.isArray(order.items) ? (order.items as OrderItem[]) : [];
  const contents = items
    .map((i) => ({
      id: String(i?.id ?? ""),
      quantity: Number(i?.qty) || 1,
      item_price: Number(i?.price) || 0,
    }))
    .filter((c) => c.id);
  const contentIds = contents.map((c) => c.id);
  const numItems = contents.reduce((n, c) => n + c.quantity, 0);
  // `total` is this schema's order value (subtotal + delivery fee) and is
  // exactly what the browser Pixel reports, so the two dedupe cleanly.
  const value = Number(order.total) || 0;

  const customer = typeof order.customer === "string" ? order.customer.trim() : "";
  const nameParts = customer.split(/\s+/).filter(Boolean);
  const identifiers: MetaUserIdentifiers = {
    ...baseIdentifiers(req, body),
    phone: typeof order.phone === "string" ? order.phone : undefined,
    firstName: nameParts[0],
    lastName: nameParts.length > 1 ? nameParts[nameParts.length - 1] : undefined,
    // Latin-script fields where the schema has them — Meta matches Latin
    // place names, so `wilayaFr`/`communeFr` beat the Arabic equivalents.
    city:
      (typeof order.communeFr === "string" && order.communeFr) ||
      (typeof order.baladiya === "string" ? order.baladiya : undefined) ||
      undefined,
    state:
      (typeof order.wilayaFr === "string" && order.wilayaFr) ||
      (typeof order.wilaya === "string" ? order.wilaya : undefined) ||
      undefined,
    country: "dz",
  };

  const result = await sendMetaEvent({
    event_name: "Purchase",
    event_id: eventId,
    event_source_url: eventSourceUrl,
    action_source: "website",
    user_data: buildUserData(identifiers),
    custom_data: {
      currency: CURRENCY,
      value,
      content_type: "product",
      content_ids: contentIds,
      contents,
      num_items: numItems,
      // Human-facing order number (`DS-1234`) where present, else the
      // Firestore id — this is what shows up in Events Manager, so it
      // should be the number the shop actually refers to an order by.
      order_id: typeof order.num === "string" && order.num ? order.num : orderId,
    },
  });

  // Release the claim and record the outcome. A failed send clears
  // `purchaseInFlight` so a genuine retry can still get through, while
  // `purchaseSent: true` permanently blocks a duplicate.
  try {
    await ref.update({
      "meta.purchaseInFlight": false,
      "meta.purchaseSent": result.sent,
      ...(result.sent
        ? { "meta.purchaseSentAt": Date.now() }
        : { "meta.purchaseError": result.reason ?? "unknown" }),
    });
  } catch (e) {
    console.error("[DS] meta-capi purchase flag", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ ok: result.sent });
}

// ---------------------------------------------------------------------------
// ViewContent — no order to verify against
// ---------------------------------------------------------------------------

async function handleViewContent(req: NextRequest, body: Body, eventSourceUrl: string | undefined) {
  const eventId = str(body.eventId);
  if (!eventId) return NextResponse.json({ skipped: true });

  // ViewContent has no Firestore record to check against (landing-page
  // products are defined in code, not Firestore), so its payload is
  // client-supplied and gets validated/clamped instead. It is not a
  // conversion event and carries no purchase value, so the injection
  // exposure Purchase had does not apply here — but the bounds still keep
  // a malformed or hostile body from reaching the Graph API.
  const rawIds = Array.isArray(body.contentIds) ? body.contentIds : [];
  const contentIds = rawIds
    .filter((x): x is string | number => typeof x === "string" || typeof x === "number")
    .map((x) => String(x).slice(0, 100))
    .filter(Boolean)
    .slice(0, MAX_CONTENT_IDS);
  if (!contentIds.length) return NextResponse.json({ skipped: true });

  const rawValue = Number(body.value);
  const value = Number.isFinite(rawValue) && rawValue >= 0 ? rawValue : 0;
  const contentName = str(body.contentName)?.slice(0, 200);

  const result = await sendMetaEvent({
    event_name: "ViewContent",
    event_id: eventId,
    event_source_url: eventSourceUrl,
    action_source: "website",
    user_data: buildUserData(baseIdentifiers(req, body)),
    custom_data: {
      currency: CURRENCY,
      value,
      content_type: "product",
      content_ids: contentIds,
      contents: contentIds.map((id) => ({ id, quantity: 1 })),
      ...(contentName ? { content_name: contentName } : {}),
    },
  });

  return NextResponse.json({ ok: result.sent });
}

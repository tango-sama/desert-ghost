// Pure "في المحل" (in-closet) stock derivation — shared by the admin
// Storage Counter tab (components/admin/views/storage-counter-view.tsx,
// reading the client's already-loaded, admin-only `orders` store slice) and
// the storefront's `/api/storage-closet` route (lib/firebase-admin.ts,
// reading `orders` server-side with the Admin SDK). Kept here, with no
// Firebase imports of any kind, so both call sites compute the exact same
// number from the exact same math and can never drift apart.
//
// `products.stock` (admin-entered total-ever-stocked) minus units already
// out the door: "في المحل" = stock - sending - delivered - returned,
// clamped at 0. See context/architecture-context.md.

const TRACK_ICONS_LEN = 5; // fallback when a tracked order has no stageLabels yet

export type TrackingStatus = {
  stage?: number | null;
  stageLabels?: string[];
  alert?: string;
};

export type OrderItem = {
  id?: string | number;
  qty?: number;
  quantity?: number;
};

export type OrderLike = {
  items?: OrderItem[];
  trackingStatus?: TrackingStatus | null;
};

export type Stats = { sending: number; delivered: number; returned: number };

export const EMPTY_STATS: Stats = { sending: 0, delivered: 0, returned: 0 };

export function itemQty(it: OrderItem): number {
  return it.qty ?? it.quantity ?? 1;
}

// Same delivered/return derivation orders-view.tsx's stepper uses:
// stage == null → return/cancel; last stage reached with no alert →
// delivered; everything else placed-but-not-yet-resolved → sending.
export function classifyOrder(o: OrderLike): "delivered" | "sending" {
  const ts = o.trackingStatus;
  if (!ts || ts.stage == null) return "sending";
  const lastIdx = (ts.stageLabels?.length ?? TRACK_ICONS_LEN) - 1;
  if (!ts.alert && ts.stage === lastIdx) return "delivered";
  return "sending";
}

// Return tracking doesn't exist yet (order cards have no "mark as failed
// delivery" flag) — every product's `returned` stays 0 until that future
// feature lands and this can read a real signal off each order.
export function statsByProduct(orders: OrderLike[]): Record<string, Stats> {
  const m: Record<string, Stats> = {};
  for (const o of orders) {
    const bucket = classifyOrder(o);
    for (const it of o.items ?? []) {
      const id = String(it.id ?? "");
      if (!id) continue;
      if (!m[id]) m[id] = { sending: 0, delivered: 0, returned: 0 };
      m[id][bucket] += itemQty(it);
    }
  }
  return m;
}

export function closetFor(stock: number, stats: Stats): number {
  return Math.max(0, stock - stats.sending - stats.delivered - stats.returned);
}

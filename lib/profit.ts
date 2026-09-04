// Profit math for Desert Shop — the numbers the growth dashboard and the AI
// analyst both reason about.
//
// Pure functions only: no Firestore, no fetch, no `window`. Everything is
// passed in. That keeps this usable from the admin UI, from a Next.js route
// handler, and (once Phase 2 lands) from a Cloud Function, without three
// copies of the same arithmetic drifting apart.
//
// THE COD REALITY THIS ENCODES
// ----------------------------
// In a cash-on-delivery shop an "order" is not revenue. A customer can decline
// the confirmation call, or refuse the parcel at the door weeks later. Revenue
// is only real once the parcel is DELIVERED, while the delivery cost of a
// returned parcel is very much real. So:
//
//   - a delivered order earns its margin
//   - a returned order earns nothing and still costs the delivery fee
//   - an in-flight order counts as neither; it is pending, not profit
//
// Reporting gross order value as revenue is the single most common way an
// Algerian COD store convinces itself an unprofitable campaign is working.
import { priceNum, type Product } from "@/lib/firebase";
import type { Order, OrderItem } from "@/lib/admin";

/**
 * Fraction of an item's selling price that the goods themselves cost.
 * Owner-supplied: Desert Shop buys at roughly 65% of its retail price, i.e.
 * a 35% gross margin. Overridable globally via `site_settings.cogsRate`, and
 * per product via `product.cost` (an absolute dinar amount, not a rate).
 */
export const DEFAULT_COGS_RATE = 0.65;

export type ProfitInputs = {
  /** Global fallback rate, from site_settings.cogsRate. */
  cogsRate?: number;
  /** Real per-unit costs by product id, where known. Wins over the rate. */
  costByProduct?: Record<string, number>;
};

/** Order lifecycle as normalized from carrier tracking (see functions/index.js). */
export type OrderOutcome =
  | "new"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "returned"
  | "cancelled";

function rateOf(inputs: ProfitInputs | undefined): number {
  const r = inputs?.cogsRate;
  // A nonsensical configured rate (negative, >=1, NaN) would silently invert
  // every margin in the dashboard, so fall back rather than trust it.
  return typeof r === "number" && r >= 0 && r < 1 ? r : DEFAULT_COGS_RATE;
}

function qtyOf(item: OrderItem): number {
  const q = item.qty ?? item.quantity ?? 1;
  return typeof q === "number" && q > 0 ? q : 1;
}

/** Per-unit cost of one order line: a real cost if we have one, else the rate. */
export function itemUnitCost(item: OrderItem, inputs?: ProfitInputs): number {
  const id = item.id != null ? String(item.id) : "";
  const known = id ? inputs?.costByProduct?.[id] : undefined;
  if (typeof known === "number" && known >= 0) return known;
  return Math.round(priceNum(item.price) * rateOf(inputs));
}

/** Per-unit cost of a catalog product — same rule, for stock/margin views. */
export function productUnitCost(product: Product, inputs?: ProfitInputs): number {
  const known = product.cost;
  if (typeof known === "number" && known >= 0) return known;
  return Math.round(priceNum(product.price) * rateOf(inputs));
}

/**
 * What the customer pays for goods, excluding delivery.
 *
 * Prefers `parcelPrice` — the final amount actually collected by the carrier,
 * which the admin can override when a price was renegotiated on the phone —
 * and falls back to the order's own total, mirroring the existing income view
 * in components/admin/views/income-view.tsx.
 */
export function orderRevenue(order: Order): number {
  const gross =
    order.parcelPrice != null
      ? Number(order.parcelPrice)
      : order.total != null
        ? Number(order.total)
        : Number(order.subtotal ?? 0);
  const fee = Number(order.deliveryFee) || 0;
  const net = (Number.isFinite(gross) ? gross : 0) - fee;
  return net > 0 ? net : 0;
}

/** Cost of the goods in an order. */
export function orderCogs(order: Order, inputs?: ProfitInputs): number {
  const items = order.items ?? [];
  if (!items.length) return Math.round(orderRevenue(order) * rateOf(inputs));
  return items.reduce((sum, it) => sum + itemUnitCost(it, inputs) * qtyOf(it), 0);
}

/** Revenue minus cost of goods. Ignores delivery and advertising. */
export function orderGrossMargin(order: Order, inputs?: ProfitInputs): number {
  return orderRevenue(order) - orderCogs(order, inputs);
}

/**
 * What an order is actually worth to the business right now, by outcome.
 *
 * Delivered: its margin. Returned: minus the delivery fee we ate to send a
 * parcel that came back. Anything still moving: zero — not a loss, just not
 * money yet. Ad spend is NOT subtracted here; it is per-campaign, not
 * per-order, and is applied at the rollup level.
 */
export function orderNetProfit(order: Order, inputs?: ProfitInputs): number {
  switch (orderOutcome(order)) {
    case "delivered":
      return orderGrossMargin(order, inputs);
    case "returned":
      return -(Number(order.deliveryFee) || 0);
    default:
      return 0;
  }
}

/**
 * Best available lifecycle state for an order.
 *
 * Reads the canonical `outcome` field written server-side by the carrier
 * webhooks. Older orders predate that field, so fall back to the signals that
 * have always existed — a created parcel means confirmed, `fulfilled` means at
 * least confirmed — rather than mislabelling historic orders as `new`.
 */
export function orderOutcome(order: Order): OrderOutcome {
  const stored = order.outcome;
  if (typeof stored === "string") return stored as OrderOutcome;
  const hasParcel = Boolean(
    order.yalidine?.tracking || order.noest?.tracking || order.zr?.tracking,
  );
  if (hasParcel || order.fulfilled) return "confirmed";
  return "new";
}

export type Totals = {
  orders: number;
  confirmed: number;
  delivered: number;
  returned: number;
  revenue: number;
  cogs: number;
  grossMargin: number;
  adSpend: number;
  netProfit: number;
  /** Confirmed / total orders — how many survive the confirmation call. */
  confirmRate: number | null;
  /** Delivered / confirmed — how many confirmed parcels actually arrive. */
  deliveryRate: number | null;
  /** Ad spend per delivered order. The number that decides if a campaign lives. */
  cac: number | null;
  /** Revenue / ad spend. The vanity metric; kept because everyone asks for it. */
  roas: number | null;
  /** Net profit / ad spend. The one that actually matters. */
  profitRoas: number | null;
};

/**
 * Roll a set of orders up into the headline numbers, optionally against the
 * ad spend that produced them (in dinars — convert before calling; Meta bills
 * this account in EUR).
 *
 * `delivered` and `returned` are terminal states, so rates are computed over
 * them rather than over everything still in flight.
 */
export function summarize(
  orders: Order[],
  inputs?: ProfitInputs,
  adSpend = 0,
): Totals {
  let confirmed = 0;
  let delivered = 0;
  let returned = 0;
  let revenue = 0;
  let cogs = 0;
  let netProfit = 0;

  for (const o of orders) {
    const outcome = orderOutcome(o);
    // Confirmed counts everything that got past the confirmation call,
    // including orders that have since shipped, delivered or come back.
    if (outcome !== "new" && outcome !== "cancelled") confirmed++;
    if (outcome === "delivered") {
      delivered++;
      revenue += orderRevenue(o);
      cogs += orderCogs(o, inputs);
    }
    if (outcome === "returned") returned++;
    netProfit += orderNetProfit(o, inputs);
  }

  netProfit -= adSpend;
  const grossMargin = revenue - cogs;
  const terminal = delivered + returned;

  return {
    orders: orders.length,
    confirmed,
    delivered,
    returned,
    revenue,
    cogs,
    grossMargin,
    adSpend,
    netProfit,
    confirmRate: orders.length ? confirmed / orders.length : null,
    deliveryRate: terminal ? delivered / terminal : null,
    cac: adSpend > 0 && delivered > 0 ? adSpend / delivered : null,
    roas: adSpend > 0 ? revenue / adSpend : null,
    profitRoas: adSpend > 0 ? netProfit / adSpend : null,
  };
}

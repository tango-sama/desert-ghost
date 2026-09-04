// Ad spend, and the join that turns it into profit per campaign.
//
// Spend rows are written by the `syncMetaInsights` Cloud Function (in the
// trinkl repo, which owns the Functions) into
// `marketing/meta/insights/{date}_{adId}`, one row per ad per day. They are
// admin-read-only and never client-writable — see firestore.rules.
//
// This module is the read side plus the arithmetic that connects the two
// halves of the business: what an ad cost, and what the orders it produced
// were actually worth. The profit math itself lives in lib/profit.ts and is
// reused here rather than restated.
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { summarize, type ProfitInputs, type Totals } from "@/lib/profit";
import { orderStamp, type Order } from "@/lib/admin";

/** One ad's spend and delivery for one day, as stored by the sync. */
export type Insight = {
  id: string;
  date: string; // YYYY-MM-DD
  adId: string;
  adName?: string;
  adsetId?: string;
  adsetName?: string;
  campaignId?: string;
  campaignName?: string;
  spendEur: number;
  /** Converted at sync time, at the `rate` stored alongside it. */
  spendDzd: number;
  rate?: number;
  impressions?: number;
  clicks?: number;
  /** Meta's own purchase count — NOT ours. Kept for comparison, never for profit. */
  purchases?: number;
};

function ymd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Read spend rows from `since` (inclusive, YYYY-MM-DD) onward. */
export async function getInsights(since: string): Promise<Insight[]> {
  try {
    const snap = await getDocs(
      query(collection(db, "marketing", "meta", "insights"), where("date", ">=", since)),
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Insight, "id">) }));
  } catch (e) {
    // Same rule the rest of the data layer follows: a failed read renders an
    // empty dashboard, it does not break the admin panel.
    console.error("[DS] getInsights", e);
    return [];
  }
}

// --------------------------------------------------------------------------
// Joining orders to the ads that produced them
// --------------------------------------------------------------------------

type Attr = { campaignId?: string; adId?: string; adsetId?: string };

function attrOf(order: Order): Attr {
  const a = (order.attribution ?? {}) as Attr;
  return a || {};
}

/** The ad an order came from, if its landing URL carried one. */
export function orderAdId(order: Order): string | undefined {
  return attrOf(order).adId || undefined;
}

/** The campaign an order came from. */
export function orderCampaignId(order: Order): string | undefined {
  return attrOf(order).campaignId || undefined;
}

export type Group = {
  key: string;
  /** Campaign or ad name, from whichever spend row we have for it. */
  name: string;
  campaignId?: string;
  spendDzd: number;
  spendEur: number;
  impressions: number;
  clicks: number;
  totals: Totals;
  /**
   * Orders in this cohort that have not reached a terminal state yet.
   *
   * The number that stops a healthy campaign from looking like a disaster:
   * a cohort measured three days after the spend has barely any delivered
   * orders yet, so its profit reads deeply negative. Surfacing this lets the
   * UI say "still maturing" instead of "losing money".
   */
  inFlight: number;
};

/**
 * Group spend and orders together by campaign (or by ad).
 *
 * ORDER-DATE COHORT. Spend on a day is judged against the orders placed that
 * same day, followed through to whatever those orders eventually became. This
 * is what measures the ad: money spent on Tuesday is answerable for the orders
 * Tuesday produced, not for cash that happened to land on Tuesday from a
 * fortnight-old campaign.
 *
 * `allowed`, when given, is the campaign allowlist — spend outside it is
 * excluded here and reported separately by `unallocatedSpend()` rather than
 * silently dropped.
 */
export function groupByCampaign(
  orders: Order[],
  insights: Insight[],
  opts: {
    profit?: ProfitInputs;
    allowed?: Set<string>;
    /** Group by individual ad rather than by campaign. */
    byAd?: boolean;
  } = {},
): Group[] {
  const { profit, allowed, byAd } = opts;
  const keyOfInsight = (i: Insight) => (byAd ? i.adId : i.campaignId || i.adId);
  const keyOfOrder = (o: Order) =>
    byAd ? orderAdId(o) : orderCampaignId(o) || orderAdId(o);

  const groups = new Map<string, Group>();
  const ensure = (key: string, name: string, campaignId?: string): Group => {
    let g = groups.get(key);
    if (!g) {
      g = {
        key, name, campaignId,
        spendDzd: 0, spendEur: 0, impressions: 0, clicks: 0,
        totals: summarize([], profit, 0), inFlight: 0,
      };
      groups.set(key, g);
    }
    // A later row may carry the name when an earlier one didn't.
    if (!g.name && name) g.name = name;
    return g;
  };

  for (const i of insights) {
    const key = keyOfInsight(i);
    if (!key) continue;
    if (allowed && !allowed.has(i.campaignId || "")) continue;
    const g = ensure(key, (byAd ? i.adName : i.campaignName) || "", i.campaignId);
    g.spendDzd += i.spendDzd || 0;
    g.spendEur += i.spendEur || 0;
    g.impressions += i.impressions || 0;
    g.clicks += i.clicks || 0;
  }

  // Bucket orders, then summarize each bucket in one pass — summarize() walks
  // the whole list, so calling it per order would be quadratic.
  const buckets = new Map<string, Order[]>();
  for (const o of orders) {
    const key = keyOfOrder(o);
    if (!key) continue;
    const campaign = orderCampaignId(o) || "";
    if (allowed && !allowed.has(campaign)) continue;
    // An order can only be credited to a group we have spend for, or to one
    // its own attribution names — either way `ensure` creates it, so an order
    // whose ad has no spend row still shows up rather than disappearing.
    ensure(key, "", campaign || undefined);
    const list = buckets.get(key);
    if (list) list.push(o);
    else buckets.set(key, [o]);
  }

  for (const [key, list] of buckets) {
    const g = groups.get(key);
    if (!g) continue;
    g.totals = summarize(list, profit, g.spendDzd);
    g.inFlight = list.filter((o) => {
      const s = String(o.outcome ?? "");
      return s !== "delivered" && s !== "returned" && s !== "cancelled";
    }).length;
  }

  // Rebuild totals for groups that have spend but no orders at all, so their
  // spend still counts against profit instead of vanishing.
  for (const g of groups.values()) {
    if (!buckets.has(g.key)) g.totals = summarize([], profit, g.spendDzd);
  }

  return [...groups.values()].sort((a, b) => b.spendDzd - a.spendDzd);
}

/**
 * Spend in the account that no ticked campaign accounts for.
 *
 * The allowlist's one real hazard is a Desert Shop campaign the owner forgot
 * to tick: its spend would quietly leave the profit numbers and make every
 * other campaign look better than it is. Reporting the excluded total makes
 * that impossible to miss.
 */
export function unallocatedSpend(
  insights: Insight[],
  allowed: Set<string> | undefined,
): { dzd: number; campaigns: { id: string; name: string; dzd: number }[] } {
  if (!allowed) return { dzd: 0, campaigns: [] };
  const byCampaign = new Map<string, { id: string; name: string; dzd: number }>();
  let dzd = 0;
  for (const i of insights) {
    const cid = i.campaignId || "";
    if (allowed.has(cid)) continue;
    dzd += i.spendDzd || 0;
    const row = byCampaign.get(cid) ?? { id: cid, name: i.campaignName || "—", dzd: 0 };
    row.dzd += i.spendDzd || 0;
    byCampaign.set(cid, row);
  }
  return { dzd, campaigns: [...byCampaign.values()].sort((a, b) => b.dzd - a.dzd) };
}

/**
 * Cash actually collected in a period, by DELIVERY date.
 *
 * The other half of "both side by side": this ignores which ad produced what
 * and answers the bookkeeping question — what money landed this month. An
 * order counts on the day it was marked delivered, which is when the cash
 * genuinely arrived, not the day it was ordered.
 */
export function cashInPeriod(
  orders: Order[],
  sinceMs: number,
  profit?: ProfitInputs,
): Totals {
  const delivered = orders.filter((o) => {
    if (String(o.outcome ?? "") !== "delivered") return false;
    // `outcomeAt` is when the carrier reported delivery; fall back to the
    // order's own date for pre-Phase-1 orders that never got a stamp.
    const at = Number(o.outcomeAt) || orderStamp(o);
    return at >= sinceMs;
  });
  return summarize(delivered, profit, 0);
}

/** Spend inside a window, for pairing with `cashInPeriod`. */
export function spendInPeriod(
  insights: Insight[],
  sinceMs: number,
  allowed?: Set<string>,
): number {
  const since = ymd(sinceMs);
  return insights.reduce((sum, i) => {
    if (i.date < since) return sum;
    if (allowed && !allowed.has(i.campaignId || "")) return sum;
    return sum + (i.spendDzd || 0);
  }, 0);
}

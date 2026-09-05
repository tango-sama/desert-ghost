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
import { collection, getDocs, limit, query, where } from "firebase/firestore";
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

// --------------------------------------------------------------------------
// Funnel events
// --------------------------------------------------------------------------

/** One recorded step of one visitor's walk through a funnel. */
export type FunnelEventDoc = {
  id: string;
  funnel: string;
  step: string;
  sessionId: string;
  ts: number;
  variant?: string | null;
  stepIndex?: number | null;
  answers?: Record<string, string> | null;
  value?: number | null;
  orderId?: string | null;
  campaignId?: string | null;
  channel?: string | null;
};

/** The funnel's stages, in order. Mirrors the vocabulary the API route accepts. */
export const FUNNEL_STEPS = ["view", "start", "answer", "result", "offer", "checkout", "order"] as const;

export async function getFunnelEvents(
  funnel: string,
  sinceMs: number,
  max = 5000,
): Promise<FunnelEventDoc[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, "funnels", funnel, "events"),
        where("ts", ">=", sinceMs),
        limit(max),
      ),
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FunnelEventDoc, "id">) }));
  } catch (e) {
    console.error("[DS] getFunnelEvents", e);
    return [];
  }
}

export type StepStat = { step: string; sessions: number; pctOfTop: number };

/**
 * How many distinct visitors reached each stage.
 *
 * Counted by SESSION, not by event: a visitor who answers five questions fires
 * five `answer` events, and counting those would make the middle of the funnel
 * look five times wider than the top. Percentages are against the first stage
 * that anyone actually reached, so a funnel whose `view` events are missing
 * still reports usable ratios instead of dividing by zero.
 */
export function funnelSteps(events: FunnelEventDoc[]): StepStat[] {
  const bySt = new Map<string, Set<string>>();
  for (const e of events) {
    if (!e.step || !e.sessionId) continue;
    const set = bySt.get(e.step) ?? new Set<string>();
    set.add(e.sessionId);
    bySt.set(e.step, set);
  }
  const rows = FUNNEL_STEPS.map((step) => ({
    step,
    sessions: bySt.get(step)?.size ?? 0,
  }));
  const top = rows.find((r) => r.sessions > 0)?.sessions ?? 0;
  return rows.map((r) => ({
    ...r,
    pctOfTop: top ? r.sessions / top : 0,
  }));
}

export type VariantStat = {
  variant: string;
  sessions: number;
  orders: number;
  conversion: number | null;
};

/**
 * The A/B result: how many visitors each arm got, and how many ordered.
 *
 * Conversion is orders over sessions that actually entered the funnel, so an
 * arm is never flattered by visitors who never saw it.
 */
export function variantStats(events: FunnelEventDoc[]): VariantStat[] {
  const seen = new Map<string, Set<string>>();
  const ordered = new Map<string, Set<string>>();
  for (const e of events) {
    const v = e.variant || "—";
    if (!e.sessionId) continue;
    const s = seen.get(v) ?? new Set<string>();
    s.add(e.sessionId);
    seen.set(v, s);
    if (e.step === "order") {
      const o = ordered.get(v) ?? new Set<string>();
      o.add(e.sessionId);
      ordered.set(v, o);
    }
  }
  return [...seen.entries()]
    .map(([variant, s]) => {
      const orders = ordered.get(variant)?.size ?? 0;
      return {
        variant,
        sessions: s.size,
        orders,
        conversion: s.size ? orders / s.size : null,
      };
    })
    .sort((a, b) => b.sessions - a.sessions);
}

/** The goal a quiz order was placed under, if it came through the funnel. */
export function orderGoal(order: Order): string | undefined {
  return order.quiz?.goal || undefined;
}

export type GoalStat = {
  goal: string;
  /** Distinct visitors who chose this goal. */
  sessions: number;
  orders: number;
  delivered: number;
  returned: number;
  /** Delivered / (delivered + returned) — over settled orders only. */
  deliveryRate: number | null;
  /**
   * Revenue minus goods minus the freight eaten on returns, with NO ad spend
   * subtracted. Spend is bought per ad, not per answer, so there is no honest
   * way to split it across goals — pretending otherwise would invent a number.
   * Campaign-level net profit lives in the campaign panel, where spend is real.
   */
  margin: number;
  inFlight: number;
};

/**
 * Which goal each visitor picks, and what those visitors were worth.
 *
 * Sessions come from the funnel events; everything downstream of the order
 * comes from the order documents, because only they carry `outcome` and the
 * money. The two are joined on `quiz.goal`, which the quiz order modal stamps
 * onto every order it creates.
 */
export function goalStats(
  events: FunnelEventDoc[],
  // Required, not defaulted: order counts come from the order DOCUMENTS, not
  // from `order` funnel events, because only the documents carry the outcome
  // and the money — and a beacon lost on page-unload would undercount. A
  // default of [] would let a one-argument call silently report zero orders
  // for every goal, which reads as "nothing converts" rather than as a bug.
  orders: Order[],
  profit?: ProfitInputs,
): GoalStat[] {
  // One goal per visitor — the last one recorded, since she can go back and
  // change her answer, and the events are append-only.
  const goalOf = new Map<string, string>();
  for (const e of events) {
    const g = e.answers?.goal;
    if (g && e.sessionId) goalOf.set(e.sessionId, g);
  }

  const sessions = new Map<string, number>();
  for (const goal of goalOf.values()) sessions.set(goal, (sessions.get(goal) ?? 0) + 1);

  const byGoal = new Map<string, Order[]>();
  for (const o of orders) {
    const g = orderGoal(o);
    if (!g) continue;
    const list = byGoal.get(g);
    if (list) list.push(o);
    else byGoal.set(g, [o]);
  }

  const goals = new Set<string>([...sessions.keys(), ...byGoal.keys()]);
  return [...goals]
    .map((goal) => {
      const list = byGoal.get(goal) ?? [];
      const t = summarize(list, profit, 0);
      return {
        goal,
        sessions: sessions.get(goal) ?? 0,
        orders: t.orders,
        delivered: t.delivered,
        returned: t.returned,
        deliveryRate: t.deliveryRate,
        margin: t.netProfit,
        inFlight: t.orders - t.delivered - t.returned,
      };
    })
    .sort((a, b) => b.sessions - a.sessions || b.orders - a.orders);
}

export type CampaignGoalRow = {
  campaignId: string;
  campaignName: string;
  goal: string;
  sessions: number;
  orders: number;
  delivered: number;
  deliveryRate: number | null;
  margin: number;
  /**
   * Margin divided by visitors — the number that actually discriminates here.
   *
   * `margin` alone barely moves: the only cost a failed order carries is its
   * delivery fee, so one delivered sale (≈5,075 DA on a 14,500 DA product)
   * outweighs five refused parcels (≈600 DA each) and the total stays positive
   * even at a dreadful delivery rate. Per visitor is the comparable unit —
   * it sits in the same currency as what a visitor costs to buy, so a row
   * earning less per visitor than the ad pays for one is losing money.
   */
  marginPerVisitor: number | null;
};

/**
 * The cross-tab: which goal each campaign actually brings, and what those
 * visitors are worth once delivery is accounted for.
 *
 * This is the view that turns "the quiz is collecting answers" into something
 * you can act on — an ad whose visitors overwhelmingly want a product line
 * that rarely gets delivered is losing money no matter how cheap its clicks
 * are, and nothing else on this page would show that.
 *
 * Sessions are attributed by the campaign stamped on the funnel event; orders
 * by the campaign stamped on the order (lib/attribution.ts). Both come from
 * the same capture, so they agree.
 */
export function goalsByCampaign(
  events: FunnelEventDoc[],
  orders: Order[],
  opts: {
    profit?: ProfitInputs;
    allowed?: Set<string>;
    /** Campaign id → display name, from the spend rows. */
    names?: Map<string, string>;
  } = {},
): CampaignGoalRow[] {
  const { profit, allowed, names } = opts;

  // Resolve each visitor's goal and campaign once. A visitor's campaign is
  // whichever one her events carry; unattributed visitors are grouped under a
  // blank id rather than dropped, so the totals still add up.
  const goalOf = new Map<string, string>();
  const campaignOf = new Map<string, string>();
  for (const e of events) {
    if (!e.sessionId) continue;
    if (e.answers?.goal) goalOf.set(e.sessionId, e.answers.goal);
    if (e.campaignId) campaignOf.set(e.sessionId, e.campaignId);
  }

  const key = (c: string, g: string) => `${c}\u0000${g}`;
  const sessions = new Map<string, number>();
  for (const [session, goal] of goalOf) {
    const campaign = campaignOf.get(session) ?? "";
    if (allowed && campaign && !allowed.has(campaign)) continue;
    const k = key(campaign, goal);
    sessions.set(k, (sessions.get(k) ?? 0) + 1);
  }

  const ordersByKey = new Map<string, Order[]>();
  for (const o of orders) {
    const goal = orderGoal(o);
    if (!goal) continue;
    const campaign = orderCampaignId(o) ?? "";
    if (allowed && campaign && !allowed.has(campaign)) continue;
    const k = key(campaign, goal);
    const list = ordersByKey.get(k);
    if (list) list.push(o);
    else ordersByKey.set(k, [o]);
  }

  const keys = new Set<string>([...sessions.keys(), ...ordersByKey.keys()]);
  return [...keys]
    .map((k) => {
      const [campaignId, goal] = k.split("\u0000");
      const list = ordersByKey.get(k) ?? [];
      const t = summarize(list, profit, 0);
      const visitors = sessions.get(k) ?? 0;
      return {
        campaignId,
        campaignName: names?.get(campaignId) || (campaignId ? campaignId : "غير منسوب"),
        goal,
        sessions: visitors,
        orders: t.orders,
        delivered: t.delivered,
        deliveryRate: t.deliveryRate,
        margin: t.netProfit,
        marginPerVisitor: visitors ? t.netProfit / visitors : null,
      };
    })
    // Ordered by margin per visitor, not by raw margin: a campaign that simply
    // sent more traffic would otherwise always look best.
    .sort(
      (a, b) =>
        (b.marginPerVisitor ?? -Infinity) - (a.marginPerVisitor ?? -Infinity) ||
        b.sessions - a.sessions ||
        a.goal.localeCompare(b.goal),
    );
}

/** Campaign id → name, taken from whichever spend rows carry it. */
export function campaignNames(insights: Insight[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const i of insights) {
    if (i.campaignId && i.campaignName && !m.has(i.campaignId)) {
      m.set(i.campaignId, i.campaignName);
    }
  }
  return m;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { priceFmt, type Product } from "@/lib/firebase";
import { orderStamp, type Order } from "@/lib/admin";
import { useAdminStore } from "@/stores/admin-store";
import {
  getInsights,
  getFunnelEvents,
  groupByCampaign,
  unallocatedSpend,
  cashInPeriod,
  spendInPeriod,
  funnelSteps,
  variantStats,
  goalStats,
  goalsByCampaign,
  campaignNames,
  type Insight,
  type Group,
  type FunnelEventDoc,
} from "@/lib/marketing";
import { DEFAULT_COGS_RATE, type ProfitInputs, type Totals } from "@/lib/profit";
import { cn } from "@/lib/utils";
import { cardCls, cardH3, btn, EmptyState, tblWrap, thCls, tdCls } from "@/components/admin/ui";

// The growth dashboard: ad spend on one side, what the orders it produced were
// actually worth on the other.
//
// Two panels, because in cash-on-delivery those are genuinely different
// questions and answering only one of them misleads:
//
//   1. أداء الحملات — cohort by ORDER date. Spend on a day is judged against
//      the orders that day produced, followed to whatever they became. This
//      measures the ad. A recent cohort is mostly undelivered, so it is badged
//      "قيد النضج" rather than being read as a loss.
//   2. الصندوق — by DELIVERY date. What money actually landed. This is the
//      bookkeeping answer and matches the income ledger's view of the world.
//
// All arithmetic comes from lib/profit.ts and lib/marketing.ts; this file only
// chooses a window, renders, and stays out of the way.

const RANGES = [
  { key: "7", label: "7 أيام", days: 7 },
  { key: "30", label: "30 يوماً", days: 30 },
  { key: "90", label: "90 يوماً", days: 90 },
] as const;

function pct(v: number | null): string {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}
function ratio(v: number | null): string {
  return v == null ? "—" : v.toFixed(2);
}
function money(v: number | null): string {
  return v == null ? "—" : priceFmt(Math.round(v));
}

function StatCard({
  title, value, color, sub,
}: { title: string; value: string; color?: string; sub?: string }) {
  return (
    <div className={cn(cardCls, "m-0 mb-0 text-center")}>
      <div className="mb-2 text-[.76rem] font-extrabold text-[var(--ink-3)]">{title}</div>
      <div className="num text-[1.45rem] font-black" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[.68rem] text-[var(--ink-3)]">{sub}</div>}
    </div>
  );
}

const EMPTY_INSIGHTS: Insight[] = [];
const EMPTY_EVENTS: FunnelEventDoc[] = [];

// Arabic labels for the funnel's stored codes. Kept here rather than in
// lib/quiz.ts so the storefront bundle never pulls in admin-only strings.
const STEP_LABELS: Record<string, string> = {
  view: "وصلت للصفحة",
  start: "بدأت الأسئلة",
  answer: "أجابت على سؤال",
  result: "شاهدت الاقتراح",
  offer: "فتحت صفحة المنتج",
  checkout: "فتحت نموذج الطلب",
  order: "أتمّت الطلب",
};
const VARIANT_LABELS: Record<string, string> = {
  single: "منتج واحد",
  bundle: "روتين (3 منتجات)",
};
const GOAL_LABELS: Record<string, string> = {
  skin: "البشرة",
  hair: "الشعر",
  slim: "التنحيف",
  gain: "التسمين",
  curves: "تكبير الصدر/المؤخرة",
  hormones: "الهرمونات",
  vitality: "الطاقة والصحة",
};

const GOOD = "#22c55e";
const BAD = "#ef4444";

export function GrowthView() {
  const orders = useAdminStore((s) => s.orders);
  const products = useAdminStore((s) => s.products);
  const settings = useAdminStore((s) => s.settings);

  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]["key"]>("30");
  const [byAd, setByAd] = useState(false);
  // Rows, the window they were fetched for, and the clock reading that
  // defined it — all in one state object written only from the async
  // callback. The window is computed inside the effect rather than during
  // render because reading the clock while rendering is impure: it would make
  // every memo below recompute on an unrelated re-render, and the order/spend
  // windows could disagree about where "now" is mid-render.
  const [data, setData] = useState<{
    days: number;
    sinceMs: number;
    rows: Insight[];
    funnel: FunnelEventDoc[];
  } | null>(null);

  const days = RANGES.find((r) => r.key === rangeKey)!.days;

  useEffect(() => {
    let alive = true;
    const sinceMs = Date.now() - days * 86400000;
    Promise.all([
      getInsights(new Date(sinceMs).toISOString().slice(0, 10)),
      getFunnelEvents("quiz", sinceMs),
    ]).then(([rows, funnel]) => {
      if (alive) setData({ days, sinceMs, rows, funnel });
    });
    return () => {
      alive = false;
    };
  }, [days]);

  // Stale while the newly-picked range is still loading, so the table never
  // shows one range's spend against another's orders.
  const ready = data !== null && data.days === days;
  const insights = ready ? data.rows : EMPTY_INSIGHTS;
  const funnelEvents = ready ? data.funnel : EMPTY_EVENTS;
  const sinceMs = ready ? data.sinceMs : Number.MAX_SAFE_INTEGER;
  const loading = !ready;

  // Real per-product costs where the owner has entered them; the global rate
  // covers everything else (see lib/profit.ts).
  const profitInputs: ProfitInputs = useMemo(() => {
    const costByProduct: Record<string, number> = {};
    for (const p of products as Product[]) {
      if (typeof p.cost === "number" && p.cost >= 0) costByProduct[String(p.id)] = p.cost;
    }
    return {
      cogsRate: Number(settings.cogsRate) || DEFAULT_COGS_RATE,
      costByProduct,
    };
  }, [products, settings.cogsRate]);

  // Undefined (not an empty set) when nothing has been ticked yet: an empty
  // allowlist would exclude everything and show a blank dashboard, which reads
  // as "no data" rather than "you haven't chosen your campaigns".
  const allowed = useMemo(() => {
    const ids = settings.metaCampaignIds;
    return Array.isArray(ids) && ids.length ? new Set(ids.map(String)) : undefined;
  }, [settings.metaCampaignIds]);

  const inRange = useMemo(
    () => (orders as Order[]).filter((o) => orderStamp(o) >= sinceMs),
    [orders, sinceMs],
  );

  const groups = useMemo(
    () => groupByCampaign(inRange, insights, { profit: profitInputs, allowed, byAd }),
    [inRange, insights, profitInputs, allowed, byAd],
  );

  const unalloc = useMemo(() => unallocatedSpend(insights, allowed), [insights, allowed]);

  // Headline = the cohort view summed across campaigns.
  const head = useMemo(() => {
    const t: Totals = groups.reduce(
      (acc, g) => ({
        ...acc,
        orders: acc.orders + g.totals.orders,
        delivered: acc.delivered + g.totals.delivered,
        returned: acc.returned + g.totals.returned,
        revenue: acc.revenue + g.totals.revenue,
        netProfit: acc.netProfit + g.totals.netProfit,
        adSpend: acc.adSpend + g.totals.adSpend,
      }),
      {
        orders: 0, confirmed: 0, delivered: 0, returned: 0, revenue: 0, cogs: 0,
        grossMargin: 0, adSpend: 0, netProfit: 0, confirmRate: null,
        deliveryRate: null, cac: null, roas: null, profitRoas: null,
      } as Totals,
    );
    const terminal = t.delivered + t.returned;
    return {
      ...t,
      deliveryRate: terminal ? t.delivered / terminal : null,
      cac: t.adSpend > 0 && t.delivered > 0 ? t.adSpend / t.delivered : null,
      profitRoas: t.adSpend > 0 ? t.netProfit / t.adSpend : null,
    };
  }, [groups]);

  const inFlight = useMemo(() => groups.reduce((n, g) => n + g.inFlight, 0), [groups]);

  const cash = useMemo(
    () => cashInPeriod(orders as Order[], sinceMs, profitInputs),
    [orders, sinceMs, profitInputs],
  );
  const cashSpend = useMemo(
    () => spendInPeriod(insights, sinceMs, allowed),
    [insights, sinceMs, allowed],
  );

  const steps = useMemo(() => funnelSteps(funnelEvents), [funnelEvents]);
  const variants = useMemo(() => variantStats(funnelEvents), [funnelEvents]);
  const goals = useMemo(
    () => goalStats(funnelEvents, inRange, profitInputs),
    [funnelEvents, inRange, profitInputs],
  );
  const names = useMemo(() => campaignNames(insights), [insights]);
  const byCampaignGoal = useMemo(
    () => goalsByCampaign(funnelEvents, inRange, { profit: profitInputs, allowed, names }),
    [funnelEvents, inRange, profitInputs, allowed, names],
  );
  const hasFunnel = funnelEvents.length > 0;

  const noSpend = ready && insights.length === 0;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            className={btn(rangeKey === r.key ? "green" : "gray", true)}
            onClick={() => setRangeKey(r.key)}
          >
            {r.label}
          </button>
        ))}
        <div className="flex-1" />
        <button type="button" className={btn("gray", true)} onClick={() => setByAd((v) => !v)}>
          {byAd ? "عرض حسب الحملة" : "عرض حسب الإعلان"}
        </button>
      </div>

      {noSpend && !loading && (
        <div className={cn(cardCls, "text-[.84rem] text-[var(--ink-2)]")}>
          لا توجد بيانات إنفاق بعد. افتحي الإعدادات ← «إنفاق الإعلانات (Meta)»،
          احفظي رقم الحساب وسعر الصرف، ثم اضغطي «مزامنة الإنفاق الآن».
          الأرقام أدناه تعرض الطلبات والهامش فقط حتى تصل بيانات الإنفاق.
        </div>
      )}

      {!allowed && !noSpend && (
        <div className={cn(cardCls, "text-[.84rem] text-[var(--ink-2)]")}>
          لم تختاري حملات ديزرت شوب بعد، لذلك تُحتسب كل حملات الحساب — بما فيها
          حملات النشاط الآخر. حدّديها من الإعدادات ← «حملات ديزرت شوب».
        </div>
      )}

      {/* ── Panel 1: campaign performance (order-date cohort) ── */}
      <h3 className={cn(cardH3, "mb-3 border-0")}>📈 أداء الحملات</h3>
      <div className="mb-2 text-[.76rem] text-[var(--ink-3)]">
        الإنفاق مقابل الطلبات التي أنتجها في نفس اليوم — هذا ما يقيس الإعلان.
      </div>
      <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
        <StatCard
          title="الربح الصافي"
          value={money(head.netProfit)}
          color={head.netProfit >= 0 ? GOOD : BAD}
          sub="بعد البضاعة والإعلانات والمرتجعات"
        />
        <StatCard title="إنفاق الإعلانات" value={money(head.adSpend)} sub={`${days} يوماً`} />
        <StatCard
          title="ربح لكل دينار إعلان"
          value={ratio(head.profitRoas)}
          color={head.profitRoas != null && head.profitRoas >= 0 ? GOOD : BAD}
          sub="Profit-ROAS"
        />
        <StatCard
          title="تكلفة الطلب المُسلَّم"
          value={money(head.cac)}
          sub={`${head.delivered} مُسلَّم من ${head.orders}`}
        />
        <StatCard
          title="نسبة التسليم"
          value={pct(head.deliveryRate)}
          sub={`${head.returned} مرتجع`}
        />
      </div>

      {inFlight > 0 && (
        <div className={cn(cardCls, "text-[.82rem] text-[var(--ink-2)]")}>
          ⏳ <b>{inFlight}</b> طلباً في هذه الفترة ما زال في الطريق ولم يُحسم بعد.
          الربح أعلاه لا يحتسبها، لذلك الأرقام الحديثة تبدو أقل من حقيقتها — تنضج
          خلال أيام.
        </div>
      )}

      <div className={cn(tblWrap, "mb-8 overflow-x-auto")}>
        {loading ? (
          <div className="p-6 text-center text-[.84rem] text-[var(--ink-3)]">جارٍ التحميل…</div>
        ) : groups.length === 0 ? (
          <EmptyState icon="📊" text="لا توجد بيانات في هذه الفترة" />
        ) : (
          <table className="w-full border-collapse text-[.82rem]">
            <thead>
              <tr>
                <th className={thCls}>{byAd ? "الإعلان" : "الحملة"}</th>
                <th className={thCls}>الإنفاق</th>
                <th className={thCls}>طلبات</th>
                <th className={thCls}>مُسلَّم</th>
                <th className={thCls}>مرتجع</th>
                <th className={thCls}>التسليم</th>
                <th className={thCls}>تكلفة الطلب</th>
                <th className={thCls}>الربح الصافي</th>
                <th className={thCls}>ربح/دينار</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g: Group) => (
                <tr key={g.key}>
                  <td className={tdCls}>
                    <div className="font-bold">{g.name || g.key}</div>
                    {g.inFlight > 0 && (
                      <div className="mt-0.5 text-[.68rem] text-[var(--ink-3)]">
                        قيد النضج — {g.inFlight} في الطريق
                      </div>
                    )}
                  </td>
                  <td className={cn(tdCls, "num")} title={`€${g.spendEur.toFixed(2)}`}>
                    {money(g.spendDzd)}
                  </td>
                  <td className={cn(tdCls, "num")}>{g.totals.orders}</td>
                  <td className={cn(tdCls, "num")}>{g.totals.delivered}</td>
                  <td className={cn(tdCls, "num")}>{g.totals.returned}</td>
                  <td className={cn(tdCls, "num")}>{pct(g.totals.deliveryRate)}</td>
                  <td className={cn(tdCls, "num")}>{money(g.totals.cac)}</td>
                  <td
                    className={cn(tdCls, "num font-bold")}
                    style={{ color: g.totals.netProfit >= 0 ? GOOD : BAD }}
                  >
                    {money(g.totals.netProfit)}
                  </td>
                  <td className={cn(tdCls, "num")}>{ratio(g.totals.profitRoas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {unalloc.dzd > 0 && (
        <div className={cardCls}>
          <h3 className={cardH3}>⚠️ إنفاق غير مصنَّف — {priceFmt(unalloc.dzd)}</h3>
          <div className="mb-3 text-[.8rem] text-[var(--ink-2)]">
            إنفاق في الحساب خارج حملات ديزرت شوب المختارة، وغير محتسب في الربح
            أعلاه. إن كانت أي حملة منها لديزرت شوب، أضيفيها من الإعدادات — وإلا
            فهي تخص النشاط الآخر ووجودها هنا صحيح.
          </div>
          <div className="flex flex-col gap-1">
            {unalloc.campaigns.slice(0, 8).map((c) => (
              <div key={c.id} className="flex justify-between text-[.8rem]">
                <span>{c.name}</span>
                <span className="num text-[var(--ink-3)]">{priceFmt(c.dzd)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Panel 2: the quiz funnel ── */}
      <h3 className={cn(cardH3, "mb-3 border-0")}>🧭 قمع الاستبيان (/quiz)</h3>
      <div className="mb-3 text-[.76rem] text-[var(--ink-3)]">
        كم زائرة تصل إلى كل مرحلة — محسوبة بعدد الزائرات لا بعدد الأحداث.
      </div>
      {!hasFunnel ? (
        <div className={cn(cardCls, "text-[.84rem] text-[var(--ink-2)]")}>
          لا توجد بيانات للقمع في هذه الفترة بعد. وجّهي زيارات إلى{" "}
          <span className="ltr">/quiz</span> وستظهر هنا.
        </div>
      ) : (
        <>
          <div className={cn(cardCls, "mb-4")}>
            {steps.map((s) => (
              <div key={s.step} className="mb-3 last:mb-0">
                <div className="mb-1 flex justify-between text-[.8rem]">
                  <span className="font-bold">{STEP_LABELS[s.step] ?? s.step}</span>
                  <span className="num text-[var(--ink-3)]">
                    {s.sessions} · {Math.round(s.pctOfTop * 100)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--card-2,rgba(0,0,0,.06))]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(s.pctOfTop * 100, s.sessions ? 2 : 0)}%`,
                      background: "linear-gradient(90deg,#D9A86C,#E0728C)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 max-[860px]:grid-cols-1">
            <div className={cn(cardCls, "m-0 mb-0")}>
              <h3 className={cardH3}>تجربة A/B — شكل النتيجة</h3>
              <div className="mb-3 text-[.76rem] text-[var(--ink-3)]">
                منتج واحد مقابل روتين من 3 منتجات.
              </div>
              <table className="w-full border-collapse text-[.82rem]">
                <thead>
                  <tr>
                    <th className={thCls}>النسخة</th>
                    <th className={thCls}>زائرات</th>
                    <th className={thCls}>طلبات</th>
                    <th className={thCls}>التحويل</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => (
                    <tr key={v.variant}>
                      <td className={tdCls}>{VARIANT_LABELS[v.variant] ?? v.variant}</td>
                      <td className={cn(tdCls, "num")}>{v.sessions}</td>
                      <td className={cn(tdCls, "num")}>{v.orders}</td>
                      <td className={cn(tdCls, "num")}>{pct(v.conversion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {variants.every((v) => v.sessions < 100) && (
                <div className="mt-3 text-[.72rem] text-[var(--ink-3)]">
                  ⚠️ العيّنة ما زالت صغيرة — لا تُحسم النتيجة بعد.
                </div>
              )}
            </div>

            <div className={cn(cardCls, "m-0 mb-0")}>
              <h3 className={cardH3}>ما الذي تبحث عنه الزائرات</h3>
              <div className="mb-3 text-[.76rem] text-[var(--ink-3)]">
                الهدف الذي تختاره كل زائرة، وكم يُسلَّم منه فعلاً.
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[.82rem]">
                  <thead>
                    <tr>
                      <th className={thCls}>الهدف</th>
                      <th className={thCls}>زائرات</th>
                      <th className={thCls}>طلبات</th>
                      <th className={thCls}>مُسلَّم</th>
                      <th className={thCls}>التسليم</th>
                      <th className={thCls}>الهامش</th>
                    </tr>
                  </thead>
                  <tbody>
                    {goals.map((g) => (
                      <tr key={g.goal}>
                        <td className={tdCls}>
                          {GOAL_LABELS[g.goal] ?? g.goal}
                          {g.inFlight > 0 && (
                            <div className="mt-0.5 text-[.66rem] text-[var(--ink-3)]">
                              {g.inFlight} في الطريق
                            </div>
                          )}
                        </td>
                        <td className={cn(tdCls, "num")}>{g.sessions}</td>
                        <td className={cn(tdCls, "num")}>{g.orders}</td>
                        <td className={cn(tdCls, "num")}>{g.delivered}</td>
                        <td className={cn(tdCls, "num")}>{pct(g.deliveryRate)}</td>
                        <td
                          className={cn(tdCls, "num font-bold")}
                          style={{ color: g.margin >= 0 ? GOOD : BAD }}
                        >
                          {money(g.margin)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {hasFunnel && byCampaignGoal.length > 0 && (
        <div className={cn(cardCls, "mb-8")}>
          <h3 className={cardH3}>🎯 من تجلبه كل حملة</h3>
          <div className="mb-1 text-[.8rem] text-[var(--ink-2)]">
            أي هدف تجلبه كل حملة، وكم يُسلَّم منه. حملة تجلب زائرات لهدف لا
            يُسلَّم تخسر مهما كانت النقرة رخيصة.
          </div>
          <div className="mb-4 text-[.72rem] text-[var(--ink-3)]">
            «الهامش» هنا بعد البضاعة والمرتجعات وقبل الإعلانات — الإنفاق يُشترى
            لكل إعلان لا لكل هدف، فلا يمكن قسمته على الأهداف بصدق. الربح الصافي
            لكل حملة في الجدول الأول. قارني «لكل زائرة» بما تدفعينه لجلب زائرة
            واحدة: إن كان أقل، فهذا الصف يخسر.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[.82rem]">
              <thead>
                <tr>
                  <th className={thCls}>الحملة</th>
                  <th className={thCls}>الهدف</th>
                  <th className={thCls}>زائرات</th>
                  <th className={thCls}>طلبات</th>
                  <th className={thCls}>مُسلَّم</th>
                  <th className={thCls}>التسليم</th>
                  <th className={thCls}>الهامش</th>
                  <th className={thCls}>لكل زائرة</th>
                </tr>
              </thead>
              <tbody>
                {byCampaignGoal.map((r) => (
                  <tr key={`${r.campaignId}-${r.goal}`}>
                    <td className={tdCls}>{r.campaignName}</td>
                    <td className={tdCls}>{GOAL_LABELS[r.goal] ?? r.goal}</td>
                    <td className={cn(tdCls, "num")}>{r.sessions}</td>
                    <td className={cn(tdCls, "num")}>{r.orders}</td>
                    <td className={cn(tdCls, "num")}>{r.delivered}</td>
                    <td className={cn(tdCls, "num")}>{pct(r.deliveryRate)}</td>
                    <td className={cn(tdCls, "num")}>{money(r.margin)}</td>
                    <td
                      className={cn(tdCls, "num font-bold")}
                      style={{
                        color:
                          r.marginPerVisitor == null
                            ? undefined
                            : r.marginPerVisitor > 0
                              ? GOOD
                              : BAD,
                      }}
                    >
                      {r.marginPerVisitor == null ? "—" : money(Math.round(r.marginPerVisitor))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Panel 4: cash actually collected (delivery date) ── */}
      <h3 className={cn(cardH3, "mb-3 border-0")}>💰 الصندوق — ما وصل فعلاً</h3>
      <div className="mb-2 text-[.76rem] text-[var(--ink-3)]">
        محسوب بتاريخ التسليم لا بتاريخ الطلب — هذا ما دخل الصندوق خلال {days} يوماً.
      </div>
      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
        <StatCard title="طلبات مُسلَّمة" value={String(cash.delivered)} />
        <StatCard title="المبيعات" value={money(cash.revenue)} sub="بدون رسوم التوصيل" />
        <StatCard title="تكلفة البضاعة" value={money(cash.cogs)} color={BAD} />
        <StatCard title="هامش الربح" value={money(cash.grossMargin)} color={GOOD} />
        <StatCard
          title="بعد خصم الإعلانات"
          value={money(cash.grossMargin - cashSpend)}
          color={cash.grossMargin - cashSpend >= 0 ? GOOD : BAD}
          sub="الهامش − الإنفاق في نفس الفترة"
        />
      </div>
    </div>
  );
}

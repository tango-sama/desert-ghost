"use client";

import { useState } from "react";
import { priceFmt, productImages } from "@/lib/firebase";
import {
  callFn,
  updateDocIn,
  deleteDocIn,
  orderStamp,
  type Order,
  type TrackingStatus,
  type CarrierKey,
} from "@/lib/admin";
import { useAdminStore } from "@/stores/admin-store";
import { cn } from "@/lib/utils";
import {
  inp,
  btn,
  rowActions,
  orderCardCls,
  orderItemsCls,
  tagOk,
  tagInfo,
  EmptyState,
  fmtDate,
  waIntl,
} from "@/components/admin/ui";
import {
  CANCEL_FN,
  CO,
  CREATE_FN,
  isDelivered,
  isPastCancelWindow,
  orderCarrier,
  orderDate,
  startsFolded,
} from "@/components/admin/carriers";
import { nowMs } from "@/lib/time";
import { useDeliveryData } from "@/hooks/use-delivery-data";
import {
  centersForCarrier,
  feeForCarrier,
  wilayasFor,
  type Carrier,
  type CarrierCache,
  type DeliveryType,
} from "@/lib/delivery";

const TRACK_ICONS = ["📥", "📦", "🏭", "🚚", "✅"];
// ⚠️ marker sits on the line between "خرج للتوصيل" and the final step
const WARN_IDX = 3;

function patchOrder(id: string, patch: Partial<Order>) {
  useAdminStore.setState((s) => ({
    orders: s.orders.map((o) =>
      String(o.id) === String(id) ? { ...o, ...patch } : o
    ),
  }));
}

// Merge a fresh getParcelStatus result into the order (the function also
// persists it server-side; this keeps the open panel in sync instantly).
function applyTrackingResult(o: Order, status: TrackingStatus): Partial<Order> {
  const patch: Partial<Order> = { trackingStatus: status };
  if (status?.carrier === "noest" && status.noestValidated && o.noest)
    patch.noest = { ...o.noest, validated: true };
  // ZR can heal a not-yet-resolved tracking number on refresh
  if (status?.carrier === "zr" && status.tracking && o.zr)
    patch.zr = { ...o.zr, tracking: status.tracking };
  return patch;
}

// `badge-class` from the carrier API is only a colour hint (green=success,
// red=problem, blue=in-progress) — never shown as raw text.
function badgeCls(b: unknown): "ok" | "bad" | "warn" | "info" | "" {
  const s = String(b ?? "").toLowerCase();
  if (/success/.test(s)) return "ok";
  if (/danger|error/.test(s)) return "bad";
  if (/warn/.test(s)) return "warn";
  if (/primary|info/.test(s)) return "info";
  return "";
}

const CLR_INK: Record<string, string> = {
  ok: "text-[var(--ok-ink)]",
  bad: "text-[var(--alert-ink)]",
  warn: "text-[var(--warn-ink)]",
  info: "text-[var(--info-ink)]",
};

// A carrier's own badge only classifies the STATE ("out for delivery",
// "delivered"...) — the free-text reason attached to it isn't reliably
// classified the same way (e.g. Noest hands back "Client ne répond pas"
// with no special badge at all, since the state itself is still just
// "delivery attempt"). Catch the reason text directly so a real delivery
// problem is never left in the same plain color as a routine update, no
// matter what the surrounding event's badge says.
const URGENT_REASON =
  /ne r[ée]pond pas|injoignable|absent|refus[ée]?|annul[ée]?|report[ée]|adresse (erron[ée]e|incorrecte|introuvable)|num[ée]ro (erron[ée]|incorrect)|hors zone|endommag[ée]|colis perdu/i;

// Horizontally centre a stepper on its current/last-reached step by
// adjusting only the stepper's own scroll — never the page (delta-based,
// works in RTL too).
function centerStepper(pstep: Element) {
  let target: Element | null = pstep.querySelector(".pstep-node.cur");
  if (!target) {
    const done = pstep.querySelectorAll(".pstep-node.done");
    target = done[done.length - 1] ?? null;
  }
  if (!target) return;
  const pr = pstep.getBoundingClientRect();
  const tr = target.getBoundingClientRect();
  (pstep as HTMLElement).scrollLeft += tr.left + tr.width / 2 - (pr.left + pr.width / 2);
}

// After a refresh re-renders, bring this order's tracker into view and
// scroll its stepper to the current/last-reached step.
function scrollTrackerToCurrent(orderId: string) {
  requestAnimationFrame(() => {
    const ptrack = document.querySelector(`[data-ptrack="${orderId}"]`);
    if (!ptrack) return;
    const pstep = ptrack.querySelector(".pstep");
    let target: Element | null = null;
    if (pstep) {
      target = pstep.querySelector(".pstep-node.cur");
      if (!target) {
        const done = pstep.querySelectorAll(".pstep-node.done");
        target = done[done.length - 1] ?? null;
      }
    }
    if (target)
      target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    else ptrack.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

// After refresh-all, snap every visible stepper to its own current step
// without ever scrolling the page (folded cards render no stepper).
function scrollAllSteppersToCurrent() {
  requestAnimationFrame(() => {
    document.querySelectorAll(".pstep").forEach(centerStepper);
  });
}

function TrackStepper({
  o,
  busy,
  onRefresh,
}: {
  o: Order;
  busy: boolean;
  onRefresh: () => void;
}) {
  const carrier = orderCarrier(o);
  if (!carrier) return null;
  const color = CO[carrier].color;
  const ts = o.trackingStatus;

  const refreshBtn = (
    <button
      type="button"
      disabled={busy}
      onClick={onRefresh}
      className={cn(btn("blue", true), "mr-auto")}
      style={{ background: color }}
    >
      {busy ? "⏳ جاري التحقق..." : "🔄 تحديث"}
    </button>
  );

  if (!ts || ts.carrier !== carrier || ts.tracking !== o[carrier]?.tracking) {
    return (
      <div
        data-ptrack={o.id}
        className="mt-2.5 rounded-[11px] bg-[var(--card-2)] px-4 py-3.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 text-[.82rem] text-[var(--ink-3)]">
          لم يتم التحقق من حالة الطرد بعد.
          {refreshBtn}
        </div>
      </div>
    );
  }

  const labels = ts.stageLabels ?? [];
  const hasAlert = !!ts.alert;
  const isReturn = ts.stage == null; // return / cancel — no forward progress
  let effStage = isReturn ? -1 : (ts.stage as number);
  // A delivery-problem ⚠️ means the parcel is NOT delivered — never let the
  // final step turn green while the triangle shows.
  if (hasAlert && !isReturn) effStage = Math.min(effStage, labels.length - 2);

  const lastDate = ts.lastDate ? fmtDate(ts.lastDate) : null;
  const updated = ts.updatedAt ? fmtDate(ts.updatedAt) : null;
  const carrierName = CO[carrier]?.name ?? carrier;
  // Show BOTH our Arabic stage and the carrier's own status text, so it's
  // clear what step we display AND exactly what the delivery API reported.
  const stageAr = !isReturn && ts.stage != null ? labels[ts.stage] : null;
  const evs = (ts.events ?? []).filter((e) => e && e.date);

  return (
    <div
      data-ptrack={o.id}
      className="mt-2.5 rounded-[11px] bg-[var(--card-2)] px-4 py-3.5"
    >
      {/* The stepper is ALWAYS shown — an alert/return only adds a ⚠️
          marker and a badge, never a banner replacing the tracker. */}
      <div className="pstep flex items-start overflow-x-auto pb-0.5">
        {labels.map((lab, i) => {
          const reached = i <= effStage;
          const isCur = i === effStage && !hasAlert;
          const warnHere = hasAlert && i === WARN_IDX;
          return (
            <div key={i} className="contents">
              <div
                className={cn(
                  "pstep-node flex w-[74px] flex-shrink-0 flex-col items-center",
                  reached && "done",
                  isCur && "cur"
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 text-[.9rem]",
                    reached
                      ? "border-[var(--green)] bg-[var(--green)] text-white"
                      : "border-border bg-card text-[var(--ink-3)]",
                    isCur && "shadow-[0_0_0_4px_rgba(34,197,94,.25)]"
                  )}
                >
                  {reached ? "✓" : TRACK_ICONS[i] || "•"}
                </div>
                <div
                  className={cn(
                    "mt-1.5 text-center text-[.66rem] font-bold leading-[1.4]",
                    isCur
                      ? "text-[var(--green)]"
                      : reached
                        ? "text-[var(--ink-2)]"
                        : "text-[var(--ink-3)]"
                  )}
                >
                  {lab}
                </div>
              </div>
              {i < labels.length - 1 && (
                <div
                  className={cn(
                    "relative mx-0.5 mt-[15px] h-0.5 min-w-4 flex-1",
                    i < effStage
                      ? "bg-[var(--green)]"
                      : warnHere
                        ? "bg-destructive"
                        : "bg-border"
                  )}
                >
                  {warnHere && (
                    <span
                      title={ts.alert}
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[60%] text-base leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,.4)]"
                    >
                      🔺
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-col gap-1.5 text-[.72rem] text-[var(--ink-3)]">
        <div className="flex flex-wrap items-center gap-2">
          {isReturn ? (
            <span className="max-w-full rounded-xl bg-[rgba(229,72,77,.2)] px-2.5 py-1 text-[.75rem] font-extrabold break-words text-[var(--alert-ink)]">
              ⚠️ {ts.alert || "—"}
            </span>
          ) : hasAlert ? (
            <span className="max-w-full rounded-xl bg-[var(--alert-bg)] px-2.5 py-1 text-[.75rem] font-extrabold break-words text-[var(--alert-ink)]">
              🔺 {ts.alert}
            </span>
          ) : stageAr ? (
            <span className="whitespace-nowrap rounded-full bg-[var(--ok-bg)] px-2.5 py-1 text-[.75rem] font-extrabold text-[var(--ok-ink)]">
              {stageAr}
            </span>
          ) : null}
          {ts.lastLabel && (
            <span className="text-[.74rem] text-[var(--ink-2)]">
              حالة {carrierName}:{" "}
              <b className="font-extrabold text-foreground">{ts.lastLabel}</b>
            </span>
          )}
        </div>
        <div className="text-[.7rem] text-[var(--ink-3)]">
          {lastDate ? `🕒 آخر حدث: ${lastDate}` : ""}
          {ts.lastLocation ? `${lastDate ? " · " : ""}📍 ${ts.lastLocation}` : ""}
          {updated
            ? `${lastDate || ts.lastLocation ? " · " : ""}🔄 تحديث: ${updated}`
            : ""}
        </div>
      </div>

      <div className={`${rowActions} mt-3`}>{refreshBtn}</div>

      {/* Activity details from the carrier API — agent, hub, causer and the
          reason — folded by default; click "تفاصيل الشحنة" to expand. */}
      {evs.length > 0 && (
        <details className="group mt-3 border-t border-border pt-2.5">
          <summary className="cursor-pointer select-none list-none text-[.74rem] font-extrabold text-[var(--ink-2)] [&::-webkit-details-marker]:hidden">
            <span className="text-[var(--ink-3)] group-open:hidden">▸ </span>
            <span className="hidden text-[var(--ink-3)] group-open:inline">▾ </span>
            📋 تفاصيل الشحنة ({evs.length})
          </summary>
          <div className="mt-2">
            {evs
              .slice()
              .reverse()
              .map((e, i) => {
                const cls = badgeCls(e.badge);
                const d = e.date ? fmtDate(e.date) : "";
                const bits: React.ReactNode[] = [];
                if (e.by) bits.push(`🚚 ${e.by}`);
                if (e.center) bits.push(`🏢 ${e.center}`);
                if (e.location)
                  bits.push(
                    <span key="loc" className="text-[var(--teal-ink)]">
                      📍 {e.location}
                    </span>
                  );
                if (e.causer) bits.push(`causer: ${e.causer}`);
                if (e.content)
                  bits.push(
                    <span
                      key="c"
                      className={cn(
                        "font-bold",
                        URGENT_REASON.test(e.content) ? CLR_INK.bad : CLR_INK[cls]
                      )}
                    >
                      content: {e.content}
                    </span>
                  );
                if (d) bits.push(`🕒 ${d}`);
                return (
                  <div
                    key={i}
                    className="mb-1.5 rounded-lg border-r-2 border-border bg-card px-2.5 py-1.5"
                  >
                    <div
                      className={cn(
                        "text-[.76rem] font-extrabold text-foreground",
                        CLR_INK[cls]
                      )}
                    >
                      {e.label || "—"}
                    </div>
                    {bits.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-0.5 text-[.68rem] text-[var(--ink-3)]">
                        {bits.map((b, j) => (
                          <span key={j}>
                            {j > 0 && " · "}
                            {b}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </details>
      )}
    </div>
  );
}

// One lowercase haystack per order for the topbar search box: number,
// customer, phone, location, address and item titles.
function orderHaystack(o: Order): string {
  return [
    o.num,
    o.id,
    o.customer,
    o.phone,
    o.wilaya,
    o.baladiya,
    o.address,
    ...(o.items ?? []).map((it) => it.title),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

// The order's wilaya id is normally saved directly at order time
// (selectedWilaya.id) — older orders that predate that field are resolved
// by matching the saved wilaya name against the target carrier's own list;
// Algeria's 58 wilaya codes are the same official numbering every carrier
// uses, so this is only ever a name lookup, never a cross-carrier translation.
function resolveOrderWilayaId(
  o: Order,
  co: Carrier,
  cache: CarrierCache
): string | number | null {
  const raw = o.wilayaId;
  if (typeof raw === "string" || typeof raw === "number") return raw;
  const match = wilayasFor(co, cache).find(
    (w) => w.ar === o.wilaya || w.fr === o.wilayaFr
  );
  return match ? match.id : null;
}

export function OrdersView() {
  const orders = useAdminStore((s) => s.orders);
  const products = useAdminStore((s) => s.products);
  const toast = useAdminStore((s) => s.toast);
  const ordersSearch = useAdminStore((s) => s.ordersSearch);

  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [refreshAllLabel, setRefreshAllLabel] = useState<string | null>(null);
  const [noestSel, setNoestSel] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<
    Record<string, { note?: string; price?: string }>
  >({});
  // user fold/unfold overrides; without one, a card starts folded when the
  // order is old news (placed over 7 days ago or already delivered)
  const [folds, setFolds] = useState<Record<string, boolean>>({});

  const cache = useDeliveryData();
  // When a Stop Desk order's delivery company is switched to one other than
  // the customer's original pick, the desk already saved on the order
  // belongs to the OLD carrier's own agency list and means nothing to the
  // new one — this prompts the admin to pick a real desk from the new
  // carrier's own list (in the order's wilaya) before a parcel is created.
  const [deskPrompt, setDeskPrompt] = useState<{
    orderId: string;
    co: CarrierKey;
    deskId: string;
  } | null>(null);
  const [deskSaving, setDeskSaving] = useState(false);

  // Orders are listed by date placed, newest first; the sticky topbar
  // search narrows the list (and what refresh-all touches) live.
  const q = ordersSearch.trim().toLowerCase();
  const list = orders
    .slice()
    .sort((a, b) => orderStamp(b) - orderStamp(a))
    .filter((o) => !q || orderHaystack(o).includes(q));
  const cardOpen = (o: Order) => folds[String(o.id)] ?? !startsFolded(o);
  const anyTracked = list.some((o) => !!orderCarrier(o));
  const openTracked = list.filter((o) => orderCarrier(o) && cardOpen(o));
  const selectedNoest = Object.keys(noestSel).filter((k) => noestSel[k]);

  function setBusyKey(key: string, on: boolean) {
    setBusy((b) => ({ ...b, [key]: on }));
  }

  // After a bulk refresh, drop the order's fold override so the default
  // folding applies again — a parcel that just turned "delivered" folds
  // right away, decluttering the list once the batch is done.
  function clearFold(oid: string) {
    setFolds((f) => {
      if (!(oid in f)) return f;
      const n = { ...f };
      delete n[oid];
      return n;
    });
  }

  // A single-order refresh is always triggered from inside that order's own
  // (already open) card — force it to stay open even if the result is
  // "delivered", so the admin actually sees the stepper land on the final
  // step instead of the card folding out from under them.
  function forceOpen(oid: string) {
    setFolds((f) => ({ ...f, [oid]: true }));
  }

  async function refreshTracking(orderId: string) {
    const key = `track:${orderId}`;
    setBusyKey(key, true);
    try {
      const status = await callFn<TrackingStatus>("getParcelStatus", { orderId });
      const o = useAdminStore.getState().orders.find(
        (x) => String(x.id) === String(orderId)
      );
      if (o) patchOrder(orderId, applyTrackingResult(o, status));
      forceOpen(orderId);
      scrollTrackerToCurrent(orderId);
    } catch (err) {
      console.error("getParcelStatus", err);
      toast(
        "تعذّر جلب حالة الطرد: " + ((err as Error | null)?.message ?? "خطأ")
      );
    } finally {
      setBusyKey(key, false);
    }
  }

  // Refreshes parcels one at a time (not in parallel) so we don't burst
  // past carrier rate limits. Only orders whose card is expanded are
  // refreshed — folded ones (old or already delivered) are skipped.
  async function refreshAllTracking() {
    const targets = openTracked;
    if (!targets.length) {
      toast("لا توجد طلبات مفتوحة بها طرود لتحديثها");
      return;
    }
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < targets.length; i++) {
      const o = targets[i];
      setRefreshAllLabel(`⏳ جاري التحديث... (${i + 1}/${targets.length})`);
      try {
        const status = await callFn<TrackingStatus>("getParcelStatus", {
          orderId: o.id,
        });
        patchOrder(String(o.id), applyTrackingResult(o, status));
        clearFold(String(o.id));
        ok++;
      } catch (err) {
        console.error("getParcelStatus", o.id, err);
        fail++;
      }
      await new Promise((r) => setTimeout(r, 350));
    }
    setRefreshAllLabel(null);
    scrollAllSteppersToCurrent();
    toast(`تم تحديث ${ok} طرد` + (fail ? ` — تعذّر تحديث ${fail}` : ""));
  }

  // Noest label PDFs require the API token, so the browser can't link to
  // them directly — fetch via the getNoestLabels callable (multiple labels
  // arrive merged into one PDF) and open the blob.
  async function openNoestLabels(trackings: string[], busyKey?: string) {
    if (!trackings.length) return;
    if (busyKey) setBusyKey(busyKey, true);
    const w = window.open("about:blank", "_blank");
    try {
      const res = await callFn<{ pdf?: string }>("getNoestLabels", { trackings });
      const b64 = res?.pdf ?? "";
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: "application/pdf" }));
      if (w) w.location = url;
      else window.open(url, "_blank");
    } catch (err) {
      console.error("getNoestLabels", err);
      try {
        w?.close();
      } catch {}
      alert("تعذّر جلب الوصل:\n" + ((err as Error | null)?.message ?? "خطأ"));
    } finally {
      if (busyKey) setBusyKey(busyKey, false);
    }
  }

  async function createParcel(co: CarrierKey, orderId: string) {
    const o = useAdminStore.getState().orders.find(
      (x) => String(x.id) === String(orderId)
    );
    if (!o) return;
    const draft = drafts[orderId] ?? {};
    const note = (draft.note ?? o.deliveryLabel ?? "").trim();
    if (!note) {
      toast("أدخلي اسم المنتج الذي سيظهر على وصل التوصيل أولاً");
      return;
    }
    const praw = (draft.price ?? "").trim();
    let parcelPrice: number | null = null;
    if (praw !== "") {
      const pn = Number(praw);
      if (isNaN(pn) || pn < 0) {
        toast("سعر الطرد غير صالح");
        return;
      }
      parcelPrice = pn;
    } else if (o.parcelPrice != null) {
      parcelPrice = o.parcelPrice;
    }
    const label = CO[co].name;
    const origTotal = o.total != null ? o.total : o.subtotal;
    if (
      !confirm(
        `إنشاء طرد ${label} لـ ${o.customer || o.num}؟\nاسم المنتج على الوصل: «${note}»\nسعر الطرد: ` +
          (parcelPrice != null
            ? `${parcelPrice} د.ج (بدلاً من ${origTotal})`
            : `${origTotal} د.ج (بدون تغيير)`)
      )
    )
      return;
    const key = `parcel:${co}:${orderId}`;
    setBusyKey(key, true);
    try {
      await updateDocIn("orders", orderId, { deliveryLabel: note, parcelPrice });
      patchOrder(orderId, { deliveryLabel: note, parcelPrice });
      const d = await callFn<{
        tracking?: string;
        label?: string;
        validated?: boolean;
        alreadyCreated?: boolean;
      }>(CREATE_FN[co], { orderId });
      patchOrder(orderId, {
        [co]: {
          tracking: d.tracking,
          label: d.label ?? null,
          validated: d.validated,
          createdAt: nowMs(),
        },
        fulfilled: true,
      });
      toast(
        d.alreadyCreated
          ? "الطرد موجود مسبقاً ✓"
          : `تم إنشاء طرد ${label} ✓ ${d.tracking ?? ""}`
      );
    } catch (err) {
      console.error(CREATE_FN[co], err);
      alert(
        `تعذّر إنشاء طرد ${label}:\n` +
          ((err as Error | null)?.message ?? "خطأ غير معروف")
      );
    } finally {
      setBusyKey(key, false);
    }
  }

  // A carrier button was clicked to create a parcel. For a Stop Desk order
  // where the admin is choosing a DIFFERENT company than the customer's
  // original pick, the desk already saved on the order belongs to that
  // original carrier's own agency list, not this one's — ask which of THIS
  // carrier's desks (in the order's wilaya) to use before creating the parcel.
  function requestCreateParcel(co: CarrierKey, o: Order) {
    const isOffice = o.deliveryType === "office";
    const switchingCompany = !!o.deliveryCompany && o.deliveryCompany !== co;
    if (isOffice && switchingCompany) {
      setDeskPrompt({ orderId: String(o.id), co, deskId: "" });
      return;
    }
    createParcel(co, String(o.id));
  }

  async function confirmDeskAndCreateParcel(
    o: Order,
    co: CarrierKey,
    desk: { id: number | string; name: string },
    newFee: number | null
  ) {
    setDeskSaving(true);
    try {
      // Different carriers charge different Stop Desk fees for the same
      // wilaya, so switching carrier can change the price the customer
      // owes — recompute deliveryFee/total for the NEW carrier instead of
      // silently keeping the old carrier's fee.
      const baseSubtotal =
        o.subtotal != null
          ? o.subtotal
          : o.total != null && o.deliveryFee != null
            ? o.total - o.deliveryFee
            : (o.total ?? 0);
      const patch: Partial<Order> = {
        baladiya: desk.name,
        deliveryCompany: co,
        ...(newFee != null ? { deliveryFee: newFee, total: baseSubtotal + newFee } : {}),
      };
      await updateDocIn("orders", o.id, patch);
      patchOrder(o.id, patch);
      setDeskPrompt(null);
      createParcel(co, String(o.id));
    } catch (err) {
      console.error(err);
      toast("تعذّر حفظ المكتب المختار");
    } finally {
      setDeskSaving(false);
    }
  }

  async function toggleFulfilled(o: Order) {
    if (o.fulfilled) {
      // "تعليم كجديد": always clear the delivery label / parcel price / any
      // created carrier tracking, so the order goes back to its starting
      // state — regardless of whether a parcel was actually created. The
      // label can be typed into the note field (saved on blur) before a
      // parcel ever exists, so it must be cleared even when there's no
      // carrier tracking to clear alongside it.
      const carrier = orderCarrier(o);
      const hasDeliveryData = !!(o.deliveryLabel || o.parcelPrice != null || carrier);
      if (
        hasDeliveryData &&
        !confirm(
          carrier
            ? `سيتم محاولة إلغاء طرد ${CO[carrier].name} لدى شركة التوصيل عبر الـ API، ثم حذف بيانات الوصل من هذا الطلب حتى تتمكني من إنشاء وصل جديد بأي شركة توصيل. إذا تعذّر الإلغاء (مثلاً لأن الطرد بدأ الشحن بالفعل) فلن يُحذف شيء. متابعة؟`
            : "سيتم حذف اسم المنتج على الوصل لهذا الطلب حتى تتمكني من إدخاله من جديد. متابعة؟"
        )
      )
        return;

      const key = `reset:${o.id}`;
      setBusyKey(key, true);
      // Cancel with the carrier FIRST — only clear our own record of the
      // parcel once it's confirmed gone on their side. If cancellation
      // fails (e.g. it already shipped), abort entirely and leave the
      // order untouched, so we never lose track of a parcel that's still
      // live with the carrier.
      if (carrier) {
        try {
          await callFn(CANCEL_FN[carrier], { orderId: o.id });
        } catch (err) {
          console.error(CANCEL_FN[carrier], err);
          setBusyKey(key, false);
          alert(
            `تعذّر إلغاء طرد ${CO[carrier].name} لدى شركة التوصيل:\n` +
              ((err as Error | null)?.message ?? "خطأ غير معروف") +
              `\n\nلم يتم حذف أي شيء — يمكنك إلغاء الطرد يدوياً من لوحة ${CO[carrier].name} ثم إعادة المحاولة.`
          );
          return;
        }
      }

      const patch: Partial<Order> = {
        fulfilled: false,
        status: "New",
        deliveryLabel: null,
        parcelPrice: null,
        yalidine: null,
        noest: null,
        zr: null,
        trackingStatus: null,
      };
      try {
        await updateDocIn("orders", o.id, patch);
        patchOrder(o.id, patch);
      } catch (e) {
        console.error(e);
        toast("فشل");
      } finally {
        setBusyKey(key, false);
      }
      return;
    }
    const v = !o.fulfilled;
    try {
      await updateDocIn("orders", o.id, { fulfilled: v, status: v ? "Done" : "New" });
      patchOrder(o.id, { fulfilled: v, status: v ? "Done" : "New" });
    } catch (e) {
      console.error(e);
      toast("فشل");
    }
  }

  async function delOrder(id: string) {
    if (!confirm("حذف هذا الطلب؟")) return;
    try {
      await deleteDocIn("orders", id);
      useAdminStore.setState((s) => ({
        orders: s.orders.filter((x) => String(x.id) !== String(id)),
      }));
      toast("تم الحذف");
    } catch (e) {
      console.error(e);
      toast("فشل الحذف");
    }
  }

  if (!list.length)
    return q ? (
      <EmptyState icon="🔍" text="لا توجد طلبات مطابقة للبحث" />
    ) : (
      <EmptyState icon="📦" text="لا توجد طلبات بعد" />
    );

  return (
    <div>
      {anyTracked && (
        <div className="mb-4">
          <button
            type="button"
            className={btn("blue", true)}
            disabled={refreshAllLabel != null}
            onClick={refreshAllTracking}
          >
            {refreshAllLabel ??
              `🔄 تحديث حالة الطرود المفتوحة (${openTracked.length})`}
          </button>
        </div>
      )}

      {selectedNoest.length > 0 && (
        <div className="fixed bottom-5 left-1/2 z-[300] -translate-x-1/2 rounded-full bg-[#1E73E8] px-2 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,.35)]">
          <button
            type="button"
            disabled={!!busy["noest-print"]}
            onClick={() => openNoestLabels(selectedNoest, "noest-print")}
            className="cursor-pointer bg-transparent px-3 py-1 text-[.78rem] font-extrabold text-white"
          >
            {busy["noest-print"]
              ? "⏳ جاري تجهيز الوصول..."
              : `🖨️ طباعة الوصول المحددة (${selectedNoest.length})`}
          </button>
        </div>
      )}

      {deskPrompt &&
        (() => {
          const o = orders.find((x) => String(x.id) === deskPrompt.orderId);
          if (!o) return null;
          const co = deskPrompt.co;
          const wid = resolveOrderWilayaId(o, co, cache);
          const desks = wid != null ? centersForCarrier(co, wid, cache) : [];
          const prevCoName = o.deliveryCompany
            ? (CO[o.deliveryCompany as CarrierKey]?.name ?? o.deliveryCompany)
            : "—";
          // Each carrier prices Stop Desk delivery differently for the same
          // wilaya — switching carrier can change what the customer owes,
          // so recompute it here instead of silently keeping the old fee.
          const newFee =
            wid != null
              ? feeForCarrier(co, wid, (o.deliveryType as DeliveryType) || "office", cache)
              : null;
          const feeChanged = newFee != null && o.deliveryFee != null && newFee !== o.deliveryFee;
          return (
            <div
              className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 p-6"
              onClick={(e) => e.target === e.currentTarget && setDeskPrompt(null)}
            >
              <div className="w-full max-w-[440px] rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-lg)]">
                <h3 className="mb-2 text-[1.05rem] font-extrabold">
                  🏢 تغيير شركة التوصيل — اختيار المكتب
                </h3>
                <p className="mb-4 text-[.82rem] leading-relaxed text-[var(--ink-3)]">
                  هذا الطلب توصيل لمكتب (Stop Desk) واخترتِ {CO[co].name} بدلاً
                  من {prevCoName}. اختاري المكتب المناسب في ولاية{" "}
                  {o.wilaya || "—"} لدى {CO[co].name}:
                </p>
                <select
                  className={cn(inp, "px-3.5 py-[.55rem] text-[.85rem]")}
                  value={deskPrompt.deskId}
                  onChange={(e) =>
                    setDeskPrompt((d) => (d ? { ...d, deskId: e.target.value } : d))
                  }
                >
                  <option value="">
                    {desks.length
                      ? "اختاري المكتب"
                      : "لا توجد مكاتب متاحة لهذه الولاية لدى هذه الشركة"}
                  </option>
                  {desks.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.address ? `${d.name} — ${d.address}` : d.name}
                    </option>
                  ))}
                </select>
                <div className="mt-3 rounded-lg bg-[var(--card-2)] px-3 py-2 text-[.8rem]">
                  💰 رسم التوصيل لدى {CO[co].name}:{" "}
                  <b className="text-foreground">
                    {newFee != null ? priceFmt(newFee) : "—"}
                  </b>
                  {feeChanged && (
                    <span className="text-[var(--ink-3)]">
                      {" "}
                      (بدلاً من {priceFmt(o.deliveryFee!)} لدى {prevCoName})
                    </span>
                  )}
                </div>
                <div className={cn(rowActions, "mt-4 justify-end")}>
                  <button
                    type="button"
                    className={btn("gray", true)}
                    onClick={() => setDeskPrompt(null)}
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    disabled={!deskPrompt.deskId || deskSaving}
                    className={btn("blue", true)}
                    onClick={() => {
                      const desk = desks.find(
                        (d) => String(d.id) === deskPrompt.deskId
                      );
                      if (!desk) return;
                      confirmDeskAndCreateParcel(o, co, desk, newFee);
                    }}
                  >
                    {deskSaving ? "⏳ جاري الحفظ..." : "تأكيد وإنشاء الطرد"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {list.map((o) => {
        const oid = String(o.id);
        const oco = CO[(o.deliveryCompany as CarrierKey) ?? "yalidine"] ?? CO.yalidine;
        const carrier = orderCarrier(o);
        const when = orderDate(o);
        const isOpen = cardOpen(o);
        const isStaffOrder =
          o.source === "admin_phone" || o.source === "seller_direct";
        const isSunguardOrder = o.source === "landing_sunguard";
        const picList = (o.items ?? [])
          .map((it) => {
            let img = it.image;
            if (!img) {
              const p = products.find((x) => String(x.id) === String(it.id));
              img = p ? productImages(p)[0] : undefined;
            }
            return img ? { img, qty: it.qty ?? it.quantity ?? 1 } : null;
          })
          .filter(Boolean) as { img: string; qty: number }[];
        const draft = drafts[oid] ?? {};
        const dimCls = o.fulfilled
          ? "opacity-55 grayscale-[.6] transition-all group-hover:opacity-85 group-hover:grayscale-[.25]"
          : "";

        return (
          <div
            key={oid}
            className={cn(orderCardCls, "group", !isOpen && "opacity-[.82]")}
            style={
              // Neon halo marks orders placed by website customers themselves;
              // staff-entered orders (admin phone / seller direct) stay plain.
              // The sunguard landing page gets its own pink neon so it's
              // visually distinct from other customer-placed orders (blue) —
              // checkout, collagen, and glutathione orders all share that
              // blue halo (#00D1FF), distinguished from each other only by
              // their badge tag below.
              isSunguardOrder
                ? {
                    borderColor: "#FF2EC4",
                    boxShadow:
                      "inset 4px 0 0 #FF2EC4, 0 0 14px rgba(255,46,196,.35)",
                  }
                : !isStaffOrder
                  ? {
                      borderColor: "#00D1FF",
                      boxShadow:
                        "inset 4px 0 0 #00D1FF, 0 0 14px rgba(0,209,255,.30)",
                    }
                  : undefined
            }
          >
            {/* always-visible summary — click to fold/unfold */}
            <div
              className="cursor-pointer select-none"
              onClick={() =>
                setFolds((f) => {
                  const next = { ...f, [oid]: !isOpen };
                  // Expanding a card collapses every other already-delivered
                  // order, so opening one parcel doesn't leave a wall of
                  // finished ones stuck open alongside it.
                  if (!isOpen) {
                    for (const other of list) {
                      const otherId = String(other.id);
                      if (otherId !== oid && isDelivered(other))
                        next[otherId] = false;
                    }
                  }
                  return next;
                })
              }
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className={o.fulfilled ? tagOk : tagInfo}>
                    {o.fulfilled ? "تم التنفيذ" : "جديد"}
                  </span>
                  {o.source === "admin_phone" && (
                    <span className="mr-1 inline-block rounded-full bg-[var(--purple-bg)] px-[9px] py-[2px] text-[.72rem] font-extrabold text-[var(--purple-ink)]">
                      📞 أدخلتيه بنفسك
                    </span>
                  )}
                  {o.source === "seller_direct" && (
                    <span className="mr-1 inline-block rounded-full bg-[rgba(217,168,108,.18)] px-[9px] py-[2px] text-[.72rem] text-[var(--gold)]">
                      🧾 بائع مباشر
                    </span>
                  )}
                  {o.source === "landing_collagen" && (
                    <span className="mr-1 inline-block rounded-full bg-[var(--teal-bg)] px-[9px] py-[2px] text-[.72rem] font-extrabold text-[var(--teal-ink)]">
                      🧴 صفحة الكولاجين
                    </span>
                  )}
                  {o.source === "landing_glutathione" && (
                    <span className="mr-1 inline-block rounded-full bg-[var(--cyan-bg)] px-[9px] py-[2px] text-[.72rem] font-extrabold text-[var(--cyan-ink)]">
                      💊 صفحة الجلوتاثيون
                    </span>
                  )}
                  {isSunguardOrder && (
                    <span className="mr-1 inline-block rounded-full bg-[var(--pink-bg)] px-[9px] py-[2px] text-[.72rem] font-extrabold text-[var(--pink-ink)]">
                      🍉 صفحة واقي الشمس
                    </span>
                  )}
                  {o.wilaya ? (
                    <span
                      className="mr-1 inline-block rounded-full px-[9px] py-[2px] text-[.72rem] font-extrabold"
                      style={{ background: oco.bg, color: oco.ink }}
                    >
                      {oco.icon} {oco.name} ·{" "}
                      {o.deliveryType === "office" ? "مكتب (Stop Desk)" : "منزل"}
                    </span>
                  ) : (
                    <span className="mr-1 inline-block rounded-full bg-[rgba(229,72,77,.16)] px-[9px] py-[2px] text-[.72rem] font-extrabold text-destructive">
                      📍 بانتظار تأكيد العنوان
                    </span>
                  )}
                  <b className="mr-1.5">{o.num ?? o.id}</b>
                  <div className="mt-1 text-[.78rem] text-[var(--ink-3)]">
                    {when ? fmtDate(when) : ""}
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-[1.1rem] font-black text-[var(--rose)]">
                    {priceFmt(o.total != null ? o.total : o.subtotal)}
                  </div>
                  {o.deliveryFee != null && (
                    <div className="mt-0.5 text-[.7rem] text-[var(--ink-3)]">
                      منتجات {priceFmt(o.subtotal)} + توصيل {priceFmt(o.deliveryFee)}
                    </div>
                  )}
                </div>
              </div>

              {/* customer / phone / location stay visible when folded */}
              <div className="flex flex-wrap gap-5 text-[.82rem] text-[var(--ink-2)]">
                <span>👤 {o.customer}</span>
                <span className="num">📱 {o.phone}</span>
                {o.wilaya && (
                  <>
                    <span>
                      📍 {o.wilaya} - {o.baladiya}
                    </span>
                    {o.address && <span>🏠 {o.address}</span>}
                    <span>
                      🚚 {o.deliveryType === "office" ? "مكتب (Stop Desk)" : "منزل"}
                      {o.deliveryFee != null ? ` · ${priceFmt(o.deliveryFee)}` : ""}
                    </span>
                  </>
                )}
              </div>

              <div className="mt-2.5 text-[.72rem] font-extrabold text-[var(--ink-3)]">
                {isOpen ? "▾ إخفاء التفاصيل" : "▸ عرض التفاصيل"}
              </div>
            </div>

            {/* grid-rows 0fr→1fr is the CSS trick for animating to/from an
                intrinsic ("auto") height — a plain max-height transition
                would need a guessed cap and either clip tall carts or
                animate a lot of empty space. */}
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-300 ease-in-out",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              )}
            >
              {/* inert while folded — the content is still in the DOM for
                  the height animation, but must stay untabbable and
                  invisible to screen readers, same as when it was unmounted. */}
              <div className="overflow-hidden" inert={!isOpen}>
                <div className={dimCls}>
                  {picList.length > 0 && (
                    <>
                      <div className="mt-2 flex gap-2.5 overflow-x-auto rounded-[11px] bg-[var(--card-2)] p-2.5">
                        {picList.map((pi, i) => (
                          <div key={i} className="relative flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={pi.img}
                              alt=""
                              loading="lazy"
                              onError={(e) => {
                                (e.currentTarget.parentElement as HTMLElement).style.display =
                                  "none";
                              }}
                              className="block h-24 w-24 rounded-[10px] border border-border bg-white object-cover"
                            />
                            {pi.qty > 1 && (
                              <b className="absolute -top-1.5 -right-1.5 flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-card bg-[#22C55E] px-[5px] text-[.72rem] font-black text-white">
                                ×{pi.qty}
                              </b>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="my-2 flex justify-center gap-1.5">
                        {(o.items ?? []).map((_, i) => (
                          <i key={i} className="block h-2 w-2 rounded-full bg-[#22C55E]" />
                        ))}
                      </div>
                    </>
                  )}

                  <div className={orderItemsCls}>
                    {(o.items ?? []).length
                      ? (o.items ?? []).map((it, i) => (
                          <div key={i}>
                            • {it.title} ×{it.qty ?? it.quantity ?? 1}
                          </div>
                        ))
                      : "—"}
                  </div>

                  {o.yalidine?.tracking && (
                    <div className="mt-2.5 rounded-[11px] bg-[var(--yal-bg)] px-4 py-3 text-[.84rem] text-[var(--yal-ink)]">
                      📦 طرد Yalidine: <b className="num">{o.yalidine.tracking}</b>
                      {o.yalidine.label && (
                        <>
                          {" · "}
                          <a
                            href={o.yalidine.label}
                            target="_blank"
                            className="text-[var(--yal-link)] underline"
                          >
                            طباعة الوصل
                          </a>
                        </>
                      )}
                    </div>
                  )}
                  {o.noest?.tracking && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-[11px] bg-[rgba(91,141,239,.12)] px-4 py-3 text-[.84rem] text-[var(--info-ink)]">
                      <input
                        type="checkbox"
                        title="تحديد للطباعة"
                        checked={!!noestSel[o.noest.tracking]}
                        onChange={(e) =>
                          setNoestSel((s) => ({
                            ...s,
                            [o.noest!.tracking!]: e.target.checked,
                          }))
                        }
                        className="h-[17px] w-[17px] flex-shrink-0 cursor-pointer accent-[#1E73E8]"
                      />
                      <span>🔵 طرد Noest:</span>
                      <a
                        href="#"
                        title="فتح وصل التوصيل PDF"
                        onClick={(e) => {
                          e.preventDefault();
                          void openNoestLabels([o.noest!.tracking!]);
                        }}
                        className="num font-extrabold text-[var(--info-ink)] underline"
                      >
                        {o.noest.tracking}
                      </a>
                      <span>
                        ·{" "}
                        {o.noest.validated
                          ? "مُثبَّت ✓"
                          : "جاهز في «prêt à expédier» — أكّديه في Noest للشحن"}
                      </span>
                    </div>
                  )}
                  {o.zr?.tracking && (
                    <div className="mt-2.5 rounded-[11px] bg-[rgba(232,164,19,.12)] px-4 py-3 text-[.84rem] text-[var(--warn-ink)]">
                      🟡 طرد ZR Express: <b className="num">{o.zr.tracking}</b> ·{" "}
                      <span className="text-[.78rem]">الوصل يُطبع من لوحة ZR</span>
                    </div>
                  )}
                </div>

                <TrackStepper
                  o={o}
                  busy={!!busy[`track:${oid}`]}
                  onRefresh={() => refreshTracking(oid)}
                />

                <div className={dimCls}>
                  {carrier ? (
                    o.deliveryLabel && (
                      <div className="mt-3 text-[.8rem] text-[var(--ink-2)]">
                        📝 اسم المنتج على الوصل:{" "}
                        <b className="text-foreground">{o.deliveryLabel}</b>
                        {o.parcelPrice != null && (
                          <>
                            {" "}
                            · 💰 سعر الطرد:{" "}
                            <b className="num text-foreground">
                              {priceFmt(o.parcelPrice)}
                            </b>
                          </>
                        )}
                      </div>
                    )
                  ) : (
                    <>
                      <div className="mt-3.5">
                        <label className="mb-1.5 block text-[.74rem] font-extrabold text-[var(--ink-2)]">
                          📝 اسم المنتج على وصل التوصيل{" "}
                          <span className="text-destructive">*</span>
                        </label>
                        <input
                          className={cn(inp, "px-3.5 py-[.55rem] text-[.85rem]")}
                          value={draft.note ?? o.deliveryLabel ?? ""}
                          placeholder="مثال: منتج تجميل — لن يظهر الاسم الحقيقي"
                          onChange={(e) =>
                            setDrafts((d) => ({
                              ...d,
                              [oid]: { ...d[oid], note: e.target.value },
                            }))
                          }
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v === (o.deliveryLabel ?? "")) return;
                            patchOrder(oid, { deliveryLabel: v });
                            updateDocIn("orders", oid, { deliveryLabel: v }).catch(
                              (err) => console.error(err)
                            );
                          }}
                        />
                      </div>
                      <div className="mt-2.5">
                        <label className="mb-1.5 block text-[.74rem] font-extrabold text-[var(--ink-2)]">
                          💰 سعر جديد للطرد (اختياري)
                        </label>
                        <input
                          className={cn(inp, "px-3.5 py-[.55rem] text-[.85rem]")}
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={
                            draft.price ??
                            (o.parcelPrice != null ? String(o.parcelPrice) : "")
                          }
                          placeholder={`اتركيه فارغاً لإبقاء ${o.total != null ? o.total : o.subtotal} د.ج`}
                          onChange={(e) =>
                            setDrafts((d) => ({
                              ...d,
                              [oid]: { ...d[oid], price: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </>
                  )}
                  <div className={`${rowActions} mt-3.5`}>
                    <a
                      className={btn("green", true)}
                      href={`https://wa.me/${waIntl(o.phone)}`}
                      target="_blank"
                    >
                      💬 واتساب
                    </a>
                    {!carrier &&
                      (Object.keys(CO) as CarrierKey[]).map((co) => {
                        const bright = !o.deliveryCompany || o.deliveryCompany === co;
                        const key = `parcel:${co}:${oid}`;
                        return (
                          <button
                            key={co}
                            type="button"
                            disabled={!!busy[key]}
                            title={
                              o.deliveryCompany === co
                                ? "اختيار الزبون"
                                : o.deliveryCompany
                                  ? `الزبون اختار ${CO[o.deliveryCompany as CarrierKey]?.name ?? o.deliveryCompany}`
                                  : ""
                            }
                            onClick={() => requestCreateParcel(co, o)}
                            className={btn("blue", true)}
                            style={{
                              background: CO[co].color,
                              ...(bright
                                ? {}
                                : { opacity: 0.38, filter: "grayscale(.5)" }),
                            }}
                          >
                            {busy[key]
                              ? "⏳ جاري الإنشاء..."
                              : `${CO[co].icon} طرد ${CO[co].name}`}
                          </button>
                        );
                      })}
                    {(() => {
                      const locked = o.fulfilled && isPastCancelWindow(o);
                      return (
                        <button
                          type="button"
                          className={btn("gray", true)}
                          disabled={!!busy[`reset:${oid}`] || locked}
                          title={
                            locked
                              ? `تم تأكيد الطرد لدى ${carrier ? CO[carrier].name : "شركة التوصيل"} ولم يعد قابلاً للإلغاء`
                              : undefined
                          }
                          onClick={() => toggleFulfilled(o)}
                        >
                          {busy[`reset:${oid}`]
                            ? "⏳ جاري الإلغاء..."
                            : o.fulfilled
                              ? "↩ تعليم كجديد"
                              : "✓ تم التنفيذ"}
                        </button>
                      );
                    })()}
                    <button
                      type="button"
                      className={btn("danger", true)}
                      onClick={() => delOrder(oid)}
                    >
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

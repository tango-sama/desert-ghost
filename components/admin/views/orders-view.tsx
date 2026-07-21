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
  CO,
  CREATE_FN,
  orderCarrier,
  orderDate,
  startsFolded,
} from "@/components/admin/carriers";
import { nowMs } from "@/lib/time";

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
            <span className="whitespace-nowrap rounded-full bg-[rgba(229,72,77,.2)] px-2.5 py-1 text-[.75rem] font-extrabold text-[var(--alert-ink)]">
              ⚠️ {ts.alert || "—"}
            </span>
          ) : hasAlert ? (
            <span className="whitespace-nowrap rounded-full bg-[var(--alert-bg)] px-2.5 py-1 text-[.75rem] font-extrabold text-[var(--alert-ink)]">
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
                if (e.location) bits.push(`📍 ${e.location}`);
                if (e.causer) bits.push(`causer: ${e.causer}`);
                if (e.content)
                  bits.push(
                    <span key="c" className={cn("font-bold", CLR_INK[cls])}>
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

  // After a refresh, drop the order's fold override so the default folding
  // applies again — a parcel that just turned "delivered" folds right away.
  function clearFold(oid: string) {
    setFolds((f) => {
      if (!(oid in f)) return f;
      const n = { ...f };
      delete n[oid];
      return n;
    });
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
      clearFold(orderId);
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
        parcelId?: string;
        label?: string;
        validated?: boolean;
        alreadyCreated?: boolean;
      }>(CREATE_FN[co], { orderId });
      patchOrder(orderId, {
        // Keep the ZR parcelId so the parcel is recognized as created even
        // before its tracking number resolves — otherwise the card would
        // fall back to showing the create buttons again (see orderCarrier).
        [co]: {
          tracking: d.tracking,
          parcelId: d.parcelId,
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

  async function toggleFulfilled(o: Order) {
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

      {list.map((o) => {
        const oid = String(o.id);
        const oco = CO[(o.deliveryCompany as CarrierKey) ?? "yalidine"] ?? CO.yalidine;
        const carrier = orderCarrier(o);
        const when = orderDate(o);
        const isOpen = cardOpen(o);
        const isStaffOrder =
          o.source === "admin_phone" || o.source === "seller_direct";
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
              !isStaffOrder
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
              onClick={() => setFolds((f) => ({ ...f, [oid]: !isOpen }))}
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

            {isOpen && (
              <>
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
                  {(o.zr?.tracking || o.zr?.parcelId) && (
                    <div className="mt-2.5 rounded-[11px] bg-[rgba(232,164,19,.12)] px-4 py-3 text-[.84rem] text-[var(--warn-ink)]">
                      {o.zr?.tracking ? (
                        <>
                          🟡 طرد ZR Express: <b className="num">{o.zr.tracking}</b> ·{" "}
                          <span className="text-[.78rem]">الوصل يُطبع من لوحة ZR</span>
                        </>
                      ) : (
                        <>
                          🟡 تم إنشاء طرد ZR Express ✓ ·{" "}
                          <span className="text-[.78rem]">
                            رقم التتبع سيظهر قريباً — حدِّثي بـ 🔄 أو من لوحة ZR
                          </span>
                        </>
                      )}
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
                            onClick={() => createParcel(co, oid)}
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
                    <button
                      type="button"
                      className={btn("gray", true)}
                      onClick={() => toggleFulfilled(o)}
                    >
                      {o.fulfilled ? "↩ تعليم كجديد" : "✓ تم التنفيذ"}
                    </button>
                    <button
                      type="button"
                      className={btn("danger", true)}
                      onClick={() => delOrder(oid)}
                    >
                      حذف
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

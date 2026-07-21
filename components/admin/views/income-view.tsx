"use client";

import { useState } from "react";
import { priceFmt } from "@/lib/firebase";
import { addDocIn, deleteDocIn, type Order } from "@/lib/admin";
import { useAdminStore } from "@/stores/admin-store";
import { CO, confirmStamp } from "@/components/admin/carriers";
import { cn } from "@/lib/utils";
import { inp, btn, cardCls, EmptyState, fmtDate } from "@/components/admin/ui";

// Sales income = final package price (parcelPrice override or order total)
// minus the delivery fee, counted for fulfilled orders only.
function saleStamp(o: Order): number {
  const c = confirmStamp(o);
  if (c > 1) return c;
  return o.placedAt?.seconds ? o.placedAt.seconds * 1000 : o.createdAt || 0;
}

type Row = {
  type: "in" | "out";
  ts: number;
  amount: number;
  label: string;
  order?: Order;
  price?: number;
  id?: string;
};

function StatCard({
  title,
  value,
  color,
  sub,
}: {
  title: string;
  value: number;
  color: string;
  sub?: string;
}) {
  return (
    <div className={cn(cardCls, "m-0 mb-0 text-center")}>
      <div className="mb-2 text-[.76rem] font-extrabold text-[var(--ink-3)]">
        {title}
      </div>
      <div className="num text-[1.45rem] font-black" style={{ color }}>
        {priceFmt(value)}
      </div>
      {sub && (
        <div className="mt-1.5 text-[.68rem] text-[var(--ink-3)]">{sub}</div>
      )}
    </div>
  );
}

export function IncomeView() {
  const orders = useAdminStore((s) => s.orders);
  const expenses = useAdminStore((s) => s.expenses);
  const toast = useAdminStore((s) => s.toast);

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // expanded sale rows survive live re-renders (onSnapshot updates)
  const [openLedger, setOpenLedger] = useState<Record<string, boolean>>({});

  const sales: Row[] = orders
    .filter((o) => o.fulfilled)
    .map((o) => {
      const price =
        Number(o.parcelPrice != null ? o.parcelPrice : o.total != null ? o.total : o.subtotal) || 0;
      return {
        type: "in",
        ts: saleStamp(o),
        amount: price - (Number(o.deliveryFee) || 0),
        label: `🛍️ طلب ${o.num ?? o.id}` + (o.customer ? ` — ${o.customer}` : ""),
        order: o,
        price,
      };
    });
  const exps: Row[] = expenses.map((e) => ({
    type: "out",
    ts: Number(e.createdAt) || 0,
    amount: Number(e.amount) || 0,
    label: `📦 ${e.note || "مصاريف بضاعة"}`,
    id: e.id,
  }));
  const rows = sales.concat(exps).sort((a, b) => b.ts - a.ts);
  const incomeTotal = sales.reduce((s, r) => s + r.amount, 0);
  const expTotal = exps.reduce((s, r) => s + r.amount, 0);
  const net = incomeTotal - expTotal;

  async function addExpense() {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast("أدخلي مبلغاً صحيحاً");
      return;
    }
    setBusy(true);
    try {
      // the live expenses watcher delivers the new row instantly
      await addDocIn("expenses", { amount: amt, note, createdAt: Date.now() });
      setAmount("");
      setNote("");
      toast("تم تسجيل المصروف ✓");
    } catch (e) {
      console.error(e);
      toast("فشل الحفظ");
    } finally {
      setBusy(false);
    }
  }

  async function delExpense(id: string) {
    if (!confirm("حذف هذا المصروف؟")) return;
    try {
      await deleteDocIn("expenses", id);
      toast("تم الحذف");
    } catch (e) {
      console.error(e);
      toast("فشل الحذف");
    }
  }

  const amtCls =
    "whitespace-nowrap px-4 py-3 text-left font-black [direction:ltr] border-t border-border";

  return (
    <div>
      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <StatCard
          title="إجمالي الدخل"
          value={incomeTotal}
          color="#22c55e"
          sub={`من ${sales.length} طلب منفَّذ — بدون رسوم التوصيل`}
        />
        <StatCard
          title="إجمالي المصاريف"
          value={expTotal}
          color="#ef4444"
          sub={`${exps.length} مصروف`}
        />
        <StatCard
          title="صافي الربح"
          value={net}
          color={net >= 0 ? "#22c55e" : "#ef4444"}
          sub="الدخل − المصاريف"
        />
      </div>

      <div className={cardCls}>
        <h3 className="mb-3.5 font-black">➕ إضافة مصاريف (شراء بضاعة جديدة...)</h3>
        <div className="flex flex-wrap gap-3">
          <input
            className={cn(inp, "max-w-[180px] text-right [direction:ltr]")}
            type="number"
            min={1}
            placeholder="المبلغ (د.ج)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <input
            className={cn(inp, "min-w-[200px] flex-1")}
            placeholder="ملاحظة — مثال: شراء كولاجين ×20"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            type="button"
            className={btn("danger")}
            disabled={busy}
            onClick={addExpense}
          >
            تسجيل المصروف
          </button>
        </div>
      </div>

      <div className={cn(cardCls, "overflow-x-auto p-0")}>
        {rows.length ? (
          <table className="w-full border-collapse text-[.88rem]">
            <thead>
              <tr>
                <th className="border-b border-border px-4 py-3 text-right text-[.74rem] font-extrabold text-[var(--ink-3)]">
                  التاريخ
                </th>
                <th className="border-b border-border px-4 py-3 text-right text-[.74rem] font-extrabold text-[var(--ink-3)]">
                  البيان
                </th>
                <th className="border-b border-border px-4 py-3 text-right text-[.74rem] font-extrabold text-[var(--ink-3)]">
                  المبلغ
                </th>
                <th className="border-b border-border px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const o = r.order;
                const oid = o ? String(o.id) : "";
                const track = o
                  ? o.noest?.tracking || o.yalidine?.tracking || o.zr?.tracking || ""
                  : "";
                const oco = o
                  ? (CO[o.deliveryCompany as keyof typeof CO] ?? CO.yalidine)
                  : null;
                return (
                  <FragmentRow key={oid || r.id || idx}>
                    <tr
                      className={cn(o && "cursor-pointer")}
                      title={o ? "اضغطي لعرض التفاصيل" : undefined}
                      onClick={
                        o
                          ? () =>
                              setOpenLedger((s) => ({ ...s, [oid]: !s[oid] }))
                          : undefined
                      }
                    >
                      <td
                        className="whitespace-nowrap border-t border-border px-4 py-3 text-[.78rem] text-[var(--ink-2)]"
                        style={{
                          borderRight: `3px solid ${r.type === "in" ? "#22c55e" : "#ef4444"}`,
                        }}
                      >
                        {r.ts ? fmtDate(r.ts) : "—"}
                      </td>
                      <td className="border-t border-border px-4 py-3 text-[var(--ink-2)]">
                        {r.label}
                        {o && (
                          <span className="text-[.68rem] text-[var(--ink-3)]"> ▾</span>
                        )}
                      </td>
                      <td
                        className={amtCls}
                        style={{ color: r.type === "in" ? "#22c55e" : "#ef4444" }}
                      >
                        {r.type === "in" ? "+" : "−"}
                        {Number(r.amount).toLocaleString("en-US")} د.ج
                      </td>
                      <td className="border-t border-border px-4 py-3 text-left">
                        {r.type === "out" && r.id && (
                          <button
                            type="button"
                            className={btn("danger", true)}
                            onClick={(e) => {
                              e.stopPropagation();
                              void delExpense(r.id!);
                            }}
                          >
                            حذف
                          </button>
                        )}
                      </td>
                    </tr>
                    {o && openLedger[oid] && (
                      <tr>
                        <td
                          colSpan={4}
                          className="bg-[rgba(127,127,127,.06)] px-5 py-4"
                        >
                          <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4 text-[.83rem] leading-[1.9]">
                            <div>
                              <b>🛒 المنتجات</b>
                              <br />
                              {(o.items ?? []).length
                                ? (o.items ?? []).map((it, i) => (
                                    <div key={i}>
                                      • {it.title} ×{it.qty ?? it.quantity ?? 1} —{" "}
                                      {priceFmt(it.price)}
                                    </div>
                                  ))
                                : "—"}
                            </div>
                            <div>
                              <b>👤 الزبون</b>
                              <br />
                              {o.customer || "—"}
                              <br />
                              <span className="num">📱 {o.phone || "—"}</span>
                              <br />
                              📍 {o.wilaya || ""} - {o.baladiya || ""}
                              {o.address && (
                                <>
                                  <br />
                                  🏠 {o.address}
                                </>
                              )}
                            </div>
                            <div>
                              <b>🚚 التوصيل</b>
                              <br />
                              {oco!.icon} {oco!.name} ·{" "}
                              {o.deliveryType === "office"
                                ? "مكتب (Stop Desk)"
                                : "منزل"}
                              {track && (
                                <>
                                  <br />
                                  رقم التتبع: <span className="num">{track}</span>
                                </>
                              )}
                            </div>
                            <div>
                              <b>💰 الحساب</b>
                              <br />
                              سعر الطرد:{" "}
                              <span className="num">
                                {Number(r.price).toLocaleString("en-US")}
                              </span>{" "}
                              د.ج
                              {o.parcelPrice != null && (
                                <span className="text-[.72rem] text-[var(--ink-3)]">
                                  {" "}
                                  (سعر معدَّل)
                                </span>
                              )}
                              <br />− التوصيل:{" "}
                              <span className="num">
                                {Number(o.deliveryFee || 0).toLocaleString("en-US")}
                              </span>{" "}
                              د.ج
                              <br />= الدخل:{" "}
                              <b className="num" style={{ color: "#22c55e" }}>
                                {Number(r.amount).toLocaleString("en-US")}
                              </b>{" "}
                              د.ج
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </FragmentRow>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState
            icon="💰"
            text="لا توجد حركات بعد — نفّذي طلباً أو سجّلي مصروفاً"
          />
        )}
      </div>
    </div>
  );
}

// tbody needs keyed fragments that can hold two <tr>s
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

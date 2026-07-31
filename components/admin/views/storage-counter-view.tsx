"use client";

import { useMemo, useState } from "react";
import { productImages, type Product } from "@/lib/firebase";
import { updateDocIn, type Order } from "@/lib/admin";
import { useAdminStore } from "@/stores/admin-store";
import {
  sel,
  tagCls,
  tblWrap,
  thCls,
  tdCls,
  EmptyState,
  Pager,
  transparent,
} from "@/components/admin/ui";

const PER_PAGE = 20;
const TRACK_ICONS_LEN = 5; // fallback when a tracked order has no stageLabels yet

type Stats = { sending: number; delivered: number; returned: number };

function itemQty(it: { qty?: number; quantity?: number }): number {
  return it.qty ?? it.quantity ?? 1;
}

// Same delivered/return derivation orders-view.tsx's stepper uses:
// stage == null → return/cancel; last stage reached with no alert → delivered;
// everything else placed-but-not-yet-resolved → sending.
function classifyOrder(o: Order): "delivered" | "sending" {
  const ts = o.trackingStatus;
  if (!ts || ts.stage == null) return "sending";
  const lastIdx = (ts.stageLabels?.length ?? TRACK_ICONS_LEN) - 1;
  if (!ts.alert && ts.stage === lastIdx) return "delivered";
  return "sending";
}

export function StorageCounterView() {
  const products = useAdminStore((s) => s.products);
  const categories = useAdminStore((s) => s.categories);
  const orders = useAdminStore((s) => s.orders);
  const toast = useAdminStore((s) => s.toast);

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const catMap = useMemo(() => {
    const m: Record<string, string> = {};
    categories.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [categories]);

  // Return tracking doesn't exist yet (order cards have no "mark as failed
  // delivery" flag) — every product's `returned` stays 0 until that future
  // feature lands and this can read a real signal off each order.
  const statsById = useMemo(() => {
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
  }, [orders]);

  const list = useMemo(() => {
    let l = products.slice();
    if (filter !== "all") l = l.filter((p) => p.category === filter);
    if (search) {
      const q = search.toLowerCase();
      l = l.filter((p) => String(p.title ?? "").toLowerCase().includes(q));
    }
    return l.sort((a, b) => String(a.title ?? "").localeCompare(String(b.title ?? "")));
  }, [products, filter, search]);

  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const curPage = Math.min(page, pages);
  const pageItems = list.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE);

  function patchProducts(fn: (ps: Product[]) => Product[]) {
    useAdminStore.setState((s) => ({ products: fn(s.products) }));
  }

  async function saveStock(id: string | number, value: number) {
    const n = Math.max(0, Math.round(value) || 0);
    patchProducts((ps) => ps.map((x) => (String(x.id) === String(id) ? { ...x, stock: n } : x)));
    try {
      await updateDocIn("products", id, { stock: n });
    } catch (e) {
      console.error(e);
      toast("فشل حفظ الكمية");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-4">
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-[220px] rounded-full border-[1.5px] border-input bg-[var(--card-2)] px-4 py-[.55rem] text-foreground outline-none placeholder:text-[var(--ink-3)] focus:border-[var(--rose)]"
            placeholder="بحث..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value.trim());
              setPage(1);
            }}
          />
          <select
            className={sel}
            style={{ width: "auto" }}
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">كل التصنيفات</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={tblWrap}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls} style={{ width: 34 }}>
                  #
                </th>
                <th className={thCls}>المنتج</th>
                <th className={thCls}>التصنيف</th>
                <th className={thCls}>الكمية الأساسية</th>
                <th className={thCls}>في المحل</th>
                <th className={thCls}>قيد الشحن</th>
                <th className={thCls}>المرتجعة</th>
                <th className={thCls}>تم التسليم</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length ? (
                pageItems.map((p, i) => {
                  const stats = statsById[p.id] ?? { sending: 0, delivered: 0, returned: 0 };
                  const stock = Number(p.stock ?? 0);
                  const closet = Math.max(0, stock - stats.sending - stats.delivered - stats.returned);
                  return (
                    <tr key={p.id}>
                      <td className={`${tdCls} num`}>
                        {(curPage - 1) * PER_PAGE + i + 1}
                      </td>
                      <td className={tdCls}>
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={productImages(p)[0] || transparent()}
                            alt=""
                            onError={(e) => {
                              e.currentTarget.src = transparent();
                            }}
                            className="h-[42px] w-[42px] flex-shrink-0 rounded-[9px] bg-[var(--card-2)] object-cover"
                          />
                          <span>{p.title ?? p.name}</span>
                        </div>
                      </td>
                      <td className={tdCls}>
                        <span className={tagCls}>
                          {catMap[p.category ?? ""] ?? p.category ?? "—"}
                        </span>
                      </td>
                      <td className={tdCls}>
                        <input
                          type="number"
                          min={0}
                          defaultValue={stock}
                          key={`${p.id}-${stock}`}
                          onBlur={(e) => {
                            const n = Number(e.target.value);
                            if (n !== stock) void saveStock(p.id, n);
                          }}
                          className="w-20 rounded-[9px] border-[1.5px] border-input bg-[var(--card-2)] px-2 py-1 text-center text-foreground outline-none focus:border-[var(--rose)]"
                        />
                      </td>
                      <td className={`${tdCls} num font-extrabold`}>{closet}</td>
                      <td className={`${tdCls} num`}>{stats.sending}</td>
                      <td className={`${tdCls} num text-[var(--ink-3)]`} title="قريباً — سيتم ربطها عند إضافة تعليم الطلبات كمرتجعة">
                        {stats.returned}
                      </td>
                      <td className={`${tdCls} num`}>{stats.delivered}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8}>
                    <EmptyState icon="🧮" text="لا توجد منتجات" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pager page={curPage} pages={pages} onPage={setPage} />
    </div>
  );
}

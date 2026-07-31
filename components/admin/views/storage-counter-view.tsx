"use client";

import { useMemo, useState } from "react";
import { productImages, type Product } from "@/lib/firebase";
import { updateDocIn, type Order } from "@/lib/admin";
import { useAdminStore } from "@/stores/admin-store";
import {
  sel,
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

function closetFor(stock: number, stats: Stats): number {
  return Math.max(0, stock - stats.sending - stats.delivered - stats.returned);
}

const EMPTY_STATS: Stats = { sending: 0, delivered: 0, returned: 0 };

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
    // High to low by "في المحل" (computed closet quantity).
    return l.sort((a, b) => {
      const aCloset = closetFor(Number(a.stock ?? 0), statsById[a.id] ?? EMPTY_STATS);
      const bCloset = closetFor(Number(b.stock ?? 0), statsById[b.id] ?? EMPTY_STATS);
      return bCloset - aCloset;
    });
  }, [products, filter, search, statsById]);

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
        {/* Bounded + independently scrollable (both axes) so the sticky
            header has a real scroll container to stick within — a header
            made `sticky` inside a plain `overflow-x-auto` div never sticks,
            because that div's forced `overflow-y: auto` (a side effect of
            setting `overflow-x`) still becomes the header's containing
            scroll box, and that box's own scrollTop never moves since the
            page scrolls around it instead. */}
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${thCls} sticky top-0 z-[5] bg-card`} style={{ width: 34 }}>
                  #
                </th>
                <th className={`${thCls} sticky top-0 z-[5] bg-card`}>الكمية الأساسية</th>
                <th className={`${thCls} sticky top-0 z-[5] bg-card`}>المنتج</th>
                <th className={`${thCls} sticky top-0 z-[5] bg-card`}>في المحل</th>
                <th className={`${thCls} sticky top-0 z-[5] bg-card`}>قيد الشحن</th>
                <th className={`${thCls} sticky top-0 z-[5] bg-card`}>المرتجعة</th>
                <th className={`${thCls} sticky top-0 z-[5] bg-card`}>تم التسليم</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length ? (
                pageItems.map((p, i) => {
                  const stats = statsById[p.id] ?? EMPTY_STATS;
                  const stock = Number(p.stock ?? 0);
                  const closet = closetFor(stock, stats);
                  return (
                    <tr key={p.id}>
                      <td className={`${tdCls} num`}>
                        {(curPage - 1) * PER_PAGE + i + 1}
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
                      <td className={`${tdCls} num font-extrabold text-[var(--ok-ink)]`}>{closet}</td>
                      <td className={`${tdCls} num text-[var(--info-ink)]`}>{stats.sending}</td>
                      <td className={`${tdCls} num text-[var(--alert-ink)]`} title="قريباً — سيتم ربطها عند إضافة تعليم الطلبات كمرتجعة">
                        {stats.returned}
                      </td>
                      <td className={`${tdCls} num`}>{stats.delivered}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>
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

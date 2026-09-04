"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { Category, Product } from "@/lib/firebase";
import { priceNum } from "@/lib/firebase";
import { catColor, hexToRgba } from "@/lib/colors";
import { trackPixelEvent } from "@/lib/meta-pixel";
import { ProductCard } from "@/components/storefront/product-card";

type Sort = "quantity" | "new" | "price-asc" | "price-desc" | "name";

const selectClass =
  "cursor-pointer rounded-full border-[1.5px] border-[var(--line)] bg-card px-5 py-3 text-[0.88rem] text-foreground outline-none transition-colors";

export function ProductsBrowser({
  products,
  categories,
  initialCat,
  initialQuery = "",
}: {
  products: Product[];
  categories: Category[];
  initialCat: string;
  initialQuery?: string;
}) {
  const router = useRouter();
  const [activeCat, setActiveCat] = useState(initialCat);
  const [search, setSearch] = useState(initialQuery);
  const [sort, setSort] = useState<Sort>("quantity");

  const catMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories]
  );
  const visibleCats = categories.filter((c) => c.visible !== false);

  // A `?cat=` aimed at a hidden (or deleted) category still filters the grid,
  // so it needs an option of its own: without one the native select would show
  // «كل التصنيفات» while the page is in fact filtered to that category.
  const catOptions = visibleCats.map((c) => ({ id: c.id, name: c.name }));
  if (activeCat !== "all" && !catOptions.some((o) => o.id === activeCat))
    catOptions.push({ id: activeCat, name: catMap[activeCat] || activeCat });

  // Carries the per-category accent the tiles/buttons used, tinting the closed
  // select — option colours are not stylable across browsers, so the control
  // itself is where the colour has to live.
  const activeCatObj = categories.find((c) => c.id === activeCat);
  const activeCatColor = activeCatObj ? catColor(activeCatObj) : null;

  const list = useMemo(() => {
    let items = products.slice();
    if (activeCat !== "all") items = items.filter((p) => p.category === activeCat);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter((p) =>
        `${p.title || p.name || ""} ${p.subtitle || ""} ${catMap[p.category ?? ""] || ""}`
          .toLowerCase()
          .includes(q)
      );
    }
    if (sort === "price-asc") items.sort((a, b) => priceNum(a.price) - priceNum(b.price));
    else if (sort === "price-desc") items.sort((a, b) => priceNum(b.price) - priceNum(a.price));
    else if (sort === "name")
      items.sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ar"));
    else if (sort === "new")
      items.sort(
        (a, b) => (Number(b.lastModified ?? b.id) || 0) - (Number(a.lastModified ?? a.id) || 0)
      );
    // "quantity" (the default) is the order `products` already arrives in:
    // the page sorted it most-in-closet first server-side, where the closet
    // counts stay (app/(storefront)/products/page.tsx, lib/closet-sort.ts).
    // Filtering above preserves it, so there is nothing to sort here.
    return items;
  }, [products, activeCat, search, sort, catMap]);

  // Fires a `Search` event ~600ms after the customer stops typing, not per
  // keystroke — and only once per distinct settled query (a query typed,
  // cleared, then retyped identically fires again; one that just keeps
  // matching the same debounce window doesn't). Skips the empty string
  // (clearing the box, or the initial `initialQuery=""` default, isn't a
  // search). Any pending timer is cleared on the next keystroke/unmount.
  const lastSearchTracked = useRef("");
  useEffect(() => {
    const q = search.trim();
    if (!q) return;
    const timer = setTimeout(() => {
      if (q === lastSearchTracked.current) return;
      lastSearchTracked.current = q;
      trackPixelEvent("Search", { search_string: q });
    }, 600);
    return () => clearTimeout(timer);
  }, [search]);

  const title = activeCat === "all" ? "كل المنتجات" : catMap[activeCat] || "المنتجات";

  function selectCat(cat: string) {
    setActiveCat(cat);
    const url = cat === "all" ? "/products" : `/products?cat=${encodeURIComponent(cat)}`;
    router.replace(url, { scroll: false });
  }

  return (
    <div>
      <div className="mx-auto max-w-[1320px] px-5 pt-10 pb-4 text-center md:px-12 md:pt-12">
        <span className="mb-3.5 inline-block rounded-full border border-[rgba(217,168,108,.5)] bg-[rgba(217,168,108,.14)] px-4.5 py-1.5 text-[0.74rem] font-extrabold tracking-[.3px] text-[var(--rose-deep)]">
          مجموعتنا الكاملة
        </span>
        <h1 className="inline-block bg-gradient-to-br from-[var(--rose-deep)] to-[var(--gold)] bg-clip-text text-[clamp(1.8rem,4vw,2.7rem)] leading-[1.15] font-black text-transparent">
          {title}
        </h1>
        <div className="mx-auto mt-3.5 h-[3px] w-20 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--rose)]" />
      </div>

      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4 px-5 py-6 md:px-12">
        <div className="relative min-w-60 max-w-105 flex-1">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحثي عن منتج..."
            className="w-full rounded-full border-[1.5px] border-[var(--line)] bg-card py-3.5 pr-5 pl-11 text-[0.92rem] text-foreground outline-none transition-colors focus:border-[var(--rose)]"
          />
          <Search className="absolute right-4 top-1/2 size-4.5 -translate-y-1/2 text-[var(--ink-3)]" />
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:flex-nowrap md:gap-4">
          <span className="w-full text-[0.82rem] font-semibold text-[var(--ink-3)] md:w-auto">
            {list.length} منتج
          </span>
          <select
            value={activeCat}
            onChange={(e) => selectCat(e.target.value)}
            aria-label="التصنيف"
            style={
              activeCatColor
                ? {
                    background: hexToRgba(activeCatColor, 0.14),
                    borderColor: hexToRgba(activeCatColor, 0.5),
                  }
                : undefined
            }
            className={`${selectClass} flex-1 truncate md:max-w-60 md:flex-none`}
          >
            <option value="all">كل التصنيفات</option>
            {catOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="الترتيب"
            className={`${selectClass} flex-1 md:flex-none`}
          >
            <option value="quantity">الأكثر توفراً</option>
            <option value="new">الأحدث</option>
            <option value="price-asc">السعر: من الأقل</option>
            <option value="price-desc">السعر: من الأعلى</option>
            <option value="name">الاسم</option>
          </select>
        </div>
      </div>

      <div className="mx-auto max-w-[1320px] px-5 pt-2 pb-16 md:px-12">
        {list.length === 0 ? (
          <div className="py-16 text-center font-bold text-[var(--ink-3)]">
            <div className="mb-4 text-5xl">🔍</div>
            لا توجد منتجات مطابقة
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {list.map((p) => (
              <ProductCard key={p.id} product={p} categoryName={catMap[p.category ?? ""]} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

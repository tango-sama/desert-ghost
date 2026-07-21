"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { Category, Product } from "@/lib/firebase";
import { priceNum } from "@/lib/firebase";
import { catColor, hexToRgba } from "@/lib/colors";
import { ProductCard } from "@/components/storefront/product-card";

type Sort = "new" | "price-asc" | "price-desc" | "name";

export function ProductsBrowser({
  products,
  categories,
  initialCat,
}: {
  products: Product[];
  categories: Category[];
  initialCat: string;
}) {
  const router = useRouter();
  const [activeCat, setActiveCat] = useState(initialCat);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("new");

  const catMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories]
  );
  const visibleCats = categories.filter((c) => c.visible !== false);

  const list = useMemo(() => {
    let items = products.slice();
    if (activeCat !== "all") items = items.filter((p) => p.category === activeCat);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter((p) =>
        `${p.title || p.name || ""} ${p.subtitle || ""}`.toLowerCase().includes(q)
      );
    }
    if (sort === "price-asc") items.sort((a, b) => priceNum(a.price) - priceNum(b.price));
    else if (sort === "price-desc") items.sort((a, b) => priceNum(b.price) - priceNum(a.price));
    else if (sort === "name")
      items.sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ar"));
    else
      items.sort(
        (a, b) => (Number(b.lastModified ?? b.id) || 0) - (Number(a.lastModified ?? a.id) || 0)
      );
    return items;
  }, [products, activeCat, search, sort]);

  const title = activeCat === "all" ? "كل المنتجات" : catMap[activeCat] || "المنتجات";

  function selectCat(cat: string) {
    setActiveCat(cat);
    const url = cat === "all" ? "/products" : `/products?cat=${encodeURIComponent(cat)}`;
    router.replace(url, { scroll: false });
  }

  return (
    <div>
      <div className="mx-auto max-w-[1320px] px-5 pt-30 pb-4 text-center md:px-12 md:pt-32">
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
        <div className="flex items-center gap-4">
          <span className="text-[0.82rem] font-semibold text-[var(--ink-3)]">{list.length} منتج</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="cursor-pointer rounded-full border-[1.5px] border-[var(--line)] bg-card px-5 py-3 text-[0.88rem] text-foreground outline-none"
          >
            <option value="new">الأحدث</option>
            <option value="price-asc">السعر: من الأقل</option>
            <option value="price-desc">السعر: من الأعلى</option>
            <option value="name">الاسم</option>
          </select>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1320px] grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5 px-5 pb-6 md:px-12">
        <button
          type="button"
          onClick={() => selectCat("all")}
          className={`flex min-h-11 items-center justify-center rounded-[22px] border-[1.5px] border-transparent bg-gradient-to-br from-[var(--rose)] to-[var(--rose-deep)] px-4 py-2.5 text-center text-[0.84rem] font-bold text-white transition-all hover:-translate-y-px ${
            activeCat === "all" ? "shadow-[0_6px_16px_rgba(224,114,140,.35)]" : ""
          }`}
        >
          الكل
        </button>
        {visibleCats.map((c) => {
          const color = catColor(c);
          const active = activeCat === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => selectCat(c.id)}
              style={
                active
                  ? { background: color, borderColor: color, color: "var(--ink)" }
                  : { background: hexToRgba(color, 0.14), borderColor: hexToRgba(color, 0.5), color: "var(--ink)" }
              }
              className={`flex min-h-11 items-center justify-center rounded-[22px] border-[1.5px] px-4 py-2.5 text-center text-[0.84rem] font-bold transition-all hover:-translate-y-px ${active ? "shadow-[0_6px_16px_rgba(0,0,0,.16)]" : ""}`}
            >
              {c.name}
            </button>
          );
        })}
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

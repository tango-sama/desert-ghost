import Link from "next/link";
import type { Category, Product } from "@/lib/firebase";
import { ProductCard } from "@/components/storefront/product-card";
import { SectionHead } from "@/components/storefront/section-head";
import { byRecency, sortByCloset, soldByProduct } from "@/lib/closet-sort";

const NEW_FOR_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_NEW = 3;

// Which products may carry the «جديد» badge.
//
// `lastModified` is an epoch-ms stamp on newer docs and absent on older ones,
// where byRecency() falls back to the document id. Only a value that is
// plausibly a millisecond timestamp counts as a date — an id-shaped number
// would otherwise mark half the catalog new.
//
// Capped at MAX_NEW because the badge is a distinction, not a fact: when the
// closet stats are unavailable the grid falls back to recency order, and
// without the cap every card in it would be badged «جديد», which tells a
// shopper nothing. The newest few keep it.
//
// Async, and awaited alongside the Firestore-backed reads below, because
// reading the clock is impure: it belongs in this page's data phase, not in
// its render body (react-hooks/purity).
async function newProductIds(products: Product[]): Promise<Set<string>> {
  const cutoff = Math.max(Date.now() - NEW_FOR_MS, 1e12);
  return new Set(
    products
      .filter((p) => Number(p.lastModified ?? 0) > cutoff)
      .sort(byRecency)
      .slice(0, MAX_NEW)
      .map((p) => p.id)
  );
}

export async function ProductGrid({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  // Most-in-closet first, same order the /products listing opens on
  // (lib/closet-sort.ts) — the top 8 of it are this section. `sold` is the
  // bucketed units-sold band behind each card's badge; both reads go through
  // the same guarded Admin SDK import and both degrade to "no badge, recency
  // order" rather than failing the page.
  const [sorted, sold, fresh] = await Promise.all([
    sortByCloset(products),
    soldByProduct(),
    newProductIds(products),
  ]);
  const top = sorted.slice(0, 8);

  return (
    <section id="collection" className="reveal mx-auto max-w-[1320px] px-5 py-20 md:px-12 md:py-24">
      <SectionHead label="الأكثر طلباً" title="أبرز المنتجات" />
      {top.length === 0 ? (
        <p className="py-8 text-center text-[var(--ink-3)]">لا توجد منتجات بعد.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {top.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              categoryName={catMap[p.category ?? ""]}
              soldCount={sold[p.id]}
              isNew={fresh.has(p.id)}
            />
          ))}
        </div>
      )}
      <div className="mt-10 text-center">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-light)] px-9 py-4 text-[0.92rem] font-extrabold text-[#5A3F2A] shadow-[0_8px_22px_rgba(217,168,108,.35)] transition-all hover:-translate-y-0.75 hover:shadow-[0_14px_32px_rgba(217,168,108,.5)]"
        >
          عرض كل المنتجات
        </Link>
      </div>
    </section>
  );
}

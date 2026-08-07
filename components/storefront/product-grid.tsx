import Link from "next/link";
import type { Category, Product } from "@/lib/firebase";
import { ProductCard } from "@/components/storefront/product-card";
import { SectionHead } from "@/components/storefront/section-head";
import { getOrderStats } from "@/lib/firebase-admin";
import { closetFor, EMPTY_STATS } from "@/lib/storage-counter";

function byRecency(a: Product, b: Product): number {
  return (Number(b.lastModified ?? b.id) || 0) - (Number(a.lastModified ?? a.id) || 0);
}

export async function ProductGrid({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  // Most-in-closet first — same "في المحل" derivation as the admin Storage
  // Counter tab and the checkout badge (lib/storage-counter.ts). Products
  // with no admin-entered `stock` sort after every tracked product (we have
  // no real quantity signal for them, so they can't outrank one that does)
  // but keep their relative recency order among themselves. If the orders
  // read itself fails (e.g. FIREBASE_SERVICE_ACCOUNT_KEY not configured
  // yet), `stats` is null and this falls back to the original
  // recency-only sort rather than guessing.
  const stats = await getOrderStats();
  const closetOf = (p: Product): number | null =>
    stats && p.stock != null ? closetFor(Number(p.stock), stats[p.id] ?? EMPTY_STATS) : null;

  const sorted = [...products].sort((a, b) => {
    const ac = closetOf(a);
    const bc = closetOf(b);
    if (ac != null && bc != null) return bc - ac || byRecency(a, b);
    if (ac != null) return -1;
    if (bc != null) return 1;
    return byRecency(a, b);
  });
  const top = sorted.slice(0, 8);

  return (
    <section id="collection" className="reveal mx-auto max-w-[1320px] px-5 py-22 md:px-12">
      <SectionHead label="الأكثر طلباً" title="أبرز المنتجات" />
      {top.length === 0 ? (
        <p className="py-8 text-center text-[var(--ink-3)]">لا توجد منتجات بعد.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {top.map((p) => (
            <ProductCard key={p.id} product={p} categoryName={catMap[p.category ?? ""]} />
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

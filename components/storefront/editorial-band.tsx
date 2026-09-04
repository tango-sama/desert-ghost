import Link from "next/link";
import type { Category, Product } from "@/lib/firebase";
import { catColor, hexToRgba } from "@/lib/colors";

// Two large "shop by concern" panels between the product grid and the
// contact form — the page's second entry point into the catalog, for the
// shopper who scrolled past the category carousel without picking one.
//
// Everything on them is real: the image, name and accent colour are the
// category's own, the count is computed from the products the page already
// fetched, and both strings («{n} منتج», «تسوّقي الآن ←») are lifted from
// components that already use them. No invented copy, no new Firestore field.
export function EditorialBand({
  categories,
  products,
}: {
  categories: Category[];
  products: Product[];
}) {
  const counts: Record<string, number> = {};
  for (const p of products) {
    if (p.category) counts[p.category] = (counts[p.category] ?? 0) + 1;
  }

  // The two best-stocked visible categories with a photo — a panel this size
  // is mostly image, so one without a photo would just be a coloured box.
  const picks = categories
    .filter((c) => c.visible !== false && c.image)
    .sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))
    .slice(0, 2);

  if (picks.length < 2) return null;

  return (
    <section className="reveal mx-auto max-w-[1320px] px-5 pb-4 md:px-12">
      <div className="grid gap-5 md:grid-cols-2 md:gap-6">
        {picks.map((c) => {
          const color = catColor(c);
          return (
            <Link
              key={c.id}
              href={`/products?cat=${encodeURIComponent(c.id)}`}
              className="group relative flex min-h-[260px] items-end overflow-hidden rounded-[26px] border border-[var(--line-2)] shadow-[var(--shadow)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[var(--shadow-lg)] md:min-h-[320px]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- admin-pasted URL, arbitrary host */}
              <img
                src={c.image}
                alt={c.name}
                loading="lazy"
                className="absolute inset-0 size-full object-cover transition-transform duration-600 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-105"
              />
              <span
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to top, ${hexToRgba(color, 0.92)} 0%, ${hexToRgba(color, 0.45)} 45%, transparent 78%)`,
                }}
              />
              <span className="relative w-full p-6 text-start md:p-8">
                <span className="block text-[0.68rem] font-extrabold tracking-[2px] text-white/80 uppercase">
                  <span className="num">{counts[c.id] ?? 0}</span> منتج
                </span>
                <span className="mt-1.5 block text-[clamp(1.4rem,3vw,2rem)] leading-tight font-black text-white [text-shadow:0_2px_10px_rgba(0,0,0,.3)]">
                  {c.name}
                </span>
                <span className="mt-4 inline-flex items-center rounded-full bg-white/95 px-6 py-2.5 text-[0.82rem] font-extrabold text-foreground transition-all group-hover:bg-white">
                  تسوّقي الآن ←
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

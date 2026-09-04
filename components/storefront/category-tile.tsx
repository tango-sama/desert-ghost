import Link from "next/link";
import type { Category } from "@/lib/firebase";
import { catColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

// The one category card in the storefront. Shared by the `/categories` grid
// (CategoryTileGrid) and the home page carousel (CategoryCarousel) so the two
// never drift apart — the same reason the grid was extracted in the first
// place. `className` overrides the aspect ratio for the carousel's taller
// cards; `count` and `active` are carousel-only extras the grid leaves unset.
export function CategoryTile({
  category,
  count,
  className,
  eager = false,
}: {
  category: Category;
  count?: number;
  className?: string;
  eager?: boolean;
}) {
  const color = catColor(category);

  return (
    <Link
      href={`/products?cat=${encodeURIComponent(category.id)}`}
      className={cn(
        "group relative block aspect-[1/1.15] overflow-hidden rounded-[22px] border border-[var(--line-2)] shadow-[var(--shadow)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[var(--shadow-lg)]",
        "hover:ring-2 hover:ring-[rgba(217,168,108,.55)] data-[active=true]/cc:ring-2 data-[active=true]/cc:ring-[rgba(217,168,108,.55)]",
        "focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:outline-none",
        className
      )}
    >
      <span className="absolute inset-x-0 top-0 z-[3] h-[5px]" style={{ background: color }} />
      {category.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin-pasted URL, arbitrary host
        <img
          src={category.image}
          alt={category.name}
          loading={eager ? "eager" : "lazy"}
          className="absolute inset-0 size-full object-cover transition-transform duration-600 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-108"
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-gradient-to-br from-[var(--rose-soft)] to-[var(--gold-light)] text-5xl">
          🌸
        </div>
      )}
      <span className="absolute inset-0 z-[1] bg-gradient-to-t from-[rgba(58,42,48,.88)] via-[rgba(58,42,48,.28)] via-42% to-transparent to-72%" />
      {/* shine sweep — on hover, and on the centred card in the carousel */}
      <span className="absolute inset-0 z-[2] bg-gradient-to-br from-white/25 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-data-[active=true]/cc:opacity-100" />
      <span className="absolute inset-x-0 bottom-0 z-[2] p-5 text-center">
        <span className="flex items-center justify-center gap-2 text-[1.12rem] font-black text-white [text-shadow:0_2px_8px_rgba(0,0,0,.35)]">
          <span
            className="size-2.5 shrink-0 rounded-full shadow-[0_0_0_2px_rgba(255,255,255,.6)]"
            style={{ background: color }}
          />
          {category.name}
        </span>
        {count !== undefined && (
          <span className="mt-2 inline-block rounded-full border border-white/25 bg-white/15 px-2.5 py-0.5 text-[0.7rem] font-bold text-white backdrop-blur-sm">
            <span className="num">{count}</span> منتج
          </span>
        )}
        <span className="mt-1.5 block translate-y-2 text-[0.74rem] font-bold text-[var(--gold-light)] opacity-0 transition-all duration-400 group-hover:translate-y-0 group-hover:opacity-100 group-data-[active=true]/cc:translate-y-0 group-data-[active=true]/cc:opacity-100">
          تسوّقي الآن ←
        </span>
      </span>
    </Link>
  );
}

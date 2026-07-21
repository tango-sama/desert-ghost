import Link from "next/link";
import type { Category } from "@/lib/firebase";
import { catColor } from "@/lib/colors";

export function CategoryTileGrid({ categories }: { categories: Category[] }) {
  if (categories.length === 0) {
    return <p className="text-center text-[var(--ink-3)]">لا توجد تصنيفات بعد.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
      {categories.map((c) => {
        const color = catColor(c);
        return (
          <Link
            key={c.id}
            href={`/products?cat=${encodeURIComponent(c.id)}`}
            className="group relative block aspect-[1/1.05] overflow-hidden rounded-[20px] border border-[var(--line-2)] shadow-[var(--shadow)] transition-all hover:-translate-y-1.5 hover:shadow-[var(--shadow-lg)]"
          >
            <span className="absolute inset-x-0 top-0 z-[3] h-[5px]" style={{ background: color }} />
            {c.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin-pasted URL, arbitrary host
              <img
                src={c.image}
                alt={c.name}
                className="absolute inset-0 size-full object-cover transition-transform duration-600 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-108"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-gradient-to-br from-[var(--rose-soft)] to-[var(--gold-light)] text-5xl">
                🌸
              </div>
            )}
            <span className="absolute inset-0 z-[1] bg-gradient-to-t from-[rgba(58,42,48,.78)] via-[rgba(58,42,48,.15)] via-45% to-transparent to-70%" />
            <span className="absolute inset-x-0 bottom-0 z-[2] p-5 text-center">
              <span className="flex items-center justify-center gap-2 text-[1.05rem] font-extrabold text-white [text-shadow:0_2px_8px_rgba(0,0,0,.3)]">
                <span className="size-2.5 shrink-0 rounded-full shadow-[0_0_0_2px_rgba(255,255,255,.6)]" style={{ background: color }} />
                {c.name}
              </span>
              <span className="mt-1 block translate-y-2 text-[0.72rem] font-bold text-[var(--gold-light)] opacity-0 transition-all duration-400 group-hover:translate-y-0 group-hover:opacity-100">
                تسوّقي الآن ←
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

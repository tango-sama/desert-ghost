import Link from "next/link";
import type { Category } from "@/lib/firebase";

// The category strip under the nav row — the reference layout's second deck,
// and the reason the old generic NAV_LINKS row is gone: sending shoppers
// straight into a real category converts better than a link labelled
// "المنتجات". Driven by live Firestore categories, linking with the same
// `?cat=<document id>` key `category-tile.tsx` already uses.
//
// A server component on purpose: it is passed to the client `Nav` as
// children, so none of this lands in the browser bundle.
const MAX = 6;

export function CategoryNav({ categories }: { categories: Category[] }) {
  const items = categories
    .filter((c) => c.visible !== false)
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
    .slice(0, MAX);

  return (
    <nav
      aria-label="التصنيفات"
      className="no-scrollbar h-[var(--catnav-h)] overflow-x-auto border-t border-[var(--line)] bg-[var(--blush)]/70"
    >
      <ul className="mx-auto flex h-full max-w-[1320px] items-center gap-0 px-5 md:justify-center md:px-12">
        {items.map((c) => (
          <li key={c.id} className="flex shrink-0 items-center">
            <Link
              href={`/products?cat=${encodeURIComponent(c.id)}`}
              className="rounded-full px-3.5 py-1 text-[0.8rem] font-bold whitespace-nowrap text-[var(--ink-2)] transition-colors hover:text-[var(--rose-deep)] md:px-4 md:text-[0.84rem]"
            >
              {c.name}
            </Link>
            <span aria-hidden className="h-3.5 w-px bg-[var(--line)]" />
          </li>
        ))}
        <li className="flex shrink-0 items-center">
          <Link
            href="/categories"
            className="rounded-full px-3.5 py-1 text-[0.8rem] font-bold whitespace-nowrap text-[var(--ink-2)] transition-colors hover:text-[var(--rose-deep)] md:px-4 md:text-[0.84rem]"
          >
            التصنيفات
          </Link>
          <span aria-hidden className="h-3.5 w-px bg-[var(--line)]" />
        </li>
        <li className="shrink-0">
          <Link
            href="/#contact"
            className="rounded-full px-3.5 py-1 text-[0.8rem] font-bold whitespace-nowrap text-[var(--rose-deep)] transition-colors hover:text-[var(--rose)] md:px-4 md:text-[0.84rem]"
          >
            تواصلي معنا
          </Link>
        </li>
      </ul>
    </nav>
  );
}

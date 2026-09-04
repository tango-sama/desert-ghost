import Link from "next/link";
import type { Category } from "@/lib/firebase";
import { CategoryMarquee } from "@/components/storefront/category-marquee";

// The category strip under the nav row — the reference layout's second deck,
// and the reason the old generic NAV_LINKS row is gone: sending shoppers
// straight into a real category converts better than a link labelled
// "المنتجات". Driven by live Firestore categories, linking with the same
// `?cat=<document id>` key `category-tile.tsx` already uses.
//
// It drifts sideways on its own and can be swiped or dragged — see
// `category-marquee.tsx`, which owns the scroll container. This file stays a
// server component and hands it the markup as children, so the only client
// code involved is that small shell.
//
// The list is repeated, and how many times matters. The track wraps after
// moving by one copy's width, so the copies still on screen at that moment
// have to cover the viewport: (copies - 1) x copy width must exceed the
// widest window this will ever open in. Two copies do not, once the strip is
// narrower than the window — a short category list on a wide desktop would
// flash an empty gap every cycle. Keeping roughly TARGET_ITEMS rendered
// whatever the catalog size clears it with room (the real strip: 8 items,
// ~1070px, 4 copies, so 3210px of cover). Every copy after the first is
// `aria-hidden` with unfocusable links, so the strip is announced and tabbed
// through once.
const MAX = 6;
const TARGET_ITEMS = 32;

const linkClass =
  "rounded-full px-3.5 py-1 text-[0.8rem] font-bold whitespace-nowrap text-[var(--ink-2)] transition-colors hover:text-[var(--rose-deep)] md:px-4 md:text-[0.84rem]";

export function CategoryNav({ categories }: { categories: Category[] }) {
  const items = categories
    .filter((c) => c.visible !== false)
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
    .slice(0, MAX)
    .map((c) => ({
      key: c.id,
      href: `/products?cat=${encodeURIComponent(c.id)}`,
      label: c.name,
      accent: false,
    }));

  items.push(
    { key: "__all", href: "/categories", label: "التصنيفات", accent: false },
    { key: "__contact", href: "/#contact", label: "تواصلي معنا", accent: true }
  );

  const repeats = Math.max(2, Math.ceil(TARGET_ITEMS / items.length));

  const run = (copy: number) =>
    items.map((it) => (
      <li
        key={`${copy}-${it.key}`}
        aria-hidden={copy > 0 || undefined}
        className="flex shrink-0 items-center"
      >
        <Link
          href={it.href}
          tabIndex={copy > 0 ? -1 : undefined}
          className={
            it.accent
              ? linkClass.replace("text-[var(--ink-2)]", "text-[var(--rose-deep)]")
              : linkClass
          }
        >
          {it.label}
        </Link>
        <span aria-hidden className="h-3.5 w-px bg-[var(--line)]" />
      </li>
    ));

  return (
    <CategoryMarquee
      copies={repeats}
      label="التصنيفات"
      className="h-[var(--catnav-h)] cursor-grab touch-pan-y overflow-hidden border-t border-[var(--line)] bg-[var(--blush)]/70 select-none active:cursor-grabbing"
      trackClassName="flex h-full w-max items-center will-change-transform"
    >
      {Array.from({ length: repeats }, (_, i) => run(i))}
    </CategoryMarquee>
  );
}

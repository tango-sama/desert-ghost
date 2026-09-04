import Link from "next/link";
import type { Category } from "@/lib/firebase";

// The category strip under the nav row — the reference layout's second deck,
// and the reason the old generic NAV_LINKS row is gone: sending shoppers
// straight into a real category converts better than a link labelled
// "المنتجات". Driven by live Firestore categories, linking with the same
// `?cat=<document id>` key `category-tile.tsx` already uses.
//
// It drifts sideways on its own (see `.cat-marquee` in globals.css), so the
// links past the fold are seen rather than waited on. Motion pauses on hover
// and on keyboard focus, and under `prefers-reduced-motion` the track stops
// and the strip becomes a normal scroller instead.
//
// The list is repeated, and how many times matters. The loop translates the
// track by exactly one copy's width and then snaps back; for that to be
// invisible, the copies still on screen at the end of the run have to cover
// the viewport. Two copies do not when the strip is narrower than the window
// — a short category list on a wide desktop would flash an empty gap once per
// cycle. So the count is chosen to keep roughly TARGET_ITEMS rendered
// whatever the catalog size, and the per-cycle shift (1 / repeats) is handed
// to CSS as a custom property. Every copy after the first is `aria-hidden`
// with unfocusable links, so the strip is announced and tabbed through once.
//
// A server component on purpose: it is passed to the client `Nav` as
// children, so none of this lands in the browser bundle.
const MAX = 6;
const TARGET_ITEMS = 24;

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
    <nav
      aria-label="التصنيفات"
      className="cat-marquee h-[var(--catnav-h)] border-t border-[var(--line)] bg-[var(--blush)]/70"
    >
      <ul
        className="cat-marquee-track h-full items-center"
        style={{ "--marquee-shift": `${100 / repeats}%` } as React.CSSProperties}
      >
        {Array.from({ length: repeats }, (_, i) => run(i))}
      </ul>
    </nav>
  );
}

// The thin band above the nav. Deliberately carries the store's existing
// trust copy (the same three promises as `feature-strip.tsx`) rather than a
// shipping offer — the store is cash-on-delivery with paid delivery to 58
// wilayas, and inventing a "free shipping over X" line would be a promise
// nobody agreed to.
//
// Desktop shows all three, dot-separated. Mobile has room for one, so the
// three are stacked in a fixed-height window and cycled with a pure-CSS
// keyframe: no JS, no hydration cost, no layout shift. `--announce-h` in
// globals.css is what the nav and hero offset themselves against.
const PROMISES = [
  "الدفع عند الاستلام",
  "توصيل لـ 58 ولاية",
  "منتجات أصلية 100%",
];

export function AnnouncementBar() {
  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-[var(--announce-h)] overflow-hidden bg-gradient-to-l from-[var(--rose-deep)] via-[var(--rose)] to-[var(--gold)] text-white">
      {/* md+: all three at once */}
      <div className="hidden h-full items-center justify-center gap-3 text-[0.74rem] font-bold tracking-[.2px] md:flex">
        {PROMISES.map((p, i) => (
          <span key={p} className="flex items-center gap-3">
            {i > 0 && <span className="size-1 rounded-full bg-white/60" />}
            {p}
          </span>
        ))}
      </div>

      {/* below md: one at a time, cycled by CSS (see .announce-cycle) */}
      <div className="announce-cycle h-full text-center text-[0.72rem] font-bold md:hidden">
        {PROMISES.map((p) => (
          <span key={p} className="flex h-[var(--announce-h)] items-center justify-center">
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

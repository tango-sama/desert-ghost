"use client";

import { useCallback, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Category } from "@/lib/firebase";
import { CategoryTile } from "@/components/storefront/category-tile";

// Home page category browser: a snap-scrolling coverflow. The depth effect is
// driven by scroll position rather than a timer, so the cards are stationary
// whenever the customer is not swiping and every card stays a reliable tap
// target. Scrolling is the browser's native horizontal scroll — no pointer
// handlers — which keeps fling/momentum native and means a vertical drag
// always scrolls the page instead of being swallowed by the carousel.
//
// The transforms are written straight to the DOM from one rAF-throttled
// scroll listener; putting them in React state would re-render every card on
// every frame. Same imperative approach as collagen/story-stack.tsx.

const GAP = 20; // matches gap-5 on the track at md; close enough for a step
const MAX_TILT = 14; // deg of rotateY at one card's distance from centre
const MAX_LEAN = 5; // deg of rotateZ — the reference's card tilt, derived from position
const DEPTH = 40; // px of translateZ push-back
const ACTIVE_WITHIN = 0.35; // |d| under which a card counts as centred

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function CategoryCarousel({
  categories,
  counts,
}: {
  categories: Category[];
  counts?: Record<string, number>;
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<number | null>(null);

  const paint = useCallback(() => {
    frameRef.current = null;
    const track = trackRef.current;
    if (!track) return;

    const flat = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Measured in layout coordinates (offsetLeft/scrollLeft), never with
    // getBoundingClientRect: that returns the *transformed* box, so the
    // transform written below would feed back into its own input and the
    // cards at either end would never read as centred. offsetLeft is relative
    // to the track's padding box (the track is `relative`, so it is the
    // offsetParent) and counts the same way scrollLeft does in both
    // directions, which keeps this correct under RTL.
    const half = track.clientWidth / 2;
    const scrolled = track.scrollLeft;

    for (const card of track.querySelectorAll<HTMLElement>("[data-ccard]")) {
      const w = card.offsetWidth || 1;
      const d = clamp((card.offsetLeft - scrolled + w / 2 - half) / w, -2, 2);
      card.dataset.active = Math.abs(d) < ACTIVE_WITHIN ? "true" : "false";
      if (flat) {
        card.style.transform = "";
        card.style.opacity = "";
        continue;
      }
      const near = Math.min(Math.abs(d), 1);
      card.style.transform =
        `translateZ(${-Math.abs(d) * DEPTH}px)` +
        ` rotateY(${-clamp(d, -1.4, 1.4) * MAX_TILT}deg)` +
        ` rotateZ(${d * MAX_LEAN}deg)` +
        ` scale(${1 - near * 0.14})`;
      card.style.opacity = String(1 - Math.min(Math.abs(d), 2) * 0.18);
    }

    // RTL scrollLeft counts down from 0 at the start toward -span at the end,
    // hence the abs() here and the inverted arrow directions below.
    const span = track.scrollWidth - track.clientWidth;
    const travelled = Math.abs(track.scrollLeft);
    if (barRef.current) {
      barRef.current.style.width = span > 1 ? `${(travelled / span) * 100}%` : "100%";
    }
    if (prevRef.current) prevRef.current.disabled = travelled < 2;
    if (nextRef.current) nextRef.current.disabled = travelled > span - 2;
  }, []);

  const schedule = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(paint);
  }, [paint]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    schedule();
    track.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      track.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [schedule]);

  if (categories.length === 0) {
    return <p className="text-center text-[var(--ink-3)]">لا توجد تصنيفات بعد.</p>;
  }

  // RTL: "next" scrolls toward the end, which is a negative scrollLeft delta.
  const step = (dir: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector("[data-ccard]") as HTMLElement | null;
    const amount = (card?.offsetWidth ?? 200) + GAP;
    track.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  const showArrows = categories.length > 2;

  return (
    <div className="relative">
      {/* Soft rose/gold glow behind the cards. Radial gradients rather than
          blurred circles in an overflow-hidden box: those get clipped into a
          visible rectangle, these fade out on their own. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(ellipse_50%_45%_at_22%_28%,var(--rose-tint),transparent_65%),radial-gradient(ellipse_50%_45%_at_78%_75%,var(--gold-soft),transparent_65%)]"
      />

      <div className="relative">
        {showArrows && (
          <>
            <button
              type="button"
              ref={prevRef}
              aria-label="السابق"
              onClick={() => step(1)}
              className="absolute top-1/2 right-[-10px] z-[5] hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--line-2)] bg-card text-[var(--rose-deep)] shadow-[var(--shadow)] transition-all hover:bg-[var(--rose-tint)] disabled:pointer-events-none disabled:opacity-0 md:flex"
            >
              <ChevronRight className="size-5" />
            </button>
            <button
              type="button"
              ref={nextRef}
              aria-label="التالي"
              onClick={() => step(-1)}
              className="absolute top-1/2 left-[-10px] z-[5] hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--line-2)] bg-card text-[var(--rose-deep)] shadow-[var(--shadow)] transition-all hover:bg-[var(--rose-tint)] disabled:pointer-events-none disabled:opacity-0 md:flex"
            >
              <ChevronLeft className="size-5" />
            </button>
          </>
        )}

        <ul
          ref={trackRef}
          role="region"
          aria-label="التصنيفات"
          tabIndex={0}
          className="relative flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth px-[max(1.25rem,calc(50%-5rem))] py-8 [perspective:1200px] [scrollbar-width:none] sm:px-[max(1.5rem,calc(50%-6rem))] md:gap-5 md:px-[max(3rem,calc(50%-7.5rem))] [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((c, i) => (
            <li
              key={c.id}
              data-ccard
              className="group/cc w-40 shrink-0 snap-center will-change-transform [transform-style:preserve-3d] sm:w-48 md:w-60"
            >
              <CategoryTile
                category={c}
                count={counts?.[c.id]}
                eager={i < 2}
                className="aspect-[1/1.25]"
              />
            </li>
          ))}
        </ul>
      </div>

      <div aria-hidden className="mx-auto mt-2 h-[3px] w-40 overflow-hidden rounded-full bg-[var(--line)]">
        <span
          ref={barRef}
          className="block h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--rose)]"
          style={{ width: "0%" }}
        />
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef } from "react";
import { priceFmt } from "@/lib/firebase";
import type { LandingBlock } from "@/lib/landing-content";
import styles from "./offer.module.css";

// The hero's swipeable gallery: one slide per product she chose.
//
// The hero used to open on text alone — a headline, a lead and a row of small
// chips — which is a poor first screen for a page selling physical products.
// This puts the products themselves at the top, and makes moving between them
// a swipe rather than a scroll past three full section stacks.
//
// SWIPE IS CSS, NOT JAVASCRIPT. A scroll-snap track gives real native inertia,
// works with a trackpad, a mouse wheel, a touch drag and a keyboard, and costs
// nothing in bundle size — the same choice hero-banner.tsx and
// category-carousel.tsx already made. No drag library.
//
// The slides are ~86% wide so the next one PEEKS at the edge. That peek is the
// affordance: it is what tells her there is something to swipe to, without a
// hint line or an arrow she has to notice on a phone.
//
// Scroll does not re-render React. The active dot is painted imperatively from
// a rAF-throttled passive listener, the pattern the other two carousels in this
// repo established — a re-render per scroll frame during a swipe is what makes
// a carousel feel cheap on a mid-range Android.

export function HeroGallery({
  blocks,
  onJump,
}: {
  blocks: LandingBlock[];
  onJump: (anchor: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const activeRef = useRef(0);
  const many = blocks.length > 1;

  // Which slide is centred, from layout coordinates. Math.abs because an RTL
  // track scrolls into NEGATIVE scrollLeft — the trap this repo's other
  // carousels document.
  const paint = useCallback(() => {
    frameRef.current = null;
    const track = trackRef.current;
    if (!track) return;
    const slide = track.firstElementChild as HTMLElement | null;
    // Step is the slide plus the gap, measured rather than assumed, so the
    // responsive width change at 700px needs no second source of truth.
    const step = slide ? slide.offsetWidth + gapOf(track) : track.clientWidth;
    if (!step) return;
    const idx = Math.min(blocks.length - 1, Math.round(Math.abs(track.scrollLeft) / step));
    if (idx === activeRef.current) return;
    activeRef.current = idx;
    const dots = dotsRef.current?.children;
    if (!dots) return;
    for (let i = 0; i < dots.length; i++) {
      (dots[i] as HTMLElement).dataset.active = String(i === idx);
    }
  }, [blocks.length]);

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
      // The frame holds a closure over the DOM node, so it must not outlive
      // the component.
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [schedule]);

  const goTo = useCallback((idx: number) => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.firstElementChild as HTMLElement | null;
    const step = slide ? slide.offsetWidth + gapOf(track) : track.clientWidth;
    // RTL tracks scroll into negative scrollLeft; LTR into positive. Deriving
    // the sign from the live direction keeps this correct either way, rather
    // than hardcoding RTL because that is what this page happens to use.
    const sign = getComputedStyle(track).direction === "rtl" ? -1 : 1;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: sign * idx * step, behavior: reduced ? "auto" : "smooth" });
  }, []);

  const step = (dir: 1 | -1) =>
    goTo((activeRef.current + dir + blocks.length) % blocks.length);

  return (
    <div className={styles.gallery}>
      <div
        ref={trackRef}
        className={`${styles.galleryTrack} no-scrollbar`}
        role="group"
        aria-label="المنتجات المختارة لكِ"
      >
        {blocks.map((b, i) => {
          const name = b.product.title ?? b.product.name ?? "";
          const img = b.images[0];
          return (
            <button
              type="button"
              key={b.anchor}
              className={styles.slide}
              onClick={() => onJump(b.anchor)}
              aria-label={`${name} — اقرئي التفاصيل`}
            >
              <span className={styles.slideMedia}>
                {img ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={img} alt={name} loading={i === 0 ? "eager" : "lazy"} />
                ) : (
                  <span className={styles.slideNoImg} aria-hidden>
                    💄
                  </span>
                )}
                {i === 0 && many && <span className={styles.slideTag}>الأنسب لكِ</span>}
              </span>
              <span className={styles.slideName}>{name}</span>
              <span className={`${styles.slidePrice} num`}>{priceFmt(b.product.price)}</span>
              <span className={styles.slideMore}>اقرئي التفاصيل ↓</span>
            </button>
          );
        })}
      </div>

      {many && (
        <>
          {/* RTL: «السابق» sits on the right, «التالي» on the left — the arrow
              convention the home banner and category carousel already use.
              Pointer-only; the swipe is the interaction on a phone. */}
          <button
            type="button"
            aria-label="السابق"
            className={`${styles.galleryArrow} ${styles.galleryPrev}`}
            onClick={() => step(-1)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="التالي"
            className={`${styles.galleryArrow} ${styles.galleryNext}`}
            onClick={() => step(1)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <div className={styles.dots} ref={dotsRef}>
            {blocks.map((b, i) => (
              <button
                type="button"
                key={b.anchor}
                data-active={i === 0}
                aria-label={`المنتج ${i + 1}`}
                className={styles.dot}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** The track's flex gap in pixels — measured, so the CSS stays the one place
 *  the slide geometry is defined. */
function gapOf(track: HTMLElement): number {
  const gap = parseFloat(getComputedStyle(track).columnGap);
  return Number.isFinite(gap) ? gap : 0;
}

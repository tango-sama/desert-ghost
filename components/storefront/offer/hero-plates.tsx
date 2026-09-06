"use client";

import { useCallback, useEffect, useRef } from "react";
import { priceFmt } from "@/lib/firebase";
import type { LandingBlock } from "@/lib/landing-content";
import { CheckIcon, ShieldIcon } from "./icons";
import styles from "./offer.module.css";

// The hero plate, made swipeable — one plate per product she chose.
//
// The plate showed `blocks[0]` and nothing else, so on a three-product result
// the other two were invisible until she had scrolled past a full section
// stack. Owner request: swipe the hero image to see the other chosen products.
//
// The plate's composition is untouched — same ring, halo, lit backdrop and
// trust minis, per plate. All this adds is the track around it, so the change
// reads as part of the design rather than as a carousel bolted onto it.
//
// SWIPE IS CSS, NOT JAVASCRIPT: a scroll-snap track, the same choice
// hero-banner.tsx and category-carousel.tsx already made. Real native inertia,
// touch and trackpad and wheel and keyboard, no drag library, no bundle cost.
//
// NO `touch-action` ON THE TRACK. `pan-y` reads like "let vertical swipes fall
// through to the page" and means the opposite — only vertical panning is
// allowed on the element, which kills the horizontal swipe while leaving the
// dots and arrows working, so it fails silently. The default `auto` lets the
// browser choose the axis from the gesture.
//
// Scrolling does not re-render React. The active dot and the caption are
// written straight to the DOM from a rAF-throttled passive listener — the
// imperative pattern the repo's other carousels established, because a
// re-render per scroll frame is what makes a carousel feel cheap on a
// mid-range Android.

export function HeroPlates({ blocks }: { blocks: LandingBlock[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const priceRef = useRef<HTMLSpanElement>(null);
  const frameRef = useRef<number | null>(null);
  const activeRef = useRef(0);
  const many = blocks.length > 1;

  const label = useCallback(
    (b: LandingBlock) => b.product.title ?? b.product.name ?? "",
    [],
  );

  // Math.abs because an RTL track scrolls into NEGATIVE scrollLeft — the trap
  // this repo's other carousels document.
  const paint = useCallback(() => {
    frameRef.current = null;
    const track = trackRef.current;
    if (!track) return;
    const step = track.clientWidth || 1;
    const idx = Math.min(blocks.length - 1, Math.round(Math.abs(track.scrollLeft) / step));
    if (idx === activeRef.current) return;
    activeRef.current = idx;

    const dots = dotsRef.current?.children;
    if (dots) {
      for (let i = 0; i < dots.length; i++) {
        (dots[i] as HTMLElement).dataset.active = String(i === idx);
      }
    }
    // The caption names the plate she is looking at. Written as text rather
    // than held in state so a swipe stays free of React entirely.
    const b = blocks[idx];
    if (b && nameRef.current) nameRef.current.textContent = label(b);
    if (b && priceRef.current) priceRef.current.textContent = priceFmt(b.product.price);
  }, [blocks, label]);

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
      // The frame closes over DOM nodes, so it must not outlive the component.
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [schedule]);

  const goTo = useCallback((idx: number) => {
    const track = trackRef.current;
    if (!track) return;
    // RTL tracks scroll into negative scrollLeft; LTR into positive. Taken
    // from the live direction rather than hardcoded, so this stays correct if
    // the page is ever rendered LTR.
    const sign = getComputedStyle(track).direction === "rtl" ? -1 : 1;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: sign * idx * track.clientWidth, behavior: reduced ? "auto" : "smooth" });
  }, []);

  const first = blocks[0];

  return (
    <div className={styles.plateWrap}>
      <div
        ref={trackRef}
        className={`${styles.plateTrack} no-scrollbar`}
        role="group"
        aria-label="المنتجات المختارة لكِ"
      >
        {blocks.map((b, i) => {
          const name = label(b);
          const img = b.images[0];
          return (
            <div className={styles.heroPlate} key={b.anchor}>
              <span className={styles.heroRing} aria-hidden />
              <span className={styles.heroHalo} aria-hidden />
              {img ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  className={styles.heroImg}
                  src={img}
                  alt={name}
                  loading={i === 0 ? "eager" : "lazy"}
                  draggable={false}
                />
              ) : null}
              <div className={`${styles.heroMini} ${styles.heroMiniTop}`}>
                <ShieldIcon />
                <span>منتجات أصلية</span>
              </div>
              <div className={`${styles.heroMini} ${styles.heroMiniBottom}`}>
                <CheckIcon />
                <span>جاهز للتأكيد</span>
              </div>
            </div>
          );
        })}
      </div>

      {many && (
        <div className={styles.plateBar}>
          <div className={styles.plateCap}>
            <span className={styles.plateName} ref={nameRef}>
              {first ? label(first) : ""}
            </span>
            <span className={`${styles.platePrice} num`} ref={priceRef}>
              {first ? priceFmt(first.product.price) : ""}
            </span>
          </div>
          <div className={styles.plateDots} ref={dotsRef}>
            {blocks.map((b, i) => (
              <button
                type="button"
                key={b.anchor}
                data-active={i === 0}
                aria-label={`المنتج ${i + 1}`}
                className={styles.plateDot}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import type { LandingBaItem } from "@/lib/firebase";
import { RevealRoot } from "@/components/storefront/reveal-root";
import { cn } from "@/lib/utils";
import styles from "./offer.module.css";

// The drag-to-reveal comparison, generalised from collagen/before-after.tsx —
// same interaction and the same wipe, but the pairs are passed in instead of
// living in a module constant, because here they come from whatever the owner
// uploaded for this particular product.
//
// THIS SECTION RENDERS ONLY FROM REAL UPLOADED PHOTOS. lib/landing-content.ts
// drops any pair missing either side, and the page skips the section outright
// when nothing is left. There is deliberately no illustrative fallback: a
// stand-in "before" photo on a product page is a claim about a customer's
// body, and this shop does not make claims it cannot back.

function BaFrame({ before, after, alt }: { before: string; after: string; alt: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const fr = frameRef.current;
    if (!fr) return;

    function set(p: number) {
      // Clamped away from the edges so one photo is never fully hidden — a
      // divider dragged to 0% looks like a broken image, not a comparison.
      fr!.style.setProperty("--ba", `${Math.max(8, Math.min(92, p))}%`);
    }
    function fromEvent(e: PointerEvent) {
      const r = fr!.getBoundingClientRect();
      set(((e.clientX - r.left) / r.width) * 100);
    }
    function onDown(e: PointerEvent) {
      draggingRef.current = true;
      fr!.classList.add(styles.dragging);
      fr!.setPointerCapture?.(e.pointerId);
      fromEvent(e);
    }
    function onMove(e: PointerEvent) {
      if (draggingRef.current) fromEvent(e);
    }
    function stop() {
      draggingRef.current = false;
      fr!.classList.remove(styles.dragging);
    }
    fr.addEventListener("pointerdown", onDown);
    fr.addEventListener("pointermove", onMove);
    fr.addEventListener("pointerup", stop);
    fr.addEventListener("pointercancel", stop);
    return () => {
      fr.removeEventListener("pointerdown", onDown);
      fr.removeEventListener("pointermove", onMove);
      fr.removeEventListener("pointerup", stop);
      fr.removeEventListener("pointercancel", stop);
    };
  }, []);

  // One sweep of the divider when the card scrolls in, so it reads as
  // draggable rather than as a static split image. Skipped entirely for
  // reduced motion, where the card simply sits at its midpoint.
  useEffect(() => {
    const fr = frameRef.current;
    if (!fr) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        timers.push(setTimeout(() => fr.style.setProperty("--ba", "80%"), 250));
        timers.push(setTimeout(() => fr.style.setProperty("--ba", "50%"), 1150));
      },
      { rootMargin: "0px 0px -100px 0px" },
    );
    io.observe(fr);
    return () => {
      io.disconnect();
      // Both timers touch the DOM node, so neither may outlive the component.
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className={styles.baFrame} ref={frameRef}>
      {/* The "before" layer is the full-bleed base; only .baAfter is clipped. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.baImg} src={before} alt={`${alt} — قبل`} draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={cn(styles.baImg, styles.baAfter)}
        src={after}
        alt={`${alt} — بعد`}
        draggable={false}
      />
      <span className={cn(styles.baTag, styles.baTagBefore)}>قبل</span>
      <span className={cn(styles.baTag, styles.baTagAfter)}>بعد</span>
      <div className={styles.baHandle}>
        <span className={styles.baKnob}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m9 18-6-6 6-6" />
            <path d="m15 6 6 6-6 6" />
          </svg>
        </span>
      </div>
    </div>
  );
}

export function BeforeAfter({ items, productName }: { items: LandingBaItem[]; productName: string }) {
  if (!items.length) return null;
  return (
    <RevealRoot>
      <section className={`${styles.sec} reveal`}>
        <span className={styles.label}>قبل وبعد</span>
        <h2 className={styles.h2}>شاهدي الفرق بنفسكِ</h2>
        <div className={styles.underline} />
        <p className={styles.sub}>اسحبي المؤشر يميناً ويساراً لمقارنة الصورتين.</p>
        <div className={styles.baGrid}>
          {items.map((c, i) => (
            <div className={styles.baCard} key={`${c.before}-${i}`}>
              <BaFrame before={c.before ?? ""} after={c.after ?? ""} alt={productName} />
              {c.title && <h4>{c.title}</h4>}
              {c.text && <p>{c.text}</p>}
            </div>
          ))}
        </div>
        <p className={styles.baNote}>
          النتائج تختلف من شخص لآخر حسب الانتظام ونمط الحياة، ولا يُعد أي منتج بديلاً
          عن استشارة الطبيب.
        </p>
      </section>
    </RevealRoot>
  );
}

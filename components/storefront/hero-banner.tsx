"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Star, Truck } from "lucide-react";
import type { Featured } from "@/lib/firebase";

// The full-bleed banner slider that opens the home page.
//
// Slides come from `featured_products` — the collection the admin panel
// already manages with image + right/left text + CTA text + link, which is
// banner-shaped data being spent on 250px cards until now. The small featured
// strip that used to render them lower down is gone; showing the same six
// images twice on one page was the reason it never converted.
//
// RTL: scrollLeft counts DOWN from 0, so "next" is a negative delta. Same
// convention the category carousel uses — see its step().
//
// The active-dot maths runs in one rAF-throttled passive scroll listener that
// writes straight to the DOM, so swiping does not re-render React (the
// imperative pattern category-carousel.tsx established).

// A slide is either a real Featured doc or the settings.heroImage fallback.
type Slide = {
  key: string;
  image?: string;
  title: string;
  lead?: string;
  cta: string;
  href: string;
};

const AUTOPLAY_MS = 6000;

// The page's own copy, used when `featured_products` is empty or the read
// failed. The storefront must render with Firestore unreachable
// (architecture-context.md invariant 2), and a blank hero is not rendering.
const FALLBACK_TITLE = "كل ما تحتاجينه لجمالكِ وعنايتكِ في مكان واحد";
const FALLBACK_LEAD =
  "منتجات أصلية مختارة بعناية للعناية بالبشرة والشعر، العطور الفرمونية، والمكمّلات النسائية — بجودة مضمونة، أسعار مناسبة، وتوصيل لكل ولايات الوطن.";

function toSlides(items: Featured[], heroImage?: string): Slide[] {
  const real = items
    .filter((f) => f.image)
    .map((f) => ({
      key: f.id,
      image: f.image,
      title: f.productName || FALLBACK_TITLE,
      lead: f.rightText || f.leftText,
      cta: f.ctaText || "تسوّقي الآن",
      href: f.productLink || "/products",
    }));
  if (real.length > 0) return real;
  return [
    {
      key: "fallback",
      image: heroImage,
      title: FALLBACK_TITLE,
      lead: FALLBACK_LEAD,
      cta: "تسوّقي الآن",
      href: "/products",
    },
  ];
}

export function HeroBanner({
  items,
  heroImage,
}: {
  items: Featured[];
  heroImage?: string;
}) {
  const slides = toSlides(items, heroImage);
  const trackRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const activeRef = useRef(0);
  const [paused, setPaused] = useState(false);

  // Which slide is centred, from layout coordinates. offsetLeft/scrollLeft
  // rather than getBoundingClientRect(), which would measure post-transform.
  const paint = useCallback(() => {
    frameRef.current = null;
    const track = trackRef.current;
    if (!track) return;
    const width = track.clientWidth || 1;
    const idx = Math.round(Math.abs(track.scrollLeft) / width);
    if (idx === activeRef.current) return;
    activeRef.current = idx;
    const dots = dotsRef.current?.children;
    if (!dots) return;
    for (let i = 0; i < dots.length; i++) {
      (dots[i] as HTMLElement).dataset.active = String(i === idx);
    }
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

  const goTo = useCallback((idx: number) => {
    const track = trackRef.current;
    if (!track) return;
    // RTL tracks scroll into negative scrollLeft; LTR into positive. Deriving
    // the sign from the current direction keeps this correct either way.
    const sign = getComputedStyle(track).direction === "rtl" ? -1 : 1;
    track.scrollTo({ left: sign * idx * track.clientWidth, behavior: "smooth" });
  }, []);

  // Autoplay. Paused on hover/focus and while the tab is hidden; skipped
  // entirely under prefers-reduced-motion.
  useEffect(() => {
    if (slides.length < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      goTo((activeRef.current + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [slides.length, paused, goTo]);

  const step = (dir: 1 | -1) =>
    goTo((activeRef.current + dir + slides.length) % slides.length);

  return (
    <section
      aria-label="عروض مميزة"
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        ref={trackRef}
        className="no-scrollbar flex h-[480px] snap-x snap-mandatory overflow-x-auto sm:h-[520px] md:h-[min(74vh,600px)]"
      >
        {slides.map((s) => (
          <div key={s.key} className="relative w-full shrink-0 snap-center overflow-hidden">
            {s.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin-pasted URL, arbitrary host
              <img
                src={s.image}
                alt={s.title}
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[var(--rose-soft)] via-[var(--gold-light)] to-[var(--blush)] text-[9rem] drop-shadow-[0_14px_28px_rgba(58,42,48,.18)]">
                💄
              </div>
            )}
            {/* Scrim runs from the start edge (right in RTL), where the copy
                sits, so the headline stays legible over any photo. */}
            <div className="absolute inset-0 bg-gradient-to-l from-[rgba(58,42,48,.80)] via-[rgba(58,42,48,.35)] via-45% to-transparent" />

            <div className="relative mx-auto flex h-full max-w-[1320px] flex-col justify-center px-6 md:px-20 lg:px-24">
              <div className="max-w-[560px] text-start">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/15 px-4 py-1.5 text-[0.7rem] font-extrabold tracking-[2px] text-white uppercase backdrop-blur-sm">
                  <span className="size-[7px] animate-pulse rounded-full bg-[var(--rose-soft)]" />
                  أناقتكِ تبدأ من هنا
                </div>
                <h1 className="mb-4 line-clamp-3 text-[clamp(1.7rem,4.4vw,3.1rem)] leading-[1.2] font-black text-balance text-white [overflow-wrap:anywhere] [text-shadow:0_3px_18px_rgba(0,0,0,.35)]">
                  {s.title}
                </h1>
                {s.lead && (
                  <p className="mb-7 line-clamp-2 max-w-[440px] text-[0.94rem] leading-[1.8] text-white/85 md:line-clamp-3 md:text-[0.98rem]">
                    {s.lead}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3.5">
                  <Link
                    href={s.href}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-br from-[var(--rose)] to-[var(--rose-deep)] px-9 py-4 text-[0.92rem] font-extrabold text-white shadow-[0_8px_22px_rgba(224,114,140,.45)] transition-all hover:-translate-y-0.75 hover:shadow-[0_14px_32px_rgba(224,114,140,.6)]"
                  >
                    {s.cta}
                  </Link>
                  <Link
                    href="/categories"
                    className="inline-flex items-center rounded-full border-[1.5px] border-white/45 px-6 py-4 text-[0.9rem] font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-white/15"
                  >
                    تصفّحي التصنيفات
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Trust badges — the same two the old split hero carried, kept as a
          pair of glass chips over the banner's end edge. */}
      <div className="pointer-events-none absolute bottom-16 end-6 z-[3] hidden flex-col gap-3 lg:flex">
        <div className="flex items-center gap-2.5 rounded-2xl border border-white/40 bg-white/85 px-4 py-3 shadow-[var(--shadow-lg)] backdrop-blur-md">
          <Star className="size-4 fill-[var(--gold)] text-[var(--gold)]" />
          <div className="text-[0.72rem] text-muted-foreground">
            <b className="font-extrabold text-foreground">4.9</b> · تقييم الزبائن
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-2xl border border-white/40 bg-white/85 px-4 py-3 shadow-[var(--shadow-lg)] backdrop-blur-md">
          <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--rose-tint)]">
            <Truck className="size-5 text-[var(--rose-deep)]" />
          </div>
          <div>
            <div className="text-[0.78rem] font-extrabold text-foreground">توصيل سريع</div>
            <div className="text-[0.7rem] text-[var(--ink-3)]">لكل 58 ولاية</div>
          </div>
        </div>
      </div>

      {slides.length > 1 && (
        <>
          {/* RTL: «السابق» sits on the right, «التالي» on the left — the same
              arrow convention as the featured and category carousels. */}
          <button
            type="button"
            aria-label="السابق"
            onClick={() => step(-1)}
            className="absolute top-1/2 right-5 z-[4] hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white/85 text-[var(--rose-deep)] shadow-[var(--shadow)] transition-all hover:bg-white md:flex"
          >
            <ChevronRight className="size-5" />
          </button>
          <button
            type="button"
            aria-label="التالي"
            onClick={() => step(1)}
            className="absolute top-1/2 left-5 z-[4] hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white/85 text-[var(--rose-deep)] shadow-[var(--shadow)] transition-all hover:bg-white md:flex"
          >
            <ChevronLeft className="size-5" />
          </button>

          <div
            ref={dotsRef}
            className="absolute inset-x-0 bottom-6 z-[4] flex items-center justify-center gap-2.5"
          >
            {slides.map((s, i) => (
              <button
                key={s.key}
                type="button"
                data-active={i === 0}
                aria-label={`الشريحة ${i + 1}`}
                onClick={() => goTo(i)}
                className="h-2.5 rounded-full bg-white/50 transition-all duration-300 data-[active=true]:w-8 data-[active=true]:bg-white data-[active=false]:w-2.5 hover:bg-white/80"
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

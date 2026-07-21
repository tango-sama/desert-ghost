"use client";

import { useRef } from "react";
import Link from "next/link";
import type { Featured } from "@/lib/firebase";
import { SectionHead } from "@/components/storefront/section-head";

export function FeaturedCarousel({ items }: { items: Featured[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  if (items.length === 0) return null;

  const showArrows = items.length > 3;
  // RTL: "next" scrolls toward the end, which is a negative scrollLeft delta.
  const step = (dir: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector("[data-fcard]") as HTMLElement | null;
    const amount = (card?.offsetWidth ?? 250) + 20;
    track.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  return (
    <section className="reveal border-y border-border bg-gradient-to-br from-[var(--bg-3)] to-[var(--cream)] py-14">
      <div className="mx-auto max-w-[1320px] px-5 md:px-12">
        <SectionHead label="مختارات مميزة" title="منتجات تستحق التجربة" />
        <div className="relative mx-auto max-w-[1200px]">
          {showArrows && (
            <>
              <button
                type="button"
                aria-label="السابق"
                onClick={() => step(1)}
                className="absolute top-[42%] right-[-10px] z-[5] hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--line-2)] bg-card text-2xl font-bold text-[var(--rose-deep)] shadow-[var(--shadow)] hover:bg-[var(--rose-tint)] md:flex"
              >
                ›
              </button>
              <button
                type="button"
                aria-label="التالي"
                onClick={() => step(-1)}
                className="absolute top-[42%] left-[-10px] z-[5] hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--line-2)] bg-card text-2xl font-bold text-[var(--rose-deep)] shadow-[var(--shadow)] hover:bg-[var(--rose-tint)] md:flex"
              >
                ‹
              </button>
            </>
          )}
          <div
            ref={trackRef}
            className="flex gap-5 overflow-x-auto scroll-smooth pb-5 [scroll-snap-type:x_mandatory] [scrollbar-width:thin]"
          >
            {items.map((f) => (
              <div
                key={f.id}
                data-fcard
                className="flex w-[250px] shrink-0 flex-col overflow-hidden rounded-[20px] border border-[var(--line-2)] bg-card shadow-[var(--shadow)] [scroll-snap-align:start]"
              >
                <div className="aspect-square overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin-pasted URL, arbitrary host */}
                  <img src={f.image} alt={f.productName} loading="lazy" className="size-full object-cover" />
                </div>
                <div className="flex flex-1 flex-col gap-2.5 p-4.5">
                  <div className="line-clamp-2 text-[1rem] font-extrabold text-[var(--rose-deep)]">
                    {f.productName}
                  </div>
                  {(f.rightText || f.leftText) && (
                    <div className="line-clamp-3 flex-1 text-[0.8rem] leading-relaxed text-muted-foreground">
                      {f.rightText || f.leftText}
                    </div>
                  )}
                  <Link
                    href={f.productLink || "/products"}
                    className="mt-auto rounded-full bg-gradient-to-br from-[var(--rose)] to-[var(--rose-deep)] py-2.5 text-center text-[0.84rem] font-extrabold text-white"
                  >
                    {f.ctaText || "تفاصيل أكثر"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

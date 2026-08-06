"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./glutathione.module.css";

// Before/after + usage instructions, two columns (matches the owner's
// reference layout). The before/after pair reuses the same illustrative
// dark-spots/pigmentation macro photography already used on /sunguard
// (public/assets/sunguard/ba-spots-*.webp) — this is a swallowed
// supplement with no before/after photography of its own, and the claim
// (pigmentation/skin-tone evenness) is the same one that asset already
// illustrates honestly, with the same disclaimer. Drag mechanic ported
// verbatim from sunguard/before-after.tsx.
//
// BeforeAfterCard and USAGE_STEPS are exported (2026-08-06) so
// before-after-section.tsx and usage-section.tsx can each render one half
// of this as its own standalone section on /glutathione, with a new 3D
// model section sandwiched between them (see product-3d-section.tsx and
// glutathione-page.tsx) — /glutathione-3d still uses the combined
// two-column CareRoutine below unchanged.
export function BeforeAfterCard() {
  const frameRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const fr = frameRef.current;
    if (!fr) return;

    function set(p: number) {
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

  useEffect(() => {
    const fr = frameRef.current;
    if (!fr) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        setTimeout(() => fr.style.setProperty("--ba", "80%"), 250);
        setTimeout(() => fr.style.setProperty("--ba", "50%"), 1150);
      },
      { rootMargin: "0px 0px -100px 0px" }
    );
    io.observe(fr);
    return () => io.disconnect();
  }, []);

  return (
    <div className={styles.glBaFrame} ref={frameRef}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.glBaImg} src="/assets/sunguard/ba-spots-before.webp" alt="" draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={cn(styles.glBaImg, styles.glBaAfter)} src="/assets/sunguard/ba-spots-after.webp" alt="" draggable={false} />
      <span className={cn(styles.glBaTag, styles.glBaTagBefore)}>قبل</span>
      <span className={cn(styles.glBaTag, styles.glBaTagAfter)}>بعد</span>
      <div className={styles.glBaHandle}>
        <span className={styles.glBaKnob}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18-6-6 6-6" />
            <path d="m15 6 6 6-6 6" />
          </svg>
        </span>
      </div>
    </div>
  );
}

export const USAGE_STEPS = [
  { ic: "💊", p: "تناولي كبسولة إلى كبسولتين يومياً على معدة فارغة مع كوب من فيتامين C." },
  { ic: "🧼", p: "استخدمي صابون Nawarna (هديتكِ المجانية) ضمن روتين العناية اليومي." },
  { ic: "💧", p: "اشربي كمية كافية من الماء على مدار اليوم لدعم فعالية التركيبة." },
  { ic: "☀️", p: "استخدمي واقي شمس خلال النهار للحفاظ على نتائج التفتيح." },
];

export function CareRoutine() {
  return (
    <RevealRoot>
      <section className={`${styles.glSec} ${styles.glCare} reveal`}>
        <div className={styles.glCareInner}>
          <div className={styles.glCareCol}>
            <h2>تمتعي ببشرة أكثر ثقة كل يوم</h2>
            <p>العناية اليومية والمنتظمة هي سر البشرة الصحية.</p>
            <BeforeAfterCard />
            <p className={styles.glBaNote}>
              الصور توضيحية لغرض المقارنة وليست صوراً حقيقية لعملاء — النتائج الفعلية تختلف حسب
              الاستخدام المنتظم ونمط الحياة.
            </p>
          </div>
          <div className={styles.glCareCol}>
            <h2>طريقة الاستخدام</h2>
            <p>خطوات بسيطة لدمج التركيبة والهدية في روتينكِ اليومي.</p>
            <div className={styles.glUsageList}>
              {USAGE_STEPS.map((s, i) => (
                <div className={styles.glUsageRow} key={i}>
                  <span className={styles.glUsageIc}>{s.ic}</span>
                  <p>{s.p}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </RevealRoot>
  );
}

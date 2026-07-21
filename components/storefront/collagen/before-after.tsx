"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import styles from "./collagen.module.css";

const CARDS = [
  {
    before: "/assets/collagen/ba-nails-before.webp",
    after: "/assets/collagen/story-nails.webp",
    beforeAlt: "الأظافر قبل الكولاجين",
    afterAlt: "الأظافر بعد الكولاجين",
    title: "أظافر صحية لا تتكسر",
    text: "بنية أقوى للظفر، نمو أسرع، وتقصف أقل من أول شهر.",
  },
  {
    before: "/assets/collagen/ba-hair-before.webp",
    after: "/assets/collagen/story-hair.webp",
    beforeAlt: "الشعر قبل الكولاجين",
    afterAlt: "الشعر بعد الكولاجين",
    title: "شعر أقوى وأقل تساقطاً",
    text: "تغذية للبصيلات من الجذور، تساقط أقل وكثافة ولمعان يزدادان مع الوقت.",
  },
  {
    before: "/assets/collagen/ba-skin-before.webp",
    after: "/assets/collagen/story-skin.webp",
    beforeAlt: "البشرة قبل الكولاجين",
    afterAlt: "البشرة بعد الكولاجين",
    title: "بشرة أكثر نضارة وإشراقاً",
    text: "خطوط أدق، ترطيب أعمق، وإشراقة تلاحظينها خلال 4–8 أسابيع من الانتظام.",
  },
];

const PROBLEMS = [
  {
    bg: "/assets/collagen/prob-wrinkles.webp",
    h: "التجاعيد والخطوط الدقيقة",
    p: "بعد سن 25 يفقد الجسم قرابة 1% من كولاجينه سنوياً، فتظهر الخطوط حول العينين والفم وتفقد البشرة امتلاءها.",
    fix: "ببتيدات الكولاجين تدعم مرونة البشرة وتساعد على تقليل مظهر الخطوط من الداخل.",
  },
  {
    bg: "/assets/collagen/prob-dryskin.webp",
    h: "جفاف البشرة وبهتانها",
    p: "قلة الترطيب والإجهاد اليومي يتركان البشرة باهتة ومتعبة المظهر مهما جرّبتِ من كريمات خارجية.",
    fix: "الكولاجين البحري مع حمض الهيالورونيك يرطّب بشرتكِ بعمق من الداخل ويعيد إشراقتها.",
  },
  {
    bg: "/assets/collagen/ba-hair-before.webp",
    h: "تساقط الشعر وضعفه",
    p: "التساقط بعد الولادة، نقص الفيتامينات أو الصبغات المتكررة — كلها تُضعف بصيلات الشعر وتقلل كثافته.",
    fix: "تركيبة الكولاجين المدعمة بالبيوتين تغذّي الجذور وتساعد على تقليل التساقط.",
  },
  {
    bg: "/assets/collagen/ba-nails-before.webp",
    h: "أظافر هشة ومتكسرة",
    p: "أظافر تتقصف من أبسط الأعمال اليومية، تنمو ببطء ولا تحتفظ بطولها مهما اعتنيتِ بها.",
    fix: "الكولاجين مع فيتامين C يقوّي بنية الظفر ويدعم نموه بشكل صحي.",
  },
  {
    bg: "/assets/collagen/story-joints.webp",
    h: "آلام وتيبّس المفاصل",
    p: "ألم في الركبتين وصعوبة في الحركة بعد يوم طويل، أو تيبّس صباحي يزداد مع مرور السنوات.",
    fix: "20غ من ببتيدات الكولاجين يومياً تدعم صحة الغضاريف ومرونة الحركة.",
  },
  {
    bg: "/assets/collagen/ba-skin-before.webp",
    h: "فقدان مرونة البشرة",
    p: "ترهّل خفيف في الوجه والرقبة وفقدان الامتلاء الطبيعي للخدين مع التقدم في العمر.",
    fix: "الاستخدام المنتظم يدعم كثافة الكولاجين تحت الجلد ويساعد على شدّ البشرة.",
  },
];

function BaFrame({ before, after, beforeAlt, afterAlt }: { before: string; after: string; beforeAlt: string; afterAlt: string }) {
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

  // Sweep the divider once when the card scrolls into view, so it reads as
  // draggable — matches the original's single shared IntersectionObserver
  // triggered off the first frame, replicated per-frame here (equivalent
  // visual effect, simpler as an isolated component).
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
    <div className={styles.baFrame} ref={frameRef}>
      {/* the "before" layer is just the full-bleed base image — only
          .baAfter gets the clip-path treatment, matching the source CSS */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.baImg} src={before} alt={beforeAlt} draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={cn(styles.baImg, styles.baAfter)} src={after} alt={afterAlt} draggable={false} />
      <span className={cn(styles.baTag, styles.baTagBefore)}>قبل</span>
      <span className={cn(styles.baTag, styles.baTagAfter)}>بعد</span>
      <div className={styles.baHandle}>
        <span className={styles.baKnob}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18-6-6 6-6" />
            <path d="m15 6 6 6-6 6" />
          </svg>
        </span>
      </div>
    </div>
  );
}

export function BeforeAfter({ onOrder }: { onOrder: () => void }) {
  return (
    <section className={styles.clBa} id="beforeAfter">
      <span className={styles.clLabel}>قبل وبعد</span>
      <h2 className={styles.clTitle}>شاهدي الفرق بنفسكِ</h2>
      <p className={styles.clBaSub}>اسحبي المؤشر يميناً ويساراً لتشاهدي الفرق الذي يصنعه الالتزام بالكولاجين يومياً.</p>
      <div className={styles.clBaGrid}>
        {CARDS.map((c) => (
          <div className={styles.baCard} key={c.title}>
            <BaFrame before={c.before} after={c.after} beforeAlt={c.beforeAlt} afterAlt={c.afterAlt} />
            <h3>{c.title}</h3>
            <p>{c.text}</p>
          </div>
        ))}
      </div>
      <p className={styles.clBaNote}>
        الصور توضيحية لغرض المقارنة — النتائج الفعلية تختلف من شخص لآخر حسب الانتظام ونمط الحياة.
      </p>

      <h3 className={styles.baPh}>
        هل تعانين من إحدى هذه المشاكل؟ <em>منتجاتنا صُمّمت لأجلكِ</em>
      </h3>
      <div className={styles.baPgrid}>
        {PROBLEMS.map((pr) => (
          <div className={styles.baProb} key={pr.h}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.bpBg} src={pr.bg} alt="" loading="lazy" aria-hidden="true" />
            <div className={styles.bpBody}>
              <h4>{pr.h}</h4>
              <p>{pr.p}</p>
              <div className={styles.bpFix}>
                <b>✓</b>
                {pr.fix}
              </div>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className={styles.btnGold} onClick={onOrder}>
        🛒 ابدئي رحلة التغيير اليوم
      </button>
    </section>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { LandingBaItem } from "@/lib/firebase";
import styles from "./sunguard.module.css";

type Kind = "spots" | "burn" | "aging";

const CARDS: { kind: Kind; title: string; text: string; before: string; after: string }[] = [
  {
    kind: "spots",
    title: "بشرة موحّدة بلا تصبّغات",
    text: "الحماية اليومية تمنع تكوّن بقع داكنة جديدة وتساعد على توحيد لون البشرة مع الوقت.",
    before: "/assets/sunguard/ba-spots-before.webp",
    after: "/assets/sunguard/ba-spots-after.webp",
  },
  {
    kind: "burn",
    title: "وداعاً لاحمرار وحروق الشمس",
    text: "SPF50+ يحجب الأشعة الحارقة ويبقي بشرتكِ هادئة حتى بعد ساعات طويلة في الشمس.",
    before: "/assets/sunguard/ba-burn-before.webp",
    after: "/assets/sunguard/ba-burn-after.webp",
  },
  {
    kind: "aging",
    title: "بشرة أكثر شباباً لفترة أطول",
    text: "حجب أشعة UVA يبطئ من ظهور الخطوط الدقيقة الناتجة عن التقدّم في السن بسبب الشمس.",
    before: "/assets/sunguard/ba-aging-before.webp",
    after: "/assets/sunguard/ba-aging-after.webp",
  },
];

function BaFrame({
  title,
  text,
  before,
  after,
}: {
  title: string;
  text: string;
  before: string;
  after: string;
}) {
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

  // Sweep the divider once when the card scrolls into view so it reads as
  // draggable, matching the collagen before/after slider's behavior.
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
    <div className={styles.baCard}>
      <div className={styles.baFrame} ref={frameRef}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.baImg} src={before} alt="" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={cn(styles.baImg, styles.baAfter)} src={after} alt="" draggable={false} />
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
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

export function BeforeAfter({ items }: { items?: LandingBaItem[] }) {
  // admin overrides apply by card position (fixed spots/burn/aging slots —
  // see landing-pages-view.tsx); an override needs both photos to replace
  // the default pair, but title/text can be edited independently.
  const cards = CARDS.map((c, i) => {
    const o = items?.[i];
    const before = o?.before?.trim();
    const after = o?.after?.trim();
    return {
      ...c,
      title: o?.title?.trim() || c.title,
      text: o?.text?.trim() || c.text,
      before: before && after ? before : c.before,
      after: before && after ? after : c.after,
    };
  });
  return (
    <section className={`${styles.sgSec} ${styles.sgBa}`} id="beforeAfter">
      <span className={styles.sgLabel}>قبل وبعد</span>
      <h2 className={styles.sgTitle}>الحماية اليومية تصنع الفرق</h2>
      <div className={styles.sgUnderline} />
      <p className={styles.sgBaSub}>اسحبي المؤشر يميناً ويساراً لمشاهدة أثر الحماية اليومية من الشمس على بشرتكِ.</p>
      <div className={styles.sgBaGrid}>
        {cards.map((c) => (
          <BaFrame key={c.kind} title={c.title} text={c.text} before={c.before} after={c.after} />
        ))}
      </div>
      <p className={styles.sgBaNote}>
        الصور توضيحية لغرض المقارنة وليست صوراً حقيقية لعملاء — النتائج الفعلية تختلف حسب الاستخدام المنتظم ونمط الحياة.
      </p>
    </section>
  );
}

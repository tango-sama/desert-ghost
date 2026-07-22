"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import styles from "./sunguard.module.css";

type Kind = "spots" | "burn" | "aging";

const CARDS: { kind: Kind; title: string; text: string }[] = [
  {
    kind: "spots",
    title: "بشرة موحّدة بلا تصبّغات",
    text: "الحماية اليومية تمنع تكوّن بقع داكنة جديدة وتساعد على توحيد لون البشرة مع الوقت.",
  },
  {
    kind: "burn",
    title: "وداعاً لاحمرار وحروق الشمس",
    text: "SPF50+ يحجب الأشعة الحارقة ويبقي بشرتكِ هادئة حتى بعد ساعات طويلة في الشمس.",
  },
  {
    kind: "aging",
    title: "بشرة أكثر شباباً لفترة أطول",
    text: "حجب أشعة UVA يبطئ من ظهور الخطوط الدقيقة الناتجة عن التقدّم في السن بسبب الشمس.",
  },
];

// Illustrative skin-patch comparison — NOT real customer photos. Drawn as
// abstract close-up skin swatches (same convention as the /collagen
// before/after slider, which also carries a "for illustration" disclaimer)
// since no real before/after photography exists for this product yet.
function SkinPanel({ kind, healed, uid }: { kind: Kind; healed: boolean; uid: string }) {
  const baseId = `sg-base-${uid}`;
  const glowId = `sg-glow-${uid}`;

  if (healed) {
    return (
      <svg className={styles.baLayer} viewBox="0 0 300 240" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={baseId} cx="45%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#FFE3EE" />
            <stop offset="60%" stopColor="#FFC9DE" />
            <stop offset="100%" stopColor="#F6A9C6" />
          </radialGradient>
          <radialGradient id={glowId} cx="30%" cy="25%" r="40%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="300" height="240" fill={`url(#${baseId})`} />
        <rect width="300" height="240" fill={`url(#${glowId})`} />
        {[
          [60, 60],
          [230, 50],
          [200, 170],
        ].map(([x, y], i) => (
          <path
            key={i}
            d={`M${x} ${y} l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 z`}
            fill="#fff"
            opacity={0.85 - i * 0.15}
          />
        ))}
        <g transform="translate(238 178)">
          <path
            d="M12 0 L22 4 V13 C22 20 17 25 12 27 C7 25 2 20 2 13 V4 Z"
            fill="#22C55E"
            opacity="0.92"
          />
          <path d="M7 13 l3.5 3.5 L18 9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    );
  }

  return (
    <svg className={styles.baLayer} viewBox="0 0 300 240" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={baseId} cx="45%" cy="35%" r="80%">
          <stop offset="0%" stopColor="#E8B99A" />
          <stop offset="60%" stopColor="#D9A57F" />
          <stop offset="100%" stopColor="#C08A63" />
        </radialGradient>
      </defs>
      <rect width="300" height="240" fill={`url(#${baseId})`} />

      {kind === "spots" && (
        <g opacity="0.85">
          {[
            [70, 70, 16],
            [140, 55, 11],
            [210, 90, 14],
            [95, 140, 10],
            [180, 160, 18],
            [240, 60, 9],
            [50, 180, 12],
          ].map(([cx, cy, r], i) => (
            <ellipse key={i} cx={cx} cy={cy} rx={r} ry={r * 0.8} fill="#6B4226" opacity={0.55 + (i % 3) * 0.1} />
          ))}
        </g>
      )}

      {kind === "burn" && (
        <>
          <rect width="300" height="240" fill="#E8483A" opacity="0.28" />
          {[
            [90, 100, 42],
            [200, 130, 50],
            [150, 60, 30],
          ].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="#C4291D" opacity={0.32 + i * 0.05} />
          ))}
        </>
      )}

      {kind === "aging" && (
        <g stroke="#6B4226" strokeWidth="2" fill="none" opacity="0.55" strokeLinecap="round">
          <path d="M40 90 Q60 85 80 92" />
          <path d="M35 105 Q58 100 82 108" />
          <path d="M230 80 Q250 75 268 84" />
          <path d="M225 96 Q248 92 266 100" />
          <path d="M110 190 Q150 200 190 190" />
          <path d="M105 205 Q150 216 195 205" />
        </g>
      )}
    </svg>
  );
}

function BaFrame({ kind, title, text }: { kind: Kind; title: string; text: string }) {
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
        <SkinPanel kind={kind} healed={false} uid={`${kind}-before`} />
        <div className={styles.baAfter}>
          <SkinPanel kind={kind} healed uid={`${kind}-after`} />
        </div>
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

export function BeforeAfter() {
  return (
    <section className={`${styles.sgSec} ${styles.sgBa}`} id="beforeAfter">
      <span className={styles.sgLabel}>قبل وبعد</span>
      <h2 className={styles.sgTitle}>الحماية اليومية تصنع الفرق</h2>
      <div className={styles.sgUnderline} />
      <p className={styles.sgBaSub}>اسحبي المؤشر يميناً ويساراً لمشاهدة أثر الحماية اليومية من الشمس على بشرتكِ.</p>
      <div className={styles.sgBaGrid}>
        {CARDS.map((c) => (
          <BaFrame key={c.kind} kind={c.kind} title={c.title} text={c.text} />
        ))}
      </div>
      <p className={styles.sgBaNote}>
        الرسوم توضيحية لغرض المقارنة وليست صوراً حقيقية لعملاء — النتائج الفعلية تختلف حسب الاستخدام المنتظم ونمط الحياة.
      </p>
    </section>
  );
}

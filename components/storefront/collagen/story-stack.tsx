"use client";

import { useEffect, useRef } from "react";
import styles from "./collagen.module.css";

const SLIDES = [
  {
    t: "بشرة <em>مشرقة ونضرة</em>",
    p: "الكولاجين يعيد لبشرتكِ مرونتها وإشراقتها الطبيعية، ويقلل من ظهور التجاعيد والخطوط الدقيقة يوماً بعد يوم.",
    img: "/assets/collagen/story-skin.webp",
    alt: "بشرة نضرة ومشرقة",
  },
  {
    t: "شعر <em>أقوى وأكثر كثافة</em>",
    p: "يغذّي بصيلات الشعر من الجذور، يقلل التساقط ويمنح شعركِ لمعاناً وحيوية تدوم.",
    img: "/assets/collagen/story-hair.webp",
    alt: "شعر قوي وكثيف",
  },
  {
    t: "أظافر <em>صحية لا تتكسر</em>",
    p: "يعزز نمو أظافركِ ويجعلها أقوى وأقل عرضة للتقصف والتكسر.",
    img: "/assets/collagen/story-nails.webp",
    alt: "أظافر صحية وقوية",
  },
  {
    t: "مفاصل <em>مرنة بلا تعب</em>",
    p: "يدعم صحة الغضاريف ويمنحكِ حرية الحركة والمرونة في نشاطكِ اليومي.",
    img: "/assets/collagen/story-joints.webp",
    alt: "مفاصل مرنة بلا آلام",
  },
];

type Pose = { x: number; y: number; z: number; ry: number; o: number };

// Direct 1:1 port of collagen.html's imperative 3D story stack: front card
// faces the screen, the rest wait tilted to the right queued to slide
// left; progress is scroll-linked (scrub), and settles into a
// pointer-swipeable state once the section is centered in the viewport.
// Kept imperative (refs + a single effect) rather than reworked into React
// state — the transform math and timing are exact and easy to regress.
export function StoryStack() {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLElement | null)[]>([]);
  const captionRef = useRef<HTMLDivElement>(null);
  const captionHRef = useRef<HTMLHeadingElement>(null);
  const captionPRef = useRef<HTMLParagraphElement>(null);
  const dotsBoxRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const hintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const caption = captionRef.current;
    const captionH = captionHRef.current;
    const captionP = captionPRef.current;
    const dotsBox = dotsBoxRef.current;
    const hint = hintRef.current;
    const cards = cardsRef.current.filter((c): c is HTMLElement => !!c);
    const dots = dotsRef.current.filter((d): d is HTMLSpanElement => !!d);
    if (!stage || !caption || !captionH || !captionP || !dotsBox || !hint || cards.length !== 4) return;

    const order = [0, 1, 2, 3]; // order[0] = card currently in front — mutated in place (push/pop/shift/unshift), never reassigned
    let phase: "scrub" | "ready" | "anim" = "scrub";
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
    const isMob = () => window.innerWidth <= 768;

    function pose(d: number): Pose {
      if (d === 0) return { x: 0, y: 0, z: 30, ry: 0, o: 1 };
      return { x: d * (isMob() ? 30 : 64), y: -d * 6, z: -d * 70, ry: -38, o: 1 - d * 0.08 };
    }
    const IN: Pose = { x: 260, y: 10, z: -90, ry: -45, o: 0 };
    const OUT: Pose = { x: -260, y: 10, z: -90, ry: 30, o: 0 };
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    function apply(el: HTMLElement, from: Pose, to: Pose, t: number) {
      el.style.transform = `translate3d(${lerp(from.x, to.x, t)}px,${lerp(from.y, to.y, t)}px,${lerp(from.z, to.z, t)}px) rotateY(${lerp(from.ry, to.ry, t)}deg)`;
      el.style.opacity = String(lerp(from.o, to.o, t));
    }
    function setDepth(el: HTMLElement, d: number) {
      apply(el, pose(d), pose(d), 1);
      el.style.filter = d > 0 && !isMob() ? "blur(1.5px)" : "none";
      el.style.zIndex = String(30 - d);
    }
    function layout() {
      order.forEach((ci, d) => setDepth(cards[ci], d));
    }
    function setCaption(ci: number) {
      captionH!.innerHTML = SLIDES[ci].t;
      captionP!.textContent = SLIDES[ci].p;
    }
    function updateDots() {
      dots.forEach((dot, i) => dot.classList.toggle(styles.on, i === order[0]));
    }

    function showFront() {
      setCaption(order[0]);
      updateDots();
      caption!.classList.add(styles.show);
      dotsBox!.classList.add(styles.show);
      phase = "ready";
      requestAnimationFrame(scrub); // re-sync if the user scrolled mid-swipe
    }

    function progress() {
      const r = stage!.getBoundingClientRect();
      const vh = window.innerHeight;
      const c = r.top + r.height / 2;
      const pIn = (vh - c) / (vh * 0.26); // entering from below
      const pOut = c / (vh * 0.26); // leaving through the top
      return Math.max(0, Math.min(1, Math.min(pIn, pOut)));
    }
    let settled = false;
    function scrub() {
      if (phase === "anim") return; // let a swipe finish first
      const p = progress();
      if (p >= 1) {
        if (!settled) settle();
        return;
      }
      settled = false;
      phase = "scrub";
      caption!.classList.remove(styles.show);
      dotsBox!.classList.remove(styles.show);
      hint!.classList.remove(styles.show);
      const exiting = stage!.getBoundingClientRect().top + stage!.offsetHeight / 2 < window.innerHeight * 0.5;
      order.forEach((ci, d) => {
        const el = cards[ci];
        el.style.transition = "none";
        el.style.filter = "none";
        el.style.zIndex = String(30 - d);
        const t = Math.max(0, Math.min(1, p * 1.45 - d * 0.15)); // front card leads the sweep
        apply(el, exiting ? OUT : IN, pose(d), t);
      });
    }
    function settle() {
      settled = true;
      order.forEach((ci, d) => {
        const el = cards[ci];
        el.style.transition = "none";
        setDepth(el, d);
        void el.offsetHeight;
        el.style.transition = ""; // transitions back on for swipes
      });
      showFront();
      hint!.classList.add(styles.show);
    }

    function swap(dir: number) {
      if (phase !== "ready") return;
      phase = "anim";
      caption!.classList.remove(styles.show);
      hint!.classList.add(styles.gone);
      const exitT = "translate3d(-240px,8px,30px) rotateY(28deg)"; // exits leftward, continuing the flow
      if (dir > 0) {
        const front = cards[order[0]];
        front.style.transform = exitT;
        front.style.opacity = "0";
        later(() => {
          order.push(order.shift()!); // …and re-enters at the back (infinite loop)
          front.style.transition = "none";
          setDepth(front, order.length - 1);
          void front.offsetHeight;
          front.style.transition = "";
          layout();
          later(showFront, 260);
        }, 300);
      } else {
        const back = cards[order[order.length - 1]];
        back.style.transition = "none";
        back.style.transform = exitT;
        back.style.opacity = "0";
        back.style.zIndex = "31";
        void back.offsetHeight;
        back.style.transition = "";
        order.unshift(order.pop()!);
        layout();
        later(showFront, 380);
      }
    }

    // swipe / drag — RTL: swipe left = next
    let startX: number | null = null;
    let startY = 0;
    function onPointerDown(e: PointerEvent) {
      startX = e.clientX;
      startY = e.clientY;
    }
    function onPointerUp(e: PointerEvent) {
      if (startX === null) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      startX = null;
      if (Math.abs(dy) > Math.abs(dx)) return; // vertical gesture = page scroll, ignore
      if (dx < -35) swap(1);
      else if (dx > 35) swap(-1);
    }
    function onPointerCancel() {
      startX = null;
    }
    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointerup", onPointerUp);
    stage.addEventListener("pointercancel", onPointerCancel);

    // drive the 3D sweep from scroll position (in and out, both directions)
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        scrub();
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    scrub();

    return () => {
      timers.forEach(clearTimeout);
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointerup", onPointerUp);
      stage.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section className={styles.clStory} id="clStory">
      <span className={styles.clLabel}>قصة جمالكِ</span>
      <h2 className={styles.clTitle}>شاهدي ما يفعله الكولاجين</h2>
      <div className={styles.clStoryStage} ref={stageRef}>
        {SLIDES.map((s, i) => (
          <figure className={styles.clScard} key={s.img} ref={(el) => { cardsRef.current[i] = el; }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.img} alt={s.alt} draggable={false} />
          </figure>
        ))}
      </div>
      <div className={styles.clStoryCaption} ref={captionRef}>
        <h3 ref={captionHRef} />
        <p ref={captionPRef} />
      </div>
      <div className={styles.clStoryDots} ref={dotsBoxRef}>
        {SLIDES.map((s, i) => (
          <span key={s.img} ref={(el) => { dotsRef.current[i] = el; }} />
        ))}
      </div>
      <div className={styles.clStoryHint} ref={hintRef}>
        ← اسحبي يساراً لاكتشاف باقي الفوائد
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./collagen.module.css";

const FACES = [
  { ic: "🧪", t: "تركيبة نقية", t2: "وفعّالة" },
  { ic: "🌿", t: "خالٍ من الجلوتين", t2: "والمواد الحافظة" },
  { ic: "💧", t: "سريع الامتصاص", t2: "لنتائج أفضل" },
  { ic: "✅", t: "مناسب للرجال", t2: "والنساء" },
  { ic: "🚚", t: "توصيل سريع", t2: "لكل الولايات" },
];

// 3D rotating drum, swipe-only (nothing clickable) — direct port of the
// pointer-drag + momentum/snap physics from collagen.html.
function StripDrum() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cylRef = useRef<HTMLDivElement>(null);
  const facesRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const cyl = cylRef.current;
    const faces = facesRef.current.filter((f): f is HTMLDivElement => !!f);
    if (!wrap || !cyl || faces.length !== FACES.length) return;

    const N = faces.length;
    const step = 360 / N;

    function layoutFaces() {
      const w = Math.min(230, window.innerWidth * 0.64);
      const r = Math.round(w / 2 / Math.tan(Math.PI / N)) + 24; // cylinder radius + breathing room
      faces.forEach((f, i) => {
        f.style.transform = `translate(-50%,-50%) rotateY(${i * step}deg) translateZ(${r}px)`;
      });
    }
    layoutFaces();
    window.addEventListener("resize", layoutFaces);

    let rot = 0;
    let dragging = false;
    let startX = 0;
    let startRot = 0;
    let lastX = 0;
    let lastT = 0;
    let vel = 0;
    function render() {
      cyl!.style.transform = `rotateY(${rot}deg)`;
    }
    render();

    function onDown(e: PointerEvent) {
      dragging = true;
      startX = e.clientX;
      startRot = rot;
      lastX = e.clientX;
      lastT = performance.now();
      vel = 0;
      cyl!.style.transition = "none";
      wrap!.setPointerCapture?.(e.pointerId);
    }
    function onMove(e: PointerEvent) {
      if (!dragging) return;
      const now = performance.now();
      vel = (e.clientX - lastX) / Math.max(1, now - lastT);
      lastX = e.clientX;
      lastT = now;
      rot = startRot + (e.clientX - startX) * 0.3; // finger drives the drum directly
      render();
    }
    function release() {
      if (!dragging) return;
      dragging = false;
      const target = Math.round((rot + vel * 80) / step) * step; // momentum, then snap fast
      cyl!.style.transition = "transform .3s cubic-bezier(.22,1,.36,1)";
      rot = target;
      render();
    }
    wrap.addEventListener("pointerdown", onDown);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerup", release);
    wrap.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("resize", layoutFaces);
      wrap.removeEventListener("pointerdown", onDown);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerup", release);
      wrap.removeEventListener("pointercancel", release);
    };
  }, []);

  return (
    <div className={styles.clStrip} ref={wrapRef}>
      <div className={styles.drum} ref={cylRef}>
        {FACES.map((f, i) => (
          <div className={styles.si} key={f.t} ref={(el) => { facesRef.current[i] = el; }}>
            <div className={styles.ic}>{f.ic}</div>
            <span>
              {f.t}
              <br />
              {f.t2}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrustStrip() {
  return (
    <RevealRoot>
      <section className={`${styles.clSec} ${styles.clSecGrey} reveal`} style={{ paddingTop: "2.5rem", paddingBottom: "2.5rem" }}>
        <StripDrum />
      </section>
    </RevealRoot>
  );
}

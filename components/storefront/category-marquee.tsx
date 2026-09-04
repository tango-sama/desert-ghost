"use client";

import { useCallback, useEffect, useRef } from "react";

// The drifting, draggable shell around the category strip.
//
// It owns the track's position as a plain number and applies it as a
// transform, rather than driving a scroll container. Two things pushed it
// here, both found by driving the strip rather than reasoning about it:
//
//  - a 16px/s drift is ~0.26px per frame, and Chromium rounds `scrollLeft`
//    to whole pixels, so every nudge rounded straight back to 0 and nothing
//    ever moved;
//  - in RTL the scroll position is clamped at 0 (the start), so dragging
//    back past the first item was impossible — the one thing an endless
//    strip should always allow.
//
// A number in a ref has neither problem: it is fractional, unbounded, and
// wraps in both directions. `copies` says how many times the list is
// repeated, which turns the track width into one copy's width; moving by
// exactly that and wrapping is invisible, because the next copy is identical.
//
// `children` is that repeated list, rendered on the server and passed
// through — only this wrapper is client code.

const DRIFT = 16; // px per second, rightwards (RTL reading order)
const DRAG_SLOP = 5; // px before a press is a drag, not a tap
const FLICK_MAX = 2200; // px/s cap on a thrown strip
const FLICK_DECAY = 3.2; // per second, e-folding

export function CategoryMarquee({
  copies,
  label,
  className,
  trackClassName,
  children,
}: {
  copies: number;
  label: string;
  className?: string;
  trackClassName?: string;
  children: React.ReactNode;
}) {
  const navRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const offset = useRef(0); // px the track is shifted right, wrapped to one copy
  const velocity = useRef(0); // px/s left over from a flick
  const dragging = useRef(false);
  const captured = useRef(false);
  const hovering = useRef(false);
  const focused = useRef(false);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const lastX = useRef(0);
  const lastT = useRef(0);
  const moved = useRef(0);

  // `wrap` is skipped while a link inside is focused: wrapping shifts the
  // track by a whole copy, which puts an identical link in the same place but
  // carries the *focused* one off screen. Nothing drifts while focused, so
  // the offset cannot run away in the meantime.
  const apply = useCallback(
    (wrap = true) => {
      const track = trackRef.current;
      if (!track) return;
      const copyW = track.scrollWidth / copies;
      if (wrap && copyW > 0) {
        // Keep the offset inside one copy. `while` rather than `%` so a hard
        // flick that jumps several copies in a frame still lands in range.
        while (offset.current >= copyW) offset.current -= copyW;
        while (offset.current < 0) offset.current += copyW;
      }
      track.style.transform = `translateX(${offset.current}px)`;
    },
    [copies]
  );

  // Only the first copy of the list is focusable, and the drift can have
  // carried it off screen — so tabbing to a link has to bring it back, or a
  // keyboard user ends up on something they cannot see.
  const ensureVisible = useCallback(
    (el: HTMLElement) => {
      const nav = navRef.current;
      if (!nav) return;
      const pad = 16;
      const nb = nav.getBoundingClientRect();
      const eb = el.getBoundingClientRect();
      if (eb.left < nb.left + pad) offset.current += nb.left + pad - eb.left;
      else if (eb.right > nb.right - pad) offset.current -= eb.right - (nb.right - pad);
      else return;
      apply(false);
    },
    [apply]
  );

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = last ? Math.min(now - last, 100) / 1000 : 0; // a backgrounded
      last = now;                                             // tab must not lurch
      if (dragging.current || document.hidden) return;
      const paused = hovering.current || focused.current;
      if (velocity.current) {
        offset.current += velocity.current * dt;
        velocity.current *= Math.exp(-FLICK_DECAY * dt);
        if (Math.abs(velocity.current) < 4) velocity.current = 0;
      }
      // The drift is what pauses on hover; a flick still coasts to a stop.
      if (!paused && !reduced.matches) offset.current += DRIFT * dt;
      apply(!focused.current);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [apply]);

  // Note what is NOT here: setPointerCapture. Capturing on press retargets
  // the compatibility mouse events with it, so `click` fires on this <nav>
  // instead of the link under the finger and the link never navigates. The
  // capture is taken in onPointerMove instead, once the pointer has travelled
  // far enough that this is a drag rather than a tap.
  function onPointerDown(e: React.PointerEvent<HTMLElement>) {
    dragging.current = true;
    captured.current = false;
    velocity.current = 0;
    moved.current = 0;
    startX.current = e.clientX;
    lastX.current = e.clientX;
    lastT.current = e.timeStamp;
    startOffset.current = offset.current;
  }

  function onPointerMove(e: React.PointerEvent<HTMLElement>) {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    moved.current = Math.max(moved.current, Math.abs(dx));
    // Past the slop it is a drag: take the pointer so it keeps tracking even
    // if it leaves the strip, and so the release cannot land as a link click.
    if (!captured.current && moved.current > DRAG_SLOP) {
      captured.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    // The strip follows the pointer one-to-one, in either direction.
    offset.current = startOffset.current + dx;
    const dt = (e.timeStamp - lastT.current) / 1000;
    if (dt > 0.004) {
      velocity.current = (e.clientX - lastX.current) / dt;
      lastX.current = e.clientX;
      lastT.current = e.timeStamp;
    }
    apply();
  }

  function endPointer(e: React.PointerEvent<HTMLElement>) {
    if (!dragging.current) return;
    dragging.current = false;
    // Stale velocity from a pointer that stopped before lifting would throw
    // the strip on release, which is not what a considered stop means.
    if (e.timeStamp - lastT.current > 120) velocity.current = 0;
    velocity.current = Math.max(-FLICK_MAX, Math.min(FLICK_MAX, velocity.current));
    if (captured.current && e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    captured.current = false;
  }

  // A drag that ends over a link must not follow it. Captured on the way
  // down, before the link sees the click.
  function onClickCapture(e: React.MouseEvent) {
    if (moved.current > DRAG_SLOP) {
      e.preventDefault();
      e.stopPropagation();
    }
    moved.current = 0;
  }

  return (
    <nav
      ref={navRef}
      aria-label={label}
      className={className}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") hovering.current = true;
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") hovering.current = false;
      }}
      onFocusCapture={(e) => {
        focused.current = true;
        ensureVisible(e.target as HTMLElement);
      }}
      onBlurCapture={() => {
        focused.current = false;
      }}
      onClickCapture={onClickCapture}
    >
      <ul ref={trackRef} className={trackClassName}>
        {children}
      </ul>
    </nav>
  );
}

"use client";

import { createElement, useEffect, useRef, useState } from "react";

// Thin wrapper around the <model-viewer> custom element
// (@google/model-viewer) for the .glb hero centerpiece. Loaded only in the
// browser — the element's JS registers itself via customElements.define,
// which needs `window`, and Next would otherwise try to render the unknown
// tag on the server. React.createElement (not JSX) sidesteps typing the
// custom element into the global JSX namespace for a single one-off use.
// Renders the poster image until the model-viewer script is ready so there
// is no blank flash — the caller passes the same static product photo used
// elsewhere on the page as the poster.
export function Product3DViewer({
  src,
  poster,
  alt,
  className,
  fullscreenButtonClassName,
}: {
  src: string;
  poster?: string;
  alt: string;
  className?: string;
  fullscreenButtonClassName?: string;
}) {
  const [ready, setReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // iOS Safari has no Element.requestFullscreen at all (only <video> gets
  // its own webkit-specific fullscreen) — check support so the button can
  // just not render there instead of sitting dead on tap.
  const [fsSupported] = useState(
    () => typeof document !== "undefined" && document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === "function"
  );
  const mvRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    import("@google/model-viewer").then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === mvRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const el = mvRef.current;
    if (!el || !ready) return;
    // Scroll/pinch always zooms the model, even past its own zoom limits —
    // without this, once the camera hits min/max distance the browser's
    // default wheel behavior takes back over and scrolls the page instead,
    // yanking focus away from the product mid-interaction.
    function onWheel(e: WheelEvent) {
      e.preventDefault();
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ready]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      // Can still legitimately reject (e.g. a Permissions-Policy denying
      // fullscreen in an embedded context) even when the API exists —
      // catch so that shows up as nothing happening, not a console error.
      mvRef.current?.requestFullscreen().catch(() => {});
    }
  }

  if (!ready) {
    return poster ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={poster} alt={alt} className={className} />
    ) : null;
  }

  return (
    <>
      {createElement("model-viewer", {
        ref: mvRef,
        src,
        alt,
        poster,
        className,
        "auto-rotate": true,
        "auto-rotate-delay": 0,
        "rotation-per-second": "16deg",
        "camera-controls": true,
        // Zoomable: no disable-zoom, so scroll/pinch zooms the camera in
        // on the product (camera-controls alone only covers drag-rotate).
        // Locked to the center: disable-pan turns off right-click-drag/
        // two-finger-drag panning, which otherwise shifts the camera
        // target off the model — orbit (rotate) and zoom are the only
        // interactions left, camera-target stays "auto" (the model's own
        // center) since it's never set explicitly.
        "disable-pan": true,
        "shadow-intensity": "1.3",
        "shadow-softness": "0.9",
        // model-viewer's shadow is a soft contact shadow cast onto an
        // invisible ground plane beneath the model (its own "shadow
        // catcher") — no environment-image/skybox is set, so the rest of
        // the element stays fully transparent and only the product + its
        // ground shadow show through onto the page background.
        exposure: "1.05",
        "interaction-prompt": "none",
        loading: "eager",
        reveal: "auto",
      })}
      {fsSupported && (
        <button
          type="button"
          onClick={toggleFullscreen}
          className={fullscreenButtonClassName}
          aria-label={isFullscreen ? "الخروج من ملء الشاشة" : "عرض المنتج بملء الشاشة"}
          title={isFullscreen ? "الخروج من ملء الشاشة" : "عرض المنتج بملء الشاشة"}
        >
          {isFullscreen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3v4a1 1 0 0 1-1 1H4M20 9h-4a1 1 0 0 1-1-1V4M15 21v-4a1 1 0 0 1 1-1h4M4 15h4a1 1 0 0 1 1 1v4" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H4v4M16 3h4v4M4 16v4h4M20 16v4h-4" />
            </svg>
          )}
        </button>
      )}
    </>
  );
}

"use client";

import { createElement, useEffect, useState } from "react";

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
}: {
  src: string;
  poster?: string;
  alt: string;
  className?: string;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("@google/model-viewer").then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return poster ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={poster} alt={alt} className={className} />
    ) : null;
  }

  return createElement("model-viewer", {
    src,
    alt,
    poster,
    className,
    "auto-rotate": true,
    "auto-rotate-delay": 0,
    "rotation-per-second": "16deg",
    "camera-controls": true,
    // Zoomable: no disable-zoom, so scroll/pinch zooms the camera in on
    // the product (camera-controls alone only covers drag-to-rotate).
    "shadow-intensity": "1.3",
    "shadow-softness": "0.9",
    // model-viewer's shadow is a soft contact shadow cast onto an
    // invisible ground plane beneath the model (its own "shadow catcher")
    // — no environment-image/skybox is set, so the rest of the element
    // stays fully transparent and only the product + its ground shadow
    // show through onto the page background.
    exposure: "1.05",
    "interaction-prompt": "none",
    loading: "eager",
    reveal: "auto",
  });
}

"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { captureAttribution } from "@/lib/attribution";

// Records the campaign that brought a visitor in, on every URL that carries ad
// parameters. Mounted once from the root layout so every funnel and product
// page is instrumented without opting in individually.
//
// It re-runs on client-side route changes, not just first load, because an ad
// can land on any route and the App Router never does a full reload between
// them. Running again is harmless: captureAttribution() ignores URLs with no
// ad parameters and never overwrites the stored first touch, so ordinary
// browsing cannot clobber a real click.
//
// Unlike the pixel, this is NOT gated on NEXT_PUBLIC_META_PIXEL_ID — knowing
// which campaign produced an order is our own bookkeeping and has to keep
// working whether or not Meta's pixel is configured or blocked.
function AttributionCaptureInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    captureAttribution();
  }, [pathname, searchParams]);

  return null;
}

// useSearchParams() needs a Suspense boundary in the App Router; keeping it
// here stops that requirement from leaking into the root layout.
export function AttributionCapture() {
  return (
    <Suspense fallback={null}>
      <AttributionCaptureInner />
    </Suspense>
  );
}

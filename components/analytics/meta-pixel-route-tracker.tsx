"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPixelEvent } from "@/lib/meta-pixel";

// Fires PageView again on every client-side route change (App Router never
// does a full page reload between routes, so the base script's one-time
// PageView in meta-pixel.tsx only ever covers the very first URL).
//
// Two ref guards, not one, because this needs to survive React 18/19 Strict
// Mode's dev-only double-invoke of effects on mount:
//   - `lastTrackedUrl` skips a second run for the *same* URL, which is what
//     Strict Mode's mount→cleanup→mount replay produces.
//   - `isFirstRun` then skips tracking that one deduped URL entirely, since
//     it's the URL the base script's own PageView already covered.
// Any *real* navigation always changes the URL, so it always passes both
// guards and fires exactly once — this only ever suppresses the redundant
// dev-mode replay and the double-covered initial load, never a real route
// change.
function MetaPixelRouteTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstRun = useRef(true);
  const lastTrackedUrl = useRef<string | null>(null);

  useEffect(() => {
    const query = searchParams.toString();
    const url = query ? `${pathname}?${query}` : pathname;

    if (lastTrackedUrl.current === url) return;
    lastTrackedUrl.current = url;

    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    trackPixelEvent("PageView");
  }, [pathname, searchParams]);

  return null;
}

// useSearchParams() requires a Suspense boundary in the App Router; wrapping
// it here keeps that requirement local to this one tracker instead of
// leaking into the root layout that mounts it.
export function MetaPixelRouteTracker() {
  return (
    <Suspense fallback={null}>
      <MetaPixelRouteTrackerInner />
    </Suspense>
  );
}

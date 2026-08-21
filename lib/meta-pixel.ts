// Thin, safe wrapper around the Meta Pixel's `fbq` global. Kept separate
// from components/analytics/meta-pixel.tsx so any funnel component (order
// modals, product pages) can fire an event without importing React/Script
// concerns, and so the pixel ID never has to be threaded through call
// sites — it's already baked into `fbq` by the base snippet at init time.
//
// `fbq` is injected by the base pixel script (components/analytics/
// meta-pixel.tsx) and queues calls itself before the real script has
// loaded, so calling this immediately on mount is safe — no readiness
// check beyond "did the base component even render" (see NEXT_PUBLIC_
// META_PIXEL_ID handling there). If that env var is unset, `fbq` never
// exists and every call here is a silent no-op, so pages keep working
// with tracking simply off rather than throwing.

type Fbq = (...args: unknown[]) => void;

function getFbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof fbq === "function" ? fbq : null;
}

/**
 * Fire a standard Meta Pixel event. `eventID` is the dedup key for a
 * future server-side Conversions API call for the same event (e.g. the
 * Firestore order id for Purchase) — passing it now costs nothing and
 * means CAPI can be added later without touching this call site again.
 */
export function trackPixelEvent(
  eventName: string,
  params?: Record<string, unknown>,
  options?: { eventID?: string }
): void {
  const fbq = getFbq();
  if (!fbq) return;
  if (options?.eventID) {
    fbq("track", eventName, params ?? {}, { eventID: options.eventID });
  } else {
    fbq("track", eventName, params ?? {});
  }
}

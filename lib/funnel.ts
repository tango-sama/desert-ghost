// Client side of funnel tracking: a stable session id and a fire-and-forget
// sender.
//
// Every call is deliberately unawaited and can never throw into the caller.
// This runs on a paid-traffic conversion path, and an analytics hiccup must
// not delay a question transition, let alone break an order. If an event is
// lost, a number in a dashboard is slightly low; that is a far cheaper failure
// than a customer stuck on a spinner.
import { orderAttribution } from "@/lib/attribution";

const SESSION_KEY = "ds_funnel_sid";

/**
 * Per-browser id tying one visitor's funnel events together.
 *
 * Deliberately separate from `ds_vid` (the Meta external_id in
 * lib/meta-pixel.ts): that one identifies a browser to Meta, this one groups a
 * funnel walk-through for our own analytics, and the A/B variant is derived
 * from it. Keeping them apart means a change to either can't silently reassign
 * every visitor's test arm.
 */
export function funnelSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    // Private mode: fall back to a per-page-load id. The visitor still gets a
    // coherent funnel within this page view and a stable variant within it;
    // only cross-visit stitching is lost.
    return `nostore-${Math.random().toString(36).slice(2, 12)}`;
  }
}

export type FunnelEvent = {
  step: "view" | "start" | "answer" | "result" | "offer" | "checkout" | "order";
  funnel?: string;
  variant?: string;
  stepIndex?: number;
  answers?: Record<string, string | undefined>;
  productIds?: (string | number)[];
  value?: number;
  orderId?: string;
};

/** Send one event. Never awaited by callers, never throws. */
export function trackFunnel(ev: FunnelEvent): void {
  if (typeof window === "undefined") return;
  try {
    const sessionId = funnelSessionId();
    if (!sessionId) return;
    const attr = orderAttribution();
    const a = (attr.attribution ?? {}) as {
      campaignId?: string;
      adId?: string;
    };
    const body = JSON.stringify({
      ...ev,
      funnel: ev.funnel ?? "quiz",
      sessionId,
      campaignId: a.campaignId,
      adId: a.adId,
      channel: attr.channel,
      // Drop undefined answer values so the route's validator sees only
      // questions actually answered.
      answers: ev.answers
        ? Object.fromEntries(Object.entries(ev.answers).filter(([, v]) => v))
        : undefined,
    });

    // sendBeacon survives the page being navigated away from, which is exactly
    // when the most interesting event (leaving mid-funnel) fires. Falls back to
    // keepalive fetch where it isn't available.
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/funnel", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics must never break the funnel it measures.
  }
}

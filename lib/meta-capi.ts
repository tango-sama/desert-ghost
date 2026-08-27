// SERVER-ONLY Meta Conversions API (CAPI) transport. NEVER import this from
// a "use client" component or anything reachable from a browser bundle —
// it reads `META_CAPI_ACCESS_TOKEN`, and a single client import would ship
// that token to the browser. Same hard boundary as lib/firebase-admin.ts.
// The only importer is app/api/meta-capi/route.ts (a Route Handler).
//
// The reverse direction is what keeps this safe: the client half
// (lib/meta-pixel.ts) never imports this module — it only POSTs to that
// route. `normalizeDzPhone` is imported FROM lib/meta-pixel.ts (a pure
// function, no browser globals at module scope) so the phone-normalization
// rule has exactly one definition shared by both halves.
//
// Credentials: `META_CAPI_ACCESS_TOKEN` (Business Manager → System Users →
// token with pixel/ads_management access). Missing token = documented
// no-op, never a throw — same "a missing credential degrades gracefully"
// invariant as lib/firebase-admin.ts's `FIREBASE_SERVICE_ACCOUNT_KEY`.
import { createHash } from "crypto";
import { normalizeDzPhone } from "@/lib/meta-pixel";

// Overridable so the Graph version can be bumped from the Vercel dashboard
// without a code deploy. CAPI payloads are stable across recent versions.
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v23.0";

/**
 * Meta requires every PII field pre-hashed with SHA-256 when sent through
 * the Graph API (unlike the browser JS SDK, which hashes for you). Each
 * field also has its own normalization rule that must be applied BEFORE
 * hashing — get it wrong and the hash simply never matches Meta's own,
 * which degrades silently as "poor match quality" rather than as an error.
 */
function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// Lowercase + trim: the rule for names, emails, and external ids.
function hashLower(value: string): string | undefined {
  const v = value.trim().toLowerCase();
  return v ? sha256(v) : undefined;
}

// Phone: Meta wants DIGITS ONLY with a country code — no `+`, no spaces,
// no leading zero. `normalizeDzPhone` produces `+213XXXXXXXXX`, so the
// `+` has to come off before hashing. Hashing the `+` form (which this
// repo previously did) produces a hash Meta can never match.
function hashPhone(phone: string): string | undefined {
  const digits = normalizeDzPhone(phone).replace(/\D/g, "");
  return digits ? sha256(digits) : undefined;
}

// City/state: lowercase with all whitespace and punctuation removed.
// Prefer the Latin-script field where the order has one (`wilayaFr`,
// `communeFr`) — Meta matches Latin place names, not Arabic.
function hashPlace(value: string): string | undefined {
  const v = value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return v ? sha256(v) : undefined;
}

/**
 * Raw (unhashed) identifiers as they exist in the app. `buildUserData()`
 * below applies each field's normalization + SHA-256; nothing in this
 * shape is ever sent to Meta or written to a log as-is.
 */
export type MetaUserIdentifiers = {
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  country?: string;
  /** Stable pseudonymous visitor id (lib/meta-pixel.ts `getVisitorId`). */
  externalId?: string;
  /** Meta browser cookies, forwarded from the client. Sent UNhashed. */
  fbp?: string;
  fbc?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
};

/**
 * Hash/normalize identifiers into Meta's `user_data` shape. Fields with no
 * value are omitted entirely rather than sent empty — an empty hash counts
 * against match quality. `fbp`/`fbc`/IP/user-agent are the only fields Meta
 * expects in the clear.
 */
export function buildUserData(id: MetaUserIdentifiers): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const put = (key: string, hashed: string | undefined) => {
    if (hashed) out[key] = [hashed];
  };

  if (id.phone) put("ph", hashPhone(id.phone));
  if (id.firstName) put("fn", hashLower(id.firstName));
  if (id.lastName) put("ln", hashLower(id.lastName));
  if (id.city) put("ct", hashPlace(id.city));
  if (id.state) put("st", hashPlace(id.state));
  if (id.country) put("country", hashLower(id.country));
  // external_id is the single highest-leverage field on a site with no
  // customer accounts and no email: it ties every event from one browser
  // together even when nothing else about the visitor is known. Hashed
  // here to match how the browser SDK hashes the same value when it's
  // passed through `fbq('init', ...)` advanced matching.
  if (id.externalId) put("external_id", hashLower(id.externalId));

  if (id.fbp) out.fbp = id.fbp;
  if (id.fbc) out.fbc = id.fbc;
  if (id.clientIpAddress) out.client_ip_address = id.clientIpAddress;
  if (id.clientUserAgent) out.client_user_agent = id.clientUserAgent;
  return out;
}

export type MetaServerEvent = {
  event_name: string;
  /** MUST equal the `eventID` the browser Pixel sent for the same event. */
  event_id: string;
  /** Unix seconds. Defaults to now. */
  event_time?: number;
  event_source_url?: string;
  action_source?: "website" | "app" | "phone_call" | "chat" | "other";
  user_data: Record<string, unknown>;
  custom_data?: Record<string, unknown>;
};

export type SendResult = { sent: boolean; reason?: string };

/**
 * POST one event to the Conversions API. Never throws and never returns a
 * rejected promise — every failure comes back as `{ sent: false, reason }`
 * so the caller (a customer-facing order flow) can ignore it safely.
 *
 * Logging discipline: the access token is never logged (it goes in the
 * request body, never in a URL that might end up in an error string), and
 * no customer data is logged — only the event name, the event id, and
 * Meta's own error text.
 */
export async function sendMetaEvent(event: MetaServerEvent): Promise<SendResult> {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!token || !pixelId) return { sent: false, reason: "not_configured" };

  // Optional and never hardcoded: set META_TEST_EVENT_CODE in a preview/dev
  // environment to make these events show up in Events Manager → Test
  // Events, then remove it. Leaving it set in production would keep real
  // conversions out of optimization, so it must stay env-driven.
  const testEventCode = process.env.META_TEST_EVENT_CODE;

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: event.event_name,
        event_id: event.event_id,
        event_time: event.event_time ?? Math.floor(Date.now() / 1000),
        action_source: event.action_source ?? "website",
        ...(event.event_source_url ? { event_source_url: event.event_source_url } : {}),
        user_data: event.user_data,
        ...(event.custom_data ? { custom_data: event.custom_data } : {}),
      },
    ],
    // Token travels in the BODY, not the query string, so it can never leak
    // into a proxy/access log or into an error message built from the URL.
    access_token: token,
  };
  if (testEventCode) payload.test_event_code = testEventCode;

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[DS] meta-capi ${event.event_name} ${event.event_id} -> ${res.status} ${text.slice(0, 500)}`
      );
      return { sent: false, reason: `http_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error(
      `[DS] meta-capi ${event.event_name} ${event.event_id} -> network`,
      err instanceof Error ? err.message : err
    );
    return { sent: false, reason: "network" };
  }
}

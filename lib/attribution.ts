// Ad attribution capture — the spine that lets every order be traced back to
// the ad that produced it.
//
// WHY THIS EXISTS
// ---------------
// Orders already carry `_fbp`/`_fbc` for Meta's own matching, but those are
// opaque cookies: they let META attribute a conversion, they do not let US
// answer "which campaign made money". Net-profit-per-ad needs the campaign /
// ad set / ad ids on our side of the fence, in Firestore, joinable against
// spend. That is what this module captures.
//
// FIRST TOUCH vs LAST TOUCH
// -------------------------
// Both are kept. First touch is the ad that ORIGINALLY brought the visitor in
// and is what a COD shop should usually pay attribution to — an Algerian
// customer commonly clicks an ad, leaves, and comes back directly a day later
// to order. Crediting that order to "direct" would make every campaign look
// unprofitable. Last touch is kept alongside it so a future model can compare.
//
// THE OVERWRITE RULE (the part that is easy to get wrong)
// ------------------------------------------------------
// Stored attribution is only ever replaced when the CURRENT url actually
// carries ad parameters. Plain internal navigation ( / -> /checkout ) has no
// params and must never clobber a real click, or every order would end up
// attributed to the last page the customer happened to browse.
//
// NO PII. Everything here is campaign metadata plus the random `ds_vid`
// visitor id from lib/meta-pixel.ts. Nothing identifies a person.
import { getVisitorId, getFbc } from "@/lib/meta-pixel";

const FIRST_KEY = "ds_attr_first";
const LAST_KEY = "ds_attr_last";

// Matches the 90-day window Meta's own `_fbc` click cookie uses, so our
// attribution and Meta's stop agreeing at the same time rather than ours
// expiring first and silently reporting "direct".
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export type Attribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  // Meta/TikTok object ids, populated from the ad's URL parameters. Meta does
  // NOT add these on its own — the ad must set campaign URL parameters using
  // its dynamic macros ({{campaign.id}}, {{adset.id}}, {{ad.id}}). Without
  // that setup these stay empty and only the utm_* fields arrive.
  campaignId?: string;
  adsetId?: string;
  adId?: string;
  fbclid?: string;
  ttclid?: string;
  landingPath?: string;
  referrer?: string;
  seenAt?: number;
};

/** Attribution as it is stamped onto an order document. */
export type OrderAttribution = {
  channel: "meta" | "tiktok" | "referral" | "direct" | "phone";
  visitorId?: string;
  fbc?: string;
  attribution?: Attribution;
  attributionLast?: Attribution;
};

function readParams(): URLSearchParams | null {
  if (typeof window === "undefined") return null;
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return null;
  }
}

function trimmed(v: string | null | undefined): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  // Cap length: these land in Firestore and come straight off a URL, so a
  // hostile or malformed link must not be able to write an unbounded field.
  return s ? s.slice(0, 300) : undefined;
}

/**
 * Read ad parameters out of the current URL.
 *
 * Accepts both the snake_case names Meta writes (`utm_campaign`) and the
 * camelCase ones our own links use (`campaignId`), plus Meta's `campaign_id`
 * spelling, because all three show up in practice depending on how the ad's
 * URL parameters were typed in Ads Manager.
 */
function fromUrl(): Attribution | null {
  const p = readParams();
  if (!p) return null;
  const get = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = trimmed(p.get(k));
      if (v) return v;
    }
    return undefined;
  };

  const attr: Attribution = {
    utmSource: get("utm_source"),
    utmMedium: get("utm_medium"),
    utmCampaign: get("utm_campaign"),
    utmContent: get("utm_content"),
    utmTerm: get("utm_term"),
    campaignId: get("campaignId", "campaign_id"),
    adsetId: get("adsetId", "adset_id"),
    adId: get("adId", "ad_id"),
    fbclid: get("fbclid"),
    ttclid: get("ttclid"),
  };

  // Nothing ad-related in this URL — an ordinary internal navigation.
  const hasSignal = Object.values(attr).some(Boolean);
  if (!hasSignal) return null;

  try {
    attr.landingPath = window.location.pathname.slice(0, 300);
    // Only external referrers are informative; an internal one is just the
    // previous page of this same session.
    const ref = document.referrer;
    if (ref && !ref.startsWith(window.location.origin)) attr.referrer = ref.slice(0, 300);
  } catch {
    // Location/referrer unavailable — the campaign fields still stand alone.
  }
  attr.seenAt = Date.now();
  return attr;
}

function read(key: string): Attribution | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Attribution;
    if (!parsed || typeof parsed !== "object") return undefined;
    // Expired click — report it as absent rather than crediting a months-old ad.
    if (parsed.seenAt && Date.now() - parsed.seenAt > MAX_AGE_MS) return undefined;
    return parsed;
  } catch {
    // Private mode, disabled storage, or corrupt JSON. Attribution is a
    // best-effort signal and must never break the page that reads it.
    return undefined;
  }
}

function write(key: string, attr: Attribution): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(attr));
  } catch {
    // Storage unavailable — this page view goes unattributed. Acceptable.
  }
}

/**
 * Capture attribution from the current URL, if it has any.
 *
 * Called once per page load from <AttributionCapture/> in the root layout, so
 * it runs on the landing page of every funnel without each page opting in.
 * Safe to call repeatedly: first touch is written once and then left alone.
 */
export function captureAttribution(): void {
  const incoming = fromUrl();
  if (!incoming) return; // no ad params — never clobber a stored click
  if (!read(FIRST_KEY)) write(FIRST_KEY, incoming);
  write(LAST_KEY, incoming);
}

/** Which acquisition channel a stored attribution represents. */
function channelOf(attr: Attribution | undefined): OrderAttribution["channel"] {
  if (!attr) return "direct";
  if (attr.fbclid || attr.campaignId || attr.adsetId || attr.adId) return "meta";
  if (attr.ttclid) return "tiktok";
  const src = (attr.utmSource || "").toLowerCase();
  if (src.includes("facebook") || src.includes("meta") || src.includes("instagram")) return "meta";
  if (src.includes("tiktok")) return "tiktok";
  if (attr.utmSource || attr.referrer) return "referral";
  return "direct";
}

/**
 * The attribution blob stamped onto an order by saveOrder().
 *
 * `phone` is passed for seller-entered orders: those are placed from the
 * shop's own browser, which may well carry a stale ad click from the owner's
 * own browsing. Crediting a phone order to that ad would silently inflate the
 * campaign's numbers, so ad fields are dropped entirely for them — the same
 * reasoning that makes onOrderCreatedMetaPurchase skip `source: admin_phone`.
 */
export function orderAttribution(channel?: "phone"): OrderAttribution {
  if (channel === "phone") return { channel: "phone" };
  const first = read(FIRST_KEY);
  const last = read(LAST_KEY);
  const out: OrderAttribution = { channel: channelOf(first) };
  const vid = getVisitorId();
  if (vid) out.visitorId = vid;
  const fbc = getFbc();
  if (fbc) out.fbc = fbc;
  if (first) out.attribution = first;
  // Only worth storing when the ad itself genuinely differs from first touch.
  // Compared on the campaign fields rather than on `seenAt`: two captures can
  // land in the same millisecond, and a timestamp match would then throw away
  // a real second click.
  if (last && (!first || !sameAd(first, last))) out.attributionLast = last;
  return out;
}

/** Whether two captures describe the same ad click (ignoring when they happened). */
function sameAd(a: Attribution, b: Attribution): boolean {
  const keys: (keyof Attribution)[] = [
    "utmSource",
    "utmMedium",
    "utmCampaign",
    "utmContent",
    "utmTerm",
    "campaignId",
    "adsetId",
    "adId",
    "fbclid",
    "ttclid",
  ];
  return keys.every((k) => a[k] === b[k]);
}

import { WILAYAS, COMMUNES, type WilayaData } from "@/lib/delivery-data";

export type Carrier = "yalidine" | "noest" | "zr";
export type DeliveryType = "home" | "office" | "desk";

export const COMPANIES: { id: Carrier; ar: string; fr: string; color: string }[] = [
  { id: "yalidine", ar: "ياليدين", fr: "Yalidine", color: "#E11900" },
  { id: "noest", ar: "نوست", fr: "Noest", color: "#1E73E8" },
  { id: "zr", ar: "زد آر إكسبرس", fr: "ZR Express", color: "#E8A413" },
];

// Picker display/default order — Noest first, like the live site's
// checkout and seller quick-order (the default carrier is the first
// enabled one in this order).
export const CARRIER_ORDER: Carrier[] = ["noest", "yalidine", "zr"];

export function companyInfo(id: Carrier) {
  return COMPANIES.find((c) => c.id === id)!;
}

// A stop desk (agency office) belonging to one carrier in one wilaya —
// synced from that carrier's own "centers" API, never derived from the
// commune list (a wilaya's stop desks are a small subset of its communes,
// at carrier-specific addresses).
export type CarrierCenter = { id: number | string; name: string; address?: string };

// Live per-carrier data synced from Firestore `delivery_data/{carrier}` (see
// syncCarriers in trinkl/functions/index.js) — overrides the static defaults
// in delivery-data.ts when present. `centers` is optional because the sync
// job may not populate it yet for every carrier; callers must NOT fall back
// to `communes` when it's missing — an empty/loading desk list, not the
// commune list, is the correct state until real desk data is synced.
export type CarrierData = {
  wilayas: { id: number | string; ar: string; fr: string }[];
  communes: Record<string, string[]>;
  centers?: Record<string, CarrierCenter[]>;
  fees: Record<string, { home: number; desk: number }>;
  // Per-commune fee overrides within a wilaya — Yalidine's own "Supplément
  // commune" (its real price varies by destination commune, not just
  // wilaya). Currently only synced for Yalidine (see syncCarriers /
  // yalidineFeeTable in tango-sama/trinkl); optional because Noest/ZR docs
  // never carry it. Keyed by wilaya id -> exact commune name (as it appears
  // in `communes` above) -> { home, desk }. Callers must fall back to the
  // wilaya-level `fees` entry when the commune has no entry here (a Stop
  // Desk destination, an unsynced carrier, or a name that doesn't match
  // exactly) — see baseFeeForCarrier.
  communeFees?: Record<string, Record<string, { home: number; desk: number }>>;
};
export type CarrierCache = Partial<Record<Carrier, CarrierData>>;

export function wilaya(id: number | string): WilayaData | null {
  const sid = String(id);
  return WILAYAS.find((w) => String(w.id) === sid) ?? null;
}

export function communes(id: number | string) {
  return COMMUNES[String(id)] ?? [];
}

export function fee(id: number | string, type: DeliveryType, company: Carrier): number {
  const w = wilaya(id);
  if (!w) return 0;
  const stop = type === "office" || type === "desk";
  if (company === "noest") return stop ? w.noestDesk : w.noestHome;
  return stop ? w.desk : w.home;
}

// Whether THIS carrier's own live wilaya/commune list (synced from its
// real API by syncCarriers) has loaded. Carriers serve genuinely
// different sets — e.g. currently 58 (Yalidine) / 56 (Noest) / 54 (ZR)
// wilayas — so callers must not show wilaya/commune options until this
// is true; the static fallback below is for the fee estimate only, never
// for eligibility lists.
export function carrierDataReady(company: Carrier, cache: CarrierCache): boolean {
  return !!cache[company];
}

export function wilayasFor(company: Carrier, cache: CarrierCache) {
  const d = cache[company];
  return d && d.wilayas.length ? d.wilayas : WILAYAS;
}

export function wilayaForCarrier(company: Carrier, id: number | string, cache: CarrierCache) {
  const sid = String(id);
  return wilayasFor(company, cache).find((w) => String(w.id) === sid) ?? null;
}

export function communesForCarrier(company: Carrier, id: number | string, cache: CarrierCache): string[] {
  const d = cache[company];
  if (d && d.communes[String(id)]) return d.communes[String(id)];
  return communes(id).map((c) => c.fr || c.ar);
}

// Stop desks (agency offices) THIS carrier runs in THIS wilaya — the Stop
// Desk equivalent of communesForCarrier(). Deliberately has no static
// fallback: unlike communes (which have an offline default grid), stop-desk
// addresses only exist as each carrier's own live-synced list, so an
// unsynced/empty result must render as "no desks (yet)", never silently
// substitute the commune list.
export function centersForCarrier(company: Carrier, id: number | string, cache: CarrierCache): CarrierCenter[] {
  const d = cache[company];
  return d?.centers?.[String(id)] ?? [];
}

// Owner-confirmed fee corrections that override the synced grid.
//
// The server-side `syncCarriers` fee sync (in tango-sama/trinkl) stored a
// national / Alger-origin Yalidine grid instead of computing fees from this
// store's real departure wilaya (site_settings.originWilaya = "Touggourt").
// That makes every northern destination too cheap — e.g. Alger came out
// 500/300 instead of the real 800/500 from Touggourt. Until that sync is
// fixed at the source, these owner-confirmed real Yalidine fees take
// precedence over the synced/static grid so checkout shows what Yalidine
// actually bills.
//
// Add a wilaya here as its correct home/desk fee is confirmed. Keyed by
// carrier -> wilaya id (string) -> { home, desk } in DA. Remove an entry
// once the upstream sync is fixed and its synced value is correct again.
const FEE_OVERRIDES: Partial<Record<Carrier, Record<string, { home: number; desk: number }>>> = {
  yalidine: {
    // Alger (wilaya 16) — confirmed 2026-07-22 (e.g. Bab El Oued):
    // home 800 / desk 500. Synced grid wrongly had home 500 / desk 300.
    "16": { home: 800, desk: 500 },
  },
};

// Base (home | desk) delivery fee for a destination wilaya, optionally
// sharpened to a specific commune. Resolution order: owner-confirmed
// override → this carrier's per-commune fee (when `commune` is given and
// synced — Yalidine's real "Supplément commune") → this carrier's
// live-synced per-wilaya grid → static defaults. This is the fee "including
// commune tax" but WITHOUT any weight surcharge — see feeForCarrier() for
// the total actually charged.
//
// NOTE: FEE_OVERRIDES still wins over the per-commune fee on purpose — it
// was owner-confirmed against a real Yalidine order back when the synced
// grid used the wrong origin wilaya. Now that syncCarriers also captures
// real per-commune fees, re-verify wilaya 16 (Alger) against a live order
// and remove its override once the synced per-commune numbers are trusted.
export function baseFeeForCarrier(
  company: Carrier,
  id: number | string,
  type: DeliveryType,
  cache: CarrierCache,
  commune?: string
): number {
  const stop = type === "office" || type === "desk";
  const ov = FEE_OVERRIDES[company]?.[String(id)];
  if (ov) return stop ? ov.desk : ov.home;
  const d = cache[company];
  if (commune) {
    const cf = d?.communeFees?.[String(id)]?.[commune];
    if (cf) return stop ? cf.desk : cf.home;
  }
  const f = d?.fees[String(id)];
  if (f) return stop ? f.desk : f.home;
  return fee(id, type, company);
}

// --- Weight ("oversize") fee ---------------------------------------------
//
// Yalidine (and Noest/ZR the same way) bill a delivery as:
//     total = base fee (home | desk)  +  weight fee
// The base fee already includes the commune tax. The weight fee — Yalidine
// calls it `oversize_fee` — applies ONLY to the billable weight above a
// free threshold: the first FREE_WEIGHT_KG are free, then a per-kg rate for
// each additional (whole, rounded-up) kilogram.
//
// Every parcel this store ships is a fixed ~1 kg (PARCEL_WEIGHT_KG), which
// is under the 5 kg free threshold, so the weight fee is always 0 and the
// customer only ever pays the base fee. The rule is written out in full,
// against a named constant rather than a magic 0, so it stays correct if
// heavier products are ever added and so the "delivery is just the base
// fee" behaviour is explicit and self-documenting.
export const FREE_WEIGHT_KG = 5;
export const PARCEL_WEIGHT_KG = 1;

// Whole kilograms billed beyond the free threshold (rounded up), matching
// Yalidine's "first N kg free, then per additional kg" rule.
export function billableOverweightKg(weightKg: number, freeKg = FREE_WEIGHT_KG): number {
  return Math.max(0, Math.ceil(weightKg) - freeKg);
}

// The weight surcharge for a parcel. `ratePerKg` is Yalidine's `oversize_fee`
// (per additional kg). It's not part of the synced per-wilaya grid because
// it never applies to this store's 1 kg parcels; when the billable weight is
// within the free threshold the rate is irrelevant and the surcharge is 0.
export function weightFee(
  weightKg: number = PARCEL_WEIGHT_KG,
  ratePerKg = 0
): number {
  return billableOverweightKg(weightKg) * ratePerKg;
}

// Total delivery fee actually charged to the customer: base fee + weight
// fee. Weight defaults to the store's fixed 1 kg, for which the weight fee
// is 0, so the total equals the base fee. `commune` sharpens the base fee to
// that exact destination (Yalidine's per-commune "Supplément commune") when
// synced data for it exists — pass it whenever a specific commune is
// selected, omit it (or pass "") for a Stop Desk pick that has no commune of
// its own. Kept as the single source of truth for every order surface
// (checkout, seller quick-order, admin, collagen, ...).
export function feeForCarrier(
  company: Carrier,
  id: number | string,
  type: DeliveryType,
  cache: CarrierCache,
  commune?: string,
  weightKg: number = PARCEL_WEIGHT_KG,
  oversizeRatePerKg = 0
): number {
  return baseFeeForCarrier(company, id, type, cache, commune) + weightFee(weightKg, oversizeRatePerKg);
}

const PHONE_RE = /^0[567][0-9]{8}$/;
export function isValidPhone(phone: string): boolean {
  return PHONE_RE.test(phone.replace(/\s/g, ""));
}

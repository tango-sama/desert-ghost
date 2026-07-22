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

// Live per-carrier data synced from Firestore `delivery_data/{carrier}` (see
// syncCarriers in trinkl/functions/index.js) — overrides the static defaults
// in delivery-data.ts when present.
export type CarrierData = {
  wilayas: { id: number | string; ar: string; fr: string }[];
  communes: Record<string, string[]>;
  fees: Record<string, { home: number; desk: number }>;
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

// Base (home | desk) delivery fee for a destination wilaya, from this
// carrier's live-synced grid, falling back to the static defaults. This is
// the fee "including commune tax" but WITHOUT any weight surcharge — see
// deliveryFee() for the total actually charged.
export function baseFeeForCarrier(
  company: Carrier,
  id: number | string,
  type: DeliveryType,
  cache: CarrierCache
): number {
  const d = cache[company];
  const stop = type === "office" || type === "desk";
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
// is 0, so the total equals the base fee. Kept as the single source of
// truth for every order surface (checkout, seller quick-order, collagen).
export function feeForCarrier(
  company: Carrier,
  id: number | string,
  type: DeliveryType,
  cache: CarrierCache,
  weightKg: number = PARCEL_WEIGHT_KG,
  oversizeRatePerKg = 0
): number {
  return baseFeeForCarrier(company, id, type, cache) + weightFee(weightKg, oversizeRatePerKg);
}

const PHONE_RE = /^0[567][0-9]{8}$/;
export function isValidPhone(phone: string): boolean {
  return PHONE_RE.test(phone.replace(/\s/g, ""));
}

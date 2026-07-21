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

export function feeForCarrier(
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

const PHONE_RE = /^0[567][0-9]{8}$/;
export function isValidPhone(phone: string): boolean {
  return PHONE_RE.test(phone.replace(/\s/g, ""));
}

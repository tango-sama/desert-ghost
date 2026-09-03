// Arabic display labels for the delivery carriers' own status vocabulary.
//
// The order card's tracker is Arabic everywhere EXCEPT the text the carriers
// themselves report: `trackingStatus.lastLabel` (the parcel's current state),
// each `TrackEvent.label` in «تفاصيل الشحنة», and the free-text failure reason
// in `TrackEvent.content`. Those arrive in whatever the carrier speaks — ZR
// Express in snake_case French (`sortie_en_livraison`), Noest in accented
// French sentences ("Enlevé par le livreur"), Yalidine in English ("Out for
// delivery") — which left staff reading an Arabic card that switched to French
// at exactly the moment a delivery was failing.
//
// This module is DISPLAY ONLY. Every existing matcher that drives behaviour
// (OUT_FOR_DELIVERY_RE, NO_ANSWER_RE, AT_DESK_RE, URGENT_REASON in
// orders-view.tsx, and isPastCancelWindow's "prêt à expédier" test in
// carriers.ts) must keep testing the RAW carrier string — translating before
// those would silently break stage detection, the traffic light and the
// cancel guard. Nothing here is ever written back to Firestore.
//
// The 5 step names (`trackingStatus.stageLabels`) and the alert text are NOT
// here: they are produced Arabic-side already by getParcelStatus in the
// separate tango-sama/trinkl functions repo.
//
// Pure strings — no React, no Firebase imports — so it stays testable on its
// own, the same way lib/storage-counter.ts is.

// Diacritic-, case- and punctuation-insensitive comparison key. The same
// concept reaches us spelled many ways ("sortie_en_livraison" / "Sortie en
// livraison" / "sortieEnLivraison"), so every lookup goes through this.
//
// Same normalisation as communeKey() in lib/delivery.ts, plus a camelCase
// split first — matching zrNormalize in the trinkl functions, which had to
// solve this exact spread for ZR's per-tenant state names. Arabic codepoints
// are preserved, so a status the carrier already reports in Arabic (ZR's
// «مجددا») keys to itself and simply finds no entry.
const HAS_ARABIC = /[\u0600-\u06ff]/;

export function trackKey(s: string): string {
  return String(s ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .trim();
}

// Carrier state names, keyed by trackKey(). Arabic wording deliberately
// mirrors the stage labels the server already sends («خرج للتوصيل»,
// «في مركز الفرز», «تم الاستلام») so the badge and the carrier line read as
// one vocabulary rather than two translations of the same journey.
const STATE_AR: Record<string, string> = {
  // ── Created / not yet shipped ──
  "commande recue": "تم استلام الطلب",
  "pret a expedier": "جاهز للشحن",
  "ready to dispatch": "جاهز للشحن",
  "readytodispatch": "جاهز للشحن",
  "en preparation": "قيد التحضير",
  "en traitement": "قيد المعالجة",

  // ── In the carrier's network ──
  "confirme au bureau": "تم التأكيد في المكتب",
  "vers wilaya": "في الطريق إلى الولاية",
  "vers centre": "في الطريق إلى الولاية",
  "vers bureau": "في الطريق إلى الولاية",

  // ── Out for delivery ──
  "sortie en livraison": "خرج للتوصيل",
  "sorti en livraison": "خرج للتوصيل",
  "out for delivery": "خرج للتوصيل",
  "en livraison": "في طور التوصيل",
  "en cours de livraison": "في طور التوصيل",
  "enleve par le livreur": "استلمه المندوب",
  "remis au livreur": "استلمه المندوب",
  "tentative de livraison": "محاولة توصيل",

  // ── Finished ──
  "livree": "تم التسليم",
  "livre": "تم التسليم",
  "delivered": "تم التسليم",
  "encaisse": "تم التحصيل",
};

// State names that carry a suffix or a counter, so no fixed key can catch
// them: ZR's whole `retour_*` family, and the numbered no-answer states
// («No Answer 1», «Ne répond pas 1»). Tested against the normalised key, in
// order — first match wins.
const STATE_RULES: [RegExp, string][] = [
  [/^retour/, "مرتجع"],
  [/no answer|ne repond pas|sans reponse|injoignable/, "الزبون لا يرد"],
];

// Failure reasons (`TrackEvent.content`) are free-text sentences, not an
// enum, so they are matched by ordered rules rather than exact keys. More
// specific rules come first — "appel sans reponse" must win over the generic
// "sans reponse" below it.
const REASON_RULES: [RegExp, string][] = [
  [/appel sans reponse/, "مكالمة بدون رد"],
  [/ne repond pas|sans reponse|no answer|injoignable/, "الزبون لا يرد"],
  [/absent/, "الزبون غائب"],
  [/adresse (erronee|incorrecte|introuvable)/, "العنوان خاطئ"],
  [/numero (erronee?|incorrect)/, "رقم الهاتف خاطئ"],
  [/hors zone/, "خارج نطاق التغطية"],
  [/colis perdu|perdu/, "الطرد مفقود"],
  [/endommage/, "الطرد متضرر"],
  [/refus/, "رفض الاستلام"],
  [/annul/, "ملغى"],
  [/report/, "مؤجل"],
];

// Arabic for a carrier STATE name, or null when we don't recognise it.
//
// Null rather than the input on purpose: carrier state names are not a fixed
// enum (ZR's are per-tenant configurable), so this map will always have gaps,
// and the caller must be able to tell "translated" from "passed through" —
// an unrecognised state renders raw and unchanged rather than being guessed
// at or flattened into a coarser stage name.
export function trackStateAr(raw: string | null | undefined): string | null {
  const s = String(raw ?? "");
  // Already Arabic — ZR reports some situations in Arabic itself («مجددا»).
  // Nothing to translate, and returning null keeps the caller from printing
  // the same string twice (once as the label, once as the raw quote).
  if (HAS_ARABIC.test(s)) return null;
  const k = trackKey(s);
  if (!k) return null;
  if (STATE_AR[k]) return STATE_AR[k];
  for (const [re, ar] of STATE_RULES) if (re.test(k)) return ar;
  return null;
}

// Arabic for a free-text failure REASON, or null when unrecognised (same
// pass-through contract as trackStateAr).
export function trackReasonAr(raw: string | null | undefined): string | null {
  const s = String(raw ?? "");
  if (HAS_ARABIC.test(s)) return null;
  const k = trackKey(s);
  if (!k) return null;
  for (const [re, ar] of REASON_RULES) if (re.test(k)) return ar;
  return null;
}

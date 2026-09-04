// The quiz funnel's brain: five questions in, a personalised recommendation
// out.
//
// Pure and I/O-free on purpose, exactly like lib/profit.ts — the catalog is
// passed in, nothing is fetched, nothing touches `window`. That makes the
// recommendation testable against the real 149-product catalog, and lets the
// same scoring run on the server (for a shareable result link) if that is ever
// wanted.
//
// WHY RULES AND NOT A MODEL CALL
// -----------------------------
// The recommendation itself is deterministic scoring, not an LLM round trip.
// This sits on a paid-traffic conversion path where a two-second wait costs
// orders, and a model outage would break the funnel outright. Scoring answers
// instantly, always, and can be unit-tested — none of which is true of a live
// generation. The model's proper job here is the *wording* of the result, not
// the choice of product, and that runs separately and non-blockingly.
//
// CATEGORY IDS ARE REAL. These are the actual Firestore `categories` document
// ids, not invented ones — a mismatch would silently recommend nothing.
import { priceNum, type Product } from "@/lib/firebase";

export type Goal =
  | "skin" | "hair" | "slim" | "gain" | "curves" | "hormones" | "vitality";
export type Duration = "new" | "months" | "long";
export type Age = "u25" | "a25" | "a35" | "a45";
export type Form = "caps" | "topical" | "oil" | "any";
export type Budget = "low" | "mid" | "high";

export type Answers = {
  goal?: Goal;
  duration?: Duration;
  age?: Age;
  form?: Form;
  budget?: Budget;
};

export type QuestionOption = { value: string; label: string; hint?: string };
export type Question = {
  key: keyof Answers;
  title: string;
  options: QuestionOption[];
};

/* Five single-select questions, no branching. Branching would personalise a
   little better and would also make every funnel-step number incomparable
   between visitors, which is worse: the whole point of this funnel is to
   learn where people drop off. */
export const QUESTIONS: Question[] = [
  {
    key: "goal",
    title: "ما الذي تريدين تحسينه أولاً؟",
    options: [
      { value: "skin", label: "بشرتي", hint: "نضارة، تفتيح، تصبّغات" },
      { value: "hair", label: "شعري", hint: "تساقط، ضعف، تقصّف" },
      { value: "slim", label: "تنحيف", hint: "إنقاص الوزن والبطن" },
      { value: "gain", label: "تسمين", hint: "زيادة الوزن" },
      { value: "curves", label: "تكبير الصدر أو المؤخرة" },
      { value: "hormones", label: "هرموناتي ودورتي" },
      { value: "vitality", label: "طاقتي وصحتي العامة", hint: "فيتامينات ومناعة" },
    ],
  },
  {
    key: "duration",
    title: "منذ متى وأنتِ تلاحظين هذا؟",
    options: [
      { value: "new", label: "أقل من ٣ أشهر" },
      { value: "months", label: "من ٣ إلى ١٢ شهراً" },
      { value: "long", label: "أكثر من سنة" },
    ],
  },
  {
    key: "age",
    title: "كم عمركِ؟",
    options: [
      { value: "u25", label: "أقل من ٢٥" },
      { value: "a25", label: "٢٥ – ٣٤" },
      { value: "a35", label: "٣٥ – ٤٤" },
      { value: "a45", label: "٤٥ فأكثر" },
    ],
  },
  {
    key: "form",
    title: "أي شكل تفضّلين؟",
    options: [
      { value: "caps", label: "كبسولات أو حبوب" },
      { value: "topical", label: "كريم أو سيروم" },
      { value: "oil", label: "زيوت وصابون" },
      { value: "any", label: "لا يهم — الأهم النتيجة" },
    ],
  },
  {
    key: "budget",
    title: "ما ميزانيتكِ التقريبية؟",
    options: [
      { value: "low", label: "أقل من ٥٠٠٠ دج" },
      { value: "mid", label: "٥٠٠٠ – ١٢٠٠٠ دج" },
      { value: "high", label: "أكثر من ١٢٠٠٠ دج" },
    ],
  },
];

/* Goal → catalog categories. `primary` is what the goal is actually about;
   `related` is what genuinely complements it and is what the bundle draws on
   (a skin routine paired with the skin-supplement line, hair loss paired with
   the vitamins that drive it). Ids verified against the live `categories`
   collection. */
const GOAL_CATEGORIES: Record<Goal, { primary: string[]; related: string[] }> = {
  skin: { primary: ["skin_care", "Bibo88"], related: ["NF", "AMF"] },
  hair: { primary: ["hair_care"], related: ["NF", "AMF", "Venom"] },
  slim: { primary: ["slimming"], related: ["Ms", "Fm", "NF"] },
  gain: { primary: ["fattening"], related: ["NF", "AMF", "Ms"] },
  curves: { primary: ["breast_enlargement", "butt_enlargement"], related: ["Venom", "fattening"] },
  hormones: { primary: ["Venom"], related: ["NF", "AMF", "vagina_care"] },
  vitality: { primary: ["NF", "Fm", "AMF"], related: ["Ms", "Msl", "Bibo88"] },
};

const BUDGET_CEILING: Record<Budget, number> = {
  low: 5000,
  mid: 12000,
  high: Number.MAX_SAFE_INTEGER,
};

/* Product form, read off the Arabic title. The catalog has no `form` field and
   adding one would mean the owner re-tagging 149 products, so this infers it
   from the words already there. Anything unrecognised scores as neutral rather
   than being penalised — a mis-guess must never bury a well-matched product. */
export function productForm(p: Product): Form | null {
  const t = `${p.title ?? p.name ?? ""} ${p.subtitle ?? ""}`;
  if (/كبسول|حبوب|أقراص|اقراص|كبسل|مسحوق|شراب|قطرات/.test(t)) return "caps";
  if (/كريم|سيروم|لوشن|جل|تونر|ماسك|قناع|محلول|تحاميل/.test(t)) return "topical";
  if (/زيت|صابون|غسول|صابونة/.test(t)) return "oil";
  return null;
}

/* Stock is "total units ever stocked", not a live count (see Product.stock),
   so it is a soft signal only:
     - a positive number means the owner has restocked it → worth surfacing
     - an explicit 0 means it ran out → push it down hard, since recommending
       something unavailable wastes the click that was paid for
     - absent means untracked, which is most of the catalog → stay neutral
   Treating absent as zero would eliminate two thirds of the products. */
/** True when the catalog explicitly says this product ran out (stock === 0).
 *  Untracked stock (the majority of the catalog) is NOT sold out. */
export function isSoldOut(p: Product): boolean {
  const raw = p.stock as unknown;
  if (raw === undefined || raw === null || raw === "") return false;
  const n = Number(raw);
  return Number.isFinite(n) && n <= 0;
}

function stockScore(p: Product): number {
  // Read as unknown: `Product.stock` is typed `number`, but the live catalog
  // stores an empty STRING for untracked products (verified against the real
  // 149-product collection). Trusting the declared type here would make
  // `Number("")` collapse to 0 and mark two thirds of the shop as sold out.
  const raw = p.stock as unknown;
  if (raw === undefined || raw === null || raw === "") return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  if (n > 0) return 20;
  return -30;
}

export type Scored = { product: Product; score: number; why: string[] };

/** Score one product against the answers. Exported for testing. */
export function scoreProduct(p: Product, a: Answers): Scored {
  const why: string[] = [];
  let score = 0;

  const cat = String(p.category ?? "");
  if (a.goal) {
    const { primary, related } = GOAL_CATEGORIES[a.goal];
    if (primary.includes(cat)) {
      score += 100;
      why.push("goal");
    } else if (related.includes(cat)) {
      score += 40;
      why.push("related");
    } else {
      // Off-goal products stay eligible for the bundle but must never
      // outrank something that actually addresses what she asked about.
      score -= 60;
    }
  }

  const form = productForm(p);
  if (a.form && a.form !== "any" && form) {
    if (form === a.form) {
      score += 25;
      why.push("form");
    } else score -= 15;
  }

  const price = priceNum(p.price);
  if (a.budget) {
    const ceiling = BUDGET_CEILING[a.budget];
    if (price <= ceiling) {
      score += 30;
      why.push("budget");
      // Comfortably inside the budget — a small nudge, not a race to the
      // cheapest thing on the shelf.
      if (price <= ceiling * 0.6) score += 10;
    } else {
      // Over budget is a soft penalty, not a filter: someone who says "under
      // 5000" will still be shown a 5500 hero if nothing else fits, rather
      // than an empty result.
      score -= 40;
    }
  }

  score += stockScore(p);

  // A long-standing problem is not going to be fixed by a soap. Nudge toward
  // supplements, which is what actually gets taken for months.
  if (a.duration === "long" && form === "caps") {
    score += 12;
    why.push("duration");
  }
  // Age-appropriate formulations, matched on what the titles actually say.
  const title = `${p.title ?? p.name ?? ""}`;
  if ((a.age === "a35" || a.age === "a45") && /كولاجين|collagen|ريتينول|retinol|مفاصل|Q10|هرمون/i.test(title)) {
    score += 15;
    why.push("age");
  }
  if (a.age === "u25" && /حب الشباب|تفتيح|صابون/.test(title)) score += 6;

  return { product: p, score, why };
}

export type Recommendation = {
  hero: Product | null;
  /** Hero plus complements — what variant B offers as a routine. */
  bundle: Product[];
  /** Ranked runners-up, for "أخرى قد تناسبكِ". */
  alternates: Product[];
  scored: Scored[];
};

/**
 * Rank the catalog for one set of answers.
 *
 * The bundle deliberately takes at most one product per category: three
 * different collagen creams is a worse routine than a cream plus a supplement
 * plus a wash, and it reads as padding rather than advice.
 */
export function recommend(products: Product[], a: Answers, bundleSize = 3): Recommendation {
  // Availability is a TIER, not a score adjustment. A big enough stock penalty
  // would drag a sold-out on-goal product below an in-stock off-goal one and
  // recommend something irrelevant; sorting in tiers keeps goal relevance
  // deciding the order *within* what can actually be shipped.
  //
  // This matters more than it looks on a cash-on-delivery shop: an order for
  // something out of stock is a paid click that turns into a cancelled parcel,
  // which damages the confirmation rate the whole profit engine turns on.
  const scored = products
    .map((p) => scoreProduct(p, a))
    .sort(
      (x, y) =>
        Number(isSoldOut(x.product)) - Number(isSoldOut(y.product)) ||
        y.score - x.score ||
        priceNum(y.product.price) - priceNum(x.product.price),
    );

  const hero = scored[0]?.product ?? null;
  const bundle: Product[] = [];
  const usedCategories = new Set<string>();

  for (const s of scored) {
    if (bundle.length >= bundleSize) break;
    const cat = String(s.product.category ?? "");
    if (usedCategories.has(cat)) continue;
    // Applies to the hero too — `&& bundle.length` here would have exempted
    // the single most important slot from the availability rule.
    if (isSoldOut(s.product)) continue;
    usedCategories.add(cat);
    bundle.push(s.product);
  }

  const inBundle = new Set(bundle.map((p) => String(p.id)));
  const alternates = scored
    .filter((s) => !inBundle.has(String(s.product.id)))
    .slice(0, 4)
    .map((s) => s.product);

  return { hero, bundle, alternates, scored };
}

/** Total price of a set of products, in dinars. */
export function bundleTotal(products: Product[]): number {
  return products.reduce((n, p) => n + priceNum(p.price), 0);
}

// --------------------------------------------------------------------------
// A/B variant
// --------------------------------------------------------------------------

/**
 * The first thing worth testing on this funnel: does the result screen sell
 * better as one focused product, or as a routine?
 *
 * That is the real tension in a bundle offer — a routine raises order value
 * but asks for a bigger yes, and in cash-on-delivery a bigger yes also tends
 * to mean a worse confirmation rate. Which way that nets out is exactly the
 * kind of thing this shop should be measuring rather than guessing, and the
 * profit engine can already answer it per variant.
 */
export type Variant = "single" | "bundle";

export function variantBundleSize(v: Variant): number {
  return v === "single" ? 1 : 3;
}

/** Deterministic 50/50 split from the session id, so a visitor's variant is
 *  stable across steps without needing to be stored anywhere. */
export function variantFor(sessionId: string): Variant {
  let h = 0;
  for (let i = 0; i < sessionId.length; i++) h = (h * 31 + sessionId.charCodeAt(i)) | 0;
  return (Math.abs(h) & 1) === 0 ? "single" : "bundle";
}

/** True once every question has an answer. */
export function isComplete(a: Answers): boolean {
  return QUESTIONS.every((q) => Boolean(a[q.key]));
}

/** Short human-readable summary of the answers, for the order document and
 *  for the AI blurb's prompt. */
export function answersSummary(a: Answers): string {
  return QUESTIONS.map((q) => {
    const v = a[q.key];
    const opt = q.options.find((o) => o.value === v);
    return opt ? `${q.title} ${opt.label}` : null;
  })
    .filter(Boolean)
    .join(" · ");
}

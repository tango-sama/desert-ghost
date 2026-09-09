// The quiz funnel's brain: five questions in, one category and one anchor
// product out.
//
// Pure and I/O-free on purpose, exactly like lib/profit.ts — the catalog is
// passed in, nothing is fetched, nothing touches `window`. That makes the
// recommendation testable against the real 149-product catalog, and lets the
// same scoring run on the server (for a shareable result link) if that is ever
// wanted.
//
// WHY A CATEGORY TALLY AND NOT A CATALOG-WIDE SCORE
// -------------------------------------------------
// This used to score all 149 products against the answers and hand back
// whatever came out on top, which meant the funnel's most important number —
// what she is actually offered — moved every time the owner edited a title or
// added a product. Six fixed categories, each with one anchor product, make
// the outcome a thing that can be reasoned about, priced, and advertised: a
// campaign can be pointed at "تنحيف" knowing exactly which product the click
// ends on. The catalog is still ranked, but only to fill the routine around a
// decided anchor, never to decide it.
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
// CATEGORY IDS ARE REAL. The catalog category ids named below are the actual
// Firestore `categories` document ids, not invented ones — a mismatch would
// silently recommend nothing.
import { priceNum } from "@/lib/catalog";
import type { Product } from "@/lib/firebase";

/**
 * The six scoring categories. Every answer adds points to one or more of
 * these, and the highest total decides the whole result screen.
 *
 * Still called `Goal` because it is still the first question's answer, and
 * because /offer and lib/landing-content.ts key their copy off it. What
 * changed is that the goal is no longer only a filter — it is now the outcome
 * the other four questions can move.
 */
export type Goal = "skin" | "hair" | "gain" | "slim" | "energy" | "antiaging";

/** Stable order, used to break a tie that even the gateway cannot break and
 *  to iterate the tally deterministically. Ordered by what the shop actually
 *  sells most of, so an unbreakable tie resolves toward the safer bet. */
export const GOALS: Goal[] = ["skin", "hair", "slim", "gain", "energy", "antiaging"];

export type Timeline = "recent" | "months" | "years" | "prevent";
/** Product form. `Form` is also what `productForm()` reads off a title, so the
 *  preference and the product are compared in the same vocabulary. */
export type Form = "caps" | "topical" | "oil" | "any";
export type Concern = "tired" | "dull" | "shedding" | "thin" | "belly" | "lines";
export type Routine = "exhausted" | "irregular" | "beauty" | "changed" | "noappetite";

export type Answers = {
  goal?: Goal;
  timeline?: Timeline;
  form?: Form;
  concern?: Concern;
  routine?: Routine;
};

/** Points one option contributes to the tally. Absent categories score 0 —
 *  an option is never allowed to subtract, so no answer can push a category
 *  she explicitly asked for below one she never mentioned. */
export type Points = Partial<Record<Goal, number>>;

export type QuestionOption = {
  value: string;
  label: string;
  hint?: string;
  points: Points;
};
export type Question = {
  key: keyof Answers;
  title: string;
  /** One line under the title. Keeps a question from reading as an
   *  interrogation and tells her why it is being asked. */
  lead?: string;
  options: QuestionOption[];
};

/**
 * How much the gateway question is worth.
 *
 * Set against the follow-ups deliberately: questions 2–5 can award at most 3
 * points each to a single category, so overturning the gateway takes all four
 * of them pointing the same other way (12 > 10). One stray answer never
 * overrides what she said she came for, and a consistent story always does —
 * which is exactly the case worth catching, a woman who picks "بشرتي" and
 * then says 45+, tightness and wrinkles at every step.
 */
const GATEWAY_POINTS = 10;
/** The gateway's spillover onto the category that genuinely neighbours it.
 *  Small: it seeds a plausible runner-up without ever competing on its own. */
const GATEWAY_NEIGHBOUR = 3;

/* Five single-select questions, no branching. Branching would personalise a
   little better and would also make every funnel-step number incomparable
   between visitors, which is worse: the whole point of this funnel is to
   learn where people drop off.

   Copy rules for every string in this file: Arabic, addressed to a woman, in
   the feminine form throughout (لكِ, تعانين, اكتشفي). No medical claims, no
   promised timelines, no prices — the same limits the AI blurb runs under. */
export const QUESTIONS: Question[] = [
  // Q1 — THE GATEWAY. It sets the base category, and the four that follow only
  // tilt it. Deliberately the shortest question on the page: it is the one
  // every visitor has to answer to get anywhere, so it must be readable in a
  // single glance on a phone arriving from an ad.
  {
    key: "goal",
    title: "ما الذي تريدين العناية به أولاً؟",
    lead: "اختاري ما يهمّكِ أكثر اليوم — والباقي نضبطه معكِ في الأسئلة القادمة.",
    options: [
      {
        value: "skin",
        label: "بشرتي",
        hint: "نضارة، تفتيح، تصبّغات",
        points: { skin: GATEWAY_POINTS, antiaging: GATEWAY_NEIGHBOUR },
      },
      {
        value: "hair",
        label: "شعري",
        hint: "تساقط، ضعف، تقصّف",
        points: { hair: GATEWAY_POINTS, antiaging: 2 },
      },
      {
        value: "gain",
        label: "زيادة وزني",
        hint: "تسمين وامتلاء الجسم",
        points: { gain: GATEWAY_POINTS, energy: 2 },
      },
      {
        value: "slim",
        label: "إنقاص وزني",
        hint: "تنحيف وشدّ البطن",
        points: { slim: GATEWAY_POINTS, energy: 2 },
      },
      {
        value: "energy",
        label: "طاقتي ونشاطي",
        hint: "تعب، خمول، قلة تركيز",
        points: { energy: GATEWAY_POINTS, antiaging: 2 },
      },
      {
        value: "antiaging",
        label: "شبابي وحيويتي",
        hint: "تجاعيد، ترهّل، علامات السن",
        points: { antiaging: GATEWAY_POINTS, skin: GATEWAY_NEIGHBOUR },
      },
    ],
  },

  // Q2 — TIMELINE. Reads as interest in her story; scores as the strongest
  // signal for anti-aging in the whole quiz. Something present for years and
  // worsening gradually is a different sale from something that started last
  // month, and only this question can tell them apart.
  {
    key: "timeline",
    title: "منذ متى وأنتِ تلاحظين هذا؟",
    lead: "المدة تغيّر نوع المنتج المناسب لكِ، لا قوّته فقط.",
    options: [
      {
        value: "recent",
        label: "منذ أسابيع قليلة",
        hint: "بدأ حديثاً",
        points: { energy: 2, skin: 1 },
      },
      {
        value: "months",
        label: "منذ عدة أشهر",
        points: { hair: 2, slim: 1, gain: 1 },
      },
      {
        value: "years",
        label: "منذ سنوات، ويزداد تدريجياً",
        points: { antiaging: 3, hair: 1 },
      },
      {
        value: "prevent",
        label: "لا أعاني بعد، أريد الوقاية",
        hint: "أفضّل أن أبدأ مبكراً",
        points: { antiaging: 2, skin: 1, energy: 1 },
      },
    ],
  },

  // Q3 — FORM. Asked as "what will you actually keep doing", not "what do you
  // like": the honest answer to the first is what predicts a second order.
  // It also feeds `scoreProduct`, so the routine built around the anchor is in
  // the shape she said she would use.
  {
    key: "form",
    title: "أي شكل تلتزمين به فعلاً كل يوم؟",
    lead: "لا فائدة من منتج ممتاز لا يناسب روتينكِ.",
    options: [
      {
        value: "caps",
        label: "كبسولات أو حبوب",
        hint: "خطوة واحدة في اليوم",
        points: { slim: 2, gain: 2, energy: 2, antiaging: 1 },
      },
      {
        value: "topical",
        label: "كريم أو سيروم",
        hint: "أحب روتين العناية",
        points: { skin: 3, antiaging: 1 },
      },
      {
        value: "oil",
        label: "زيوت أو صابون",
        hint: "طبيعي وبسيط",
        points: { hair: 2, skin: 2 },
      },
      {
        value: "any",
        // Scores nothing on purpose. "لا يهم" is the one answer that carries no
        // preference, and giving it points would let an opt-out quietly move
        // the result — the tally must only move on things she actually said.
        label: "لا يهم — الأهم النتيجة",
        points: {},
      },
    ],
  },

  // Q4 — SECONDARY CONCERN, framed as a problem. The one question that can
  // hand the result to a category she did not pick, which is the point: the
  // woman who comes for her skin and is exhausted every day is an energy sale
  // with a skin complaint, and the tally is what notices.
  {
    key: "concern",
    title: "بعيداً عن ذلك، ما الذي يزعجكِ أكثر؟",
    lead: "غالباً ما يكون السبب واحداً والنتيجة تظهر في أكثر من مكان.",
    options: [
      { value: "tired", label: "التعب والإرهاق الدائم", points: { energy: 3 } },
      { value: "dull", label: "شحوب البشرة وبهتانها", points: { skin: 3 } },
      { value: "shedding", label: "تساقط الشعر وضعفه", points: { hair: 3 } },
      { value: "thin", label: "النحافة وصعوبة زيادة الوزن", points: { gain: 3 } },
      { value: "belly", label: "الوزن الزائد ودهون البطن", points: { slim: 3 } },
      { value: "lines", label: "التجاعيد وترهّل البشرة", points: { antiaging: 3 } },
    ],
  },

  // Q5 — SECONDARY CONCERN, framed as her day. Same job as Q4 from the other
  // side: Q4 asks what bothers her, this asks what her life looks like, and
  // the two agreeing is what makes an override trustworthy. Last question, so
  // it is also the lightest to answer — she is one tap from the result.
  {
    key: "routine",
    title: "أي وصف يشبه أيامكِ أكثر؟",
    lead: "آخر سؤال — ثم نعرض لكِ النتيجة.",
    options: [
      {
        value: "exhausted",
        label: "يوم طويل ومرهق، أنام متعبة وأستيقظ متعبة",
        points: { energy: 3, slim: 1 },
      },
      {
        value: "irregular",
        label: "أكلي غير منتظم وضغط الحياة يومي",
        points: { slim: 2, energy: 1, gain: 1 },
      },
      {
        value: "beauty",
        label: "أهتم بروتين جمالي وأحافظ عليه",
        points: { skin: 2, antiaging: 2 },
      },
      {
        value: "changed",
        label: "أشعر أن جسمي وبشرتي تغيّرا مع السنوات",
        points: { antiaging: 3, hair: 1 },
      },
      {
        value: "noappetite",
        label: "شهيتي ضعيفة وأنسى أن آكل",
        points: { gain: 3 },
      },
    ],
  },
];

// --------------------------------------------------------------------------
// The tally
// --------------------------------------------------------------------------

export type Scores = Record<Goal, number>;

function emptyScores(): Scores {
  return { skin: 0, hair: 0, slim: 0, gain: 0, energy: 0, antiaging: 0 };
}

/**
 * Add up every answered question's points, per category.
 *
 * Unanswered questions simply contribute nothing, so a partial walk-through
 * still produces a usable ranking — which is what lets the result screen be
 * built at all if she somehow lands on it early.
 */
export function tally(a: Answers): Scores {
  const scores = emptyScores();
  for (const q of QUESTIONS) {
    const value = a[q.key];
    if (!value) continue;
    const opt = q.options.find((o) => o.value === value);
    if (!opt) continue;
    for (const [goal, n] of Object.entries(opt.points)) {
      scores[goal as Goal] += n ?? 0;
    }
  }
  return scores;
}

/**
 * The winning category.
 *
 * TIES GO TO THE GATEWAY. Ranking by score alone would let an arbitrary
 * ordering decide the most important thing on the screen whenever two
 * categories drew — and draws are common, because the point values are small
 * integers. She told us what she came for in question one; unless something
 * else genuinely beat it, that is the answer. Only a tie that does not involve
 * the gateway falls through to `GOALS` order, which is fixed so the same
 * answers always produce the same result.
 */
export function winningGoal(a: Answers): Goal {
  const scores = tally(a);
  const gateway = a.goal;
  let best: Goal = gateway ?? GOALS[0];
  for (const g of GOALS) {
    if (scores[g] > scores[best]) best = g;
    else if (scores[g] === scores[best] && g === gateway) best = g;
  }
  return best;
}

/** The tally as a ranked list, highest first. Exported for the admin funnel
 *  view and for tests; the UI only ever needs the winner. */
export function rankedGoals(a: Answers): { goal: Goal; score: number }[] {
  const scores = tally(a);
  const gateway = a.goal;
  return GOALS.map((goal) => ({ goal, score: scores[goal] })).sort(
    (x, y) =>
      y.score - x.score ||
      Number(y.goal === gateway) - Number(x.goal === gateway) ||
      GOALS.indexOf(x.goal) - GOALS.indexOf(y.goal),
  );
}

// --------------------------------------------------------------------------
// Anchor products
// --------------------------------------------------------------------------

/**
 * One product an anchor is made of.
 *
 * Resolved in three passes — id, then title, then catalog category — because
 * each of the three fails differently. An id is exact but breaks the day the
 * owner re-creates a product (Firestore ids here are creation timestamps, so a
 * re-added product gets a new one). A title pattern survives that but matches
 * nothing if the product is renamed. A category always resolves to *something*
 * relevant, which is what keeps the result screen from ever being empty.
 *
 * The pattern pass is also how a product that is not in the catalog *yet*
 * starts being recommended the moment it is added — see the two gaps noted on
 * `ANCHORS` below.
 */
type AnchorPart = {
  /** Firestore `products` doc ids, best first. Verified against the live
   *  catalog on 2026-09-08. */
  ids: string[];
  /** Title patterns, tried when no id resolves. */
  match: RegExp[];
  /** Never resolve to these ids, whatever they match. */
  exclude?: string[];
  /** Catalog category ids to fall back into, best first. */
  categories: string[];
};

export type AnchorSpec = {
  /** The category name as she reads it on the result screen. */
  label: string;
  /** Small line above the headline. */
  kicker: string;
  /** The result screen's headline. */
  headline: string;
  /** Two supportive sentences shown under it. Stands alone as the result's
   *  explanation — the AI blurb replaces it when it arrives, and often does
   *  not. Never promises a result or a timeline. */
  message: string;
  /** The badge on the recommended product card. */
  tag: string;
  parts: AnchorPart[];
};

/* The live catalog ids these resolve to (2026-09-08):
     1780283875728  كبسولات Glutathione life extension        14 500 د.ج
     1780288528206  Vital Proteins Marine Collagen             14 800 د.ج
     1768873325495  HHS A1 L-Carnitine Lepidium                14 500 د.ج

   TWO ANCHORS HAVE NO PRODUCT IN THE CATALOG YET, and this is deliberately
   not hidden:
     - "Healthy Mass Gainer" (تسمين) does not exist in the `products`
       collection. Until it is added, `gain` resolves into the `fattening`
       category and recommends the strongest available product there.
     - A standalone "L-Carnitine" (طاقة ونشاط) does not exist either. The only
       carnitine in the shop is the HHS slimming capsule, which is the `slim`
       anchor and is excluded here on purpose: sending a woman who asked about
       her energy to a product titled "كبسولات تنحيف الجسم" is a mismatch she
       will read as not being listened to. Until a real L-Carnitine is added,
       `energy` resolves into the vitamin/vitality categories.
   Both start resolving to the real product automatically as soon as it is in
   the catalog — by title pattern, and by id once these lists are updated. */
export const ANCHORS: Record<Goal, AnchorSpec> = {
  skin: {
    label: "بشرة",
    kicker: "نتيجتكِ",
    headline: "بشرتكِ هي الأولوية",
    message:
      "إجاباتكِ تشير إلى أن ما يهمّكِ الآن هو نضارة بشرتكِ وتوحيد لونها، ولهذا اخترنا لكِ الغلوتاثيون: مكمّل يُستعمل بانتظام ضمن روتين بسيط. " +
      "خذي وقتكِ في قراءة التفاصيل، ويمكنكِ تعديل اختياركِ قبل الطلب.",
    tag: "الأنسب لبشرتكِ",
    parts: [
      {
        ids: ["1780283875728", "1780284240894"],
        match: [/glutathion/i, /غلوتاثيون|جلوتاثيون/],
        categories: ["Bibo88", "skin_care"],
      },
    ],
  },
  hair: {
    label: "شعر",
    kicker: "نتيجتكِ",
    headline: "شعركِ يحتاج دعماً من الداخل",
    message:
      "ما وصفتِه يبدأ عادة من داخل الجسم لا من الخارج، ولهذا اخترنا لكِ الكولاجين البحري: يُؤخذ يومياً ويندمج مع روتينكِ دون أن تغيّري شيئاً. " +
      "الشعر يحتاج انتظاماً على أشهر، والالتزام هو ما يصنع الفرق.",
    tag: "الأنسب لشعركِ",
    parts: [
      {
        ids: ["1780288528206", "1780282506022", "1780281878198"],
        match: [/marine\s*koll?agen/i, /كولاجين\s*بحري|الكولاجين البحري/],
        // `hair_care` first: if every collagen in the shop is out of stock, a
        // hair product is a better answer to "شعري" than whatever happens to
        // be the dearest supplement on the shelf.
        categories: ["hair_care", "Bibo88"],
      },
    ],
  },
  gain: {
    label: "تسمين",
    kicker: "نتيجتكِ",
    headline: "هدفكِ زيادة وزن صحية",
    message:
      "إجاباتكِ تشير إلى شهية ضعيفة وصعوبة في اكتساب الوزن، ولهذا اخترنا لكِ مكمّل التسمين الأنسب المتوفر لدينا، يُستعمل إلى جانب وجباتكِ لا بدلاً عنها. " +
      "الزيادة الصحية تدريجية، والانتظام أهم من الكمية.",
    tag: "الأنسب لهدفكِ",
    parts: [
      {
        // "Healthy Mass Gainer" — not in the catalog yet (see note above).
        // The patterns name the real product only. A looser /تسمين/ was tried
        // and is wrong: it matches "فيلر بليس لتسمين الخدود", a cheek cream,
        // and a woman who answered "زيادة وزني" would be sent a face filler.
        // With nothing matching, the category pass picks the strongest
        // in-stock product in `fattening`, which is at least the right kind of
        // product.
        ids: [],
        match: [/mass\s*gainer/i, /ماس\s*جينر|هيلثي\s*ماس/],
        categories: ["fattening"],
      },
    ],
  },
  slim: {
    label: "تنحيف",
    kicker: "نتيجتكِ",
    headline: "هدفكِ إنقاص الوزن",
    message:
      "إجاباتكِ تشير إلى رغبتكِ في التخلص من الوزن الزائد ودهون البطن، ولهذا اخترنا لكِ كبسولات HHS A1 بـ L-Carnitine: تُستعمل مع أكل منظّم وحركة يومية، لا بديلاً عنهما. " +
      "لا نعدكِ برقم ولا بمدة — نعدكِ بمنتج أصلي وبمتابعة عند الطلب.",
    tag: "الأنسب لهدفكِ",
    parts: [
      {
        ids: ["1768873325495"],
        match: [/hhs\s*a1/i, /lepidium/i],
        categories: ["slimming"],
      },
    ],
  },
  energy: {
    label: "طاقة ونشاط",
    kicker: "نتيجتكِ",
    headline: "طاقتكِ هي ما يحتاج العناية",
    message:
      "التعب المستمر هو أكثر ما تكرّر في إجاباتكِ، ولهذا اخترنا لكِ مكمّل الطاقة الأنسب المتوفر لدينا، يُؤخذ يومياً ضمن روتين بسيط. " +
      "المكمّل يدعم نظاماً غذائياً متوازناً ونوماً كافياً، ولا يحلّ محلّهما.",
    tag: "الأنسب لطاقتكِ",
    parts: [
      {
        // A standalone L-Carnitine — not in the catalog yet (see note above).
        // The HHS slimming capsule is excluded even though its title matches.
        ids: [],
        match: [/l[\s-]*carnitin/i, /كارنيتين|كارنتين/],
        exclude: ["1768873325495"],
        categories: ["AMF", "NF", "Fm"],
      },
    ],
  },
  antiaging: {
    label: "عناية ومحاربة الشيخوخة",
    kicker: "نتيجتكِ",
    headline: "روتين يحافظ على شبابكِ",
    message:
      "إجاباتكِ تصف تغيّراً تدريجياً يظهر في البشرة والشعر معاً، ولهذا اخترنا لكِ الكولاجين البحري مع الغلوتاثيون: اثنان يعملان معاً لا بديلين عن بعضهما. " +
      "هذا روتين طويل النفس، يُقيَّم بالأشهر لا بالأيام.",
    tag: "روتينكِ المقترح",
    // Two parts — this anchor IS the bundle the owner sells for this category.
    parts: [
      {
        ids: ["1780288528206", "1780282506022"],
        match: [/marine\s*koll?agen/i, /كولاجين\s*بحري|الكولاجين البحري/],
        categories: ["Bibo88"],
      },
      {
        ids: ["1780283875728", "1780284240894"],
        match: [/glutathion/i, /غلوتاثيون|جلوتاثيون/],
        categories: ["Bibo88"],
      },
    ],
  },
};

/* Goal → catalog categories, for everything that is NOT the anchor: the
   routine built around it and the runners-up. `primary` is what the goal is
   actually about; `related` is what genuinely complements it (a skin routine
   paired with the skin-supplement line, hair loss paired with the vitamins
   that drive it). Ids verified against the live `categories` collection. */
const GOAL_CATEGORIES: Record<Goal, { primary: string[]; related: string[] }> = {
  skin: { primary: ["skin_care", "Bibo88"], related: ["NF", "AMF"] },
  hair: { primary: ["hair_care"], related: ["NF", "AMF", "Bibo88"] },
  slim: { primary: ["slimming"], related: ["Ms", "Fm", "NF"] },
  gain: { primary: ["fattening"], related: ["NF", "AMF", "Ms"] },
  energy: { primary: ["NF", "AMF", "Fm"], related: ["Ms", "Msl", "Venom"] },
  antiaging: { primary: ["Bibo88"], related: ["skin_care", "NF", "AMF"] },
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

function title(p: Product): string {
  return String(p.title ?? p.name ?? "");
}

/**
 * What a product added to the routine should cost — approachable, NOT the
 * cheapest thing on the shelf.
 *
 * This number is set by the unit economics, not by taste. At the real observed
 * acquisition cost (~1,650 DA per order on the Glutathione campaign) and a 35%
 * margin, a single-product order has to clear roughly 6,700 DA at a 70%
 * delivery rate — nearer 9,400 DA at 50% — before it earns anything at all. A
 * 1,700 DA soap returns 595 DA and loses money on every paid click.
 *
 * So ties among equally-matched complements resolve toward this target rather
 * than downward. Sorting ascending instead would hand every tie to the
 * cheapest product in the catalog, which is how a funnel ends up busily
 * selling at a loss. The anchor itself is exempt — its price is whatever the
 * owner's chosen product costs.
 */
const COMPLEMENT_TARGET = 7000;

export type Scored = { product: Product; score: number; why: string[] };

/**
 * Score one product as a *complement* to the winning category. Exported for
 * testing.
 *
 * This no longer picks the recommendation — the anchor does — so it is free to
 * be a blunter instrument than it was: category relevance, the form she said
 * she would use, and availability.
 */
export function scoreProduct(p: Product, a: Answers, goal?: Goal): Scored {
  const why: string[] = [];
  let score = 0;

  const g = goal ?? a.goal;
  const cat = String(p.category ?? "");
  if (g) {
    const { primary, related } = GOAL_CATEGORIES[g];
    if (primary.includes(cat)) {
      score += 100;
      why.push("goal");
    } else if (related.includes(cat)) {
      score += 40;
      why.push("related");
    } else {
      // Off-goal products stay eligible for the routine but must never
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

  score += stockScore(p);

  // Something present for years, or an explicitly preventive visit, is where
  // the collagen/retinol/Q10 end of the catalog belongs.
  if ((a.timeline === "years" || a.timeline === "prevent") &&
      /كولاجين|collagen|ريتينول|retinol|مفاصل|Q10|هيالورونيك|astaxanthin|أستازانتين/i.test(title(p))) {
    score += 15;
    why.push("timeline");
  }

  return { product: p, score, why };
}

// --------------------------------------------------------------------------
// Resolving an anchor against the live catalog
// --------------------------------------------------------------------------

/** Rank candidates for one anchor part and return the best available. */
function resolvePart(products: Product[], part: AnchorPart, taken: Set<string>): Product | null {
  const excluded = new Set(part.exclude ?? []);
  const usable = products.filter(
    (p) => !excluded.has(String(p.id)) && !taken.has(String(p.id)),
  );
  const byId = new Map(usable.map((p) => [String(p.id), p]));

  // Pass 1: the named products, in the order the spec lists them. A sold-out
  // one is skipped rather than shown — an order for something unavailable is a
  // paid click that turns into a cancelled parcel, which damages the
  // confirmation rate the whole profit engine turns on.
  for (const id of part.ids) {
    const p = byId.get(id);
    if (p && !isSoldOut(p)) return p;
  }

  // Pass 2: by title. Sorted so that, among matches, an in-stock product wins
  // and the dearest of those wins after that — this pass is what catches the
  // owner's newly added anchor, and the anchor is meant to be the strongest
  // product of its line, not the cheapest.
  const matched = usable
    .filter((p) => !isSoldOut(p) && part.match.some((re) => re.test(title(p))))
    .sort((x, y) => priceNum(y.price) - priceNum(x.price));
  if (matched[0]) return matched[0];

  // Pass 3: the category it lives in. Ranked by availability first, then
  // price — the anchor is the line's flagship, so the strongest formulation
  // available is the right stand-in, not the cheapest.
  for (const cat of part.categories) {
    const inCat = usable
      .filter((p) => String(p.category ?? "") === cat && !isSoldOut(p))
      .sort((x, y) => priceNum(y.price) - priceNum(x.price));
    if (inCat[0]) return inCat[0];
  }

  // Last resort: a named product even if the catalog says it ran out. Better a
  // real recommendation the owner can substitute on the confirmation call than
  // an empty result screen.
  for (const id of part.ids) {
    const p = byId.get(id);
    if (p) return p;
  }
  return null;
}

/**
 * The product (or products) that a winning category recommends.
 *
 * Returns one product for five of the six categories and two for
 * `antiaging`, which is sold as a pair. Never returns duplicates — a bundle
 * whose two halves resolved to the same product would show the same card
 * twice and charge for it twice.
 */
export function resolveAnchor(products: Product[], goal: Goal): Product[] {
  const taken = new Set<string>();
  const out: Product[] = [];
  for (const part of ANCHORS[goal].parts) {
    const p = resolvePart(products, part, taken);
    if (!p) continue;
    taken.add(String(p.id));
    out.push(p);
  }
  return out;
}

export type Recommendation = {
  /** The winning category — what the result screen is about. */
  goal: Goal;
  /** The full tally, for the funnel record and for debugging a result. */
  scores: Scores;
  /** Its copy. Held here so the UI never has to look a category up itself. */
  anchor: AnchorSpec;
  /** The anchor product(s): one, or two for the anti-aging pair. */
  anchorProducts: Product[];
  /** The first anchor product — what the badge and the pixel event key off. */
  hero: Product | null;
  /** Hero plus complements — what variant B offers as a routine. */
  bundle: Product[];
  /** Ranked runners-up, for "قد يناسبكِ أيضاً". */
  alternates: Product[];
  scored: Scored[];
};

/**
 * Rank the catalog for one set of answers.
 *
 * The anchor is decided by the tally and is always first. Everything after it
 * is the catalog ranked against the same category, taking at most one product
 * per catalog category: three different collagen creams is a worse routine
 * than a cream plus a supplement plus a wash, and it reads as padding rather
 * than advice.
 */
export function recommend(products: Product[], a: Answers, bundleSize = 3): Recommendation {
  const goal = winningGoal(a);
  const scores = tally(a);
  const anchorProducts = resolveAnchor(products, goal);
  const anchorIds = new Set(anchorProducts.map((p) => String(p.id)));

  // Availability is a TIER, not a score adjustment. A big enough stock penalty
  // would drag a sold-out on-goal product below an in-stock off-goal one and
  // recommend something irrelevant; sorting in tiers keeps goal relevance
  // deciding the order *within* what can actually be shipped.
  //
  // The tiebreak resolves toward COMPLEMENT_TARGET — closest to it first —
  // rather than descending. Scores here compress: products sharing a category,
  // form and stock state score identically, so price decides a great many of
  // these comparisons in practice, not just the occasional draw. An
  // unconditional descending sort hands every one of those to the dearest
  // product; an ascending one hands them to the cheapest, which is the shelf
  // that loses money on paid traffic.
  const scored = products
    .map((p) => scoreProduct(p, a, goal))
    .sort(
      (x, y) =>
        Number(isSoldOut(x.product)) - Number(isSoldOut(y.product)) ||
        y.score - x.score ||
        Math.abs(priceNum(x.product.price) - COMPLEMENT_TARGET) -
          Math.abs(priceNum(y.product.price) - COMPLEMENT_TARGET),
    );

  // The anchor leads, always — including in the "single" variant, where the
  // bundle is exactly the anchor and nothing else.
  const bundle: Product[] = [...anchorProducts];
  const usedCategories = new Set(anchorProducts.map((p) => String(p.category ?? "")));

  for (const s of scored) {
    if (bundle.length >= Math.max(bundleSize, anchorProducts.length)) break;
    const id = String(s.product.id);
    if (anchorIds.has(id)) continue;
    const cat = String(s.product.category ?? "");
    if (usedCategories.has(cat)) continue;
    if (isSoldOut(s.product)) continue;
    usedCategories.add(cat);
    bundle.push(s.product);
  }

  const inBundle = new Set(bundle.map((p) => String(p.id)));
  const alternates = scored
    .filter((s) => !inBundle.has(String(s.product.id)) && !isSoldOut(s.product))
    .slice(0, 4)
    .map((s) => s.product);

  return {
    goal,
    scores,
    anchor: ANCHORS[goal],
    anchorProducts,
    hero: anchorProducts[0] ?? bundle[0] ?? null,
    bundle,
    alternates,
    scored,
  };
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
 * better as the anchor alone, or as a routine built around it?
 *
 * That is the real tension in a bundle offer — a routine raises order value
 * but asks for a bigger yes, and in cash-on-delivery a bigger yes also tends
 * to mean a worse confirmation rate. Which way that nets out is exactly the
 * kind of thing this shop should be measuring rather than guessing, and the
 * profit engine can already answer it per variant.
 *
 * Note that `single` does not mean one product for every visitor: the
 * anti-aging category's anchor is itself a pair, because that is the offer the
 * owner sells there. The variant controls the complements, not the anchor.
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

/** The label of one answer, looked up BY KEY.
 *
 *  Never by position: indexing into QUESTIONS by index meant that removing a
 *  question left callers reading past the end of the array and throwing on
 *  `.options` — which took the whole result screen down with it. */
export function answerLabel(key: keyof Answers, value: string | undefined): string | undefined {
  if (!value) return undefined;
  return QUESTIONS.find((q) => q.key === key)?.options.find((o) => o.value === value)?.label;
}

/** Short human-readable summary of the answers, for the order document and
 *  for the AI blurb's prompt. */
export function answersSummary(a: Answers): string {
  return QUESTIONS.map((q) => {
    const label = answerLabel(q.key, a[q.key]);
    return label ? `${q.title} ${label}` : null;
  })
    .filter(Boolean)
    .join(" · ");
}

/** The catalog, cut down to the fields the quiz actually reads.
 *
 *  /quiz hands the whole catalog to the browser so scoring is instant between
 *  questions, and that is still the right trade — but "the whole catalog" was
 *  taken literally: every field of all 149 documents was serialised into the
 *  HTML, `landing` included. That one field carries a product's entire /offer
 *  page (headline, benefits, ingredients, usage, FAQ, reviews, before/after
 *  pairs) and the quiz never touches it; nor does it touch `cost`,
 *  `lastModified`, `images[]`, or anything else the admin panel writes.
 *
 *  Eight fields is the complete list this funnel reads: `category` and `stock`
 *  drive the scoring (recommend/isSoldOut), `title`/`name`/`subtitle` feed
 *  productForm()'s Arabic keyword match and the card labels, `price` the
 *  totals, `image` the card thumbnails, and `id` everything downstream.
 *  /offer is unaffected — the handoff is by id in the URL and that page
 *  fetches the full documents itself.
 *
 *  Keys that are absent stay absent rather than being serialised as
 *  `undefined`, and the return type is still Product: every consumer here
 *  reads through `?? ` fallbacks, so a trimmed document behaves exactly like a
 *  full one that happened to have those fields blank.
 */
export function slimForQuiz(products: Product[]): Product[] {
  return products.map((p) => {
    const slim: Product = { id: p.id };
    if (p.title !== undefined) slim.title = p.title;
    if (p.name !== undefined) slim.name = p.name;
    if (p.subtitle !== undefined) slim.subtitle = p.subtitle;
    if (p.price !== undefined) slim.price = p.price;
    if (p.category !== undefined) slim.category = p.category;
    if (p.image !== undefined) slim.image = p.image;
    if (p.stock !== undefined) slim.stock = p.stock;
    return slim;
  });
}

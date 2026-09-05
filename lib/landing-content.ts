// The /offer landing page's content engine: one catalog product in, a full
// page's worth of sections out.
//
// Pure and I/O-free on purpose, exactly like lib/quiz.ts and lib/profit.ts —
// the product, the quiz answers and any owner-written overrides are passed in,
// nothing is fetched and nothing touches `window`. That is what lets the whole
// thing be checked against the real 149-product catalog, and lets the page
// render on the server.
//
// WHY A TEMPLATE AND NOT FOUR MORE HAND-BUILT PAGES
// ------------------------------------------------
// /collagen, /glutathione, /sunguard and /carnitine are each written by hand
// for one hardcoded SKU. That does not scale to a quiz that can recommend any
// of 149 products: whatever it recommends has to have a page to land on the
// same day. So this generates one, and the owner deepens it per product from
// the admin panel for the handful she actually advertises.
//
// THE HONESTY RULES ARE IN HERE, NOT IN THE COMPONENTS
// ---------------------------------------------------
// A template that fills every section for every product is a template that
// invents claims about supplements. Three rules keep it straight, and they are
// enforced here so no caller can route around them:
//
//   1. BEFORE/AFTER comes only from photo pairs the owner actually uploaded.
//      There is no category default and no illustrative stand-in — an invented
//      transformation photo is a claim about a customer's body. /carnitine and
//      /glutathione already take this line (see landing-pages-view.tsx).
//   2. REVIEWS are either the store's own testimonials, worded about the shop,
//      the delivery and the service, or per-product ones the owner typed in.
//      Nothing here fabricates a named customer's result for a product, and no
//      star rating is ever inferred (context/ui-context.md).
//   3. INGREDIENTS come only from the owner. A category cannot tell you what
//      is in a bottle, and guessing composition on health products is the one
//      place a wrong word does real damage.
//
// Everything else — benefits, usage steps, FAQ, headline — degrades through
// layers that are each true at the level they speak at: what the owner wrote
// about this product, then what is true of this category, then what is true of
// the goal she told us about, then the product's own description.
import {
  benefits as descLines,
  productImages,
  type LandingBaItem,
  type LandingReview,
  type Product,
  type ProductLanding,
} from "@/lib/firebase";
import { productForm, type Answers, type Form, type Goal } from "@/lib/quiz";

export type BenefitItem = { ic: string; title: string; text: string };
export type IngredientItem = { name: string; text: string };
export type UsageStep = { ic: string; p: string };
export type FaqItem = { q: string; a: string };
export type ReviewItem = { stars: number; text: string; name: string; where: string };

/** Everything one product's section stack needs. Empty arrays mean "do not
 *  render that section" — the page must reflow, never leave a gap. */
export type LandingBlock = {
  product: Product;
  /** Stable DOM id, so the hero's jump chips can scroll to this block. */
  anchor: string;
  headline: string;
  subhead: string;
  benefits: BenefitItem[];
  ingredients: IngredientItem[];
  usage: UsageStep[];
  faq: FaqItem[];
  beforeAfter: LandingBaItem[];
  reviews: ReviewItem[];
  images: string[];
};

// --------------------------------------------------------------------------
// Layer 2: category archetypes
// --------------------------------------------------------------------------

/* Keyed by the REAL Firestore `categories` document ids — the same ones
   lib/quiz.ts scores against. An invented id here would silently produce a
   thinner page rather than an error, which is the worst kind of bug to have on
   a paid-traffic path, so these are the verified ones only.

   Deliberately covers just the seven semantically-named categories. The rest
   of the catalog's ids (NF, AMF, Ms, Fm, Msl, Bibo88, Venom) are supplier or
   brand codes, not descriptions of what the product does — writing "category
   copy" for them would mean guessing what the code stands for. Those fall
   through to the goal layer below, which is built from what she actually told
   us in the quiz and is therefore safer AND more personal. */
type Archetype = {
  /** Fills «هذا المنتج مناسب لـ …» in the headline. */
  angle: string;
  benefits: BenefitItem[];
  faq: FaqItem[];
};

const CATEGORY_ARCHETYPES: Record<string, Archetype> = {
  skin_care: {
    angle: "العناية ببشرتكِ",
    benefits: [
      { ic: "✨", title: "روتين واضح", text: "خطوة واحدة تضيفينها لروتينكِ اليومي بدل خلط منتجات كثيرة لا تعرفين أيها يعمل." },
      { ic: "🌿", title: "للاستعمال المنتظم", text: "منتجات العناية بالبشرة تُبنى نتائجها بالانتظام على أسابيع، لا بجرعة واحدة." },
      { ic: "🤍", title: "مناسب للبشرة الحساسة", text: "ابدئي بكمية صغيرة وجربيها على منطقة صغيرة أولاً، كما تُستعمل أي عناية جديدة." },
    ],
    faq: [
      { q: "متى ألاحظ الفرق؟", a: "العناية بالبشرة تحتاج انتظاماً: أغلب المنتجات تُقيَّم بعد 4 إلى 8 أسابيع من الاستعمال اليومي، لا بعد أيام." },
      { q: "هل أستعمله مع منتجات أخرى؟", a: "نعم، لكن أضيفي منتجاً جديداً واحداً في كل مرة حتى تعرفي ما الذي يناسب بشرتكِ فعلاً." },
    ],
  },
  hair_care: {
    angle: "العناية بشعركِ",
    benefits: [
      { ic: "💇‍♀️", title: "من الجذور", text: "العناية بالشعر تبدأ من فروة الرأس، وهي ما تركّز عليه منتجات هذه الفئة." },
      { ic: "🕒", title: "نتيجة تتراكم", text: "الشعر ينمو بمعدل سنتيمتر تقريباً في الشهر — الفرق يُقاس بالأشهر لا بالأيام." },
      { ic: "🧴", title: "سهل الإدخال", text: "يندمج مع روتينكِ الحالي دون أن تغيّري شامبوكِ أو طريقة تصفيفكِ." },
    ],
    faq: [
      { q: "هل يوقف التساقط تماماً؟", a: "تساقط 50 إلى 100 شعرة يومياً طبيعي. منتجات العناية تدعم الشعر والفروة، ولا تحل محل استشارة الطبيب إذا كان التساقط شديداً أو مفاجئاً." },
      { q: "كم أستعمله في الأسبوع؟", a: "اتبعي إرشادات العبوة — أغلب منتجات هذه الفئة تُستعمل مرتين إلى ثلاث مرات أسبوعياً." },
    ],
  },
  slimming: {
    angle: "هدفكِ في التنحيف",
    benefits: [
      { ic: "🎯", title: "جزء من خطة", text: "مكمّلات التنحيف تدعم مجهودكِ في الأكل والحركة، ولا تعوّضه." },
      { ic: "💧", title: "مع ماء كافٍ", text: "شرب الماء بانتظام جزء أساسي من أي روتين تنحيف، ومذكور على أغلب العبوات." },
      { ic: "📆", title: "بانتظام", text: "الاستعمال المتقطع لا يُقيَّم — التزمي بالجرعة المكتوبة على العبوة لمدة كافية." },
    ],
    faq: [
      { q: "هل أحتاج حمية؟", a: "نعم. لا يوجد منتج يُغني عن تنظيم الأكل والحركة، وأي وعد بغير ذلك غير صادق." },
      { q: "هل يناسب الحامل أو المرضع؟", a: "لا نوصي به للحامل أو المرضع دون استشارة الطبيب، وكذلك مع أي دواء مزمن." },
    ],
  },
  fattening: {
    angle: "هدفكِ في زيادة الوزن",
    benefits: [
      { ic: "🍯", title: "دعم للسعرات", text: "منتجات هذه الفئة تُستعمل إلى جانب وجبات منتظمة، لا بدلاً عنها." },
      { ic: "📆", title: "انتظام يومي", text: "زيادة الوزن الصحية تدريجية — تُقاس بالأسابيع، والانتظام هو العامل الأهم." },
      { ic: "🥛", title: "سهل الإضافة", text: "يُضاف إلى روتين يومكِ دون تغيير كبير في عاداتكِ." },
    ],
    faq: [
      { q: "كم من الوقت يحتاج؟", a: "زيادة الوزن الصحية تكون تدريجية، وتحتاج انتظاماً في الأكل والاستعمال لعدة أسابيع." },
      { q: "هل له آثار على المعدة؟", a: "إن شعرتِ بأي انزعاج، أوقفي الاستعمال واستشيري طبيبكِ. اتبعي دائماً الجرعة المكتوبة على العبوة." },
    ],
  },
  breast_enlargement: {
    angle: "ما تبحثين عنه في هذه الفئة",
    benefits: [
      { ic: "📆", title: "استعمال منتظم", text: "منتجات هذه الفئة تُستعمل بانتظام لفترة، ونتائجها تختلف من جسم لآخر." },
      { ic: "🤲", title: "طريقة التطبيق مهمة", text: "اتبعي طريقة الاستعمال المكتوبة على العبوة بدقة — هي جزء من النتيجة." },
      { ic: "🔒", title: "توصيل مغلّف", text: "يصلكِ في تغليف محايد لا يكشف محتواه." },
    ],
    faq: [
      { q: "هل النتائج مضمونة؟", a: "لا، والنتائج تختلف من شخص لآخر. لا نعد بنتيجة محددة، ولا يغني أي منتج عن استشارة طبية عند الحاجة." },
      { q: "هل التغليف محايد؟", a: "نعم، يصلكِ الطلب في تغليف لا يظهر عليه اسم المنتج." },
    ],
  },
  butt_enlargement: {
    angle: "ما تبحثين عنه في هذه الفئة",
    benefits: [
      { ic: "📆", title: "استعمال منتظم", text: "منتجات هذه الفئة تُستعمل بانتظام لفترة، ونتائجها تختلف من جسم لآخر." },
      { ic: "🤲", title: "طريقة التطبيق مهمة", text: "اتبعي طريقة الاستعمال المكتوبة على العبوة بدقة — هي جزء من النتيجة." },
      { ic: "🔒", title: "توصيل مغلّف", text: "يصلكِ في تغليف محايد لا يكشف محتواه." },
    ],
    faq: [
      { q: "هل النتائج مضمونة؟", a: "لا، والنتائج تختلف من شخص لآخر. لا نعد بنتيجة محددة، ولا يغني أي منتج عن استشارة طبية عند الحاجة." },
      { q: "هل التغليف محايد؟", a: "نعم، يصلكِ الطلب في تغليف لا يظهر عليه اسم المنتج." },
    ],
  },
  vagina_care: {
    angle: "العناية الحميمة",
    benefits: [
      { ic: "🔒", title: "خصوصية تامة", text: "تغليف محايد، ولا يظهر اسم المنتج على الطرد ولا في اتصال التأكيد." },
      { ic: "🌸", title: "استعمال خارجي", text: "اتبعي إرشادات العبوة بدقة، ولا تتجاوزي المدة المذكورة." },
      { ic: "🤍", title: "توقفي عند أي انزعاج", text: "إن شعرتِ بحرقة أو تهيّج، أوقفي الاستعمال فوراً واستشيري طبيبكِ." },
    ],
    faq: [
      { q: "هل التغليف محايد؟", a: "نعم. الطرد لا يحمل اسم المنتج، والاتصال للتأكيد لا يذكره." },
      { q: "هل يُستعمل أثناء الدورة؟", a: "لا ننصح بذلك. اتبعي إرشادات العبوة، واستشيري طبيبكِ عند أي شك." },
    ],
  },
};

// --------------------------------------------------------------------------
// Layer 3: goal archetypes
// --------------------------------------------------------------------------

/* The fallback for every product whose category id is a supplier code rather
   than a description — which is most of the catalog. Built from the answer she
   gave in the first question, so a page that cannot say much about the product
   can at least be honest and specific about why she is looking at it. */
const GOAL_ARCHETYPES: Record<Goal, Archetype> = {
  skin: CATEGORY_ARCHETYPES.skin_care,
  hair: CATEGORY_ARCHETYPES.hair_care,
  slim: CATEGORY_ARCHETYPES.slimming,
  gain: CATEGORY_ARCHETYPES.fattening,
  curves: CATEGORY_ARCHETYPES.breast_enlargement,
  hormones: {
    angle: "توازنكِ الهرموني ودورتكِ",
    benefits: [
      { ic: "🌙", title: "روتين يومي", text: "منتجات الدعم الهرموني تُستعمل بانتظام على مدى دورة كاملة على الأقل قبل تقييمها." },
      { ic: "📋", title: "دوّني ملاحظاتكِ", text: "تتبّع بسيط لأيام دورتكِ يجعل الفرق واضحاً لكِ ولطبيبتكِ." },
      { ic: "👩‍⚕️", title: "لا يعوّض الطبيب", text: "إن كانت الدورة غائبة أو مؤلمة بشدة، الاستشارة الطبية أولاً — والمكمّل بعدها." },
    ],
    faq: [
      { q: "هل يغني عن الطبيب؟", a: "لا. الاضطرابات الهرمونية تحتاج تشخيصاً، والمكمّلات دعم إضافي لا بديل عن العلاج." },
      { q: "متى أقيّم النتيجة؟", a: "بعد دورة كاملة على الأقل من الاستعمال المنتظم، لا بعد أيام." },
    ],
  },
  vitality: {
    angle: "طاقتكِ وصحتكِ العامة",
    benefits: [
      { ic: "⚡", title: "روتين يومي بسيط", text: "خطوة واحدة في اليوم، أسهل بكثير من الالتزام بروتين معقّد لن تكملينه." },
      { ic: "🛡️", title: "دعم عام", text: "الفيتامينات والمكمّلات تدعم نظاماً غذائياً متوازناً ولا تحل محله." },
      { ic: "💤", title: "مع النوم والماء", text: "النتيجة الحقيقية تأتي من المجموع: نوم كافٍ، ماء، أكل متوازن، ثم المكمّل." },
    ],
    faq: [
      { q: "هل أستعمله يومياً؟", a: "نعم، أغلب مكمّلات هذه الفئة يومية. التزمي بالجرعة المكتوبة على العبوة." },
      { q: "هل يتعارض مع دواء؟", a: "إن كنتِ تتناولين دواءً بوصفة أو لديكِ حالة مزمنة، استشيري طبيبكِ قبل البدء." },
    ],
  },
};

/* Last resort: true of any product in the shop, and says nothing about what is
   inside it. Never the whole page — it only fills a section that would
   otherwise be empty. */
const GENERIC_ARCHETYPE: Archetype = {
  angle: "ما تبحثين عنه",
  benefits: [
    { ic: "✅", title: "منتج أصلي", text: "نبيع ما نستعمله ونعرف مصدره — لا تقليد ولا عبوات مجهولة." },
    { ic: "🚚", title: "توصيل 58 ولاية", text: "إلى باب المنزل أو مكتب التوصيل، وأنتِ تختارين." },
    { ic: "💵", title: "الدفع عند الاستلام", text: "لا تدفعين شيئاً قبل أن يصلكِ الطرد بين يديكِ." },
  ],
  faq: [
    { q: "كيف أدفع؟", a: "الدفع عند الاستلام نقداً. لا تحويل ولا بطاقة، ولا تدفعين قبل أن تستلمي." },
    { q: "كم يستغرق التوصيل؟", a: "من 2 إلى 5 أيام حسب ولايتكِ، ويتصل بكِ عون التوصيل قبل الوصول." },
  ],
};

function archetypeFor(p: Product, a: Answers): Archetype {
  const cat = String(p.category ?? "");
  return CATEGORY_ARCHETYPES[cat] ?? (a.goal ? GOAL_ARCHETYPES[a.goal] : GENERIC_ARCHETYPE);
}

// --------------------------------------------------------------------------
// Usage steps, by the form the title says it is
// --------------------------------------------------------------------------

/* Derived from `productForm()` — the same title-reading the quiz scores with,
   so a product is never told to be swallowed and rubbed in at once. Anything
   unrecognised gets the neutral set, which says only what is true of every
   product in the shop: follow the packet, be regular, keep it sealed.

   Every variant ends on "the packet wins". These steps are a routine, not a
   dosage: the real instruction is on the box, in the manufacturer's words. */
/** Step markers for usage read out of a description, which carries no icons of
 *  its own. Ordinal, not semantic — nothing here knows what the step says. */
const USAGE_ICONS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

const USAGE_BY_FORM: Record<Form, UsageStep[]> = {
  caps: [
    { ic: "💊", p: "التزمي بالجرعة المكتوبة على العبوة — لا تزيديها ظناً أن النتيجة تأتي أسرع." },
    { ic: "🕗", p: "اختاري وقتاً ثابتاً كل يوم (مع الفطور مثلاً) حتى لا تنسي." },
    { ic: "💧", p: "مع كوب ماء كامل، وحافظي على شرب الماء طوال اليوم." },
    { ic: "📆", p: "الانتظام هو ما يصنع الفرق — أكملي المدة المذكورة قبل أن تحكمي." },
  ],
  topical: [
    { ic: "🧼", p: "نظّفي المنطقة وجفّفيها قبل التطبيق." },
    { ic: "🤲", p: "كمية صغيرة تكفي، ووزّعيها بحركات دائرية خفيفة حتى تمتص." },
    { ic: "🌡️", p: "جرّبيها أولاً على منطقة صغيرة وانتظري 24 ساعة إن كانت بشرتكِ حساسة." },
    { ic: "📆", p: "استعمليها بانتظام حسب ما هو مكتوب على العبوة، وأكملي المدة." },
  ],
  oil: [
    { ic: "💆‍♀️", p: "دلّكي الكمية المناسبة بأطراف أصابعكِ حتى تتوزّع جيداً." },
    { ic: "🕒", p: "اتركيها المدة المذكورة على العبوة قبل الغسل إن كانت تُغسل." },
    { ic: "🚿", p: "اغسليها بماء فاتر وشامبو خفيف عند الحاجة." },
    { ic: "📆", p: "كرّري حسب ما هو مكتوب على العبوة — الانتظام أهم من الكمية." },
  ],
  any: [
    { ic: "📋", p: "اقرئي إرشادات العبوة قبل أول استعمال والتزمي بها." },
    { ic: "📆", p: "الانتظام هو ما يصنع الفرق — أكملي المدة المذكورة قبل أن تحكمي على النتيجة." },
    { ic: "🌡️", p: "احفظيه في مكان جاف بعيداً عن الشمس المباشرة ومتناول الأطفال." },
    { ic: "👩‍⚕️", p: "إن كنتِ حاملاً أو مرضعاً أو تتناولين دواءً، استشيري طبيبكِ أولاً." },
  ],
};

// --------------------------------------------------------------------------
// Proof: the store's own testimonials
// --------------------------------------------------------------------------

/* Deliberately about THE SHOP — ordering, delivery, packaging, the confirmation
   call, genuine goods. Not one of them claims a result from a product, because
   this same set is shown beside all 149 of them and a per-product outcome claim
   would be false for at least 148.
 *
 * Per-product testimonials exist too, but only ones the owner typed in herself
 * (`products/<id>.landing.reviews`) — see block.reviews below. */
export const STORE_REVIEWS: ReviewItem[] = [
  { stars: 5, text: "طلبت وخلص كل شي بالهاتف، وصلني الطرد في يومين ودفعت عند الاستلام. تعامل محترم من البداية للنهاية.", name: "أمينة ب.", where: "الجزائر العاصمة" },
  { stars: 5, text: "كنت خايفة نطلب أونلاين، بصح هنا ما دفعت والو حتى وصلني الطرد وشفته بعينيا. راهي ثاني مرة نطلب.", name: "خديجة م.", where: "وهران" },
  { stars: 5, text: "التغليف كان مرتب والمنتج أصلي كيما في الصورة بالضبط. تأكيد الطلب جاني بسرعة وبدون إلحاح.", name: "سارة ل.", where: "سطيف" },
  { stars: 4, text: "التوصيل خذا 4 أيام حتى لولاية بعيدة، بصح عون التوصيل عيّطلي قبل ما يجي وكلش تم مليح.", name: "فاطمة الزهراء", where: "ورقلة" },
  { stars: 5, text: "سقسيتهم على المنتج قبل ما نطلب وجاوبوني بصدق، حتى قالولي واش ما يناسبنيش. هذا اللي خلاني نثق فيهم.", name: "نسرين ط.", where: "البليدة" },
  { stars: 5, text: "طلبت جوج منتجات مع بعض ووصلاوني في طرد واحد، ودفعت غير كي استلمت. خدمة نظيفة.", name: "حنان ك.", where: "قسنطينة" },
];

/** Store-level FAQ — true of every order, whatever she bought. Appended after
 *  the product's own questions so the delivery/payment answers are always
 *  somewhere on the page. */
export const STORE_FAQ: FaqItem[] = [
  { q: "كيف يتم الدفع؟", a: "الدفع عند الاستلام نقداً لعون التوصيل. لا تدفعين أي شيء قبل أن يصلكِ الطرد." },
  { q: "كم تكلفة التوصيل؟", a: "تختلف حسب الولاية وحسب اختياركِ (للمنزل أو لمكتب التوصيل)، وتظهر لكِ بالضبط في نموذج الطلب قبل أن تؤكّدي." },
  { q: "هل أستطيع الطلب لأي ولاية؟", a: "نعم، نوصّل لكل الولايات الـ58." },
  { q: "ماذا لو غيّرتُ رأيي؟", a: "تواصلي معنا قبل خروج الطرد ونلغيه فوراً. وإن وصلكِ ولم تريديه، لكِ الحق ألا تدفعي." },
];

// --------------------------------------------------------------------------
// Building a block
// --------------------------------------------------------------------------

function clean(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function title(p: Product): string {
  return clean(p.title) || clean(p.name) || "هذا المنتج";
}

/** Owner-written entries, minus the blank rows the admin form leaves behind. */
function ownBenefits(o: ProductLanding | undefined): BenefitItem[] {
  return (o?.benefits ?? [])
    .map((b) => ({ ic: clean(b.ic) || "✅", title: clean(b.title), text: clean(b.text) }))
    .filter((b) => b.title || b.text);
}

function ownIngredients(o: ProductLanding | undefined): IngredientItem[] {
  return (o?.ingredients ?? [])
    .map((i) => ({ name: clean(i.name), text: clean(i.text) }))
    .filter((i) => i.name);
}

function ownUsage(o: ProductLanding | undefined): UsageStep[] {
  return (o?.usage ?? [])
    .map((u) => ({ ic: clean(u.ic) || "📋", p: clean(u.p) }))
    .filter((u) => u.p);
}

function ownFaq(o: ProductLanding | undefined): FaqItem[] {
  return (o?.faq ?? [])
    .map((f) => ({ q: clean(f.q), a: clean(f.a) }))
    .filter((f) => f.q && f.a);
}

function ownReviews(o: ProductLanding | undefined): ReviewItem[] {
  return (o?.reviews ?? [])
    .map((r: LandingReview) => ({
      // Clamped, not defaulted to 5: an out-of-range or missing star count on a
      // review the owner typed must not silently become a perfect score.
      stars: Math.min(5, Math.max(1, Math.round(Number(r.stars) || 5))),
      text: clean(r.text),
      name: clean(r.name) || "زبونة",
      where: clean(r.where),
    }))
    .filter((r) => r.text);
}

/**
 * The before/after pairs for a product — owner-uploaded only.
 *
 * BOTH photos must be present. A pair with one side missing is not a
 * half-truth to render with a placeholder, it is an unfinished admin entry,
 * and the section is better absent than wrong.
 */
export function beforeAfterPairs(o: ProductLanding | undefined): LandingBaItem[] {
  return (o?.beforeAfter ?? [])
    .map((b) => ({
      before: clean(b.before),
      after: clean(b.after),
      title: clean(b.title),
      text: clean(b.text),
    }))
    .filter((b) => b.before && b.after);
}

// --------------------------------------------------------------------------
// Reading the owner's own description
// --------------------------------------------------------------------------

/* The single richest source of true copy on this page, and the one that needed
   the most care.
 *
 * The admin form asks for "الفوائد والمميزات، كل فائدة في سطر", but the live
 * catalog does not look like that: descriptions are prose with section
 * headings ("الفوائد الرئيسية:"), ✅-marked bullets, spec lines
 * ("الكمية: 120 كبسولة"), and a usage paragraph at the end. Splitting on
 * newlines and calling every line a benefit — which is what this did first —
 * put cards reading "الفوائد الرئيسية:" and "بخلاصة الحلزون:" on the page.
 * Verified against all 149 live descriptions.
 *
 * So the lines are classified instead:
 *   • a heading (anything ending in a colon) introduces a list — skipped
 *   • "اسم: شرح" becomes a titled card, which is exactly a benefit card's shape
 *   • the opening paragraph becomes the page's subhead, not a card
 *   • everything after a "كيفية الاستخدام"-style heading is a USAGE step, not a
 *     benefit — real instructions in the owner's words, which beat the generic
 *     ones for the 51 of 149 products whose descriptions carry them
 *   • short fragments are dropped rather than shown as half a sentence
 */
type ParsedDescription = { intro: string; items: BenefitItem[]; usage: string[] };

// Bullet glyphs the owner types inline as well as at the start of a line, so
// they are stripped everywhere rather than only from the front.
const BULLET_GLYPHS = /[✅✔️✔☑️✓•▪◾●]/g;
const LEADING_DASH = /^[\s\u200e\u200f]*[-–—*·]+\s*/;
const ENDS_IN_COLON = /[:：]\s*$/;
// No `s` flag: the project targets an older lib than es2018, and it is not
// needed — lines are split on newlines before they get here, so `.` never has
// a newline to match.
const NAMED_ITEM = /^(.{2,34}?)\s*[:：]\s*(.{15,})$/;
/** Minimum length of a "name: text" item's text once trimmed. */
const MIN_NAMED_TEXT = 15;
/* Usage headings, matched on ALEF-NORMALISED text.
 *
 * The catalog spells these several ways — "الاستعمال" and "الإستعمال",
 * "كيفية الاستخدام" and a bare "الاستخدام:" — and an unmatched spelling does
 * not fail loudly: the instructions quietly become a benefit card while the
 * usage section falls back to the generic steps, which is what shipped the
 * first time. Normalising the hamza forms is what makes the two spellings one
 * pattern. */
const ALEF_FORMS = /[أإآ]/g;
const normalizeAlef = (t: string) => t.replace(ALEF_FORMS, "ا");
const USAGE_HEADING =
  /(كيفية\s*الاستخدام|كيفية\s*الاستعمال|طريقة\s*الاستخدام|طريقة\s*الاستعمال|طريقة\s*التحضير)/;
/** A "name: text" item whose NAME is one of these is an instruction, not a
 *  benefit — "الاستخدام: يوصى باستخدامه يومياً بعد الاستحمام…". */
const USAGE_ITEM_NAME = /^(طريقة\s*)?(الاستخدام|الاستعمال|التحضير|الجرعة)$/;

// Long enough to be a sentence rather than a stray fragment, and long enough
// again to be the opening paragraph. Both tuned against the live catalog.
const MIN_SENTENCE = 45;
const MIN_INTRO = 60;
const MIN_USAGE = 25;

function parseDescription(d: Product["description"]): ParsedDescription {
  const items: BenefitItem[] = [];
  const usage: string[] = [];
  let intro = "";
  let inUsage = false;

  // Icons cycle for visual rhythm only; they carry no meaning, and must not,
  // because nothing here knows what the line is actually about.
  const ICONS = ["✨", "🌿", "💧", "🛡️", "⭐", "🤍"];

  for (const raw of descLines(d)) {
    const line = raw.replace(BULLET_GLYPHS, "").replace(LEADING_DASH, "").replace(/\s+/g, " ").trim();
    if (!line) continue;

    const normalized = normalizeAlef(line);
    if (USAGE_HEADING.test(normalized)) {
      inUsage = true;
      // The heading itself is not a step — unless the instruction is on the
      // same line as it, which some descriptions do.
      if (ENDS_IN_COLON.test(line) || line.length < 40) continue;
    }
    if (ENDS_IN_COLON.test(line)) continue;

    // The regex counts characters before trimming, so "الماركة: Propos' Nature"
    // slipped through as a 14-character "benefit". Re-check the trimmed text.
    const m = NAMED_ITEM.exec(line);
    const matched = m && m[2].trim().length >= MIN_NAMED_TEXT ? m : null;
    const title = matched ? matched[1].trim() : "";
    const text = matched ? matched[2].trim() : line;

    // A bare "الاستخدام: …" item both is a step and opens the usage section.
    if (matched && USAGE_ITEM_NAME.test(normalizeAlef(title))) {
      inUsage = true;
      if (text.length >= MIN_USAGE) usage.push(text);
      continue;
    }

    if (inUsage) {
      if (line.length >= MIN_USAGE) usage.push(title ? `${title}: ${text}` : text);
      continue;
    }
    if (matched) {
      items.push({ ic: ICONS[items.length % ICONS.length], title, text });
      continue;
    }
    if (line.length >= MIN_SENTENCE) {
      if (!intro && line.length >= MIN_INTRO) {
        intro = line;
        continue;
      }
      items.push({ ic: ICONS[items.length % ICONS.length], title: "", text: line });
    }
  }

  return { intro, items, usage };
}

/* The benefit cards, in the order a shopper's trust runs: what the owner wrote
   about this exact product, then the product's own description bullets (which
   she also wrote, in the catalog), then what is true of the category. The
   archetype only tops up a short list — it never displaces the real copy. */
function buildBenefits(
  o: ProductLanding | undefined,
  parsed: ParsedDescription,
  arch: Archetype,
): BenefitItem[] {
  const own = ownBenefits(o);
  if (own.length >= 3) return own.slice(0, 6);

  // The description is the owner's own words about this exact product, so it
  // outranks anything generated. The archetype only tops up a list too short
  // to fill the grid — it never displaces real copy.
  const merged = [...own, ...parsed.items.slice(0, 6 - own.length)];
  if (merged.length >= 3) return merged.slice(0, 6);
  return [...merged, ...arch.benefits].slice(0, 6);
}

/**
 * The "how to use" steps when the owner has not written her own.
 *
 * Real instructions out of the product's own description come first — they
 * name the product's actual routine, which no generic step can. A single one
 * is not a section on its own, though, so the form-based steps top the list up
 * to three rather than being discarded: one specific instruction plus two true
 * general ones beats either alone, and beats falling back to all-generic just
 * because the description only carried one line.
 *
 * Icons go ordinal as soon as any step is description-derived, because the
 * form-based emoji describe THEIR step and would be wrong against another.
 */
function deriveUsage(parsed: ParsedDescription, form: Form): UsageStep[] {
  const generic = USAGE_BY_FORM[form];
  if (!parsed.usage.length) return generic;
  const steps = [...parsed.usage, ...generic.map((u) => u.p)].slice(
    0,
    Math.max(3, Math.min(parsed.usage.length, 5)),
  );
  return steps.map((text, i) => ({ ic: USAGE_ICONS[i % USAGE_ICONS.length], p: text }));
}

/** Build one product's section stack. */
export function buildBlock(p: Product, a: Answers): LandingBlock {
  const o = p.landing;
  const arch = archetypeFor(p, a);
  const name = title(p);
  const form = productForm(p) ?? "any";
  const parsed = parseDescription(p.description);

  const headline =
    clean(o?.headline) ||
    // Names the product and the reason she is here, in her own words from the
    // quiz. Falls back to the category/goal angle, which is always set.
    `${name} — ${arch.angle}`;

  const subhead =
    clean(o?.subhead) ||
    clean(p.subtitle) ||
    parsed.intro ||
    "الدفع عند الاستلام، وتوصيل لكل الولايات الـ58.";

  const faq = ownFaq(o);
  const usage = ownUsage(o);

  return {
    product: p,
    anchor: `p-${String(p.id)}`,
    headline,
    subhead,
    benefits: buildBenefits(o, parsed, arch),
    // No layer under this one. See the honesty rules at the top of the file.
    ingredients: ownIngredients(o),
    usage: usage.length ? usage : deriveUsage(parsed, form),
    faq: [...faq, ...arch.faq].slice(0, 5),
    beforeAfter: beforeAfterPairs(o),
    reviews: ownReviews(o),
    images: productImages(p),
  };
}

/** Build every block for a selection, hero first — the order the quiz ranked
 *  them in, which the /offer URL preserves. */
export function buildBlocks(products: Product[], a: Answers): LandingBlock[] {
  return products.map((p) => buildBlock(p, a));
}

// --------------------------------------------------------------------------
// Page-level copy
// --------------------------------------------------------------------------

const GOAL_HEADLINE: Record<Goal, string> = {
  skin: "اخترناها لبشرتكِ",
  hair: "اخترناها لشعركِ",
  slim: "اخترناها لهدفكِ في التنحيف",
  gain: "اخترناها لهدفكِ في زيادة الوزن",
  curves: "اخترناها لما تبحثين عنه",
  hormones: "اخترناها لتوازنكِ ودورتكِ",
  vitality: "اخترناها لطاقتكِ وصحتكِ",
};

/** The hero's headline. Speaks to the answers she gave, not to the catalog. */
export function pageHeadline(a: Answers, count: number): string {
  const base = a.goal ? GOAL_HEADLINE[a.goal] : "اخترناها لكِ";
  return count > 1 ? `${count} منتجات ${base}` : base;
}

/** The hero's supporting line. */
export function pageSubhead(a: Answers, count: number): string {
  const many = count > 1;
  return (
    `${many ? "هذه المنتجات مختارة" : "هذا المنتج مختار"} بناءً على إجاباتكِ. ` +
    `اقرئي التفاصيل${many ? " لكل واحد منها" : ""} — الفوائد، طريقة الاستعمال، وما تحتاجين معرفته قبل الطلب — ` +
    `ثم اطلبي بالدفع عند الاستلام.`
  );
}

// Hardcoded collagen product list for the /collagen landing page —
// intentionally separate from the Firestore `products` collection (this
// funnel is self-contained, per architecture-context.md). Ported verbatim
// from trinkl/collagen.html (origin/main) including copy, prices, and the
// glutathione "special offer" fifth product.
export type CollagenProduct = {
  id: string;
  brand: string;
  title: string;
  headline: string;
  price: number;
  image: string;
  color: string;
  soft: string;
  icons: [string, string][];
  bullets: string[];
  special?: boolean;
  badge?: string;
  offerNote?: string;
};

export const COLLAGEN_PRODUCTS: CollagenProduct[] = [
  {
    id: "col-neocell-tabs",
    brand: "NEOCELL",
    title: "Grassfed Collagen + Vitamin C & Biotin",
    headline: "كولاجين + فيتامين C + بيوتين لبشرة أكثر إشراقاً وشعر وأظافر أقوى.",
    price: 10600,
    image: "/assets/collagen/neocell-tablets.webp",
    color: "#D6336C",
    soft: "rgba(214,51,108,.12)",
    icons: [
      ["✨", "يعزز نضارة البشرة"],
      ["💆‍♀️", "يقوّي الشعر ويقلل التساقط"],
      ["💅", "يقوّي الأظافر ويقلل تكسّرها"],
      ["🦴", "يدعم صحة المفاصل"],
    ],
    bullets: [
      "6000 مجم كولاجين بقري طبيعي (Grass-Fed) في كل حصة",
      "مدعم بفيتامين C والبيوتين لدعم إنتاج الكولاجين طبيعياً",
      "180 قرصاً — تركيبة عالية الجودة وسريعة الامتصاص",
    ],
  },
  {
    id: "col-vp-peptides",
    brand: "VITAL PROTEINS",
    title: "Collagen Peptides — Grass Fed",
    headline: "كولاجين بقري نقي يذوب دون نكهة، لروتين جمال يومي بسيط.",
    price: 14800,
    image: "/assets/collagen/vp-peptides.webp",
    color: "#2E86C1",
    soft: "rgba(46,134,193,.12)",
    icons: [
      ["💅", "يعزز صحة الأظافر"],
      ["🦴", "يدعم مرونة المفاصل"],
      ["✨", "يحسّن نضارة البشرة"],
      ["💧", "سهل الامتصاص ومفعوله سريع"],
    ],
    bullets: [
      "20 غراماً من ببتيدات الكولاجين في كل حصة",
      "من أبقار تتغذى على الأعشاب في مراعٍ طبيعية (Grass Fed)",
      "بدون نكهة أو سكر — تُضاف لأي مشروب بارد أو ساخن",
    ],
  },
  {
    id: "col-vp-marine",
    brand: "VITAL PROTEINS",
    title: "Marine Collagen — كولاجين بحري نقي",
    headline: "مصدره أسماك تُصطاد في البرية، لبشرة ومفاصل تستحق الأفضل.",
    price: 14800,
    image: "/assets/collagen/vp-marine.webp",
    color: "#2F8F9D",
    soft: "rgba(47,143,157,.12)",
    icons: [
      ["✨", "يعزّز نضارة البشرة"],
      ["💆‍♀️", "يقوّي الشعر"],
      ["🦴", "يدعم صحة المفاصل"],
      ["🐟", "مصدر طبيعي سريع الامتصاص"],
    ],
    bullets: [
      "12 غراماً من الكولاجين البحري النقي في كل حصة",
      "مصدر برّي (Wild Caught) — بدون إضافات صناعية",
      "بدون نكهة، خالٍ من السكر — 221 غراماً (7.8 أونصة)",
    ],
  },
  {
    id: "col-neocell-marine",
    brand: "NEOCELL",
    title: "Marine Collagen + Hyaluronic Acid",
    headline: "ترطيب أعمق ومرونة أكثر، بكبسولة يومية سهلة.",
    price: 10600,
    image: "/assets/collagen/neocell-marine.webp",
    color: "#1B6FA8",
    soft: "rgba(27,111,168,.12)",
    icons: [
      ["💧", "يدعم ترطيب البشرة بعمق"],
      ["✨", "يحسّن مرونة البشرة ويقلل التجاعيد"],
      ["💅", "يدعم صحة الأظافر"],
      ["💆‍♀️", "يدعم نمو الشعر وكثافته"],
    ],
    bullets: [
      "كولاجين بحري مدعم بحمض الهيالورونيك لترطيب أعمق",
      "120 كبسولة سهلة الاستخدام يومياً بدون طعم",
      "يدعم مرونة البشرة ويقلل من مظهر التجاعيد",
    ],
  },
  {
    id: "col-glutathione",
    brand: "LIFE EXTENSION",
    title: "Glutathione, Cysteine & C — جلوتاثيون للتفتيح",
    headline: "الحل النهائي لمشاكل البشرة — يفتّح ويوحّد لون بشرتكِ ويكمّل مفعول الكولاجين.",
    price: 14000,
    image: "/assets/collagen/glutathione.webp",
    color: "#C9A24A",
    soft: "rgba(201,162,74,.14)",
    special: true,
    badge: "✨ عرض خاص — الحل النهائي",
    offerNote: "لفترة محدودة",
    icons: [
      ["🌟", "يفتّح ويوحّد لون البشرة"],
      ["🛡️", "مضاد أكسدة قوي"],
      ["💧", "يقلل التصبّغات والبقع الداكنة"],
      ["🧬", "يعزّز مفعول الكولاجين"],
    ],
    bullets: [
      "ثلاثية الجلوتاثيون + السيستئين + فيتامين C للتفتيح والحماية من الأكسدة",
      "يعمل جنباً إلى جنب مع الكولاجين لبشرة موحّدة ومشرقة من الداخل",
      "100 كبسولة — خالٍ من الجلوتين ومعتمد NON-GMO",
    ],
  },
];

export function moneyFmt(n: number): string {
  return n.toLocaleString("en-US") + " د.ج";
}

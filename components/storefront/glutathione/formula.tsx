import { RevealRoot } from "@/components/storefront/reveal-root";
import type { GLUTATHIONE_PRODUCT } from "./product";
import styles from "./glutathione.module.css";

// Ingredient-science section — two possible renders:
// 1. Default (no admin image set): a real-markup "orbit" diagram (crisp,
//    always-correct text — see progress-tracker.md, 2026-07-26, for why
//    an earlier AI-generated version of this was replaced).
// 2. Admin-set `formulaImage`: the image becomes the entire section
//    (owner's choice, 2026-07-26) — used only when the supplied image is
//    itself a complete, legible, accurate graphic; loses independent
//    text-editability for this section in exchange for that visual.
//    2026-08-06: owner asked to swap this section's image with the hero's
//    — `formulaImage` (set via /amelhadj → صفحات الهبوط) should point at
//    the bottle+soap combo photo, `public/assets/glutathione/
//    hero-shot.webp`, now that the "قوة الجلوتاثيون" infographic moved to
//    hero.tsx's own default. No code default photo lives here (this
//    section still falls back to the orbit diagram, not a static photo,
//    when `formulaImage` is unset) — setting `formulaImage` is a content
//    edit in the admin panel, not a code change.
//    2026-08-06, follow-up: owner asked for a further, structural swap on
//    /glutathione itself — this section's whole visual (diagram or
//    formulaImage) now renders inside the hero instead of its own
//    section, and the hero's old floating card moved to a standalone
//    section in its place. See hero.tsx / formula-visual.tsx /
//    product-spot-section.tsx and glutathione-page.tsx's new section
//    order. This component (the full section, with heading) is
//    untouched and still powers /glutathione-3d's own Formula section —
//    TRIO/OrbitRing are exported below purely so formula-visual.tsx can
//    reuse them instead of duplicating the ingredient copy.
export const TRIO = [
  {
    ic: "🧬",
    h: "جلوتاثيون",
    p: "يحمي الخلايا من الإجهاد التأكسدي وينشّط إزالة السموم في الكبد.",
    pos: styles.glOrbitTop,
  },
  {
    ic: "🧪",
    h: "سيستئين",
    p: "يحفّز إنتاج الجلوتاثيون الطبيعي ويحافظ على فعاليته.",
    pos: styles.glOrbitLeft,
  },
  {
    ic: "🍊",
    h: "فيتامين C",
    p: "يعزّز كفاءة الجلوتاثيون ويشارك في تكوين الكولاجين.",
    pos: styles.glOrbitRight,
  },
];

export function OrbitRing() {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={styles.glOrbitRing}>
      <defs>
        <linearGradient id="glRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--gl-gold)" />
          <stop offset="100%" stopColor="var(--gl-mid)" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="88" stroke="url(#glRingGrad)" strokeWidth="5" opacity="0.55" />
      <circle cx="100" cy="12" r="6" fill="var(--gl-gold)" />
      <circle cx="20" cy="150" r="5" fill="var(--gl-mid)" />
      <circle cx="180" cy="150" r="5" fill="var(--gl-mid)" />
    </svg>
  );
}

export function Formula({
  product,
  image,
}: {
  product: typeof GLUTATHIONE_PRODUCT;
  image?: string;
}) {
  const fullImage = image?.trim();

  if (fullImage) {
    return (
      <RevealRoot>
        <section className={`${styles.glFormula} ${styles.glFormulaImageWrap} reveal`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fullImage} alt="تركيبة ثلاثية الجمال" className={styles.glFormulaFullImage} />
        </section>
      </RevealRoot>
    );
  }

  return (
    <RevealRoot>
      <section className={`${styles.glSec} ${styles.glFormula} reveal`}>
        <div className={styles.glFormHead}>
          <span className={styles.glLabel}>العلم وراء التركيبة</span>
          <h2 className={styles.glTitle}>تركيبة ثلاثية الجمال</h2>
          <div className={styles.glUnderline} />
        </div>
        <div className={styles.glOrbit}>
          <OrbitRing />
          <div className={styles.glOrbitBottle}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.image} alt={product.title} />
          </div>
          {TRIO.map((t) => (
            <div className={`${styles.glOrbitNode} ${t.pos}`} key={t.h}>
              <div className={styles.glOrbitIcon}>{t.ic}</div>
              <h3>{t.h}</h3>
              <p>{t.p}</p>
            </div>
          ))}
        </div>
      </section>
    </RevealRoot>
  );
}

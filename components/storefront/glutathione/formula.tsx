import { RevealRoot } from "@/components/storefront/reveal-root";
import type { GLUTATHIONE_PRODUCT } from "./product";
import { ProductSpot } from "./product-spot";
import styles from "./glutathione.module.css";

// Ingredient-science section — two possible renders:
// 1. Default (no admin image set): a real-markup "orbit" diagram (crisp,
//    always-correct text — see progress-tracker.md, 2026-07-26, for why
//    an earlier AI-generated version of this was replaced).
// 2. Admin-set `formulaImage`: the hero's floating product card is shown
//    here instead (owner asked, 2026-08-06, for the hero's floating card
//    and this section's big picture to swap places — see hero.tsx, which
//    now renders `formulaImage` in the floating card's old spot).
const TRIO = [
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

function OrbitRing() {
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
        <section className={`${styles.glSec} ${styles.glFormula} reveal`}>
          <ProductSpot product={product} className={styles.glFormulaSpot} />
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

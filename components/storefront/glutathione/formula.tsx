import { RevealRoot } from "@/components/storefront/reveal-root";
import type { GLUTATHIONE_PRODUCT } from "./product";
import styles from "./glutathione.module.css";

// Ingredient-science split section — copy sourced from the real Firestore
// product description (products/1780283875728). Replaces an earlier
// 3-card grid version with a two-column layout (product photo + molecule
// decoration / ingredient list) matching the owner's reference mockup.
const TRIO = [
  {
    ic: "🧬",
    h: "جلوتاثيون",
    p: "يساعد على حماية الخلايا من الإجهاد التأكسدي، وينشّط عمليات إزالة السموم الطبيعية في الكبد، ويدعم صحة البشرة.",
  },
  {
    ic: "🧪",
    h: "سيستئين",
    p: "يدعم الجسم في إنتاج الجلوتاثيون الطبيعي، فيعزز فعاليته ويحافظ عليه للحفاظ على نضارة البشرة.",
  },
  {
    ic: "🍊",
    h: "فيتامين C",
    p: "يشارك في تكوين الكولاجين ويعزّز كفاءة الجلوتاثيون، ويساعد على الحفاظ على بشرة صحية ومشرقة.",
  },
];

export function Formula({
  product,
  image,
}: {
  product: typeof GLUTATHIONE_PRODUCT;
  image?: string;
}) {
  const visual = image?.trim() || product.image;
  return (
    <RevealRoot>
      <section className={`${styles.glSec} ${styles.glFormula} reveal`}>
        <div className={styles.glFormHead}>
          <span className={styles.glLabel}>العلم وراء التركيبة</span>
          <h2 className={styles.glTitle}>تركيبة ثلاثية الجمال</h2>
          <div className={styles.glUnderline} />
        </div>
        <div className={styles.glFormInner}>
          <div className={styles.glFormVisual}>
            <span className={styles.glMolecule} style={{ width: 90, height: 90, top: "6%", insetInlineStart: "8%" }} />
            <span className={styles.glMolecule} style={{ width: 50, height: 50, top: "62%", insetInlineStart: "4%" }} />
            <span className={styles.glMolecule} style={{ width: 60, height: 60, top: "14%", insetInlineEnd: "6%" }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={visual} alt={product.title} />
          </div>
          <div className={styles.glFormList}>
            {TRIO.map((t) => (
              <div className={styles.glFormRow} key={t.h}>
                <span className={styles.glFormIc}>{t.ic}</span>
                <div>
                  <h3>{t.h}</h3>
                  <p>{t.p}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </RevealRoot>
  );
}

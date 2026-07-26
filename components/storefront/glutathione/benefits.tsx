import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./glutathione.module.css";

const ITEMS = [
  { ic: "✨", t: "تساعد على بشرة أكثر إشراقاً ونضارة" },
  { ic: "🛡️", t: "دعم قوي لمضادات الأكسدة" },
  { ic: "💧", t: "تدعم إنتاج الكولاجين" },
  { ic: "🌿", t: "تساعد على حماية البشرة من الإجهاد التأكسدي" },
  { ic: "💪", t: "تدعم صحة الجهاز المناعي" },
  { ic: "☀️", t: "تركيبة يومية للعناية بالجمال والصحة" },
];

export function Benefits() {
  return (
    <RevealRoot>
      <section className={`${styles.glSec} reveal`}>
        <div className={styles.glSecHead}>
          <span className={styles.glLabel}>فوائد المنتج</span>
          <h2 className={styles.glTitle}>فوائد رائعة لبشرة وصحة أفضل</h2>
          <div className={styles.glUnderline} />
        </div>
        <div className={styles.glBenefits}>
          {ITEMS.map((it, i) => (
            <div className={styles.glBenefit} key={i}>
              <div className={styles.bic}>{it.ic}</div>
              <p>{it.t}</p>
            </div>
          ))}
        </div>
      </section>
    </RevealRoot>
  );
}

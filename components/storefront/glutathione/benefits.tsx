import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./glutathione.module.css";

const ITEMS = [
  { ic: "🌟", h: "يفتّح ويوحّد لون البشرة", p: "يقلل التصبغات والبقع الداكنة الناتجة عن زيادة الميلانين." },
  { ic: "🛡️", h: "دعم وظائف الكبد", p: "ينشّط عمليات إزالة السموم الطبيعية ويحمي الكبد من الإجهاد الخلوي." },
  { ic: "💪", h: "تعزيز الجهاز المناعي", p: "يحمي الخلايا المناعية من الأكسدة ويدعم كفاءتها في مقاومة الأمراض." },
  { ic: "🧬", h: "يحفّز إنتاج الكولاجين", p: "فيتامين C يعزز إنتاج الكولاجين الطبيعي لبشرة أكثر مرونة ونضارة." },
];

export function Benefits() {
  return (
    <RevealRoot>
      <section className={`${styles.glSec} reveal`}>
        <div className={styles.glSecHead}>
          <span className={styles.glLabel}>فوائد المنتج</span>
          <h2 className={styles.glTitle}>لماذا هذه التركيبة؟</h2>
          <div className={styles.glUnderline} />
          <p className={styles.glSub}>
            ثلاثية الجلوتاثيون والسيستئين وفيتامين C تجمع بين التفتيح والحماية الداخلية في مكمّل واحد.
          </p>
        </div>
        <div className={styles.glBenefits}>
          {ITEMS.map((it) => (
            <div className={styles.glBenefit} key={it.h}>
              <div className={styles.bic}>{it.ic}</div>
              <h3>{it.h}</h3>
              <p>{it.p}</p>
            </div>
          ))}
        </div>
      </section>
    </RevealRoot>
  );
}

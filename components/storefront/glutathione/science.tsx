import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./glutathione.module.css";

// Ingredient-science breakdown — the differentiator for this product page
// in place of a before/after slider (no before/after photography exists
// for a supplement, unlike the sunguard/collagen topical products; see
// progress-tracker.md). Copy sourced from the real Firestore product
// description (products/1780283875728).
const TRIO = [
  {
    ic: "💎",
    tag: "المكوّن الرئيسي",
    h: "الجلوتاثيون (المُختزل)",
    p: "مضاد الأكسدة الرئيسي الذي ينتجه الجسم طبيعياً، يساعد على تنقية خلايا الكبد والجسم من السموم وتفتيح لون البشرة.",
  },
  {
    ic: "🧪",
    tag: "المحفّز الطبيعي",
    h: "L-سيستين",
    p: "حمض أميني كبريتي أساسي يحفّز خلايا الجسم على إنتاج الجلوتاثيون طبيعياً، فيعزز فعاليته بمرور الوقت.",
  },
  {
    ic: "🍊",
    tag: "المُعزِّز والحامي",
    h: "فيتامين C (حمض الأسكوربيك)",
    p: "يعزّز كفاءة الجلوتاثيون ويحافظ عليه في شكله النشط، إلى جانب تحفيز إنتاج الكولاجين ودعم المناعة.",
  },
];

export function Science() {
  return (
    <RevealRoot>
      <section className={`${styles.glSec} reveal`}>
        <div className={styles.glSecHead}>
          <span className={styles.glLabel}>العلم وراء التركيبة</span>
          <h2 className={styles.glTitle}>الثلاثية العلمية داخل كل كبسولة</h2>
          <div className={styles.glUnderline} />
          <p className={styles.glSub}>
            ثلاثة مكوّنات تعمل بشكل متكامل — كل مكوّن يعزّز فعالية الآخر — لدعم الصحة العامة وحماية الخلايا.
          </p>
        </div>
        <div className={styles.glSciGrid}>
          {TRIO.map((t) => (
            <div className={styles.glSciCard} key={t.h}>
              <div className={styles.sciIc}>{t.ic}</div>
              <span className={styles.sciTag}>{t.tag}</span>
              <h3>{t.h}</h3>
              <p>{t.p}</p>
            </div>
          ))}
        </div>
      </section>
    </RevealRoot>
  );
}

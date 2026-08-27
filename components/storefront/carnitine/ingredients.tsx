import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./carnitine.module.css";

// Grounded in the real Firestore product description (products/1768873325495)
// — two named active ingredients, no invented third component.
const INGREDIENTS = [
  {
    ic: "🌿",
    h: "إل-كارنيتين (L-Carnitine)",
    p: "حمض أميني طبيعي يساعد الجسم على استخدام الدهون كمصدر للطاقة، ويدعم مستويات النشاط والحيوية اليومية.",
  },
  {
    ic: "🌱",
    h: "عشبة الليبيديوم (Lepidium)",
    p: "عشبة تركية تقليدية يشير استخدامها إلى المساعدة على الشعور بالامتلاء، مما يدعم جهود ضبط الشهية.",
  },
];

export function Ingredients() {
  return (
    <RevealRoot>
      <section className={`${styles.cnSec} reveal`}>
        <div className={styles.cnSecHead}>
          <span className={styles.cnLabel}>التركيبة</span>
          <h2 className={styles.cnTitle}>مكونات طبيعية، بدون تعقيد</h2>
          <div className={styles.cnUnderline} />
          <p className={styles.cnSub}>
            كل كبسولة HHS A1 مصنوعة من مكونين طبيعيين فقط — بلا حشو غير ضروري.
          </p>
        </div>
        <div className={styles.cnIngGrid}>
          {INGREDIENTS.map((it) => (
            <div className={styles.cnIng} key={it.h}>
              <div className={styles.cnIngIc}>{it.ic}</div>
              <h3>{it.h}</h3>
              <p>{it.p}</p>
            </div>
          ))}
        </div>
      </section>
    </RevealRoot>
  );
}

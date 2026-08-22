import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./carnitine.module.css";

// Deliberately no invented dosage schedule (e.g. "capsule per day") — the
// real Firestore product description only states the box contains 30
// capsules, so usage steps stay generic and point to the label/packaging
// rather than inventing a specific regimen not in the source data.
const STEPS = [
  { n: 1, h: "اطلبيه الآن", p: "اضغطي على زر الطلب واملئي بياناتكِ." },
  { n: 2, h: "استخدميه حسب الإرشادات", p: "كل علبة تحتوي 30 كبسولة — اتبعي طريقة الاستخدام الموضحة على العلبة." },
  { n: 3, h: "نتصل بكِ لتأكيد الطلب", p: "نتواصل معكِ خلال وقت قصير لتأكيد الطلب وترتيب التوصيل." },
];

export function UsageSection() {
  return (
    <RevealRoot>
      <section className={`${styles.cnSec} reveal`}>
        <div className={styles.cnSecHead}>
          <span className={styles.cnLabel}>بسيط وسريع</span>
          <h2 className={styles.cnTitle}>كيف تطلبين وتستخدمين المنتج؟</h2>
          <div className={styles.cnUnderline} />
        </div>
        <div className={styles.cnSteps}>
          {STEPS.map((s) => (
            <div className={styles.cnStep} key={s.n}>
              <div className={styles.cnStepNum}>{s.n}</div>
              <h3>{s.h}</h3>
              <p>{s.p}</p>
            </div>
          ))}
        </div>
      </section>
    </RevealRoot>
  );
}

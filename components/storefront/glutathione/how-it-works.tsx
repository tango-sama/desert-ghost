import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./glutathione.module.css";

const STEPS = [
  { n: 1, h: "اطلبيه الآن", p: "اضغطي على زر الطلب واملئي بياناتكِ." },
  { n: 2, h: "أدخلي بياناتكِ", p: "اسمكِ ورقم هاتفكِ وولايتكِ فقط — لا حاجة لأي معلومات إضافية." },
  { n: 3, h: "نتصل بكِ لتأكيد الطلب", p: "نتواصل معكِ خلال وقت قصير لتأكيد الطلب وترتيب التوصيل." },
];

export function HowItWorks() {
  return (
    <RevealRoot>
      <section className={`${styles.glSec} reveal`}>
        <div className={styles.glSecHead}>
          <span className={styles.glLabel}>بسيط وسريع</span>
          <h2 className={styles.glTitle}>كيف تطلبين؟</h2>
          <div className={styles.glUnderline} />
        </div>
        <div className={styles.glSteps}>
          {STEPS.map((s) => (
            <div className={styles.glStep} key={s.n}>
              <div className={styles.sn}>{s.n}</div>
              <h3>{s.h}</h3>
              <p>{s.p}</p>
            </div>
          ))}
        </div>
      </section>
    </RevealRoot>
  );
}

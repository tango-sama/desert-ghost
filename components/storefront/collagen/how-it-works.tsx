import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./collagen.module.css";

const STEPS = [
  { n: 1, h: "اختاري منتجكِ", p: "تصفّحي المنتجات الأربعة واختاري ما يناسب احتياجكِ." },
  { n: 2, h: "أدخلي بياناتكِ", p: "اسمكِ ورقم هاتفكِ فقط — لا حاجة لأي معلومات إضافية الآن." },
  { n: 3, h: "نتصل بكِ لتأكيد الطلب", p: "نتواصل معكِ خلال وقت قصير لتأكيد الطلب وترتيب التوصيل." },
];

export function HowItWorks() {
  return (
    <RevealRoot>
      <section className={`${styles.clSec} reveal`}>
        <div className={styles.clSecHead}>
          <span className={styles.clLabel}>بسيط وسريع</span>
          <h2 className={styles.clTitle}>كيف تطلبين؟</h2>
          <div className={styles.clUnderline} />
        </div>
        <div className={styles.clSteps}>
          {STEPS.map((s) => (
            <div className={styles.clStep} key={s.n}>
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

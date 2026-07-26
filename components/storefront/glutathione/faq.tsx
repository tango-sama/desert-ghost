import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./glutathione.module.css";

const FAQS = [
  { q: "هل المنتج أصلي؟", a: "نعم، المنتج أصلي 100% من شركة Life Extension الأمريكية." },
  { q: "ما محتوى العبوة؟", a: "تحتوي العبوة على 100 كبسولة." },
  { q: "هل هدية صابون حليب الأرز حقيقية؟", a: "نعم، تحصلين عليها مجاناً مع كل طلب لفترة محدودة." },
  { q: "هل التوصيل متوفر في جميع الولايات؟", a: "نعم، نوصل لجميع الولايات عبر Yalidine و Noest." },
];

export function Faq() {
  return (
    <RevealRoot>
      <section className={`${styles.glSec} reveal`}>
        <div className={styles.glSecHead}>
          <span className={styles.glLabel}>الأسئلة الأكثر شيوعاً</span>
          <h2 className={styles.glTitle}>عندكِ سؤال؟</h2>
          <div className={styles.glUnderline} />
        </div>
        <div className={styles.glFaqGrid}>
          {FAQS.map((f) => (
            <div className={styles.glFaqCard} key={f.q}>
              <div className={styles.glFaqQ}>
                <span className={styles.qic}>؟</span>
                {f.q}
              </div>
              <p>{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </RevealRoot>
  );
}

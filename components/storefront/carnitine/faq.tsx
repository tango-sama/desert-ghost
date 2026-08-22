import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./carnitine.module.css";

const FAQS = [
  { q: "هل المنتج أصلي؟", a: "نعم، المنتج أصلي 100% — مكمل عشبي تركي HHS A1 L-Carnitine Lepidium." },
  { q: "ما محتوى العلبة؟", a: "تحتوي كل علبة على 30 كبسولة." },
  { q: "هل يوجد آثار جانبية؟", a: "المكونات طبيعية عشبية؛ كما هو الحال مع أي مكمل غذائي، استشيري طبيبكِ قبل الاستخدام إن كنتِ حاملاً أو مرضعة أو تتناولين أدوية أخرى." },
  { q: "هل التوصيل متوفر في جميع الولايات؟", a: "نعم، نوصل لجميع الولايات عبر Yalidine و Noest، مع الدفع عند الاستلام." },
];

export function Faq() {
  return (
    <RevealRoot>
      <section className={`${styles.cnSec} reveal`}>
        <div className={styles.cnSecHead}>
          <span className={styles.cnLabel}>الأسئلة الأكثر شيوعاً</span>
          <h2 className={styles.cnTitle}>عندكِ سؤال؟</h2>
          <div className={styles.cnUnderline} />
        </div>
        <div className={styles.cnFaqGrid}>
          {FAQS.map((f) => (
            <div className={styles.cnFaqCard} key={f.q}>
              <div className={styles.cnFaqQ}>
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

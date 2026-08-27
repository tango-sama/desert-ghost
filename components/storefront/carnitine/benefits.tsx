import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./carnitine.module.css";

const ITEMS = [
  { ic: "⚖️", h: "دعم فقدان الوزن", p: "تركيبة مصممة للمساعدة في دعم جهود فقدان الوزن وتحسين عملية التمثيل الغذائي." },
  { ic: "⚡", h: "زيادة الطاقة", p: "قد تساعد المكونات على تعزيز مستويات الطاقة والنشاط في الجسم." },
  { ic: "🥗", h: "الشعور بالامتلاء", p: "يساعد على سد الشهية ويمنح شعوراً بالامتلاء بين الوجبات." },
  { ic: "🇹🇷", h: "تركيبة عشبية تركية", p: "مكونات طبيعية 100% — إل-كارنيتين وعشبة الليبيديوم، بلا إضافات غير ضرورية." },
];

export function Benefits() {
  return (
    <RevealRoot>
      <section className={`${styles.cnSec} reveal`}>
        <div className={styles.cnSecHead}>
          <span className={styles.cnLabel}>فوائد المنتج</span>
          <h2 className={styles.cnTitle}>لماذا هذه الكبسولات؟</h2>
          <div className={styles.cnUnderline} />
          <p className={styles.cnSub}>
            تركيبة طبيعية تجمع بين دعم فقدان الوزن، تعزيز الطاقة، والمساعدة على ضبط الشهية.
          </p>
        </div>
        <div className={styles.cnBenefits}>
          {ITEMS.map((it) => (
            <div className={styles.cnBenefit} key={it.h}>
              <div className={styles.cnBic}>{it.ic}</div>
              <h3>{it.h}</h3>
              <p>{it.p}</p>
            </div>
          ))}
        </div>
      </section>
    </RevealRoot>
  );
}

import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./carnitine.module.css";

const PROBLEMS = [
  {
    ic: "🍽️",
    h: "شهية مفتوحة ورغبة دائمة في الأكل",
    p: "الشعور المستمر بالجوع يصعّب الالتزام بأي نظام غذائي، حتى مع أفضل النوايا.",
    fix: "الليبيديوم يساعد على الشعور بالامتلاء، مما يدعم التحكم في كمية الطعام المتناولة.",
  },
  {
    ic: "🔋",
    h: "طاقة منخفضة طوال اليوم",
    p: "الإرهاق المستمر يقلّل الرغبة في الحركة والنشاط، وهما أساس أي خسارة وزن حقيقية.",
    fix: "إل-كارنيتين يساعد على تعزيز مستويات الطاقة في الجسم بشكل طبيعي.",
  },
  {
    ic: "🐢",
    h: "تمثيل غذائي بطيء",
    p: "مع التقدم في العمر أو قلة الحركة، يصبح حرق الدهون أبطأ ويصعب فقدان الوزن.",
    fix: "المكونات الطبيعية مصممة لدعم وتحسين عملية التمثيل الغذائي.",
  },
];

export function Problems() {
  return (
    <RevealRoot>
      <section className={`${styles.cnSec} ${styles.cnProbDark} reveal`}>
        <div className={styles.cnSecHead}>
          <span className={styles.cnLabel}>عقبات إنقاص الوزن</span>
          <h2 className={styles.cnTitle}>هل تعانين من إحدى هذه المشاكل؟</h2>
          <div className={styles.cnUnderline} />
          <p>أغلب محاولات إنقاص الوزن تتعثر بسبب نفس الأسباب — لا نقص الإرادة.</p>
        </div>
        <div className={styles.cnProbGrid}>
          {PROBLEMS.map((pr) => (
            <div className={styles.cnProb} key={pr.h}>
              <div className={styles.cnProbIc}>{pr.ic}</div>
              <h4>{pr.h}</h4>
              <p>{pr.p}</p>
              <div className={styles.cnProbFix}>
                <b>✓</b>
                {pr.fix}
              </div>
            </div>
          ))}
        </div>
      </section>
    </RevealRoot>
  );
}

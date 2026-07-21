import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./collagen.module.css";

const ITEMS = [
  { ic: "✨", h: "نضارة البشرة", p: "يدعم مرونة البشرة ويقلل من ظهور التجاعيد والخطوط الدقيقة." },
  { ic: "💆‍♀️", h: "شعر أقوى", p: "يقوّي جذور الشعر ويقلل التساقط ويمنحه كثافة ولمعاناً أكثر." },
  { ic: "💅", h: "أظافر صحية", p: "يعزز نمو الأظافر ويجعلها أقوى وأقل عرضة للتكسر." },
  { ic: "🦴", h: "مفاصل مرنة", p: "يساعد على الحفاظ على صحة الغضاريف ومرونة الحركة اليومية." },
];

export function Benefits() {
  return (
    <RevealRoot>
      <section className={`${styles.clSec} reveal`}>
        <div className={styles.clSecHead}>
          <span className={styles.clLabel}>فوائد الكولاجين</span>
          <h2 className={styles.clTitle}>تركيبة واحدة، جمال شامل</h2>
          <div className={styles.clUnderline} />
          <p className={styles.clSub}>
            الكولاجين هو البروتين الأساسي الذي يمنح بشرتكِ، شعركِ، أظافركِ، ومفاصلكِ قوتها ومرونتها الطبيعية.
          </p>
        </div>
        <div className={styles.clBenefits}>
          {ITEMS.map((it) => (
            <div className={styles.clBenefit} key={it.h}>
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

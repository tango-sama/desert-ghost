import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./sunguard.module.css";

const ITEMS = [
  { ic: "🛡️", h: "حماية SPF50+ PA++++", p: "يحجب أشعة UVB وUVA معاً بحماية فيزيائية وكيميائية مزدوجة." },
  { ic: "💧", h: "خفيف وغير دهني", p: "ملمس مائي سريع الامتصاص يحمي بشرتكِ دون طبقة دهنية ثقيلة." },
  { ic: "🍉", h: "خلاصة البطيخ والبرتقال", p: "مكوّنات طبيعية تمنح بشرتكِ ترطيباً ونضارة أثناء الحماية." },
  { ic: "🌸", h: "يناسب كل أنواع البشرة", p: "تركيبة متوازنة صُممت لتناسب البشرة الحساسة والعادية معاً." },
];

export function Benefits() {
  return (
    <RevealRoot>
      <section className={`${styles.sgSec} reveal`}>
        <div className={styles.sgSecHead}>
          <span className={styles.sgLabel}>فوائد المنتج</span>
          <h2 className={styles.sgTitle}>لماذا واقي الشمس هذا؟</h2>
          <div className={styles.sgUnderline} />
          <p className={styles.sgSub}>
            تركيبة 3D Aura تجمع بين الحماية القصوى من الشمس والعناية اليومية بترطيب البشرة ونضارتها.
          </p>
        </div>
        <div className={styles.sgBenefits}>
          {ITEMS.map((it) => (
            <div className={styles.sgBenefit} key={it.h}>
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

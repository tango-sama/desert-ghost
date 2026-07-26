import { RevealRoot } from "@/components/storefront/reveal-root";
import type { GLUTATHIONE_PRODUCT } from "./product";
import styles from "./glutathione.module.css";

// The "best choice" highlight block from the owner's ad-style reference —
// a gradient panel pairing a bold claim with the product photo and a
// small rosette callout. No fabricated before/after skin photo here (see
// science.tsx note); the rosette states an honest, gradual-results claim
// instead of an instant one.
export function Highlight({ product }: { product: typeof GLUTATHIONE_PRODUCT }) {
  return (
    <RevealRoot>
      <section className={`${styles.glSec} ${styles.glHighlight} reveal`}>
        <div className={styles.glHiInner}>
          <div>
            <div className={styles.glHiKicker}>مع جلوتاثيون Life Extension</div>
            <h2>ثلاثية علمية تعمل من الداخل على بشرة موحّدة اللون</h2>
            <p>
              تركيبة مدروسة تجمع بين تفتيح البشرة وحمايتها، بينما تدعم كبدكِ ومناعتكِ في آنٍ واحد —
              نتيجة تراكمية تظهر مع الاستخدام المنتظم، لا بمستحضرات سطحية فقط.
            </p>
            <div className={styles.glHiBadgeRow}>
              <span className={styles.glHiChoice}>خيارك</span>
              <span className={styles.glHiBest}>✨ الخيار الأمثل</span>
            </div>
            <div className={styles.glHiBig}>
              لبشرة مشرقة
              <br />
              وموحّدة اللون
            </div>
          </div>
          <div className={styles.glHiVisual}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.image} alt={product.title} />
            <div className={styles.glHiRosette}>
              <span className={styles.ric}>🧬</span>
              <span>نتائج تراكمية مع الاستخدام المنتظم</span>
            </div>
          </div>
        </div>
      </section>
    </RevealRoot>
  );
}

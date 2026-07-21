import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./collagen.module.css";

export function CtaBanner({ onOrder }: { onOrder: () => void }) {
  return (
    <RevealRoot>
      <div className={`${styles.clCta} reveal`}>
        <h2>استثمري في نفسكِ اليوم</h2>
        <p>جمال يبدأ من الداخل ويستمر — الدفع عند الاستلام، وتوصيل لكل الولايات.</p>
        <button type="button" className={styles.btnGold} onClick={onOrder}>
          🛒 اطلبي الآن
        </button>
      </div>
    </RevealRoot>
  );
}

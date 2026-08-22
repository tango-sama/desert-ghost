import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./carnitine.module.css";

export function CtaBanner({ onOrder }: { onOrder: () => void }) {
  return (
    <RevealRoot>
      <div className={`${styles.cnCta} reveal`}>
        <h2>ابدئي رحلتكِ نحو جسم أخف اليوم</h2>
        <p>مكونات طبيعية عشبية تركية — الدفع عند الاستلام، وتوصيل لكل الولايات.</p>
        <button type="button" className={styles.cnBtn} onClick={onOrder}>
          🛒 اطلبيه الآن
        </button>
      </div>
    </RevealRoot>
  );
}

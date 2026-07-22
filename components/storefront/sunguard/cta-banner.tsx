import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./sunguard.module.css";

export function CtaBanner({ onOrder }: { onOrder: () => void }) {
  return (
    <RevealRoot>
      <div className={`${styles.sgCta} reveal`}>
        <h2>احمي بشرتكِ من اليوم</h2>
        <p>حماية فيزيائية وكيميائية SPF50+ PA++++ — الدفع عند الاستلام، وتوصيل لكل الولايات.</p>
        <button type="button" className={styles.sgBtn} onClick={onOrder}>
          🛒 اطلبيه الآن
        </button>
      </div>
    </RevealRoot>
  );
}

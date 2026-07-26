import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./glutathione.module.css";

export function CtaBanner({ onOrder }: { onOrder: () => void }) {
  return (
    <RevealRoot>
      <div className={`${styles.glCta} reveal`}>
        <h2>استعيدي إشراق بشرتكِ من الداخل</h2>
        <p>ثلاثية الجلوتاثيون والسيستئين وفيتامين C — الدفع عند الاستلام، وتوصيل لكل الولايات.</p>
        <button type="button" className={styles.glBtn} onClick={onOrder}>
          🛒 اطلبيه الآن
        </button>
      </div>
    </RevealRoot>
  );
}

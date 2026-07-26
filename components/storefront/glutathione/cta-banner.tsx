import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./glutathione.module.css";

export function CtaBanner({ onOrder }: { onOrder: () => void }) {
  return (
    <RevealRoot>
      <div className={`${styles.glCta} reveal`}>
        <h2>ابدئي إشراقتكِ اليوم</h2>
        <p>Glutathione, Cysteine &amp; Vitamin C — بالإضافة إلى هدية مجانية مع كل طلب.</p>
        <div className={styles.glCtaChecks}>
          <span>✅ توصيل سريع</span>
          <span>✅ الدفع عند الاستلام</span>
          <span>✅ منتج أصلي 100%</span>
        </div>
        <button type="button" className={styles.glBtn} onClick={onOrder}>
          🛒 اطلبيه الآن
        </button>
      </div>
    </RevealRoot>
  );
}

"use client";

import { RevealRoot } from "@/components/storefront/reveal-root";
import { SUNGUARD_PRODUCT, moneyFmt } from "./product";
import styles from "./sunguard.module.css";

export function ProductSection({ onOrder }: { onOrder: () => void }) {
  return (
    <RevealRoot>
      <section className={`${styles.sgSec} ${styles.sgProductWrap} reveal`} id="product">
        <div className={styles.sgProduct}>
          <div className={styles.sgProdVisual}>
            <img
              src="/assets/sunguard/product-shot.webp"
              alt={`${SUNGUARD_PRODUCT.brand} ${SUNGUARD_PRODUCT.title}`}
              loading="lazy"
              className={styles.sgProdPhoto}
            />
          </div>
          <div>
            <div className={styles.sgProdBrand}>{SUNGUARD_PRODUCT.brand}</div>
            <h3>{SUNGUARD_PRODUCT.title}</h3>
            <span className={styles.sgProdSize}>{SUNGUARD_PRODUCT.size}</span>
            <ul className={styles.sgProdBullets}>
              <li>
                <b>✓</b>
                حماية SPF50+ PA++++ فيزيائية وكيميائية من أشعة الشمس
              </li>
              <li>
                <b>✓</b>
                خلاصة البطيخ والبرتقال لترطيب ونضارة البشرة
              </li>
              <li>
                <b>✓</b>
                ملمس خفيف غير دهني، يمتص بسرعة دون طبقة لزجة
              </li>
              <li>
                <b>✓</b>
                مناسب للاستخدام اليومي تحت المكياج
              </li>
            </ul>
            <div className={styles.sgProdFoot}>
              <span className={styles.sgPrice}>{moneyFmt(SUNGUARD_PRODUCT.price)}</span>
              <button type="button" className={styles.sgBtn} onClick={onOrder}>
                🛒 اطلبيه الآن
              </button>
            </div>
            <div className={styles.sgProdMini}>
              <span>💵 الدفع عند الاستلام</span>
              <span>🚚 توصيل لكل الولايات</span>
            </div>
          </div>
        </div>
      </section>
    </RevealRoot>
  );
}

"use client";

import { RevealRoot } from "@/components/storefront/reveal-root";
import type { CARNITINE_PRODUCT } from "./product";
import { moneyFmt } from "./product";
import styles from "./carnitine.module.css";

export function ProductSection({
  onOrder,
  product,
}: {
  onOrder: () => void;
  product: typeof CARNITINE_PRODUCT;
}) {
  return (
    <RevealRoot>
      <section className={`${styles.cnSec} ${styles.cnProductWrap} reveal`} id="product">
        <div className={styles.cnProduct}>
          <div className={styles.cnProdVisual}>
            <img
              src={product.image}
              alt={`${product.brand} ${product.title}`}
              loading="lazy"
              className={styles.cnProdPhoto}
            />
          </div>
          <div>
            <div className={styles.cnProdBrand}>{product.brand}</div>
            <h3>{product.title}</h3>
            <span className={styles.cnProdSize}>{product.size}</span>
            <ul className={styles.cnProdBullets}>
              <li>
                <b>✓</b>
                يساعد على دعم فقدان الوزن وتحسين عملية التمثيل الغذائي
              </li>
              <li>
                <b>✓</b>
                مكونات طبيعية عشبية تركية — إل-كارنيتين وعشبة الليبيديوم
              </li>
              <li>
                <b>✓</b>
                يساعد على تعزيز مستويات الطاقة والشعور بالامتلاء
              </li>
              <li>
                <b>✓</b>
                علبة تحتوي 30 كبسولة
              </li>
            </ul>
            <div className={styles.cnProdFoot}>
              <span className={styles.cnPrice}>{moneyFmt(product.price)}</span>
              <button type="button" className={styles.cnBtn} onClick={onOrder}>
                🛒 اطلبيه الآن
              </button>
            </div>
            <div className={styles.cnProdMini}>
              <span>💵 الدفع عند الاستلام</span>
              <span>🚚 توصيل لكل الولايات</span>
            </div>
          </div>
        </div>
      </section>
    </RevealRoot>
  );
}

"use client";

import { RevealRoot } from "@/components/storefront/reveal-root";
import type { GLUTATHIONE_PRODUCT } from "./product";
import { moneyFmt } from "./product";
import styles from "./glutathione.module.css";

export function ProductSection({
  onOrder,
  product,
}: {
  onOrder: () => void;
  product: typeof GLUTATHIONE_PRODUCT;
}) {
  return (
    <RevealRoot>
      <section className={`${styles.glSec} ${styles.glProductWrap} reveal`} id="product">
        <div className={styles.glProduct}>
          <div className={styles.glProdVisual}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image}
              alt={`${product.brand} ${product.title}`}
              loading="lazy"
              className={styles.glProdPhoto}
            />
          </div>
          <div>
            <div className={styles.glProdBrand}>{product.brand}</div>
            <h3>{product.title}</h3>
            <span className={styles.glProdSize}>{product.size}</span>
            <ul className={styles.glProdBullets}>
              <li>
                <b>✓</b>
                ثلاثية الجلوتاثيون + السيستئين + فيتامين C لتفتيح البشرة وحماية الكبد
              </li>
              <li>
                <b>✓</b>
                يعزز إنتاج الكولاجين طبيعياً ويدعم الجهاز المناعي
              </li>
              <li>
                <b>✓</b>
                تؤخذ كبسولة إلى كبسولتين يومياً على معدة فارغة مع كوب فيتامين C
              </li>
              <li>
                <b>✓</b>
                خالٍ من الجلوتين ومعتمد NON-GMO
              </li>
            </ul>
            <div className={styles.glProdFoot}>
              <span className={styles.glPrice}>{moneyFmt(product.price)}</span>
              <button type="button" className={styles.glBtn} onClick={onOrder}>
                🛒 اطلبيه الآن
              </button>
            </div>
            <div className={styles.glProdMini}>
              <span>💵 الدفع عند الاستلام</span>
              <span>🚚 توصيل لكل الولايات</span>
            </div>
          </div>
        </div>
      </section>
    </RevealRoot>
  );
}

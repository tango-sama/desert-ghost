"use client";

import { RevealRoot } from "@/components/storefront/reveal-root";
import { SUNGUARD_PRODUCT, moneyFmt } from "./product";
import styles from "./sunguard.module.css";

function TubeIcon() {
  return (
    <svg width="140" height="180" viewBox="0 0 140 180" fill="none">
      <defs>
        <linearGradient id="sgTubeBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF6FC0" />
          <stop offset="100%" stopColor="var(--sg-mid, #C81E63)" />
        </linearGradient>
      </defs>
      <rect x="20" y="0" width="100" height="26" rx="10" fill="#F4A6C9" />
      <path d="M28 24 h84 l-8 130 a8 8 0 0 1 -8 8 H44 a8 8 0 0 1 -8 -8 Z" fill="url(#sgTubeBody)" />
      <rect x="34" y="70" width="72" height="48" rx="8" fill="rgba(255,255,255,.92)" />
      <text x="70" y="90" textAnchor="middle" fontSize="13" fontWeight="900" fill="#5C1235">
        SPF
      </text>
      <text x="70" y="110" textAnchor="middle" fontSize="15" fontWeight="900" fill="#5C1235">
        50+
      </text>
      <circle cx="70" cy="150" r="12" fill="#E8483A" opacity="0.9" />
      <path d="M70 143 a7 9 0 0 1 0 14 a7 9 0 0 1 0 -14 Z" fill="#F6D9DE" opacity="0.9" />
    </svg>
  );
}

export function ProductSection({ onOrder }: { onOrder: () => void }) {
  return (
    <RevealRoot>
      <section className={`${styles.sgSec} ${styles.sgProductWrap} reveal`} id="product">
        <div className={styles.sgProduct}>
          <div className={styles.sgProdVisual}>
            <TubeIcon />
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

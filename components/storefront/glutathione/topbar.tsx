"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import styles from "./glutathione.module.css";

// Stacked fixed header: a promo/trust strip above the brand nav, styled
// after the owner's ad-style reference — but only real, verified claims
// (no fabricated customer counts; see product.ts / progress-tracker.md).
export function Topbar({ scrolled }: { scrolled: boolean }) {
  return (
    <div className={cn(styles.glHeader, scrolled && styles.scrolled)}>
      <div className={styles.glPromo}>
        <span>🚚 توصيل مجاني لكل الولايات</span>
        <span>💳 الدفع عند الاستلام</span>
        <span>✅ منتج أصلي 100%</span>
      </div>
      <div className={styles.glTop}>
        <Link className={styles.brand} href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/logo.webp"
            alt="Desert Shop"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <span className={styles.brandTx}>
            <span className={styles.brandName}>جلوتاثيون للتفتيح</span>
            <span className={styles.brandSub}>Desert Shop</span>
          </span>
        </Link>
        <Link className={styles.glBack} href="/">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          المتجر الرئيسي
        </Link>
      </div>
    </div>
  );
}

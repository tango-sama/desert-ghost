"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import styles from "./glutathione.module.css";

// Fixed header brand nav (2026-08-06: dropped the promo/trust strip that
// used to sit above it — owner asked to remove it; those same claims
// still appear as trust icons in the hero, so nothing real was lost).
// Shared with /glutathione-3d (imports this same component), so the
// removal applies there too.
export function Topbar({ scrolled }: { scrolled: boolean }) {
  return (
    <div className={cn(styles.glHeader, scrolled && styles.scrolled)}>
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

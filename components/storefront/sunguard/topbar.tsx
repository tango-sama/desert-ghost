"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import styles from "./sunguard.module.css";

export function Topbar({ scrolled }: { scrolled: boolean }) {
  return (
    <div className={cn(styles.sgTop, scrolled && styles.scrolled)}>
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
          <span className={styles.brandName}>واقي الشمس المائي</span>
          <span className={styles.brandSub}>Desert Shop</span>
        </span>
      </Link>
      <Link className={styles.sgBack} href="/">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 19-7-7 7-7" />
          <path d="M19 12H5" />
        </svg>
        المتجر الرئيسي
      </Link>
    </div>
  );
}

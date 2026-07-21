"use client";

import { cn } from "@/lib/utils";
import styles from "./collagen.module.css";

export function StickyBar({ show, onOrder }: { show: boolean; onOrder: () => void }) {
  return (
    <div className={cn(styles.clSticky, show && styles.show)}>
      <div className={styles.csTxt}>
        أربع تركيبات كولاجين
        <small>الدفع عند الاستلام</small>
      </div>
      <button type="button" className={styles.btnGold} style={{ padding: ".75rem 1.3rem", fontSize: ".85rem" }} onClick={onOrder}>
        🛒 اطلبي الآن
      </button>
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";
import styles from "./glutathione.module.css";

export function StickyBar({ show, onOrder }: { show: boolean; onOrder: () => void }) {
  return (
    <div className={cn(styles.glSticky, show && styles.show)}>
      <div className={styles.ssTxt}>
        جلوتاثيون Life Extension للتفتيح
        <small>الدفع عند الاستلام</small>
      </div>
      <button type="button" className={styles.glBtn} style={{ padding: ".75rem 1.3rem", fontSize: ".85rem" }} onClick={onOrder}>
        🛒 اطلبيه الآن
      </button>
    </div>
  );
}

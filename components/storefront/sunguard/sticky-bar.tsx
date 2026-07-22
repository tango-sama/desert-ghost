"use client";

import { cn } from "@/lib/utils";
import styles from "./sunguard.module.css";

export function StickyBar({ show, onOrder }: { show: boolean; onOrder: () => void }) {
  return (
    <div className={cn(styles.sgSticky, show && styles.show)}>
      <div className={styles.ssTxt}>
        واقي شمس 3D Aura بطعم البطيخ
        <small>الدفع عند الاستلام</small>
      </div>
      <button type="button" className={styles.sgBtn} style={{ padding: ".75rem 1.3rem", fontSize: ".85rem" }} onClick={onOrder}>
        🛒 اطلبيه الآن
      </button>
    </div>
  );
}

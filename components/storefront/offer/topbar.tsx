"use client";

import { cn } from "@/lib/utils";
import styles from "./offer.module.css";

// Minimal bar, same job as the other funnels' topbars: identify the shop and
// state the one thing that removes the risk of ordering, and nothing else. No
// nav links — every link out of a landing page is a way to leave it.
export function Topbar({ scrolled, storeName }: { scrolled: boolean; storeName: string }) {
  return (
    <header className={cn(styles.top, scrolled && styles.topScrolled)}>
      <span className={styles.brand}>{storeName}</span>
      <span className={styles.topNote}>الدفع عند الاستلام · 58 ولاية</span>
    </header>
  );
}

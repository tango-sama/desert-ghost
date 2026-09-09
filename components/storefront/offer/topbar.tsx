"use client";

import { cn } from "@/lib/utils";
import styles from "./offer.module.css";

// Minimal bar, same job as the other funnels' topbars: identify the shop and
// state the one thing that removes the risk of ordering, and nothing else. No
// nav links — every link out of a landing page is a way to leave it.
//
// It now starts transparent and lit for the ink hero it sits over, and only
// takes on the page ground once it has scrolled past it. A solid cream bar
// pinned above a dark hero cuts the page's one full-bleed image in half.
export function Topbar({ scrolled, storeName }: { scrolled: boolean; storeName: string }) {
  return (
    <header className={cn(styles.top, scrolled && styles.topScrolled)}>
      {/* The one deliberate exception to "no links out": at the owner's
          request, the brand name is the funnel's only path back to the main
          site. It is the shop's identity, not a nav item. */}
      <a className={styles.brand} href="https://www.desertshop.fit/">
        {storeName}
      </a>
      <span className={styles.topNote}>
        الدفع عند الاستلام
        <i className={styles.topDot} aria-hidden />
        58 ولاية
      </span>
    </header>
  );
}

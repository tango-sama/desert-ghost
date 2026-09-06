"use client";

import { priceFmt } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { BagIcon } from "./icons";
import styles from "./offer.module.css";

// The page stacks a full section set per chosen product, which makes it long —
// long enough that the order CTA would otherwise sit below the fold for the
// entire scroll. This carries the ask and the running total the whole way
// down. Same job as glutathione/sticky-bar.tsx, with the total added because
// here the order can be more than one product.
//
// A floating ink capsule, inset from the edges, rather than a full-width white
// shelf welded to the bottom of the viewport — that shape is what a cookie
// banner looks like, and it reads as something to dismiss.
export function StickyBar({
  show,
  count,
  total,
  onOrder,
}: {
  show: boolean;
  count: number;
  total: number;
  onOrder: () => void;
}) {
  return (
    <div className={cn(styles.sticky, show && styles.stickyShow)}>
      <div className={styles.stickyInner}>
        <span className={styles.stickyTxt}>
          <span className={cn(styles.stickyTotal, "num")}>{priceFmt(total)}</span>
          <small>
            {count} {count === 1 ? "منتج" : "منتجات"} · الدفع عند الاستلام
          </small>
        </span>
        <button
          type="button"
          className={cn(styles.btn, styles.btnLight, styles.stickyBtn)}
          onClick={onOrder}
        >
          <BagIcon />
          اطلبي الآن
        </button>
      </div>
    </div>
  );
}

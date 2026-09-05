"use client";

import { priceFmt } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import styles from "./offer.module.css";

// The page stacks a full section set per chosen product, which makes it long —
// long enough that the order CTA would otherwise sit below the fold for the
// entire scroll. This carries the ask and the running total the whole way
// down. Same pattern as glutathione/sticky-bar.tsx, with the total added
// because here the order can be more than one product.
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
      <div className={styles.stickyTxt}>
        <span className="num">{priceFmt(total)}</span>
        <small>
          {count} {count === 1 ? "منتج" : "منتجات"} · الدفع عند الاستلام
        </small>
      </div>
      <button type="button" className={cn(styles.btn, styles.stickyBtn)} onClick={onOrder}>
        🛒 اطلبي الآن
      </button>
    </div>
  );
}

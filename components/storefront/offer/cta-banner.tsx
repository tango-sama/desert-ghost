"use client";

import { priceFmt } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { BagIcon, CashIcon, ShieldIcon, TruckIcon } from "./icons";
import styles from "./offer.module.css";

// The page's last word, and its second ink band. A long landing page that ends
// on the same cream it started on simply trails off; a dark full-bleed close
// gives the final ask somewhere to land. The gold ring behind it is the same
// one drawn around the hero's product plate, at page scale.
export function CtaBanner({ total, onOrder }: { total: number; onOrder: () => void }) {
  return (
    <section className={styles.ctaBanner}>
      <span className={styles.ctaRing} aria-hidden />
      <h2>ابدئي من اليوم، وادفعي عند الاستلام</h2>
      <p>
        املئي الاسم ورقم الهاتف والعنوان، ونتصل بكِ لتأكيد الطلب قبل أن يخرج
        الطرد. لا تدفعين شيئاً قبل أن يصلكِ.
      </p>
      <button type="button" className={cn(styles.btn, styles.btnLight)} onClick={onOrder}>
        <BagIcon />
        أريد هذا الاختيار — <span className="num">{priceFmt(total)}</span>
      </button>
      <div className={styles.ctaTrust}>
        <span>
          <CashIcon />
          الدفع عند الاستلام
        </span>
        <span>
          <TruckIcon />
          توصيل 58 ولاية
        </span>
        <span>
          <ShieldIcon />
          منتجات أصلية
        </span>
      </div>
    </section>
  );
}

"use client";

import { priceFmt } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import styles from "./offer.module.css";

export function CtaBanner({ total, onOrder }: { total: number; onOrder: () => void }) {
  return (
    <section className={styles.wrap}>
      <div className={styles.ctaBanner}>
        <h2>ابدئي من اليوم، وادفعي عند الاستلام</h2>
        <p>
          املئي الاسم ورقم الهاتف والعنوان، ونتصل بكِ لتأكيد الطلب قبل أن يخرج
          الطرد. لا تدفعين شيئاً قبل أن يصلكِ.
        </p>
        <button type="button" className={cn(styles.btn)} onClick={onOrder}>
          🛒 اطلبي الآن — <span className="num">{priceFmt(total)}</span>
        </button>
      </div>
    </section>
  );
}

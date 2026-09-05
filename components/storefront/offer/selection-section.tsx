"use client";

import { priceFmt, priceNum, type Product } from "@/lib/firebase";
import { RevealRoot } from "@/components/storefront/reveal-root";
import { cn } from "@/lib/utils";
import styles from "./offer.module.css";

// The order summary, at the foot of the stack. On a multi-product page this is
// the first place the whole selection appears together with one total — every
// block before it shows a single product's price — so it is what turns three
// separate reads into one order.
export function SelectionSection({
  products,
  total,
  onOrder,
}: {
  products: Product[];
  total: number;
  onOrder: () => void;
}) {
  return (
    <RevealRoot>
      <section className={`${styles.sec} reveal`}>
        <span className={styles.label}>طلبكِ</span>
        <h2 className={styles.h2}>
          {products.length > 1 ? "كل ما اخترتِه في طلب واحد" : "جاهز للطلب"}
        </h2>
        <div className={styles.underline} />
        <div className={styles.summary}>
          {products.map((p) => {
            const img = (Array.isArray(p.images) ? p.images[0] : "") || p.image || "";
            return (
              <div className={styles.sumRow} key={String(p.id)}>
                {img ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img className={styles.sumImg} src={img} alt="" loading="lazy" />
                ) : (
                  <span className={styles.sumImg} />
                )}
                <span className={styles.sumBody}>
                  <span className={styles.sumTitle}>{p.title ?? p.name}</span>
                  <span className={cn(styles.sumPrice, "num")}>{priceFmt(priceNum(p.price))}</span>
                </span>
              </div>
            );
          })}
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>
              المجموع ({products.length} {products.length === 1 ? "منتج" : "منتجات"})
            </span>
            <span className={cn(styles.totalValue, "num")}>{priceFmt(total)}</span>
          </div>
          <button type="button" className={cn(styles.btn, styles.btnBlock)} onClick={onOrder}>
            🛒 اطلبي الآن — الدفع عند الاستلام
          </button>
          <p className={styles.usageNote} style={{ textAlign: "center" }}>
            تكلفة التوصيل تُحسب حسب ولايتكِ وتظهر لكِ في نموذج الطلب قبل التأكيد.
          </p>
        </div>
      </section>
    </RevealRoot>
  );
}

"use client";

import { priceFmt, priceNum, type Product } from "@/lib/firebase";
import { RevealRoot } from "@/components/storefront/reveal-root";
import { cn } from "@/lib/utils";
import { BagIcon } from "./icons";
import styles from "./offer.module.css";

// The order summary, at the foot of the stack. On a multi-product page this is
// the first place the whole selection appears together with one total — every
// block before it shows a single product's price — so it is what turns three
// separate reads into one order.
//
// It gets the page's one moment of scale: its own sand band with the store's
// name set enormous and faint behind it. That is worth spending here and
// nowhere else, because this is the section the whole scroll was for. The
// watermark is the real store name from settings, never a stand-in.
export function SelectionSection({
  products,
  total,
  storeName,
  onOrder,
}: {
  products: Product[];
  total: number;
  storeName: string;
  onOrder: () => void;
}) {
  return (
    <section className={styles.summaryBand}>
      <span className={styles.watermark} aria-hidden>
        {storeName}
      </span>
      <div className={styles.wrap}>
        <RevealRoot>
          <div className={`${styles.sec} reveal`}>
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
                      <span className={cn(styles.sumPrice, "num")}>
                        {priceFmt(priceNum(p.price))}
                      </span>
                    </span>
                  </div>
                );
              })}
              <div className={styles.totalRow}>
                <span className={styles.totalLabel}>
                  المجموع · {products.length} {products.length === 1 ? "منتج" : "منتجات"}
                </span>
                <span className={cn(styles.totalValue, "num")}>{priceFmt(total)}</span>
              </div>
              <button type="button" className={cn(styles.btn, styles.btnBlock)} onClick={onOrder}>
                <BagIcon />
                اطلبي الآن — الدفع عند الاستلام
              </button>
              <p className={styles.summaryNote}>
                تكلفة التوصيل تُحسب حسب ولايتكِ وتظهر لكِ في نموذج الطلب قبل التأكيد.
              </p>
            </div>
          </div>
        </RevealRoot>
      </div>
    </section>
  );
}

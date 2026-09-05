"use client";

import { forwardRef } from "react";
import { priceFmt } from "@/lib/firebase";
import type { LandingBlock } from "@/lib/landing-content";
import { pageHeadline, pageSubhead } from "@/lib/landing-content";
import type { Answers } from "@/lib/quiz";
import styles from "./offer.module.css";

// The hero speaks to the ANSWERS, not to the catalog: she has just told us her
// goal, and the first thing she reads here should be that goal reflected back,
// so the page reads as the continuation of her quiz rather than as a product
// listing she happened to land on.
//
// The chips under it are the page's only navigation. On a stacked page they
// are not a nicety — without them a three-product page is one long scroll with
// no way back to the product she actually came for.
export const Hero = forwardRef<
  HTMLElement,
  {
    answers: Answers;
    blocks: LandingBlock[];
    total: number;
    onOrder: () => void;
    onJump: (anchor: string) => void;
  }
>(function Hero({ answers, blocks, total, onOrder, onJump }, ref) {
  const count = blocks.length;
  return (
    <section className={`${styles.wrap} ${styles.hero}`} ref={ref}>
      <span className={styles.heroKicker}>نتيجة أسئلتكِ</span>
      <h1 className={styles.heroTitle}>
        <em className={styles.heroEm}>{pageHeadline(answers, count)}</em>
      </h1>
      <p className={styles.heroLead}>{pageSubhead(answers, count)}</p>

      {count > 1 && (
        <div className={styles.chips}>
          {blocks.map((b, i) => (
            <button
              type="button"
              className={styles.chip}
              key={b.anchor}
              onClick={() => onJump(b.anchor)}
            >
              {b.images[0] ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img className={styles.chipImg} src={b.images[0]} alt="" loading="lazy" />
              ) : (
                <span className={styles.chipNum}>{i + 1}</span>
              )}
              {b.product.title ?? b.product.name}
            </button>
          ))}
        </div>
      )}

      <button type="button" className={styles.btn} onClick={onOrder}>
        🛒 اطلبي الآن — <span className="num">{priceFmt(total)}</span>
      </button>
      <div className={styles.trustRow} style={{ marginTop: "1.1rem" }}>
        <span>✓ الدفع عند الاستلام</span>
        <span>✓ توصيل 58 ولاية</span>
        <span>✓ منتجات أصلية</span>
      </div>
    </section>
  );
});

"use client";

import { forwardRef } from "react";
import { priceFmt } from "@/lib/firebase";
import type { LandingBlock } from "@/lib/landing-content";
import { pageHeadline, pageSubhead } from "@/lib/landing-content";
import type { Answers } from "@/lib/quiz";
import { HeroGallery } from "./hero-gallery";
import styles from "./offer.module.css";

// The hero speaks to the ANSWERS, not to the catalog: she has just told us her
// goal, and the first thing she reads here should be that goal reflected back,
// so the page reads as the continuation of her quiz rather than as a product
// listing she happened to land on.
//
// Under it, the swipeable gallery — one slide per product she chose (see
// hero-gallery.tsx). It replaced a row of small jump chips: a slide does
// everything a chip did, jumping to that product's section on tap, plus the
// thing a chip could not, which is showing her the product at the top of the
// page instead of three section stacks down. On a stacked page that navigation
// is not a nicety; without it a three-product page is one long scroll with no
// way back to the product she actually came for.
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

      {/* Rendered for a single product too: one slide is still a hero image,
          and the hero had none at all before. The gallery hides its own dots
          and arrows when there is nothing to swipe to. */}
      <HeroGallery blocks={blocks} onJump={onJump} />

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

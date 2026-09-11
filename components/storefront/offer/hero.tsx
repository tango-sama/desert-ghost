"use client";

import { forwardRef } from "react";
import { priceFmt } from "@/lib/firebase";
import type { LandingBlock } from "@/lib/landing-content";
import { pageHeadline, pageSubhead } from "@/lib/landing-content";
import type { Answers } from "@/lib/quiz";
import { BagIcon, CashIcon, PhoneIcon, TruckIcon } from "./icons";
import { HeroPlates } from "./hero-plates";
import styles from "./offer.module.css";

// The hero speaks to the ANSWERS, not to the catalog: she has just told us her
// goal, and the first thing she reads here should be that goal reflected back,
// so the page reads as the continuation of her quiz rather than as a product
// listing she happened to land on.
//
// WHY THE PHOTOGRAPH IS NOT THE BACKGROUND
// ----------------------------------------
// The obvious premium move — the recommended product full-bleed behind the
// headline — does not survive this catalog. Most of the 149 products are
// packshots on a white studio background, and a white packshot stretched to
// cover is the single fastest way to make a page look cheap, with white text
// unreadable over it. So the photo is used twice instead: once blurred and
// low, purely for the colour it lends the ink ground, and once crisp and whole
// on a lit plate. That works for a bottle, a jar or a sachet alike, and needs
// nothing of the photo that the catalog cannot promise.
//
// The plate is a swipeable track of one plate per chosen product (owner
// request; see hero-plates.tsx). It shows only `blocks[0]`'s photo otherwise,
// which on a three-product result leaves the other two invisible until she has
// scrolled past a whole section stack.
//
// The rail beneath overlaps the hero's foot on purpose. It is the first thing
// past the fold on a cash-on-delivery shop, and the three facts on it are the
// three reasons someone who has never heard of this store will risk an order.
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
  const hero = blocks[0];
  const img = hero?.images[0] ?? "";

  // The blurred backdrop is set through a custom property, so the URL is
  // interpolated into CSS rather than into an attribute. Firebase Storage URLs
  // are percent-encoded and cannot contain either of these, but an owner-typed
  // image URL in the admin panel can — and a stray quote there would end the
  // url() token and let the rest of the string be parsed as CSS.
  const bgUrl = img.replace(/[\\"]/g, "\\$&");

  return (
    <>
      <section className={styles.hero} ref={ref}>
        {img && (
          <div
            className={styles.heroBg}
            style={{ "--hero-img": `url("${bgUrl}")` } as React.CSSProperties}
            aria-hidden
          />
        )}
        <div className={styles.heroScrim} aria-hidden />

        <div className={`${styles.wrap} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <span className={styles.heroKicker}>نتيجة أسئلتكِ</span>
            <h1 className={styles.heroTitle}>{pageHeadline(answers, count)}</h1>
            <p className={styles.heroLead}>{pageSubhead(answers, count)}</p>

            <div className={styles.heroCta}>
              <button type="button" className={`${styles.btn} ${styles.btnLight}`} onClick={onOrder}>
                <BagIcon />
                أريد اختياري
              </button>
              <span className={styles.heroPrice}>
                <span className={styles.heroPriceLabel}>المجموع</span>
                <span className={`${styles.heroPriceValue} num`}>{priceFmt(total)}</span>
              </span>
            </div>

            <div className={styles.heroStats} aria-label="معلومات الطلب">
              <span>
                <b>01</b>
                توصية حسب إجاباتكِ
              </span>
              <span>
                <b>{count.toString().padStart(2, "0")}</b>
                {count === 1 ? "منتج مختار" : "منتجات مختارة"}
              </span>
              <span>
                <b>COD</b>
                الدفع عند الاستلام
              </span>
            </div>
          </div>

          {/* One plate per chosen product, swipeable. A single-product result
              renders exactly the one plate this used to, with no dots. */}
          <HeroPlates blocks={blocks} />
        </div>
      </section>

      <div className={styles.wrap}>
        <div className={styles.railWrap}>
          <div className={styles.rail}>
            <div className={styles.railItem}>
              <CashIcon />
              <span>
                <b className={styles.railTitle}>الدفع عند الاستلام</b>
                <span className={styles.railNote}>لا تدفعين شيئاً قبل أن يصلكِ الطرد</span>
              </span>
            </div>
            <div className={styles.railItem}>
              <TruckIcon />
              <span>
                <b className={styles.railTitle}>توصيل 58 ولاية</b>
                <span className={styles.railNote}>للمنزل أو لمكتب التوصيل</span>
              </span>
            </div>
            <div className={styles.railItem}>
              <PhoneIcon />
              <span>
                <b className={styles.railTitle}>تأكيد قبل الإرسال</b>
                <span className={styles.railNote}>نتصل بكِ قبل أن يخرج الطرد</span>
              </span>
            </div>
          </div>
        </div>

        {/* The page's only navigation, and only when there is more than one
            product to navigate between. */}
        {count > 1 && (
          <nav className={styles.index} aria-label="منتجات هذه الصفحة">
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
                  <span className={`${styles.chipNum} ${styles.numeral}`}>{i + 1}</span>
                )}
                {b.product.title ?? b.product.name}
              </button>
            ))}
          </nav>
        )}
      </div>
    </>
  );
});

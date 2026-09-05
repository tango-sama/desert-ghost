"use client";

import { priceFmt } from "@/lib/firebase";
import type { LandingBlock } from "@/lib/landing-content";
import { RevealRoot } from "@/components/storefront/reveal-root";
import { cn } from "@/lib/utils";
import { BeforeAfter } from "./before-after";
import { Reviews } from "./reviews";
import styles from "./offer.module.css";

// One product's full section stack — the piece that repeats. Every section
// here is conditional on having something real to say, because this same
// component renders for a product with a six-line description and owner-
// uploaded before/after photos AND for a product with a bare title. Rendering
// an empty "المكوّنات" heading on the second one would be worse than omitting
// it: it reads as a page that failed to load.
//
// Section order is the order a shopper's questions arrive in: what is it, why
// would it help me, what is in it, how do I use it, does it work, and only
// then — buy. The CTA repeats at the end of every block so that on a stacked
// page the ask is never more than one block away (the sticky bar carries it
// the rest of the time).
export function ProductBlock({
  block,
  index,
  isHero,
  onOrder,
}: {
  block: LandingBlock;
  index: number;
  isHero: boolean;
  onOrder: () => void;
}) {
  const p = block.product;
  const name = p.title ?? p.name ?? "";
  // The main photo is shown large in the spotlight; the rest become thumbs.
  const [main, ...rest] = block.images;

  return (
    <div className={cn(styles.block, index % 2 === 1 && styles.blockAlt)} id={block.anchor}>
      <div className={styles.wrap}>
        <RevealRoot>
          <div className="reveal">
            <div className={styles.blockHead}>
              <span className={styles.blockNum}>{index + 1}</span>
              {isHero && <span className={styles.pick}>الأنسب لكِ</span>}
            </div>
            <h2 className={styles.blockTitle}>{block.headline}</h2>
            <p className={styles.blockSub}>{block.subhead}</p>

            {/* ── the product itself ── */}
            <div className={styles.spot}>
              <div className={styles.spotMedia}>
                {main ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={main} alt={name} loading="lazy" />
                ) : null}
              </div>
              <div className={styles.spotBody}>
                <h3>{name}</h3>
                {p.subtitle && <p>{p.subtitle}</p>}
                <div className={styles.priceRow}>
                  <span className={cn(styles.price, "num")}>{priceFmt(p.price)}</span>
                  <span className={styles.priceNote}>+ التوصيل حسب ولايتكِ</span>
                </div>
                <button type="button" className={cn(styles.btn, styles.btnBlock)} onClick={onOrder}>
                  🛒 اطلبيه الآن — الدفع عند الاستلام
                </button>
                {rest.length > 0 && (
                  <div className={styles.thumbs}>
                    {rest.slice(0, 4).map((src, i) => (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img className={styles.thumb} src={src} alt="" key={`${src}-${i}`} loading="lazy" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </RevealRoot>

        {/* ── why it helps ── */}
        {block.benefits.length > 0 && (
          <RevealRoot>
            <section className={`${styles.sec} reveal`}>
              <span className={styles.label}>الفوائد</span>
              <h2 className={styles.h2}>ما الذي يقدّمه لكِ</h2>
              <div className={styles.underline} />
              <div className={styles.benefits}>
                {block.benefits.map((b, i) => (
                  <div className={styles.benefit} key={`${b.title}-${i}`}>
                    <span className={styles.benefitIc} aria-hidden>
                      {b.ic}
                    </span>
                    {b.title && <b>{b.title}</b>}
                    <p>{b.text}</p>
                  </div>
                ))}
              </div>
            </section>
          </RevealRoot>
        )}

        {/* ── what is in it ──
            Owner-entered only. A category cannot tell you what is in a bottle,
            and guessing composition on a health product is the one place a
            wrong word does real damage — so this section simply is not here
            until she has written it. */}
        {block.ingredients.length > 0 && (
          <RevealRoot>
            <section className={`${styles.sec} reveal`}>
              <span className={styles.label}>المكوّنات</span>
              <h2 className={styles.h2}>ماذا يحتوي وما الذي يفعله</h2>
              <div className={styles.underline} />
              <div className={styles.ingredients}>
                {block.ingredients.map((ing, i) => (
                  <div className={styles.ingredient} key={`${ing.name}-${i}`}>
                    <b>{ing.name}</b>
                    {ing.text && <p>{ing.text}</p>}
                  </div>
                ))}
              </div>
            </section>
          </RevealRoot>
        )}

        {/* ── how to use it ── */}
        {block.usage.length > 0 && (
          <RevealRoot>
            <section className={`${styles.sec} reveal`}>
              <span className={styles.label}>طريقة الاستعمال</span>
              <h2 className={styles.h2}>كيف تستعملينه</h2>
              <div className={styles.underline} />
              <div className={styles.usage}>
                {block.usage.map((u, i) => (
                  <div className={styles.usageRow} key={i}>
                    <span className={styles.usageIc} aria-hidden>
                      {u.ic}
                    </span>
                    <p>{u.p}</p>
                  </div>
                ))}
              </div>
              <p className={styles.usageNote}>
                الإرشادات المكتوبة على العبوة هي المرجع دائماً. إن كنتِ حاملاً أو
                مرضعاً أو تتناولين دواءً بوصفة، استشيري طبيبكِ قبل البدء.
              </p>
            </section>
          </RevealRoot>
        )}

        {/* ── proof, when it is real ── */}
        <BeforeAfter items={block.beforeAfter} productName={name} />
        <Reviews
          items={block.reviews}
          label="آراء عن هذا المنتج"
          title={`ماذا قلن عن ${name}`}
          sub="تجارب زبونات طلبن هذا المنتج تحديداً."
        />

        {/* ── ask again, at the end of the block ── */}
        <div className={styles.sec}>
          <button type="button" className={cn(styles.btn, styles.btnGold)} onClick={onOrder}>
            🛒 أضيفيه لطلبكِ — الدفع عند الاستلام
          </button>
        </div>
      </div>
    </div>
  );
}

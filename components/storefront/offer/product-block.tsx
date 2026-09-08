"use client";

import { priceFmt } from "@/lib/firebase";
import type { LandingBlock } from "@/lib/landing-content";
import { RevealRoot } from "@/components/storefront/reveal-root";
import { cn } from "@/lib/utils";
import { BeforeAfter } from "./before-after";
import { Reviews } from "./reviews";
import { BagIcon, CheckIcon } from "./icons";
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
// page the ask is never more than one block away (the floating capsule carries
// it the rest of the time).
//
// WHERE THE EMOJI WENT
// --------------------
// `benefit.ic` and `usage.ic` still arrive from lib/landing-content.ts and are
// deliberately not rendered. They were decorative — a category archetype
// cannot know which emoji describes a particular bottle — and they were the
// one element on the page that no stylesheet could touch, since every device
// draws them in its own typeface at its own weight. A counted numeral says the
// same nothing in the page's own voice, and on the usage steps it says
// something true: those steps are sequential.

/** Two-digit index, the page's counting device. */
function n2(i: number): string {
  return String(i + 1).padStart(2, "0");
}

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
  // The main photo is shown large on the plate; the rest become thumbs.
  const [main, ...rest] = block.images;

  return (
    <div className={cn(styles.block, index % 2 === 1 && styles.blockAlt)} id={block.anchor}>
      <div className={styles.wrap}>
        <RevealRoot>
          <div className="reveal">
            <div className={styles.blockHead}>
              <span className={cn(styles.blockNum, styles.numeral)} aria-hidden>
                {n2(index)}
              </span>
              {isHero && (
                <span className={styles.pick}>
                  <CheckIcon />
                  الأنسب لكِ
                </span>
              )}
            </div>
            <h2 className={styles.blockTitle}>{block.headline}</h2>
            <p className={styles.blockSub}>{block.subhead}</p>

            {/* ── the product itself ── */}
            <div className={styles.spot}>
              <div className={styles.spotMedia}>
                <span className={styles.spotOrbit} aria-hidden />
                {main ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={main} alt={name} loading="lazy" />
                ) : null}
              </div>
              <div className={styles.spotBody}>
                <span className={styles.formulaTag}>Selected Formula</span>
                <h3>{name}</h3>
                {p.subtitle && <p>{p.subtitle}</p>}
                <div className={styles.fitPanel}>
                  <span className={cn(styles.fitNum, styles.numeral)}>01</span>
                  <span>
                    <b>لماذا ظهر في نتيجتكِ؟</b>
                    {/* Built per product in lib/landing-content.ts. It names
                        her goal only when this product's own description
                        speaks to it, and otherwise says plainly that we chose
                        it from her answers — the page must never tell her a
                        product is for something its own words never claim. */}
                    <small>{block.fit}</small>
                  </span>
                </div>
                <div className={styles.priceRow}>
                  <span className={cn(styles.price, "num")}>{priceFmt(p.price)}</span>
                  <span className={styles.priceNote}>+ التوصيل حسب ولايتكِ</span>
                </div>
                <button type="button" className={cn(styles.btn, styles.btnBlock)} onClick={onOrder}>
                  <BagIcon />
                  اطلبيه الآن — الدفع عند الاستلام
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
                    <span className={cn(styles.benefitNum, styles.numeral)} aria-hidden>
                      {n2(i)}
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
              <ol className={styles.usage}>
                {block.usage.map((u, i) => (
                  <li className={styles.usageRow} key={i}>
                    <span className={cn(styles.usageNum, styles.numeral)} aria-hidden>
                      {n2(i)}
                    </span>
                    <p>{u.p}</p>
                  </li>
                ))}
              </ol>
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

        {/* ── ask again, at the end of the block ──
            Outlined, not a third solid rose pill in one screen: the spotlight
            above already made the ask in full colour, and a page where every
            button shouts equally has no primary action at all. */}
        <div className={styles.sec}>
          <button type="button" className={cn(styles.btn, styles.btnQuiet)} onClick={onOrder}>
            <BagIcon />
            أضيفيه لطلبكِ — الدفع عند الاستلام
          </button>
        </div>
      </div>
    </div>
  );
}

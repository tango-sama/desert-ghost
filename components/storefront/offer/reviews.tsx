import { RevealRoot } from "@/components/storefront/reveal-root";
import type { ReviewItem } from "@/lib/landing-content";
import { StarIcon } from "./icons";
import styles from "./offer.module.css";

// Proof, with the honesty rule from lib/landing-content.ts showing through:
// the default set is the STORE's testimonials — about ordering, delivery,
// packaging and the confirmation call — because the same set sits beside all
// 149 products and a per-product outcome claim would be false for at least 148
// of them. Per-product reviews exist, but only ones the owner typed in
// herself; those render inside that product's own block.
//
// Set as testimony rather than as cards: a large faint serif quotation mark
// opens each one, and the rating is five drawn stars instead of the "★★★★☆"
// character run, which arrived at whatever size and colour the device's emoji
// or symbol font happened to use.
export function Reviews({
  items,
  title = "زبونات طلبن من عندنا",
  sub = "تجارب حقيقية مع الطلب والتوصيل.",
  label = "آراء زبوناتنا",
}: {
  items: ReviewItem[];
  title?: string;
  sub?: string;
  label?: string;
}) {
  if (!items.length) return null;
  return (
    <RevealRoot>
      <section className={`${styles.sec} reveal`}>
        <span className={styles.label}>{label}</span>
        <h2 className={styles.h2}>{title}</h2>
        <div className={styles.underline} />
        <p className={styles.sub}>{sub}</p>
        <div className={styles.reviews}>
          {items.map((r, i) => (
            <figure className={styles.review} key={`${r.name}-${i}`}>
              <span className={styles.quote} aria-hidden>
                &rdquo;
              </span>
              <div className={styles.stars} aria-label={`${r.stars} من 5`}>
                {[0, 1, 2, 3, 4].map((n) => (
                  <StarIcon key={n} filled={n < r.stars} />
                ))}
              </div>
              <p>{r.text}</p>
              <figcaption className={styles.who}>
                <span className={styles.avatar} aria-hidden>
                  {r.name.trim().charAt(0)}
                </span>
                <span>
                  <span className={styles.whoName}>{r.name}</span>
                  {r.where && <span className={styles.whoWhere}>{r.where}</span>}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </RevealRoot>
  );
}

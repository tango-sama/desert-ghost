import { RevealRoot } from "@/components/storefront/reveal-root";
import type { ReviewItem } from "@/lib/landing-content";
import styles from "./offer.module.css";

// Proof, with the honesty rule from lib/landing-content.ts showing through:
// the default set is the STORE's testimonials — about ordering, delivery,
// packaging and the confirmation call — because the same set sits beside all
// 149 products and a per-product outcome claim would be false for at least 148
// of them. Per-product reviews exist, but only ones the owner typed in
// herself; those render inside that product's own block.
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
            <div className={styles.review} key={`${r.name}-${i}`}>
              <div className={styles.stars} aria-label={`${r.stars} من 5`}>
                {"★".repeat(r.stars)}
                {"☆".repeat(5 - r.stars)}
              </div>
              <p>{r.text}</p>
              <div className={styles.who}>
                <span className={styles.avatar} aria-hidden>
                  {r.name.trim().charAt(0)}
                </span>
                <span>
                  <span className={styles.whoName}>{r.name}</span>
                  {r.where && <span className={styles.whoWhere}>{r.where}</span>}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </RevealRoot>
  );
}

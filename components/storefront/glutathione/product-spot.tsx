import type { GLUTATHIONE_PRODUCT } from "./product";
import styles from "./glutathione.module.css";

// The hero's "floating" product spotlight card, extracted so it can also
// render inside the formula section when the two visuals are swapped (see
// hero.tsx / formula.tsx — 2026-08-06, owner asked for the floating card
// and the big formula-section picture to trade places). One component
// keeps both spots' badge copy identical instead of two hand-synced
// copies drifting apart.
export function ProductSpot({
  product,
  image,
  className,
}: {
  product: typeof GLUTATHIONE_PRODUCT;
  image?: string;
  className?: string;
}) {
  return (
    <div className={className ? `${styles.glSpot} ${className}` : styles.glSpot}>
      <div className={styles.glSpotVisual}>
        <span className={styles.glSpotCorner}>✨ {product.size}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image || product.image} alt={product.title} />
      </div>
      <div className={styles.glSpotBrand}>{product.brand}</div>
      <div className={styles.glSpotTitle}>{product.title}</div>
      <div className={styles.glSpotBadges}>
        <span className={styles.glSpotBadge}>🌿 خالٍ من الجلوتين</span>
        <span className={styles.glSpotBadge}>✅ NON-GMO</span>
      </div>
    </div>
  );
}

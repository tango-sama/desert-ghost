import type { GLUTATHIONE_PRODUCT } from "./product";
import styles from "./glutathione.module.css";

// The floating "spotlight" product card — used to live inline in the
// hero; moved out into its own standalone section right after Benefits
// (2026-08-06, owner request via annotated screenshot). See
// product-spot-section.tsx and hero.tsx.
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

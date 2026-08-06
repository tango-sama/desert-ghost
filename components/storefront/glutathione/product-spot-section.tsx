import { RevealRoot } from "@/components/storefront/reveal-root";
import type { GLUTATHIONE_PRODUCT } from "./product";
import { ProductSpot } from "./product-spot";
import styles from "./glutathione.module.css";

// Standalone section for the floating product spotlight card
// (2026-08-06, owner request) — sits right after Benefits; used to live
// inline as the hero's second column (see hero.tsx / product-spot.tsx).
// `image` is the same admin "صورة الواجهة (Hero)" override the card used
// there, just re-homed to whichever section actually renders it now.
export function ProductSpotSection({
  product,
  image,
}: {
  product: typeof GLUTATHIONE_PRODUCT;
  image?: string;
}) {
  return (
    <RevealRoot>
      <section className={`${styles.glSec} reveal`}>
        <ProductSpot product={product} image={image} className={styles.glSpotStandalone} />
      </section>
    </RevealRoot>
  );
}

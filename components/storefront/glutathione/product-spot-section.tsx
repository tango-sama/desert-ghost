import { RevealRoot } from "@/components/storefront/reveal-root";
import type { GLUTATHIONE_PRODUCT } from "./product";
import { ProductSpot } from "./product-spot";
import styles from "./glutathione.module.css";

// Standalone section for the floating product spotlight card
// (2026-08-06, owner request) — sits where the formula section used to,
// right after Benefits and before Gift; that section's own visual now
// renders inside the hero instead (see hero.tsx / formula-visual.tsx).
export function ProductSpotSection({ product }: { product: typeof GLUTATHIONE_PRODUCT }) {
  return (
    <RevealRoot>
      <section className={`${styles.glSec} reveal`}>
        <ProductSpot product={product} className={styles.glFormulaSpot} />
      </section>
    </RevealRoot>
  );
}

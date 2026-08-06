import { TRIO, OrbitRing } from "./formula";
import type { GLUTATHIONE_PRODUCT } from "./product";
import styles from "./glutathione.module.css";

// The formula section's ingredient "orbit" diagram — now rendered inside
// the hero instead of its own section (2026-08-06, owner request: swap
// the hero's floating card with this visual; the card moved to
// product-spot-section.tsx). Reuses formula.tsx's TRIO/OrbitRing so
// /glutathione-3d's own, still-separate Formula section stays untouched
// and the ingredient copy isn't duplicated.
//
// 2026-08-06, later same day: this used to also handle the admin
// `formulaImage` picture case (as a foreground image filling the hero's
// visual column). The owner then asked for that picture to become the
// whole section's *background* instead — hero.tsx now applies it via
// `background-image` directly and skips rendering this component
// entirely in that case (see hero.tsx), so only the no-picture, orbit-
// diagram fallback is left here.
export function FormulaVisual({ product }: { product: typeof GLUTATHIONE_PRODUCT }) {
  return (
    <div className={styles.glHeroOrbitCard}>
      <div className={styles.glOrbit}>
        <OrbitRing />
        <div className={styles.glOrbitBottle}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.image} alt={product.title} />
        </div>
        {TRIO.map((t) => (
          <div className={`${styles.glOrbitNode} ${t.pos}`} key={t.h}>
            <div className={styles.glOrbitIcon}>{t.ic}</div>
            <h3>{t.h}</h3>
            <p>{t.p}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

import { TRIO, OrbitRing } from "./formula";
import type { GLUTATHIONE_PRODUCT } from "./product";
import styles from "./glutathione.module.css";

// The formula section's visual — the ingredient "orbit" diagram, or the
// admin-set `formulaImage` when one is uploaded — now rendered inside the
// hero instead of its own section (2026-08-06, owner request: swap the
// hero's floating card with this visual; the card moved to
// product-spot-section.tsx). Reuses formula.tsx's TRIO/OrbitRing so
// /glutathione-3d's own, still-separate Formula section stays untouched
// and the ingredient copy isn't duplicated.
export function FormulaVisual({
  product,
  image,
}: {
  product: typeof GLUTATHIONE_PRODUCT;
  image?: string;
}) {
  const fullImage = image?.trim();

  if (fullImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={fullImage} alt="تركيبة ثلاثية الجمال" className={styles.glHeroBigImage} />
    );
  }

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

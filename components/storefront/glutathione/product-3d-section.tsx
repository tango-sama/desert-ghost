import dynamic from "next/dynamic";
import { RevealRoot } from "@/components/storefront/reveal-root";
import type { GLUTATHIONE_PRODUCT } from "./product";
import styles from "./glutathione.module.css";

// New standalone 3D-model showcase section (2026-08-06, owner request) —
// sits between the before/after slider and the usage-steps section (see
// before-after-section.tsx / usage-section.tsx, which CareRoutine's old
// two-column section was split into to make room for this). Reuses the
// same <model-viewer> wrapper /glutathione-3d's hero already uses (see
// glutathione-3d/product-3d-viewer.tsx) instead of duplicating it — that
// component is presentational only (src/poster/alt/className props),
// nothing specific to that page's own layout.
const Product3DViewer = dynamic(
  () => import("@/components/storefront/glutathione-3d/product-3d-viewer").then((m) => m.Product3DViewer),
  { ssr: false }
);

const MODEL_SRC = "/assets/glutathione/product-3d.glb";

export function Product3DSection({ product }: { product: typeof GLUTATHIONE_PRODUCT }) {
  return (
    <RevealRoot>
      <section className={`${styles.glSec} ${styles.gl3dSection} reveal`}>
        <div className={styles.glSecHead}>
          <span className={styles.glLabel}>عرض تفاعلي</span>
          <h2 className={styles.glTitle}>استكشفي المنتج من كل زاوية</h2>
          <div className={styles.glUnderline} />
        </div>
        <div className={styles.gl3dStage}>
          <Product3DViewer
            src={MODEL_SRC}
            poster={product.image}
            alt={product.title}
            className={styles.gl3dModel}
            fullscreenButtonClassName={styles.gl3dFsBtn}
          />
          <span className={styles.gl3dHint}>🔍 قابل للتكبير · اسحبي للتدوير 360°</span>
        </div>
      </section>
    </RevealRoot>
  );
}

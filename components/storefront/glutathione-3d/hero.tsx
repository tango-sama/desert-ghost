import dynamic from "next/dynamic";
import type { LandingHeroContent } from "@/lib/firebase";
import type { GLUTATHIONE_PRODUCT, GIFT_SOAP } from "@/components/storefront/glutathione/product";
import styles from "@/components/storefront/glutathione/glutathione.module.css";
import gl3d from "./glutathione-3d.module.css";

// Same hero as /glutathione (structure, copy, offer, CTAs all identical —
// see components/storefront/glutathione/hero.tsx) with one change: the
// static bottle photo in the spotlight card is replaced by an interactive,
// auto-rotating 3D model (gluta-3d.glb) so this page can be A/B-tested
// against the photo-based original without touching it.
const Product3DViewer = dynamic(
  () => import("./product-3d-viewer").then((m) => m.Product3DViewer),
  { ssr: false }
);

const MODEL_SRC = "/assets/glutathione/gluta-3d.glb";

export function Hero({
  onOrder,
  ref,
  product,
  gift,
  content,
}: {
  onOrder: () => void;
  ref: React.Ref<HTMLElement>;
  product: typeof GLUTATHIONE_PRODUCT;
  gift: typeof GIFT_SOAP;
  content?: LandingHeroContent;
}) {
  const title = content?.title?.trim();
  const lead = content?.lead?.trim();
  const heroImage = content?.image?.trim() || product.image;
  return (
    <section className={styles.glHero} ref={ref}>
      <div className={styles.glHeroRay} />
      <div className={styles.glHeroInner}>
        <div>
          <span className={styles.glEyebrow}>✨ تركيبة متقدمة لدعم جمالكِ من الداخل</span>
          {title ? (
            <h1>{title}</h1>
          ) : (
            <>
              <h1>اكتشفي إشراقتكِ</h1>
              <span className={styles.glHeroGold}>الطبيعية من الداخل</span>
            </>
          )}
          <span className={styles.glHeroSub}>Glutathione, Cysteine &amp; Vitamin C</span>
          <p className={styles.lead}>
            {lead ||
              "تساعد على دعم مضادات الأكسدة وتعزيز صحة البشرة، وتوحيد لونها وتفتيحها، من أجل بشرة أكثر نضارة وحيوية — 100 كبسولة."}
          </p>

          <div className={styles.glGiftBox}>
            <span className={styles.glGiftIcon}>🎁</span>
            <div className={styles.glGiftTx}>
              <h4>هدية مجانية</h4>
              <p>{gift.title} مع كل طلب — لفترة محدودة</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.glGiftThumb} src={gift.image} alt={gift.title} />
          </div>

          <div className={styles.glHeroCtas}>
            <button type="button" className={styles.glBtn} onClick={onOrder}>
              🛒 اطلبيه الآن
            </button>
            <a className={styles.glBtnGhost} href="#product">
              تفاصيل المنتج
            </a>
          </div>
          <div className={styles.glTrust}>
            <span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              منتج أصلي 100%
            </span>
            <span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="12" x="2" y="6" rx="2" />
                <circle cx="12" cy="12" r="2" />
              </svg>
              الدفع عند الاستلام
            </span>
            <span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 18V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h1" />
                <path d="M14 9h4l4 4v4a1 1 0 0 1-1 1h-1" />
                <circle cx="7" cy="18" r="2" />
                <circle cx="17" cy="18" r="2" />
              </svg>
              توصيل لكل الولايات
            </span>
          </div>
        </div>
        <div>
          <div className={styles.glSpot}>
            <div className={styles.glSpotVisual}>
              <span className={styles.glSpotCorner}>✨ {product.size}</span>
              <Product3DViewer src={MODEL_SRC} poster={heroImage} alt={product.title} className={gl3d.model3d} />
              <span className={gl3d.spin3dHint}>🔄 اسحبي للتدوير 360°</span>
            </div>
            <div className={styles.glSpotBrand}>{product.brand}</div>
            <div className={styles.glSpotTitle}>{product.title}</div>
            <div className={styles.glSpotBadges}>
              <span className={styles.glSpotBadge}>🌿 خالٍ من الجلوتين</span>
              <span className={styles.glSpotBadge}>✅ NON-GMO</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

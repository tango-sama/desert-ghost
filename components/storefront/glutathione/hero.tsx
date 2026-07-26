import type { LandingHeroContent } from "@/lib/firebase";
import type { GLUTATHIONE_PRODUCT, GIFT_SOAP } from "./product";
import styles from "./glutathione.module.css";

// Restyled (2026-07-26) to match an owner-provided reference built for
// this exact product: deep navy background matching the real Life
// Extension bottle branding, a two-tone headline (white + gold line),
// and a real free-gift callout (see product.ts — GIFT_SOAP is a real
// catalog item, not a fabricated offer). No star-rating graphic or
// customer-count claim — this store has no real review data to back
// that up (see progress-tracker.md).
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
  return (
    <section className={styles.glHero} ref={ref}>
      <div className={styles.glHeroRay} />
      <div className={styles.glHeroInner}>
        <div>
          <span className={styles.glEyebrow}>✨ تركيبة متقدمة لدعم جمالكِ من الداخل</span>
          {/* admin-edited title loses the two-tone gold split — plain
              white text is a fair trade-off for editability (see
              landing-pages-view.tsx and the same tradeoff on sunguard) */}
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={product.image} alt={product.title} />
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

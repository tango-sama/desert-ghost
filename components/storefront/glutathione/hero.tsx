import type { GLUTATHIONE_PRODUCT } from "./product";
import styles from "./glutathione.module.css";

// Restyled per the owner's ad-style reference: light background, a big
// stacked headline with one word on a solid highlight chip (<mark>), and
// the real product photo on a plain card instead of a dark illustrated
// spotlight. The soft radial glow still nods to "glow from within".
function GlowIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none">
      <defs>
        <radialGradient id="glGlow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#FFF3D6" />
          <stop offset="55%" stopColor="var(--gold)" />
          <stop offset="100%" stopColor="#8a5a1e" />
        </radialGradient>
      </defs>
      {Array.from({ length: 12 }).map((_, i) => (
        <rect
          key={i}
          x="48"
          y="2"
          width="4"
          height="16"
          rx="2"
          fill="#FFF3D6"
          opacity="0.85"
          transform={`rotate(${i * 30} 50 50)`}
        />
      ))}
      <circle cx="50" cy="50" r="26" fill="url(#glGlow)" />
    </svg>
  );
}

export function Hero({
  onOrder,
  ref,
  product,
}: {
  onOrder: () => void;
  ref: React.Ref<HTMLElement>;
  product: typeof GLUTATHIONE_PRODUCT;
}) {
  return (
    <section className={styles.glHero} ref={ref}>
      <GlowIcon className={styles.glBgGlow} />
      <div className={styles.glHeroInner}>
        <div>
          <span className={styles.glEyebrow}>✨ ثلاثية الجلوتاثيون + السيستئين + فيتامين C</span>
          <h1>
            بشرتكِ تستحق
            <br />
            <mark>إشراقاً حقيقياً</mark>
            <br />
            من الداخل
          </h1>
          <p className={styles.lead}>
            مكمل Life Extension يجمع الجلوتاثيون (المُختزل) مع السيستئين وفيتامين C لتفتيح البشرة
            وتوحيد لونها، دعم وظائف الكبد وإزالة السموم، وتعزيز الجهاز المناعي — 100 كبسولة.
          </p>
          <div className={styles.glPill}>🌿 خالٍ من الجلوتين ومعتمد NON-GMO</div>
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

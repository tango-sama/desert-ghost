import type { LandingHeroContent } from "@/lib/firebase";
import type { CARNITINE_PRODUCT } from "./product";
import styles from "./carnitine.module.css";

// The hero visual is the real product photo inside a glass spotlight card
// (same convention as sunguard's illustrated spotlight) rather than an
// abstract icon — a supplement box reads better as a real photo than as a
// drawn illustration.
function FlameIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none">
      <defs>
        <radialGradient id="cnFlame" cx="50%" cy="60%" r="65%">
          <stop offset="0%" stopColor="#FFD9A0" />
          <stop offset="55%" stopColor="var(--gold)" />
          <stop offset="100%" stopColor="#C2511B" />
        </radialGradient>
      </defs>
      <path
        d="M50 8c8 14-6 20-6 32 0 8 6 14 14 14s14-8 14-18c10 10 14 22 14 32 0 20-16 32-36 32S14 88 14 68c0-24 20-32 20-46 0-6-2-10-2-10 10 0 18 6 18 10z"
        fill="url(#cnFlame)"
      />
    </svg>
  );
}

export function Hero({
  onOrder,
  ref,
  content,
  product,
}: {
  onOrder: () => void;
  ref: React.Ref<HTMLElement>;
  content?: LandingHeroContent;
  product: typeof CARNITINE_PRODUCT;
}) {
  const title = content?.title?.trim();
  const lead = content?.lead?.trim();
  return (
    <section className={styles.cnHero} ref={ref}>
      <FlameIcon className={styles.cnBgFlame} />
      <div className={styles.cnBubble} style={{ width: 180, height: 180, top: "6%", left: "6%" }} />
      <div className={styles.cnBubble} style={{ width: 110, height: 110, top: "64%", left: "14%", animationDelay: "2s" }} />
      <div className={styles.cnBubble} style={{ width: 140, height: 140, top: "12%", left: "82%", animationDelay: "1.2s" }} />
      <div className={styles.cnHeroInner}>
        <div>
          <span className={styles.cnEyebrow}>🔥 مكمل عشبي تركي طبيعي لدعم إنقاص الوزن</span>
          {/* admin-edited title loses the gradient-highlighted word — plain
              text is a fair trade-off for editability (see admin's
              landing-pages-view.tsx) */}
          {title ? (
            <h1>{title}</h1>
          ) : (
            <h1>
              خطوتكِ نحو <span>جسم أخف ونشاط أكبر</span>
            </h1>
          )}
          <p className={styles.lead}>
            {lead ||
              "كبسولات HHS A1 L-Carnitine Lepidium، مكمل غذائي عشبي تركي بمكونات طبيعية — إل-كارنيتين وعشبة الليبيديوم — يساعد على دعم فقدان الوزن، تحسين عملية التمثيل الغذائي، وزيادة مستويات الطاقة."}
          </p>
          <div className={styles.cnHeroCtas}>
            <button type="button" className={styles.cnBtn} onClick={onOrder}>
              🛒 اطلبيه الآن
            </button>
            <a
              className={styles.cnBtnGhost}
              href="#product"
              style={{ background: "rgba(255,255,255,.08)", borderColor: "rgba(255,255,255,.25)", color: "#fff" }}
            >
              تفاصيل المنتج
            </a>
          </div>
          <div className={styles.cnTrust}>
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
          <div className={styles.cnSpot}>
            <span className={styles.cnSpotSeal}>100% طبيعي</span>
            <div className={styles.cnSpotVisual}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.image}
                alt={product.title}
                className={styles.cnSpotProduct}
              />
            </div>
            <div className={styles.cnSpotBrand}>{product.brand}</div>
            <div className={styles.cnSpotTitle}>{product.title}</div>
            <div className={styles.cnSpotBadges}>
              <span className={styles.cnSpotBadge}>🌿 إل-كارنيتين + ليبيديوم</span>
              <span className={styles.cnSpotBadge}>⚡ طاقة ونشاط</span>
              <span className={styles.cnSpotBadge}>{product.size}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

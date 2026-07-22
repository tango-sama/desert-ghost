import { SUNGUARD_PRODUCT } from "./product";
import styles from "./sunguard.module.css";

// The hero visual is an illustrated spotlight card (sun icon, brand, SPF
// badge) rather than a product photo — no clean studio shot of this
// product exists yet in the codebase (see progress-tracker.md).
function SunIcon() {
  return (
    <svg className={styles.sgSpotSun} viewBox="0 0 100 100" fill="none">
      <defs>
        <radialGradient id="sgSun" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#FFE9A8" />
          <stop offset="55%" stopColor="var(--gold)" />
          <stop offset="100%" stopColor="#C97A3D" />
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
          fill="#FFE9A8"
          opacity="0.85"
          transform={`rotate(${i * 30} 50 50)`}
        />
      ))}
      <circle cx="50" cy="50" r="26" fill="url(#sgSun)" />
    </svg>
  );
}

export function Hero({ onOrder, ref }: { onOrder: () => void; ref: React.Ref<HTMLElement> }) {
  return (
    <section className={styles.sgHero} ref={ref}>
      <div className={styles.sgBubble} style={{ width: 180, height: 180, top: "6%", left: "6%" }} />
      <div className={styles.sgBubble} style={{ width: 110, height: 110, top: "64%", left: "14%", animationDelay: "2s" }} />
      <div className={styles.sgBubble} style={{ width: 140, height: 140, top: "12%", left: "82%", animationDelay: "1.2s" }} />
      <div className={styles.sgHeroInner}>
        <div>
          <span className={styles.sgEyebrow}>🍉 حماية فيزيائية وكيميائية 3D Aura</span>
          <h1>
            بشرتكِ تستحق <span>حماية قصوى</span> من الشمس
          </h1>
          <p className="lead">
            واقي شمس بطعم البطيخ والبرتقال، SPF50+ PA++++، يحمي بشرتكِ من الأشعة فوق البنفسجية ويمنع التصبغات
            والحروق وعلامات الشيخوخة المبكرة — بملمس خفيف غير دهني.
          </p>
          <div className={styles.sgHeroCtas}>
            <button type="button" className={styles.sgBtn} onClick={onOrder}>
              🛒 اطلبيه الآن
            </button>
            <a
              className={styles.sgBtnGhost}
              href="#product"
              style={{ background: "rgba(255,255,255,.08)", borderColor: "rgba(255,255,255,.25)", color: "#fff" }}
            >
              تفاصيل المنتج
            </a>
          </div>
          <div className={styles.sgTrust}>
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
          <div className={styles.sgSpot}>
            <span className={styles.sgSpotSpf}>SPF 50+ PA++++</span>
            <SunIcon />
            <div className={styles.sgSpotBrand}>{SUNGUARD_PRODUCT.brand}</div>
            <div className={styles.sgSpotTitle}>{SUNGUARD_PRODUCT.title}</div>
            <div className={styles.sgSpotBadges}>
              <span className={styles.sgSpotBadge}>🍉 بطعم البطيخ</span>
              <span className={styles.sgSpotBadge}>💧 خفيف وغير دهني</span>
              <span className={styles.sgSpotBadge}>{SUNGUARD_PRODUCT.size}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

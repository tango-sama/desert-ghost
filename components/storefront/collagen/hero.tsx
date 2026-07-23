import type { LandingHeroContent } from "@/lib/firebase";
import styles from "./collagen.module.css";

// React 19: ref is accepted as a plain prop (no forwardRef needed) — the
// parent measures this section's height to decide when the sticky mobile
// order bar should appear.
export function Hero({
  onOrder,
  ref,
  content,
}: {
  onOrder: () => void;
  ref: React.Ref<HTMLElement>;
  content?: LandingHeroContent;
}) {
  const title = content?.title?.trim();
  const lead = content?.lead?.trim();
  return (
    <section className={styles.clHero} ref={ref}>
      <div className={styles.clBubble} style={{ width: 180, height: 180, top: "6%", left: "6%" }} />
      <div className={styles.clBubble} style={{ width: 110, height: 110, top: "64%", left: "14%", animationDelay: "2s" }} />
      <div className={styles.clBubble} style={{ width: 140, height: 140, top: "12%", left: "82%", animationDelay: "1.2s" }} />
      <div className={styles.clHeroInner}>
        <div>
          <span className={styles.clEyebrow}>✨ مكوّن الجمال الأول عالمياً</span>
          {/* admin-edited title loses the gradient-highlighted word — plain
              text is a fair trade-off for editability (see admin's
              landing-pages-view.tsx) */}
          {title ? (
            <h1>{title}</h1>
          ) : (
            <h1>
              جمالكِ <span>يبدأ من الداخل</span> مع الكولاجين
            </h1>
          )}
          <p className="lead">
            {lead ||
              "أربع تركيبات كولاجين مختارة بعناية — بودرة وكبسولات — لبشرة أكثر نضارة، شعر أقوى وأقل تساقطاً، أظافر صحية، ومفاصل أكثر مرونة."}
          </p>
          <div className={styles.clHeroCtas}>
            <button type="button" className={styles.btnGold} onClick={onOrder}>
              🛒 اطلبي الآن
            </button>
            <a
              className={styles.btnGhost}
              href="#products"
              style={{ background: "rgba(255,255,255,.08)", borderColor: "rgba(255,255,255,.25)", color: "#fff" }}
            >
              تصفّحي المنتجات الأربعة
            </a>
          </div>
          <div className={styles.clTrust}>
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
        <div className={styles.clHeroVisual}>
          <div className={styles.clVcard}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/collagen/vp-marine.webp" alt="Vital Proteins Marine Collagen" />
          </div>
          <div className={styles.clVcard}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/collagen/neocell-tablets.webp" alt="NeoCell Grassfed Collagen Peptides" />
          </div>
          <div className={styles.clVcard}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/collagen/vp-peptides.webp" alt="Vital Proteins Collagen Peptides" />
          </div>
          <div className={styles.clVcard}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/collagen/neocell-marine.webp" alt="NeoCell Marine Collagen + Hyaluronic Acid" />
          </div>
        </div>
      </div>
    </section>
  );
}

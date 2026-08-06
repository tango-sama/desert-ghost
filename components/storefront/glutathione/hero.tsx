import type { LandingHeroContent } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import type { GLUTATHIONE_PRODUCT, GIFT_SOAP } from "./product";
import { FormulaVisual } from "./formula-visual";
import styles from "./glutathione.module.css";

// Restyled (2026-07-26) to match an owner-provided reference built for
// this exact product: deep navy background matching the real Life
// Extension bottle branding, a two-tone headline (white + gold line),
// and a real free-gift callout (see product.ts — GIFT_SOAP is a real
// catalog item, not a fabricated offer). No star-rating graphic or
// customer-count claim — this store has no real review data to back
// that up (see progress-tracker.md).
//
// 2026-08-06, structural swap (owner request): the hero's second column
// no longer shows the floating product card — it now shows the formula
// section's visual (ingredient orbit diagram, or the admin's
// `formulaImage` picture) via <FormulaVisual>, passed down as
// `formulaImage`. The floating card itself moved to its own section
// (product-spot-section.tsx), right after Benefits. This also retires
// the hero's own photo override (`content.image`, formerly this
// component's default photo) — there's no photo slot left in the hero to
// override; the admin field itself is untouched (shared type with
// sunguard/collagen) but has no visible effect here anymore.
//
// 2026-08-06, same-day follow-up: owner circled a screenshot of that
// visual sitting as a rounded, shadowed "card" with hero-navy showing
// around it and asked for it to fill its whole slot instead — no visible
// background, no floating-card look, edge-to-edge. `glHeroVisualCol`
// stretches that column to the full row height (see glutathione.module.css)
// so `FormulaVisual`'s image/card can fill it completely instead of
// sitting inset and center-aligned.
//
// 2026-08-06, second follow-up: owner went further — not just filling its
// own column, but becoming the whole section's background, literally
// full. When `formulaImage` is set, it's now applied as the section's
// `background-image` (with a dark overlay for text legibility) and the
// second grid column disappears entirely — text becomes the only column,
// full-bleed image behind it. The orbit-diagram fallback (no
// `formulaImage` set) is unchanged: still its own column via
// `FormulaVisual`, navy gradient background as before.
export function Hero({
  onOrder,
  ref,
  product,
  gift,
  content,
  formulaImage,
}: {
  onOrder: () => void;
  ref: React.Ref<HTMLElement>;
  product: typeof GLUTATHIONE_PRODUCT;
  gift: typeof GIFT_SOAP;
  content?: LandingHeroContent;
  formulaImage?: string;
}) {
  const title = content?.title?.trim();
  const lead = content?.lead?.trim();
  const bgImage = formulaImage?.trim();
  return (
    <section
      className={cn(styles.glHero, bgImage && styles.glHeroWithBg)}
      style={
        bgImage
          ? {
              backgroundImage: `linear-gradient(to left, rgba(6, 13, 28, 0.93) 0%, rgba(6, 13, 28, 0.8) 45%, rgba(6, 13, 28, 0.55) 100%), url(${bgImage})`,
            }
          : undefined
      }
      ref={ref}
    >
      <div className={styles.glHeroRay} />
      <div className={cn(styles.glHeroInner, bgImage && styles.glHeroInnerSingle)}>
        <div className={bgImage ? styles.glHeroTextOnly : undefined}>
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
        {!bgImage && (
          <div className={styles.glHeroVisualCol}>
            <FormulaVisual product={product} />
          </div>
        )}
      </div>
    </section>
  );
}

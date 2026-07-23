"use client";

import { cn } from "@/lib/utils";
import { RevealRoot } from "@/components/storefront/reveal-root";
import type { CollagenProduct } from "./products";
import { moneyFmt } from "./products";
import styles from "./collagen.module.css";

export function ProductsSection({
  products,
  onPick,
}: {
  products: CollagenProduct[];
  onPick: (id: string) => void;
}) {
  return (
    <RevealRoot>
      <section className={`${styles.clSec} reveal`} id="products">
        <div className={styles.clSecHead}>
          <span className={styles.clLabel}>مجموعتنا المختارة</span>
          <h2 className={styles.clTitle}>اختاري الكولاجين المناسب لكِ</h2>
          <div className={styles.clUnderline} />
          <p className={styles.clSub}>
            أربع تركيبات كولاجين عالمية موثوقة، وكخطوةٍ أخيرة: جلوتاثيون للتفتيح وتوحيد لون البشرة — عرض خاص لبشرة
            موحّدة ومشرقة.
          </p>
        </div>
        <div className={styles.clProducts}>
          {products.map((p) => (
            <div
              key={p.id}
              className={cn(styles.clProw, p.special && styles.clProwSpecial)}
              style={{ "--pc": p.color, "--pc-soft": p.soft } as React.CSSProperties}
            >
              {p.badge && <div className={styles.prRibbon}>{p.badge}</div>}
              <div>
                <div className={styles.prBrand}>{p.brand}</div>
                <h3>{p.title}</h3>
                <p className={styles.prHeadline}>{p.headline}</p>
                <div className={styles.prIcons}>
                  {p.icons.map(([ic, label]) => (
                    <div className={styles.prIcon} key={label}>
                      <div className={styles.piIc}>{ic}</div>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                <ul className={styles.prBullets}>
                  {p.bullets.map((b) => (
                    <li key={b}>
                      <b>✓</b>
                      {b}
                    </li>
                  ))}
                </ul>
                <div className={styles.prFoot}>
                  <span className={styles.prPrice}>
                    {moneyFmt(p.price)}
                    {p.offerNote && <small className={styles.prOffer}>{p.offerNote}</small>}
                  </span>
                  <button type="button" className={styles.prBtn} onClick={() => onPick(p.id)}>
                    🛒 اطلبي الآن
                  </button>
                  <div className={styles.prMini}>
                    <span>💵 الدفع عند الاستلام</span>
                    <span>🚚 توصيل لكل الولايات</span>
                  </div>
                </div>
              </div>
              <div className={styles.prImgwrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt={p.title} loading="lazy" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </RevealRoot>
  );
}

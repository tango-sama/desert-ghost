import { RevealRoot } from "@/components/storefront/reveal-root";
import type { GIFT_SOAP } from "./product";
import styles from "./glutathione.module.css";

// Free-gift detail section — GIFT_SOAP is a real catalog product
// (Firestore products/1768441716115) the owner is genuinely bundling
// with every /glutathione order (see product.ts). Bullet copy summarizes
// that product's real Firestore description, not invented claims.
export function Gift({ gift }: { gift: typeof GIFT_SOAP }) {
  return (
    <RevealRoot>
      <section className={`${styles.glSec} ${styles.glGift} reveal`}>
        <div className={styles.glGiftInner}>
          <div>
            <div className={styles.glGiftKicker}>🎁 هدية مجانية</div>
            <h2>{gift.title} مع كل طلب</h2>
            <ul className={styles.glCheckList}>
              <li>
                <b>✓</b>
                يفتّح ويوحّد لون البشرة بفضل الجلوتاثيون ومستخلصات الأرز
              </li>
              <li>
                <b>✓</b>
                ينظف المسام بعمق ويساعد في تقليل حب الشباب وآثاره
              </li>
              <li>
                <b>✓</b>
                يرطّب ويغذّي البشرة بالكولاجين وزيت جوز الهند
              </li>
              <li>
                <b>✓</b>
                تركيبة لطيفة مناسبة للاستخدام اليومي على جميع أنواع البشرة
              </li>
            </ul>
          </div>
          <div className={styles.glGiftVisual}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={gift.image} alt={gift.title} />
          </div>
        </div>
      </section>
    </RevealRoot>
  );
}

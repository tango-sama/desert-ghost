import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./offer.module.css";

// Every claim here is one the shop actually keeps, and none of them is about
// the product — which is what lets this same strip sit under all 149 of them.
const ITEMS = [
  {
    ic: "💵",
    t: "الدفع عند الاستلام",
    p: "لا تدفعين دينـاراً واحداً قبل أن يصلكِ الطرد بين يديكِ وتريه بعينيكِ.",
  },
  {
    ic: "🚚",
    t: "توصيل 58 ولاية",
    p: "إلى باب المنزل أو إلى مكتب التوصيل — أنتِ تختارين، وتكلفة التوصيل تظهر قبل التأكيد.",
  },
  {
    ic: "✅",
    t: "منتجات أصلية",
    p: "نبيع ما نعرف مصدره. لا تقليد، ولا عبوات بلا علامة.",
  },
  {
    ic: "📞",
    t: "تأكيد قبل الإرسال",
    p: "نتصل بكِ لتأكيد الطلب والعنوان قبل أن يخرج الطرد، ويمكنكِ الإلغاء وقتها.",
  },
];

export function TrustStrip() {
  return (
    <RevealRoot>
      <section className={`${styles.sec} reveal`}>
        <span className={styles.label}>لماذا تطلبين منّا</span>
        <h2 className={styles.h2}>الطلب بلا مخاطرة</h2>
        <div className={styles.underline} />
        <div className={styles.trustGrid}>
          {ITEMS.map((it) => (
            <div className={styles.trustCard} key={it.t}>
              <span aria-hidden>{it.ic}</span>
              <b>{it.t}</b>
              <p>{it.p}</p>
            </div>
          ))}
        </div>
      </section>
    </RevealRoot>
  );
}

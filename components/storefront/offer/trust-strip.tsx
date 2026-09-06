import { RevealRoot } from "@/components/storefront/reveal-root";
import { CashIcon, PhoneIcon, ShieldIcon, TruckIcon } from "./icons";
import styles from "./offer.module.css";

// Every claim here is one the shop actually keeps, and none of them is about
// the product — which is what lets this same strip sit under all 149 of them.
//
// The icons are drawn (see icons.tsx), not typed: 💵 🚚 ✅ 📞 rendered as four
// different illustration styles from four different vendors, at four apparent
// weights, in the one place on the page whose whole job is looking dependable.
const ITEMS = [
  {
    Icon: CashIcon,
    t: "الدفع عند الاستلام",
    p: "لا تدفعين دينـاراً واحداً قبل أن يصلكِ الطرد بين يديكِ وتريه بعينيكِ.",
  },
  {
    Icon: TruckIcon,
    t: "توصيل 58 ولاية",
    p: "إلى باب المنزل أو إلى مكتب التوصيل — أنتِ تختارين، وتكلفة التوصيل تظهر قبل التأكيد.",
  },
  {
    Icon: ShieldIcon,
    t: "منتجات أصلية",
    p: "نبيع ما نعرف مصدره. لا تقليد، ولا عبوات بلا علامة.",
  },
  {
    Icon: PhoneIcon,
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
          {ITEMS.map(({ Icon, t, p }) => (
            <div className={styles.trustCard} key={t}>
              <Icon />
              <b>{t}</b>
              <p>{p}</p>
            </div>
          ))}
        </div>
      </section>
    </RevealRoot>
  );
}

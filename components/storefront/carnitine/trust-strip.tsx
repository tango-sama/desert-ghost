import styles from "./carnitine.module.css";

const ITEMS = [
  { ic: "🚚", t: "توصيل سريع لكافة الولايات" },
  { ic: "💵", t: "الدفع عند الاستلام" },
  { ic: "🔒", t: "طلب آمن ومضمون" },
  { ic: "🏅", t: "منتج أصلي 100%" },
  { ic: "🎧", t: "خدمة عملاء متاحة" },
];

export function TrustStrip() {
  return (
    <div className={styles.cnTrustStrip}>
      {ITEMS.map((it) => (
        <span className={styles.cnTrustItem} key={it.t}>
          <span className={styles.ic}>{it.ic}</span>
          {it.t}
        </span>
      ))}
    </div>
  );
}

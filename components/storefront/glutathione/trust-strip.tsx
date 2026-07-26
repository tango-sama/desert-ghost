import styles from "./glutathione.module.css";

const ITEMS = [
  { ic: "🚚", t: "توصيل سريع لكافة الولايات" },
  { ic: "💵", t: "الدفع عند الاستلام" },
  { ic: "🔒", t: "طلب آمن ومضمون" },
  { ic: "🏅", t: "منتج أصلي 100%" },
  { ic: "🎧", t: "خدمة عملاء متاحة" },
];

export function TrustStrip() {
  return (
    <div className={styles.glTrustStrip}>
      {ITEMS.map((it) => (
        <span className={styles.glTrustItem} key={it.t}>
          <span className={styles.ic}>{it.ic}</span>
          {it.t}
        </span>
      ))}
    </div>
  );
}

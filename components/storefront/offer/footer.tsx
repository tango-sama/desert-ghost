import styles from "./offer.module.css";

export function Footer({ storeName }: { storeName: string }) {
  return (
    <footer className={styles.footer}>
      <p>
        {storeName} — منتجات أصلية، الدفع عند الاستلام، توصيل لكل الولايات الـ58.
      </p>
      <p>
        هذه الصفحة معلومات تعريفية عن المنتج ولا تُغني عن استشارة الطبيب أو
        الصيدلي، خاصة للحوامل والمرضعات ومن يتناولن دواءً بوصفة.
      </p>
    </footer>
  );
}

import Link from "next/link";
import styles from "./carnitine.module.css";

export function Footer() {
  return (
    <footer className={styles.cnFooter}>
      <p>
        © {new Date().getFullYear()} كبسولات تنحيف الجسم — Desert Shop · <Link href="/">العودة للمتجر الرئيسي</Link>
      </p>
    </footer>
  );
}

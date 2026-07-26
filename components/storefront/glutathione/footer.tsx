import Link from "next/link";
import styles from "./glutathione.module.css";

export function Footer() {
  return (
    <footer className={styles.glFooter}>
      <p>
        © {new Date().getFullYear()} جلوتاثيون للتفتيح — Desert Shop · <Link href="/">العودة للمتجر الرئيسي</Link>
      </p>
    </footer>
  );
}

import Link from "next/link";
import styles from "./collagen.module.css";

export function Footer() {
  return (
    <footer className={styles.clFooter}>
      <p>
        © {new Date().getFullYear()} جمالكِ الخارجي — Desert Shop · <Link href="/">العودة للمتجر الرئيسي</Link>
      </p>
    </footer>
  );
}

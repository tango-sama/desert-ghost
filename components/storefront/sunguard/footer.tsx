import Link from "next/link";
import styles from "./sunguard.module.css";

export function Footer() {
  return (
    <footer className={styles.sgFooter}>
      <p>
        © {new Date().getFullYear()} واقي الشمس المائي — Desert Shop · <Link href="/">العودة للمتجر الرئيسي</Link>
      </p>
    </footer>
  );
}

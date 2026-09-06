import { RevealRoot } from "@/components/storefront/reveal-root";
import type { FaqItem } from "@/lib/landing-content";
import styles from "./offer.module.css";

// Native <details>, not a JS accordion: it opens without hydration, it is
// keyboard- and screen-reader-correct for free, and on a page whose length
// varies with the number of products chosen there is no layout measurement to
// get wrong.
//
// Ruled rows rather than a stack of bordered boxes — a question is a line in a
// list, not a card — and the marker is drawn from two spans so the vertical
// bar can rotate away on open. A typographic "+" swapped for a "−" cannot.
export function Faq({ items }: { items: FaqItem[] }) {
  if (!items.length) return null;
  return (
    <RevealRoot>
      <section className={`${styles.sec} reveal`}>
        <span className={styles.label}>أسئلة شائعة</span>
        <h2 className={styles.h2}>أسئلة تُطرح علينا كثيراً</h2>
        <div className={styles.underline} />
        <div className={styles.faq}>
          {items.map((f, i) => (
            <details className={styles.faqItem} key={`${f.q}-${i}`}>
              <summary>
                {f.q}
                <span className={styles.faqSign} aria-hidden />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </RevealRoot>
  );
}

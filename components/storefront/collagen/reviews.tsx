"use client";

import { useEffect, useRef } from "react";
import styles from "./collagen.module.css";

const REVIEWS = [
  { stars: 5, text: "بعد شهر من الاستعمال اليومي لاحظت فرقاً واضحاً في نضارة بشرتي، حتى صديقاتي سألوني ماذا أستعمل! المنتج أصلي والنتيجة حقيقية.", initial: "أ", color: "#2F8F9D", name: "أمينة ب.", where: "الجزائر العاصمة" },
  { stars: 5, text: "كان شعري يتساقط بكثرة بعد الولادة، ومع الكولاجين والبيوتين قلّ التساقط كثيراً وبدأ يطلع لي شعر جديد. راضية جداً.", initial: "خ", color: "#D6336C", name: "خديجة م.", where: "وهران" },
  { stars: 4, text: "أظافري كانت تتكسر من أقل شيء، الآن صارت أقوى بكثير. النتيجة احتاجت صبراً لكنها تستحق.", initial: "س", color: "#7C5CBF", name: "سارة ل.", where: "سطيف" },
  { stars: 5, text: "طلبته لأمي لآلام الركبة، وبعد شهرين قالت لي إنها تحس بمرونة أكثر في الحركة وقلّ التعب. شكراً لكم على الجدية.", initial: "ف", color: "#1B6FA8", name: "فاطمة الزهراء", where: "قسنطينة" },
  { stars: 5, text: "البودرة بدون طعم نهائياً، أذوّبها في قهوتي كل صباح ولا أحس بها. أفضل طريقة لروتين جمال يومي سهل.", initial: "ل", color: "#2E86C1", name: "ليندة ع.", where: "تيزي وزو" },
  { stars: 5, text: "التوصيل وصلني في يومين فقط والدفع عند الاستلام، تعامل راقٍ واحترافي. سأطلب مرة أخرى إن شاء الله.", initial: "ن", color: "#12A150", name: "نسرين ط.", where: "البليدة" },
  { stars: 5, text: "هذه ثاني علبة أطلبها، النتيجة على بشرتي ومفاصلي واضحة وما عدت أستغني عنه. منتج أصلي ١٠٠٪.", initial: "ح", color: "#C0392B", name: "حنان ك.", where: "عنابة" },
  { stars: 4, text: "جربت أنواعاً كثيرة قبله، هذا أول واحد أحس معه بفرق حقيقي في كثافة الشعر. التغليف كان ممتازاً أيضاً.", initial: "إ", color: "#B7791F", name: "إيمان ر.", where: "ورقلة" },
  { stars: 5, text: "بشرتي صارت مشرقة أكثر والخطوط الرفيعة حول عيني خفّت. أنصح كل واحدة تبدأ من اليوم ولا تنتظر.", initial: "م", color: "#155F68", name: "مريم د.", where: "بجاية" },
];

export function Reviews() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    Array.from(grid.children).forEach((c, i) => {
      (c as HTMLElement).style.transitionDelay = `${i * 90}ms`;
    });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      grid.classList.add(styles.inview);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          grid.classList.add(styles.inview);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -120px 0px" }
    );
    io.observe(grid);
    return () => io.disconnect();
  }, []);

  return (
    <section className={styles.clSec} id="reviews">
      <div className={styles.clSecHead}>
        <span className={styles.clLabel}>آراء زبوناتنا</span>
        <h2 className={styles.clTitle}>زبونات سعيدات بالنتائج 💚</h2>
        <div className={styles.clUnderline} />
        <p className={styles.clSub}>تجارب حقيقية من زبونات طلبنَ الكولاجين ووصلهنّ حتى باب المنزل.</p>
      </div>
      <div className={styles.clReviews} ref={gridRef}>
        {REVIEWS.map((r, i) => (
          <div className={styles.clReview} key={i}>
            <div className={styles.stars}>{"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}</div>
            <p>{r.text}</p>
            <div className={styles.who}>
              <span className={styles.av} style={{ background: r.color }}>
                {r.initial}
              </span>
              <span>
                <span className={styles.wn}>{r.name}</span>
                <span className={styles.ww}>{r.where}</span>
              </span>
              <span className={styles.vb}>✓ شراء موثّق</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

import { RevealRoot } from "@/components/storefront/reveal-root";
import { BeforeAfterCard } from "./care-routine";
import styles from "./glutathione.module.css";

// Standalone before/after section (2026-08-06, owner request) — split off
// CareRoutine's left column so a new 3D-model section could be slotted in
// right after it, before UsageSection (see product-3d-section.tsx,
// usage-section.tsx, and care-routine.tsx for the shared BeforeAfterCard).
export function BeforeAfterSection() {
  return (
    <RevealRoot>
      <section className={`${styles.glSec} ${styles.glCare} reveal`}>
        <div className={`${styles.glCareCol} ${styles.glCareSolo}`}>
          <h2>تمتعي ببشرة أكثر ثقة كل يوم</h2>
          <p>العناية اليومية والمنتظمة هي سر البشرة الصحية.</p>
          <BeforeAfterCard />
          <p className={styles.glBaNote}>
            الصور توضيحية لغرض المقارنة وليست صوراً حقيقية لعملاء — النتائج الفعلية تختلف حسب
            الاستخدام المنتظم ونمط الحياة.
          </p>
        </div>
      </section>
    </RevealRoot>
  );
}

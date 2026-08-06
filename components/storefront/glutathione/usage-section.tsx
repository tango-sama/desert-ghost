import { RevealRoot } from "@/components/storefront/reveal-root";
import { USAGE_STEPS } from "./care-routine";
import styles from "./glutathione.module.css";

// Standalone usage-steps section (2026-08-06, owner request) — split off
// CareRoutine's right column so a new 3D-model section could be slotted
// in right before it, after BeforeAfterSection (see
// product-3d-section.tsx and care-routine.tsx for the shared
// USAGE_STEPS data).
export function UsageSection() {
  return (
    <RevealRoot>
      <section className={`${styles.glSec} ${styles.glCare} reveal`}>
        <div className={`${styles.glCareCol} ${styles.glCareSolo}`}>
          <h2>طريقة الاستخدام</h2>
          <p>خطوات بسيطة لدمج التركيبة والهدية في روتينكِ اليومي.</p>
          <div className={styles.glUsageList}>
            {USAGE_STEPS.map((s, i) => (
              <div className={styles.glUsageRow} key={i}>
                <span className={styles.glUsageIc}>{s.ic}</span>
                <p>{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </RevealRoot>
  );
}

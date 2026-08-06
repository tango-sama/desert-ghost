import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./glutathione.module.css";

// Empty, picture-only section right after the hero (2026-08-06, owner
// request, after a few earlier same-day iterations that put this same
// `formulaImage` picture inside the hero itself — as a foreground column
// image, then as the hero's own background with text overlaid on top;
// see progress-tracker.md for that history). The owner asked for it out
// of the hero entirely: its own section, the picture as that section's
// CSS background, nothing else in it — no text, no buttons, no overlay,
// so the picture is the only thing visible.
export function FormulaBackgroundSection({ image }: { image?: string }) {
  const src = image?.trim();
  if (!src) return null;

  return (
    <RevealRoot>
      <section className={`${styles.glPictureBreak} reveal`} style={{ backgroundImage: `url(${src})` }} />
    </RevealRoot>
  );
}

import { RevealRoot } from "@/components/storefront/reveal-root";
import styles from "./glutathione.module.css";

// Standalone, picture-only section (2026-08-06, owner request) — sits
// right before Benefits. Admin-uploaded via `bannerImage`, no built-in
// fallback design: renders nothing when unset, since there's no sensible
// default for "just a picture." Full-bleed, edge-to-edge, no card
// styling — the same "no boundaries" treatment the owner asked for on
// the hero's own background (see hero.tsx).
export function BannerSection({ image }: { image?: string }) {
  const src = image?.trim();
  if (!src) return null;

  return (
    <RevealRoot>
      <section className={`${styles.glBanner} reveal`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className={styles.glBannerImage} />
      </section>
    </RevealRoot>
  );
}

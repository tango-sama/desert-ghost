"use client";

import { useEffect, useRef, useState } from "react";
import type { SiteSettings } from "@/lib/firebase";
import { useDeliveryData } from "@/hooks/use-delivery-data";
import { TikTokLiveButton } from "@/components/storefront/tiktok-live-button";
import { Topbar } from "@/components/storefront/glutathione/topbar";
import { Benefits } from "@/components/storefront/glutathione/benefits";
import { Formula } from "@/components/storefront/glutathione/formula";
import { Gift } from "@/components/storefront/glutathione/gift";
import { CareRoutine } from "@/components/storefront/glutathione/care-routine";
import { ProductSection } from "@/components/storefront/glutathione/product-section";
import { TrustStrip } from "@/components/storefront/glutathione/trust-strip";
import { Faq } from "@/components/storefront/glutathione/faq";
import { CtaBanner } from "@/components/storefront/glutathione/cta-banner";
import { Footer } from "@/components/storefront/glutathione/footer";
import { StickyBar } from "@/components/storefront/glutathione/sticky-bar";
import { OrderModal } from "@/components/storefront/glutathione/order-modal";
import { GLUTATHIONE_PRODUCT, GIFT_SOAP } from "@/components/storefront/glutathione/product";
import styles from "@/components/storefront/glutathione/glutathione.module.css";
import { Hero } from "./hero";

// A separate, self-contained variant of /glutathione (architecture-context.md
// funnel pattern) that swaps only the hero's static bottle photo for an
// interactive 3D model (gluta-3d.glb) — every other section, all copy, the
// gift offer, and the order flow are the exact same components the live
// /glutathione page uses, imported directly rather than duplicated, so the
// two pages can never drift out of sync on anything except the hero visual.
// Deliberately not wired into `settings.landingPages` (no admin-editable
// hero/product override, no custom-slug redirect) — this is a standalone
// A/B variant, same "build the page first" scope call made for the other
// funnels' initial builds (see progress-tracker.md).
export function Glutathione3DPage({
  settings,
  isTikTokLive,
}: {
  settings: SiteSettings;
  isTikTokLive: boolean;
}) {
  const cache = useDeliveryData();
  const heroRef = useRef<HTMLElement>(null);
  const [topScrolled, setTopScrolled] = useState(false);
  const [stickyShow, setStickyShow] = useState(false);

  useEffect(() => {
    function onScroll() {
      setTopScrolled(window.scrollY > 30);
      const heroH = heroRef.current?.offsetHeight ?? 0;
      setStickyShow(window.scrollY > heroH * 0.8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [modalOpen, setModalOpen] = useState(false);
  const product = GLUTATHIONE_PRODUCT;

  return (
    <div className={styles.glutathione} dir="rtl">
      <Topbar scrolled={topScrolled} />
      <Hero ref={heroRef} onOrder={() => setModalOpen(true)} product={product} gift={GIFT_SOAP} />
      <Benefits />
      <Formula />
      <Gift gift={GIFT_SOAP} />
      <CareRoutine />
      <ProductSection onOrder={() => setModalOpen(true)} product={product} />
      <TrustStrip />
      <Faq />
      <CtaBanner onOrder={() => setModalOpen(true)} />
      <Footer />
      <TikTokLiveButton settings={settings} isLive={isTikTokLive} />
      <StickyBar show={stickyShow} onOrder={() => setModalOpen(true)} />
      <OrderModal
        open={modalOpen}
        settings={settings}
        cache={cache}
        product={product}
        gift={GIFT_SOAP}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

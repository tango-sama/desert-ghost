"use client";

import { useEffect, useRef, useState } from "react";
import type { SiteSettings } from "@/lib/firebase";
import { useDeliveryData } from "@/hooks/use-delivery-data";
import { TikTokLiveButton } from "@/components/storefront/tiktok-live-button";
import { Topbar } from "./topbar";
import { Hero } from "./hero";
import { Benefits } from "./benefits";
import { Formula } from "./formula";
import { Gift } from "./gift";
import { CareRoutine } from "./care-routine";
import { ProductSection } from "./product-section";
import { TrustStrip } from "./trust-strip";
import { Faq } from "./faq";
import { CtaBanner } from "./cta-banner";
import { Footer } from "./footer";
import { StickyBar } from "./sticky-bar";
import { OrderModal } from "./order-modal";
import { GLUTATHIONE_PRODUCT, GIFT_SOAP } from "./product";
import styles from "./glutathione.module.css";

// Section order matches the owner's reference mockup: hero, benefits
// strip, ingredient-formula split, free-gift detail, before/after +
// usage, product/order card, trust strip, FAQ, final CTA.
export function GlutathionePage({
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

  return (
    <div className={styles.glutathione} dir="rtl">
      <Topbar scrolled={topScrolled} />
      <Hero ref={heroRef} onOrder={() => setModalOpen(true)} product={GLUTATHIONE_PRODUCT} gift={GIFT_SOAP} />
      <Benefits />
      <Formula product={GLUTATHIONE_PRODUCT} />
      <Gift gift={GIFT_SOAP} />
      <CareRoutine />
      <ProductSection onOrder={() => setModalOpen(true)} product={GLUTATHIONE_PRODUCT} />
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
        product={GLUTATHIONE_PRODUCT}
        gift={GIFT_SOAP}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

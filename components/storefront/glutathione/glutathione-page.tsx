"use client";

import { useEffect, useRef, useState } from "react";
import type { SiteSettings } from "@/lib/firebase";
import { useDeliveryData } from "@/hooks/use-delivery-data";
import { TikTokLiveButton } from "@/components/storefront/tiktok-live-button";
import { Topbar } from "./topbar";
import { Hero } from "./hero";
import { Problems } from "./problems";
import { Science } from "./science";
import { Benefits } from "./benefits";
import { ProductSection } from "./product-section";
import { HowItWorks } from "./how-it-works";
import { CtaBanner } from "./cta-banner";
import { Footer } from "./footer";
import { StickyBar } from "./sticky-bar";
import { OrderModal } from "./order-modal";
import { GLUTATHIONE_PRODUCT } from "./product";
import styles from "./glutathione.module.css";

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
      <Hero ref={heroRef} onOrder={() => setModalOpen(true)} product={GLUTATHIONE_PRODUCT} />
      <Problems />
      <Science />
      <Benefits />
      <ProductSection onOrder={() => setModalOpen(true)} product={GLUTATHIONE_PRODUCT} />
      <HowItWorks />
      <CtaBanner onOrder={() => setModalOpen(true)} />
      <Footer />
      <TikTokLiveButton settings={settings} isLive={isTikTokLive} />
      <StickyBar show={stickyShow} onOrder={() => setModalOpen(true)} />
      <OrderModal
        open={modalOpen}
        settings={settings}
        cache={cache}
        product={GLUTATHIONE_PRODUCT}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

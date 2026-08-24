"use client";

import { useEffect, useRef, useState } from "react";
import type { SiteSettings } from "@/lib/firebase";
import { useDeliveryData } from "@/hooks/use-delivery-data";
import { trackViewContent } from "@/lib/meta-pixel";
import { TikTokLiveButton } from "@/components/storefront/tiktok-live-button";
import { Topbar } from "./topbar";
import { Hero } from "./hero";
import { BeforeAfter } from "./before-after";
import { StoryStack } from "./story-stack";
import { Benefits } from "./benefits";
import { TrustStrip } from "./trust-strip";
import { ProductsSection } from "./products-section";
import { HowItWorks } from "./how-it-works";
import { Reviews } from "./reviews";
import { CtaBanner } from "./cta-banner";
import { Footer } from "./footer";
import { StickyBar } from "./sticky-bar";
import { OrderModal } from "./order-modal";
import { COLLAGEN_PRODUCTS } from "./products";
import styles from "./collagen.module.css";

export function CollagenPage({
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

  // Single shared scroll listener drives both the top bar's blur state and
  // the mobile sticky order bar's reveal threshold.
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
  const [selected, setSelected] = useState<string[]>([]);
  const landing = settings.landingPages?.collagen;
  const products = COLLAGEN_PRODUCTS.map((p, i) => {
    const o = landing?.products?.[i];
    return {
      ...p,
      title: o?.title?.trim() || p.title,
      image: o?.image?.trim() || p.image,
      price: o?.price && o.price > 0 ? o.price : p.price,
    };
  });

  // Fires once per real page view. Ref guard (not just an empty dep array)
  // so this survives Strict Mode's dev-only double-invoke of mount effects —
  // same pattern as glutathione-page.tsx. Unlike the single-SKU landing
  // pages, this page shows multiple products at once, so ViewContent
  // reports all of them (this page's `products` array is rebuilt fresh on
  // every render from the same fixed COLLAGEN_PRODUCTS ids, so firing once
  // on mount rather than keying off it is deliberate, not a missed dep).
  const viewContentFired = useRef(false);
  useEffect(() => {
    if (viewContentFired.current) return;
    viewContentFired.current = true;
    trackViewContent({
      contentIds: products.map((p) => p.id),
      value: products.reduce((sum, p) => sum + p.price, 0),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openOrder(productId?: string) {
    if (productId) setSelected((s) => (s.includes(productId) ? s : [...s, productId]));
    setModalOpen(true);
  }

  return (
    <div className={styles.collagen} dir="rtl">
      <Topbar scrolled={topScrolled} />
      <Hero ref={heroRef} onOrder={() => openOrder()} content={landing?.hero} />
      <BeforeAfter onOrder={() => openOrder()} items={landing?.beforeAfter} />
      <StoryStack />
      <Benefits />
      <TrustStrip />
      <ProductsSection products={products} onPick={(id) => openOrder(id)} />
      <HowItWorks />
      <Reviews />
      <CtaBanner onOrder={() => openOrder()} />
      <Footer />
      <TikTokLiveButton settings={settings} isLive={isTikTokLive} />
      <StickyBar show={stickyShow} onOrder={() => openOrder()} />
      <OrderModal
        open={modalOpen}
        selected={selected}
        setSelected={setSelected}
        settings={settings}
        cache={cache}
        products={products}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

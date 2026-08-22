"use client";

import { useEffect, useRef, useState } from "react";
import type { SiteSettings } from "@/lib/firebase";
import { useDeliveryData } from "@/hooks/use-delivery-data";
import { TikTokLiveButton } from "@/components/storefront/tiktok-live-button";
import { Topbar } from "./topbar";
import { Hero } from "./hero";
import { Problems } from "./problems";
import { Ingredients } from "./ingredients";
import { Benefits } from "./benefits";
import { ProductSection } from "./product-section";
import { UsageSection } from "./usage-section";
import { TrustStrip } from "./trust-strip";
import { Faq } from "./faq";
import { CtaBanner } from "./cta-banner";
import { Footer } from "./footer";
import { StickyBar } from "./sticky-bar";
import { OrderModal } from "./order-modal";
import { CARNITINE_PRODUCT } from "./product";
import styles from "./carnitine.module.css";

// Section order: hero, problems (why weight loss stalls), ingredients
// (the two real actives), benefits, product/order card, usage steps, trust
// strip, FAQ, final CTA — same funnel shape as sunguard's simpler
// single-SKU page (no 3D/gift sections, no before/after slider since no
// real customer transformation photos exist for this product).
export function CarnitinePage({
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
  const landing = settings.landingPages?.carnitine;
  const override = landing?.product;
  const product = {
    ...CARNITINE_PRODUCT,
    title: override?.title?.trim() || CARNITINE_PRODUCT.title,
    image: override?.image?.trim() || CARNITINE_PRODUCT.image,
    price: override?.price && override.price > 0 ? override.price : CARNITINE_PRODUCT.price,
  };

  return (
    <div className={styles.carnitine} dir="rtl">
      <Topbar scrolled={topScrolled} />
      <Hero ref={heroRef} onOrder={() => setModalOpen(true)} content={landing?.hero} product={product} />
      <Problems />
      <Ingredients />
      <Benefits />
      <ProductSection onOrder={() => setModalOpen(true)} product={product} />
      <UsageSection />
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
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

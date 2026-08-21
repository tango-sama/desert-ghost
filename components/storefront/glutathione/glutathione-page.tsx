"use client";

import { useEffect, useRef, useState } from "react";
import type { SiteSettings } from "@/lib/firebase";
import { useDeliveryData } from "@/hooks/use-delivery-data";
import { trackPixelEvent } from "@/lib/meta-pixel";
import { TikTokLiveButton } from "@/components/storefront/tiktok-live-button";
import { Topbar } from "./topbar";
import { Hero } from "./hero";
import { Benefits } from "./benefits";
import { ProductSpotSection } from "./product-spot-section";
import { Formula } from "./formula";
import { Gift } from "./gift";
import { BeforeAfterSection } from "./before-after-section";
import { Product3DSection } from "./product-3d-section";
import { UsageSection } from "./usage-section";
import { ProductSection } from "./product-section";
import { TrustStrip } from "./trust-strip";
import { Faq } from "./faq";
import { CtaBanner } from "./cta-banner";
import { Footer } from "./footer";
import { StickyBar } from "./sticky-bar";
import { OrderModal } from "./order-modal";
import { GLUTATHIONE_PRODUCT, GIFT_SOAP } from "./product";
import styles from "./glutathione.module.css";

// Section order (last touched 2026-08-06, owner request): hero,
// ingredient-formula split (the full-bleed formulaImage picture, when
// set), benefits strip, product spotlight card, free-gift detail,
// before/after slider, 3D model showcase, usage steps, product/order
// card, trust strip, FAQ, final CTA. Diverged from the original
// reference mockup's hero→benefits ordering once the spotlight card
// moved out of the hero (see product-spot-section.tsx) — went through a
// few placements before landing here (Formula right after hero,
// spotlight card right before Gift, Benefits between the two). The
// before/after + usage pair used to be one two-column CareRoutine
// section; split into BeforeAfterSection/UsageSection so the new 3D
// model section could sit between them (see care-routine.tsx,
// product-3d-section.tsx) — /glutathione-3d still uses the original
// combined CareRoutine unchanged.
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
  const landing = settings.landingPages?.glutathione;
  const override = landing?.product;
  // Merged once and threaded everywhere below (hero, formula, product
  // card, order modal) so an admin-edited name/price can never disagree
  // between what's displayed and what's charged at checkout — same fix
  // applied to sunguard/collagen (see progress-tracker.md). The photo is
  // the exception: hero and formula each accept their own independent
  // image override (content.image / formulaImage) that falls back to
  // this shared product.image when blank — image choice doesn't affect
  // what's charged, so there's no consistency risk in letting it vary.
  const product = {
    ...GLUTATHIONE_PRODUCT,
    title: override?.title?.trim() || GLUTATHIONE_PRODUCT.title,
    image: override?.image?.trim() || GLUTATHIONE_PRODUCT.image,
    price: override?.price && override.price > 0 ? override.price : GLUTATHIONE_PRODUCT.price,
  };

  // Fires once per real page view. The ref guard (not just an empty dep
  // array) is what makes this survive Strict Mode's dev-only double-invoke
  // of mount effects — see meta-pixel-route-tracker.tsx for the same
  // pattern applied to PageView. Deliberately keyed off `product.id` alone,
  // not `product`: an admin price override loaded async after this mount
  // must not cause a second ViewContent for the same view.
  const viewContentFired = useRef(false);
  useEffect(() => {
    if (viewContentFired.current) return;
    viewContentFired.current = true;
    trackPixelEvent("ViewContent", {
      content_ids: [product.id],
      content_type: "product",
      content_name: product.title,
      value: product.price,
      currency: "DZD",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  return (
    <div className={styles.glutathione} dir="rtl">
      <Topbar scrolled={topScrolled} />
      <Hero ref={heroRef} onOrder={() => setModalOpen(true)} gift={GIFT_SOAP} content={landing?.hero} />
      <Formula image={landing?.formulaImage} />
      <Benefits />
      <ProductSpotSection product={product} image={landing?.hero?.image} />
      <Gift gift={GIFT_SOAP} />
      <BeforeAfterSection />
      <Product3DSection product={product} />
      <UsageSection />
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

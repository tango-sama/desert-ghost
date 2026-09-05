"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { priceNum, type Product, type SiteSettings } from "@/lib/firebase";
import { useDeliveryData } from "@/hooks/use-delivery-data";
import { trackViewContent } from "@/lib/meta-pixel";
import { funnelSessionId, trackFunnel } from "@/lib/funnel";
import { buildBlocks, STORE_FAQ, STORE_REVIEWS } from "@/lib/landing-content";
import { variantFor, type Answers, type Variant } from "@/lib/quiz";
import { QuizOrderModal } from "@/components/storefront/quiz/order-modal";
import { Topbar } from "./topbar";
import { Hero } from "./hero";
import { ProductBlock } from "./product-block";
import { TrustStrip } from "./trust-strip";
import { Reviews } from "./reviews";
import { SelectionSection } from "./selection-section";
import { Faq } from "./faq";
import { CtaBanner } from "./cta-banner";
import { Footer } from "./footer";
import { StickyBar } from "./sticky-bar";
import styles from "./offer.module.css";

// The quiz funnel's last step: a full landing page built for whatever she
// ended up choosing.
//
// One page, one full section stack per chosen product (owner's call — see
// context/progress-tracker.md), then one order for all of them together. The
// products and the answers arrive in the URL, so this survives a refresh and a
// share and can be verified by loading an address, which the previous
// in-place order modal could not.

// The variant is derived from the funnel session id, exactly as /quiz derives
// it — NOT read from the URL. Two sources of truth for a test arm is how an
// A/B result quietly becomes meaningless: a shared or edited link would report
// a visitor into the arm the link says rather than the arm she actually saw.
// The session id is in localStorage, so it survives the navigation from /quiz
// and the arm matches by construction.
const subscribeNever = () => () => {};
const getVariant = (): Variant => variantFor(funnelSessionId());
const getServerVariant = (): Variant | null => null;

export function OfferPage({
  products,
  answers,
  settings,
}: {
  products: Product[];
  answers: Answers;
  settings: SiteSettings;
}) {
  const cache = useDeliveryData();
  const heroRef = useRef<HTMLElement>(null);
  const [topScrolled, setTopScrolled] = useState(false);
  const [stickyShow, setStickyShow] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Read through useSyncExternalStore rather than an effect: the session id
  // lives in localStorage, which does not exist during the server render.
  // Server snapshot is null, so the first client render matches the server and
  // the variant resolves with no hydration mismatch. Same as quiz-page.tsx.
  const variant = useSyncExternalStore(subscribeNever, getVariant, getServerVariant);

  const blocks = useMemo(() => buildBlocks(products, answers), [products, answers]);
  const total = useMemo(
    () => products.reduce((n, p) => n + priceNum(p.price), 0),
    [products],
  );

  useEffect(() => {
    function onScroll() {
      setTopScrolled(window.scrollY > 30);
      const heroH = heroRef.current?.offsetHeight ?? 0;
      setStickyShow(window.scrollY > heroH * 0.6);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // One arrival event per real page view.
  //
  // Fired HERE and not on the quiz's outgoing tap: this counts arrivals, not
  // departures, so a navigation that never completes is not recorded as one
  // that did, and a direct or shared link is counted the same as a tap through
  // from the quiz. The ref guard (not just an empty dep array) is what makes
  // it survive Strict Mode's dev-only double-invoke, matching the other
  // funnels' ViewContent guards.
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || !variant || !products.length) return;
    fired.current = true;
    trackFunnel({
      step: "offer",
      variant,
      answers: answers as Record<string, string | undefined>,
      productIds: products.map((p) => p.id),
      value: total,
    });
    trackViewContent({
      contentIds: products.map((p) => String(p.id)),
      contentName: products[0]?.title ?? products[0]?.name,
      value: total,
    });
  }, [variant, products, answers, total]);

  // Products sharing a category contribute the same archetype questions, so a
  // three-product page would otherwise ask "متى ألاحظ الفرق؟" three times.
  // Deduped by question text, product questions first, then the store's.
  const faq = useMemo(() => {
    const seen = new Set<string>();
    return [...blocks.flatMap((b) => b.faq), ...STORE_FAQ].filter((f) => {
      if (seen.has(f.q)) return false;
      seen.add(f.q);
      return true;
    });
  }, [blocks]);

  const openOrder = useCallback(() => setModalOpen(true), []);

  const jump = useCallback((anchor: string) => {
    const el = document.getElementById(anchor);
    if (!el) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, []);

  const storeName = settings.storeName?.trim() || "Desert Shop";

  return (
    <div className={styles.offer} dir="rtl">
      <Topbar scrolled={topScrolled} storeName={storeName} />

      <Hero
        ref={heroRef}
        answers={answers}
        blocks={blocks}
        total={total}
        onOrder={openOrder}
        onJump={jump}
      />

      {blocks.map((b, i) => (
        <ProductBlock
          key={b.anchor}
          block={b}
          index={i}
          isHero={i === 0}
          onOrder={openOrder}
        />
      ))}

      <div className={styles.wrap}>
        <SelectionSection products={products} total={total} onOrder={openOrder} />
        <TrustStrip />
        {/* Store testimonials, not product ones — see reviews.tsx. */}
        <Reviews items={STORE_REVIEWS} />
        {/* Each product contributed its own questions; the store's payment and
            delivery answers close the list so they are always on the page. */}
        <Faq items={faq} />
      </div>

      <CtaBanner total={total} onOrder={openOrder} />

      <div className={styles.wrap}>
        <Footer storeName={storeName} />
      </div>

      <StickyBar
        show={stickyShow && !modalOpen}
        count={products.length}
        total={total}
        onOrder={openOrder}
      />

      {variant && (
        <QuizOrderModal
          open={modalOpen}
          products={products}
          answers={answers}
          variant={variant}
          settings={settings}
          cache={cache}
          source="funnel_quiz_offer"
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

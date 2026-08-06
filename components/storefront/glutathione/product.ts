// Hardcoded single-product data for the /glutathione landing page —
// intentionally separate from the Firestore `products` collection, same
// pattern as components/storefront/sunguard/product.ts and
// components/storefront/collagen/products.ts (architecture-context.md:
// this funnel is self-contained). Title/price sourced from the live
// Firestore `products/1780283875728` doc (2026-07-26); price kept in sync
// with the current catalog price. `image` is an owner-supplied polished
// product photo (2026-07-26) replacing an earlier crop of the raw
// Firestore catalog image, which had visible neighboring-product clutter
// at the edges — same real bottle/label, cleaner staging.
export const GLUTATHIONE_PRODUCT = {
  id: "gl-life-extension",
  brand: "LIFE EXTENSION",
  title: "Glutathione, Cysteine & C — جلوتاثيون للتفتيح",
  size: "100 كبسولة",
  price: 14500,
  image: "/assets/glutathione/product-shot.webp",
};

// Real catalog product (Firestore `products/1780279395143`, 2,900 د.ج) —
// bundled as a free gift with every /glutathione order per the owner's
// real promotion. Swapped 2026-08-06 from the earlier rice-milk-soap gift
// (owner request) to this astaxanthin mask soap; title/price/image pulled
// live from the real Firestore doc via a direct REST read, same convention
// as GLUTATHIONE_PRODUCT above. Added to every order as a zero-price line
// item (see order-modal.tsx) so fulfillment staff see it and actually
// pack it — the marketing promise and the real order must match.
export const GIFT_SOAP = {
  id: "gl-gift-astaxanthin-soap",
  title: "صابون Nawarna Dose Astaxanthin Mask",
  normalPrice: 2900,
  image: "/assets/glutathione/gift-soap.webp",
};

export function moneyFmt(n: number): string {
  return n.toLocaleString("en-US") + " د.ج";
}

// Hardcoded single-product data for the /glutathione landing page —
// intentionally separate from the Firestore `products` collection, same
// pattern as components/storefront/sunguard/product.ts and
// components/storefront/collagen/products.ts (architecture-context.md:
// this funnel is self-contained). Real product details (title, price,
// image) sourced from the live Firestore `products/1780283875728` doc
// (2026-07-26); price kept in sync with the current catalog price.
export const GLUTATHIONE_PRODUCT = {
  id: "gl-life-extension",
  brand: "LIFE EXTENSION",
  title: "Glutathione, Cysteine & C — جلوتاثيون للتفتيح",
  size: "100 كبسولة",
  price: 14500,
  image: "/assets/glutathione/product-shot.webp",
};

// Real catalog product (Firestore `products/1768441716115`, 1,700 د.ج) —
// bundled as a free gift with every /glutathione order per the owner's
// real promotion (2026-07-26). Added to every order as a zero-price line
// item (see order-modal.tsx) so fulfillment staff see it and actually
// pack it — the marketing promise and the real order must match.
export const GIFT_SOAP = {
  id: "gl-gift-jam-rice-soap",
  title: "صابون حليب الأرز (Jam Rice Milk Soap)",
  normalPrice: 1700,
  image: "/assets/glutathione/gift-soap.webp",
};

export function moneyFmt(n: number): string {
  return n.toLocaleString("en-US") + " د.ج";
}

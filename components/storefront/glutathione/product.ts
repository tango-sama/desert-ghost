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

export function moneyFmt(n: number): string {
  return n.toLocaleString("en-US") + " د.ج";
}

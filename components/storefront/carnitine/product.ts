// Hardcoded single-product data for the /carnitine landing page —
// intentionally separate from the Firestore `products` collection, same
// pattern as components/storefront/sunguard/product.ts and
// components/storefront/glutathione/product.ts (architecture-context.md:
// this funnel is self-contained). `id` is kept equal to the real Firestore
// `products/1768873325495` doc id (not a made-up slug like the other
// landing pages) so this funnel's orders line up with the real catalog
// entry an admin can also sell from `/products`; title/price/image pulled
// live from that doc via a direct REST read (2026-08-22).
export const CARNITINE_PRODUCT = {
  id: "1768873325495",
  brand: "HHS",
  title: "HHS A1 L-Carnitine Lepidium — كبسولات تنحيف الجسم",
  size: "30 كبسولة",
  price: 14500,
  image: "/assets/carnitine/product-shot.webp",
};

export function moneyFmt(n: number): string {
  return n.toLocaleString("en-US") + " د.ج";
}

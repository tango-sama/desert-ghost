// Hardcoded single-product data for the /sunguard landing page —
// intentionally separate from the Firestore `products` collection, same
// pattern as components/storefront/collagen/products.ts (architecture-
// context.md: this funnel is self-contained).
export const SUNGUARD_PRODUCT = {
  id: "sg-watermelon-3d-aura",
  brand: "JULA'S HERB",
  title: "Watermelon 3D Aura Sun Guard SPF50+ PA++++",
  size: "30 g",
  price: 3500,
};

export function moneyFmt(n: number): string {
  return n.toLocaleString("en-US") + " د.ج";
}

import { unstable_cache } from "next/cache";
import { fetchProducts, type Product } from "@/lib/firebase";

// SERVER ONLY. This module pulls in `next/cache`, so it must never be imported
// from a "use client" file — import Product/priceFmt straight from
// lib/firebase.ts there, as the quiz and offer components already do.
//
// Why this exists: /quiz, /offer and the hand-built funnels are the pages paid
// traffic lands on, and each of them read the WHOLE products collection on
// every single request (`force-dynamic` + getProducts()). That put a Firestore
// round trip in front of the first byte of every ad click. The ad data showed
// what it costs — barely half of the link clicks Meta billed for on the quiz
// funnel ever became a landing-page view, against ~74% on a lighter page.
//
// The fix is to cache the DATA, not the render. The pages stay `force-dynamic`
// deliberately: an earlier attempt at static prerendering froze a stale/empty
// catalog into the HTML (see context/progress-tracker.md), and rendering per
// request also keeps the A/B variant and attribution logic honest. Caching only
// the catalog read keeps that behaviour and removes the round trip.
//
// `use cache` is the Next 16 replacement for unstable_cache, but it requires
// the app-wide `cacheComponents` flag, which changes caching semantics for
// every route in the app. That is a much larger change than this one and is
// deliberately not bundled in here — see the follow-up note in the tracker.

/** Cache tag for the products collection, for revalidateTag() once the admin
 *  panel can signal catalog edits server-side. */
export const PRODUCTS_TAG = "products";

/** How long a catalog read is reused. The owner edits products from the admin
 *  panel at any time and those writes go straight from the browser to
 *  Firestore, so there is no server hook to invalidate on yet — this TTL is
 *  the only thing bounding staleness. Five minutes trades a short delay on
 *  catalog edits for removing a Firestore round trip from every ad click. */
const PRODUCTS_TTL_SECONDS = 300;

const cachedProducts = unstable_cache(fetchProducts, ["catalog", "products"], {
  revalidate: PRODUCTS_TTL_SECONDS,
  tags: [PRODUCTS_TAG],
});

/** The whole catalog, served from the data cache. Same contract as
 *  getProducts(): never throws, returns [] if Firestore is unreachable — but
 *  a failure is not what gets cached (see fetchProducts in lib/firebase.ts). */
export async function getCachedProducts(): Promise<Product[]> {
  try {
    return await cachedProducts();
  } catch (e) {
    console.error("[DS] getCachedProducts", e);
    return [];
  }
}

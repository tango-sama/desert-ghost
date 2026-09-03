import type { Product } from "@/lib/firebase";
import { closetFor, EMPTY_STATS, type Stats } from "@/lib/storage-counter";

// The storefront's "most in closet first" product order, shared by the home
// page's «أبرز المنتجات» grid and the /products listing so both rank the
// catalog by the same quantity signal the admin Storage Counter shows.
//
// SERVER COMPONENTS ONLY. `closetStatsOrNull` reaches `lib/firebase-admin`,
// which must never end up in a client bundle (architecture-context.md).

export function byRecency(a: Product, b: Product): number {
  return (Number(b.lastModified ?? b.id) || 0) - (Number(a.lastModified ?? a.id) || 0);
}

/**
 * Closet counts for the sort, or null if they cannot be obtained.
 *
 * The import is dynamic and the call is wrapped, deliberately. These are
 * storefront routes — the most-hit pages on the site — and all they want from
 * the privileged layer is a nicer sort ORDER. A static import means a failure
 * while merely *loading* `lib/firebase-admin` (a bad service-account key, a
 * bundling problem, anything in the Admin SDK's own module graph) takes the
 * entire page down with a 500 before a single product can render, and no
 * try/catch around the call site can help because the failure happens at
 * import time. Deferring it makes that failure catchable and turns the worst
 * case into "products sorted by recency instead of stock" — which is exactly
 * what happens already when credentials are absent.
 *
 * Storefront-safe by construction: only derived integers cross back, never
 * order documents (see architecture-context.md).
 */
async function closetStatsOrNull(): Promise<Record<string, Stats> | null> {
  try {
    const { getOrderStats } = await import("@/lib/firebase-admin");
    return await getOrderStats();
  } catch (e) {
    console.error(
      "[DS] closet-sort: closet stats unavailable, falling back to recency sort",
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * Most-in-closet first — same "في المحل" derivation as the admin Storage
 * Counter tab and the checkout badge (lib/storage-counter.ts). Products with
 * no admin-entered `stock` sort after every tracked product (we have no real
 * quantity signal for them, so they can't outrank one that does) but keep
 * their relative recency order among themselves. If the orders read itself
 * fails (e.g. FIREBASE_SERVICE_ACCOUNT_KEY not configured yet), `stats` is
 * null and this falls back to the recency-only sort rather than guessing.
 *
 * Returns a new array; the input is left alone. Only the ORDER derives from
 * privileged data — no closet number is returned, so nothing a page renders
 * from this can leak one.
 */
export async function sortByCloset(products: Product[]): Promise<Product[]> {
  return orderByCloset(products, await closetStatsOrNull());
}

/**
 * The ordering itself, split out from the privileged read so it can be
 * exercised on synthetic stats without Admin SDK credentials. `stats` is
 * null when the read failed — see above.
 */
export function orderByCloset(
  products: Product[],
  stats: Record<string, Stats> | null
): Product[] {
  const closetOf = (p: Product): number | null =>
    stats && p.stock != null ? closetFor(Number(p.stock), stats[p.id] ?? EMPTY_STATS) : null;

  return [...products].sort((a, b) => {
    const ac = closetOf(a);
    const bc = closetOf(b);
    if (ac != null && bc != null) return bc - ac || byRecency(a, b);
    if (ac != null) return -1;
    if (bc != null) return 1;
    return byRecency(a, b);
  });
}

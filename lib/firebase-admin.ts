// Server-only Firebase Admin SDK access — privileged Firestore reads that
// bypass firestore.rules entirely. NEVER import this from a "use client"
// component or anything that ends up in a storefront/admin browser bundle;
// it exists only for Next.js server code (Route Handlers) that needs to
// read admin-only collections (e.g. `orders`) without exposing raw order
// data (customer names, phones, addresses) to the client — the caller must
// only ever forward derived aggregates back to the browser, never full
// documents. See context/architecture-context.md ("Storefront-safe stock
// endpoint").
//
// Credentials: prefers an explicit `FIREBASE_SERVICE_ACCOUNT_KEY` env var
// (a service-account JSON string) — required on Vercel, which has no
// ambient Google credentials. Falls back to `applicationDefault()` for
// environments that provide it natively (e.g. Firebase App Hosting/Cloud
// Run), so nothing breaks if that path is used instead. If neither is
// configured, `getAdminDb()` returns null instead of throwing — callers
// must degrade gracefully, matching this repo's "storefront must render
// even when Firestore is unreachable" invariant.
import { getApps, initializeApp, cert, applicationDefault, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { statsByProduct, type OrderLike, type Stats } from "@/lib/storage-counter";

const PROJECT_ID = "desert-shop-24af9";

let cached: Firestore | null | undefined;
let cachedAuth: Auth | null | undefined;

function initAdminApp(): App {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (key) {
    return initializeApp({ credential: cert(JSON.parse(key)), projectId: PROJECT_ID });
  }
  return initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
}

export function getAdminDb(): Firestore | null {
  if (cached !== undefined) return cached;
  try {
    const app = getApps().length ? getApps()[0] : initAdminApp();
    cached = getFirestore(app);
  } catch (e) {
    console.error(
      "[DS] firebase-admin init failed — set FIREBASE_SERVICE_ACCOUNT_KEY (a service-account JSON string) in the deployment env",
      e
    );
    cached = null;
  }
  return cached;
}

// Reads `orders` server-side (Admin SDK, bypasses firestore.rules) and
// returns the per-product sending/delivered/returned aggregation — the
// same shape `statsByProduct` (lib/storage-counter.ts) already produces
// from the admin panel's live `orders` store slice. Callers combine this
// with each product's own public `stock` field via `closetFor()` — never
// return this raw `orders` data itself to the browser, only the derived
// closet numbers. Returns null (not an empty object) when credentials
// aren't configured or the read fails, so callers can tell "no orders"
// apart from "couldn't check" and fall back accordingly.
export async function getOrderStats(): Promise<Record<string, Stats> | null> {
  const adb = getAdminDb();
  if (!adb) return null;
  try {
    const snap = await adb.collection("orders").get();
    return statsByProduct(snap.docs.map((d) => d.data() as OrderLike));
  } catch (e) {
    console.error("[DS] getOrderStats", e);
    return null;
  }
}

// The single admin identity — the same account firestore.rules' isAdmin()
// recognizes. Kept in lock step with that rule: widening one without the
// other silently opens a hole.
export const ADMIN_EMAIL = "tango0es@gmail.com";

export function getAdminAuth(): Auth | null {
  if (cachedAuth !== undefined) return cachedAuth;
  try {
    const app = getApps().length ? getApps()[0] : initAdminApp();
    cachedAuth = getAuth(app);
  } catch (e) {
    console.error("[DS] firebase-admin auth init failed", e);
    cachedAuth = null;
  }
  return cachedAuth;
}

/**
 * Verify an `Authorization: Bearer <Firebase ID token>` header and confirm
 * it belongs to the admin account.
 *
 * Route handlers in this repo were all safely anonymous until the WhatsApp
 * send endpoint, which is not: an unauthenticated one would let anyone send
 * messages from the shop's own WhatsApp number. Returns true ONLY on a
 * verified token whose email matches ADMIN_EMAIL — every other outcome
 * (missing header, malformed token, revoked session, unverifiable because
 * Admin credentials aren't configured) is false, so a misconfiguration
 * fails closed rather than open.
 */
export async function isAdminRequest(authHeader: string | null): Promise<boolean> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return false;
  const auth = getAdminAuth();
  if (!auth) return false;
  try {
    const decoded = await auth.verifyIdToken(token, true);
    return decoded.email === ADMIN_EMAIL;
  } catch {
    // Expired, forged, or revoked — all the same answer, and deliberately
    // not logged in detail: the token itself must never reach a log.
    return false;
  }
}

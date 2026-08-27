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
import { statsByProduct, type OrderLike, type Stats } from "@/lib/storage-counter";

const PROJECT_ID = "desert-shop-24af9";

let cached: Firestore | null | undefined;

/**
 * Whether the runtime actually provides Application Default Credentials.
 *
 * This matters more than it looks. `applicationDefault()` does not fail
 * fast — it defers the credential lookup, and where none exists (Vercel)
 * the Admin SDK reaches for the GCE metadata server and the failure
 * surfaces as an **unhandled promise rejection**, outside any try/catch
 * around the call. In a serverless runtime an unhandled rejection can take
 * the whole invocation down, turning "no Firestore credentials" — which
 * every caller here is written to survive — into a 500 on a page that
 * should have rendered fine without it.
 *
 * So ADC is only attempted where it can genuinely work: Cloud Run / Firebase
 * App Hosting (`K_SERVICE`), Cloud Functions (`FUNCTION_TARGET`), App Engine
 * (`GAE_ENV`), or an explicit key file. Anywhere else, a missing
 * `FIREBASE_SERVICE_ACCOUNT_KEY` degrades to `null` immediately, which is
 * what the callers already expect.
 */
function hasAmbientGoogleCredentials(): boolean {
  return !!(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.K_SERVICE ||
    process.env.FUNCTION_TARGET ||
    process.env.GAE_ENV
  );
}

/**
 * The shared Admin app. Exported so lib/firebase-admin-auth.ts can reuse it
 * WITHOUT this module importing firebase-admin/auth — see that file's header
 * for why that separation matters.
 */
export function getAdminApp(): App | null {
  return getApps().length ? getApps()[0] : initAdminApp();
}

function initAdminApp(): App | null {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (key) {
    return initializeApp({ credential: cert(JSON.parse(key)), projectId: PROJECT_ID });
  }
  if (hasAmbientGoogleCredentials()) {
    return initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  }
  return null;
}

export function getAdminDb(): Firestore | null {
  if (cached !== undefined) return cached;
  try {
    const app = getAdminApp();
    cached = app ? getFirestore(app) : null;
    if (!app) {
      console.error(
        "[DS] firebase-admin: no credentials — set FIREBASE_SERVICE_ACCOUNT_KEY (a service-account JSON string) in the deployment env. Continuing without privileged reads."
      );
    }
  } catch (e) {
    // Reached when FIREBASE_SERVICE_ACCOUNT_KEY is set but unusable — most
    // often malformed JSON from a paste that lost its newlines or quoting.
    console.error(
      "[DS] firebase-admin init failed — FIREBASE_SERVICE_ACCOUNT_KEY is set but could not be used (malformed service-account JSON?)",
      e instanceof Error ? e.message : e
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

// Server-only admin IDENTITY checks — deliberately split out of
// lib/firebase-admin.ts.
//
// WHY THIS IS ITS OWN FILE
// ------------------------
// The storefront homepage renders components/storefront/product-grid.tsx,
// which imports `getOrderStats` from lib/firebase-admin.ts. When the auth
// helpers lived there too, every visitor's homepage render pulled in
// `firebase-admin/auth` — a dependency the storefront has no use for, on the
// hottest path in the app. Only the WhatsApp send route needs it.
//
// Keep it that way: nothing the storefront imports may reach this file.
import { getAuth, type Auth } from "firebase-admin/auth";
import { getAdminApp } from "@/lib/firebase-admin";

let cachedAuth: Auth | null | undefined;

// The admin identities — the SAME set firestore.rules' isAdmin() allows.
// The deployed rule reads:
//
//   request.auth.token.email in ['tango0es@gmail.com',
//                                'hadjajamel1988@gmail.com']
//
// These two lists must stay in lock step. They fail in opposite and equally
// bad ways: a name here that the rules omit grants API access to someone
// Firestore will not serve; a name in the rules omitted here lets that
// person see the inbox and its drafts but silently 401 when they try to
// send — which is how the second account was missed the first time.
export const ADMIN_EMAILS: readonly string[] = [
  "tango0es@gmail.com",
  "hadjajamel1988@gmail.com",
];

export function getAdminAuth(): Auth | null {
  if (cachedAuth !== undefined) return cachedAuth;
  try {
    const app = getAdminApp();
    cachedAuth = app ? getAuth(app) : null;
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
 * verified token whose email is one of ADMIN_EMAILS — every other outcome
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
    return !!decoded.email && ADMIN_EMAILS.includes(decoded.email);
  } catch {
    // Expired, forged, or revoked — all the same answer, and deliberately
    // not logged in detail: the token itself must never reach a log.
    return false;
  }
}

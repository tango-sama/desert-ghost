// "Existing client" lookup for the admin panel's manual order form — ports
// the Noest/ZR Express feature where typing a returning customer's name
// while creating a new order suggests them in a dropdown, and picking one
// autofills their phone/wilaya/commune/address from their last order.
//
// There is no separate `clients` collection (and this repo doesn't own
// firestore.rules to safely add one — see architecture-context.md), so the
// list is derived client-side from the `orders` the admin store already has
// in memory (no extra Firestore reads). This is deliberately ADMIN-ONLY:
// `orders` is admin-only-readable and carries customer PII (name/phone/
// address) — never import this file from a "use client" component outside
// /amelhadj, and never wire it into the storefront's password-only "seller
// mode" (see the owner's explicit decision recorded in progress-tracker.md
// under "existing client autocomplete").
import { orderStamp, type Order } from "@/lib/admin";

export type ExistingClient = {
  // Normalized phone digits — the de-dupe key. Two orders under slightly
  // different spacing/formatting of the same number are the same client.
  key: string;
  customer: string;
  phone: string;
  wilaya: string;
  wilayaId: string | number | null;
  wilayaFr: string;
  baladiya: string;
  address: string;
  deliveryType?: string;
  deliveryCompany?: string;
  orderCount: number;
  lastOrderAt: number;
};

function normalizePhone(phone: string | undefined): string {
  return String(phone ?? "").replace(/\D/g, "");
}

// One row per returning customer (grouped by phone), snapshotting their
// MOST RECENT order's name/address — people move or a name gets typed
// differently order to order, and the latest order is the best guess at
// their current details — plus a running count of every order under that
// phone number (shown in the suggestion list as a trust signal, same as
// the carrier dashboards this ports).
export function deriveExistingClients(orders: Order[]): ExistingClient[] {
  const counts = new Map<string, number>();
  const latest = new Map<string, { order: Order; stamp: number }>();
  for (const o of orders) {
    const key = normalizePhone(o.phone);
    if (!key || !o.customer?.trim()) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const stamp = orderStamp(o);
    const cur = latest.get(key);
    if (!cur || stamp > cur.stamp) latest.set(key, { order: o, stamp });
  }
  return Array.from(latest.entries())
    .map(([key, { order: o, stamp }]) => ({
      key,
      customer: o.customer!.trim(),
      phone: o.phone?.trim() ?? "",
      wilaya: o.wilaya ?? "",
      wilayaId: o.wilayaId ?? null,
      wilayaFr: o.wilayaFr ?? "",
      baladiya: o.baladiya ?? "",
      address: o.address ?? "",
      deliveryType: o.deliveryType,
      deliveryCompany: o.deliveryCompany,
      orderCount: counts.get(key) ?? 1,
      lastOrderAt: stamp,
    }))
    .sort((a, b) => b.lastOrderAt - a.lastOrderAt);
}

// Matches typed text against a client's name or phone digits — Noest/ZR's
// own "existing client" search does both, and a seller mid-call is just as
// likely to have the phone in front of them as the name. Name matches rank
// above phone matches (start-of-name first, then start-of-word, then
// anywhere) so typing an actual name never gets buried under a coincidental
// digit match.
export function searchClients(
  clients: ExistingClient[],
  query: string,
  limit = 6
): ExistingClient[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const qDigits = q.replace(/\D/g, "");
  const scored: { client: ExistingClient; rank: number }[] = [];
  for (const c of clients) {
    const name = c.customer.toLowerCase();
    let rank = -1;
    if (name.startsWith(q)) rank = 0;
    else if (name.split(/\s+/).some((w) => w.startsWith(q))) rank = 1;
    else if (name.includes(q)) rank = 2;
    else if (qDigits.length >= 3 && c.phone.replace(/\D/g, "").includes(qDigits)) rank = 3;
    if (rank >= 0) scored.push({ client: c, rank });
  }
  return scored
    .sort((a, b) => a.rank - b.rank || b.client.lastOrderAt - a.client.lastOrderAt)
    .slice(0, limit)
    .map((s) => s.client);
}

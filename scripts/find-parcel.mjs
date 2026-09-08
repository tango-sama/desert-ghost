#!/usr/bin/env node
//
// Find a lost parcel by its COD amount.
//
// Carrier APIs are keyed by TRACKING NUMBER — Noest's `getParcelStatus` /
// `lookupParcel` callables both take one tracking and return that one parcel.
// Neither carrier exposes "list my parcels where the price was X", so a price
// on its own cannot be turned into a carrier query.
//
// The index that DOES map an amount back to a tracking number is our own
// `orders` collection: every order carries its amount (`parcelPrice` /
// `total` / `subtotal`), its per-carrier `{ tracking }` (see ParcelInfo in
// lib/admin.ts), and the tracker's last known `trackingStatus` + `outcome`.
// So the search runs here, and the trackings it prints are what you feed to
// the carrier API (the 🔄 refresh in the admin panel) for live status.
//
// Usage:
//   FIREBASE_SERVICE_ACCOUNT_KEY='<service-account JSON>' \
//     node scripts/find-parcel.mjs --amount 18000 --tolerance 1000 --months 12
//
// Options:
//   --amount N      COD amount to look for            (default 18000)
//   --tolerance N   +/- window around it, "around"    (default 1000)
//   --months N      only orders from the last N months (default 12)
//   --carrier X     yalidine | noest | zr             (default: any)
//   --all           include delivered orders too      (default: undelivered only)
//   --json          machine-readable output
//
// Reads only. Never writes, and never prints credentials.

const CARRIERS = ["yalidine", "noest", "zr"];

export function parseArgs(argv) {
  const out = { amount: 18000, tolerance: 1000, months: 12, carrier: null, all: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") out.all = true;
    else if (a === "--json") out.json = true;
    else if (a === "--amount") out.amount = Number(argv[++i]);
    else if (a === "--tolerance") out.tolerance = Number(argv[++i]);
    else if (a === "--months") out.months = Number(argv[++i]);
    else if (a === "--carrier") out.carrier = String(argv[++i]).toLowerCase();
  }
  if (!Number.isFinite(out.amount)) throw new Error("--amount must be a number");
  if (!Number.isFinite(out.tolerance) || out.tolerance < 0) throw new Error("--tolerance must be >= 0");
  if (out.carrier && !CARRIERS.includes(out.carrier))
    throw new Error(`--carrier must be one of ${CARRIERS.join(", ")}`);
  return out;
}

// firebase-admin is imported lazily so that a missing credential reports the
// credential — not a module-resolution stack trace from an uninstalled dep.
async function db() {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) {
    console.error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is not set.\n" +
        "This is the same service-account JSON lib/firebase-admin.ts uses on Vercel.\n" +
        "Without it there is no way to read the orders collection."
    );
    process.exit(2);
  }
  let parsed;
  try {
    parsed = JSON.parse(key);
  } catch {
    console.error("FIREBASE_SERVICE_ACCOUNT_KEY is set but is not valid JSON.");
    process.exit(2);
  }
  let app, firestore;
  try {
    app = await import("firebase-admin/app");
    firestore = await import("firebase-admin/firestore");
  } catch {
    console.error("firebase-admin is not installed. Run `npm install` first.");
    process.exit(2);
  }
  if (!app.getApps().length)
    app.initializeApp({ credential: app.cert(parsed), projectId: parsed.project_id });
  return firestore.getFirestore();
}

// placedAt is in seconds, createdAt in ms — same normalization as orderTime()
// in lib/admin.ts.
export function orderTime(o) {
  return o?.placedAt?.seconds ? o.placedAt.seconds * 1000 : o?.createdAt || 0;
}

// Every amount an order can be identified by. `parcelPrice` comes first: it is
// the final amount actually collected by the carrier, which the admin can
// override when a price was renegotiated on the phone (see lib/profit.ts), so
// it is the number the customer would actually remember.
export function amountsOf(o) {
  const out = [];
  for (const [field, v] of [
    ["parcelPrice", o.parcelPrice],
    ["total", o.total],
    ["subtotal", o.subtotal],
  ]) {
    if (typeof v === "number" && Number.isFinite(v)) out.push({ field, value: v });
  }
  return out;
}

// Which carrier actually holds this parcel, and under what tracking. An order
// can carry more than one (re-shipped with a second carrier), so return all.
export function parcelsOf(o) {
  const out = [];
  for (const c of CARRIERS) {
    const tracking = o?.[c]?.tracking;
    if (tracking) out.push({ carrier: c, tracking: String(tracking) });
  }
  const linked = o?.linkedParcel;
  if (linked?.tracking && !out.some((p) => p.tracking === String(linked.tracking)))
    out.push({ carrier: linked.carrier || "?", tracking: String(linked.tracking), linked: true });
  return out;
}

// "Not delivered successfully" — deliberately wider than outcome === "returned".
// `outcome` is the canonical lifecycle state written server-side by the carrier
// webhooks, but it is ABSENT on orders placed before that landed, so fall back
// to the tracker's own last known state rather than guessing delivered.
export function deliveryState(o) {
  const outcome = typeof o.outcome === "string" ? o.outcome : null;
  if (outcome) return { state: outcome, delivered: outcome === "delivered", from: "outcome" };
  const ts = o.trackingStatus;
  if (ts?.notFoundAtCarrier)
    return { state: "notFoundAtCarrier", delivered: false, from: "trackingStatus" };
  const label = ts?.lastLabel || null;
  if (label) return { state: label, delivered: /livr|delivered|تم التسليم/i.test(label), from: "trackingStatus" };
  return { state: "unknown", delivered: false, from: "none" };
}

// Pure selection: which orders match the amount window, the date window, the
// carrier filter, and the delivered filter. Separated from main() so it can be
// tested without Firestore.
export function selectHits(orders, args, now = Date.now()) {
  const lo = args.amount - args.tolerance;
  const hi = args.amount + args.tolerance;
  const since = args.months > 0 ? now - args.months * 30 * 24 * 60 * 60 * 1000 : 0;
  const hits = [];

  for (const o of orders) {
    const when = orderTime(o);
    if (since && when && when < since) continue;

    const matched = amountsOf(o).filter((a) => a.value >= lo && a.value <= hi);
    if (!matched.length) continue;

    const state = deliveryState(o);
    if (!args.all && state.delivered) continue;

    let parcels = parcelsOf(o);
    if (args.carrier) {
      parcels = parcels.filter((p) => p.carrier === args.carrier);
      if (!parcels.length) continue;
    }

    hits.push({
      id: o.id,
      date: when ? new Date(when).toISOString().slice(0, 10) : null,
      amounts: matched,
      state: state.state,
      stateFrom: state.from,
      delivered: state.delivered,
      customer: o.name || o.customer || null,
      phone: o.phone || null,
      wilaya: o.wilaya || o.wilayaFr || null,
      commune: o.communeFr || o.baladiya || null,
      parcels,
      lastLabel: o.trackingStatus?.lastLabel || null,
      lastDate: o.trackingStatus?.lastDate || null,
      notFoundAtCarrier: !!o.trackingStatus?.notFoundAtCarrier,
    });
  }

  hits.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return hits;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const lo = args.amount - args.tolerance;
  const hi = args.amount + args.tolerance;

  const snap = await (await db()).collection("orders").get();
  const hits = selectHits(snap.docs.map((d) => ({ id: d.id, ...d.data() })), args);


  if (args.json) {
    console.log(JSON.stringify({ query: { ...args, lo, hi }, count: hits.length, hits }, null, 2));
    return;
  }

  console.log(
    `\nOrders ${lo}–${hi} DZD, last ${args.months} month(s)` +
      (args.carrier ? `, carrier ${args.carrier}` : "") +
      (args.all ? "" : ", undelivered only") +
      `\nScanned ${snap.size} order(s), matched ${hits.length}.\n`
  );
  if (!hits.length) {
    console.log("Nothing matched. Widen with --tolerance, or drop --carrier.\n");
    return;
  }
  for (const h of hits) {
    const amt = h.amounts.map((a) => `${a.value} (${a.field})`).join(", ");
    console.log(`── ${h.date || "no date"}  ${amt}`);
    console.log(`   order    ${h.id}`);
    if (h.customer || h.phone) console.log(`   customer ${[h.customer, h.phone].filter(Boolean).join("  ")}`);
    if (h.wilaya || h.commune) console.log(`   to       ${[h.wilaya, h.commune].filter(Boolean).join(" / ")}`);
    console.log(`   state    ${h.state}${h.stateFrom === "none" ? "  (never tracked)" : ""}`);
    if (h.notFoundAtCarrier) console.log(`   ⚠ carrier no longer has this parcel (deleted from their dashboard)`);
    for (const p of h.parcels)
      console.log(`   parcel   ${p.carrier}  ${p.tracking}${p.linked ? "  (linked)" : ""}`);
    if (!h.parcels.length) console.log(`   parcel   none — never handed to a carrier`);
    console.log();
  }
  console.log("Refresh any tracking above in the admin panel (🔄) for live carrier status.\n");
}

// Only run when executed directly, so the helpers above can be unit-tested.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e?.message || e);
    process.exit(1);
  });
}

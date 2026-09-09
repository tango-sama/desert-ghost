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
//   node scripts/find-parcel.mjs --key-file ~/Downloads/key.json \
//     --amount 18000 --tolerance 1000 --months 12
//
// Options:
//   --amount N      COD amount to look for            (default 18000)
//   --tolerance N   +/- window around it, "around"    (default 1000)
//   --months N      only orders from the last N months (default 12)
//   --carrier X     yalidine | noest | zr             (default: any)
//   --all           include delivered orders too      (default: undelivered only)
//   --json          machine-readable output
//   --key-file P    path to the service-account JSON downloaded from Firebase
//
// Reads only. Never writes, and never prints credentials.

const CARRIERS = ["yalidine", "noest", "zr"];
const PROJECT_ID = "desert-shop-24af9"; // matches lib/firebase-admin.ts

export function parseArgs(argv) {
  const out = { amount: 18000, tolerance: 1000, months: 12, carrier: null, all: false, json: false, keyFile: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") out.all = true;
    else if (a === "--json") out.json = true;
    else if (a === "--amount") out.amount = Number(argv[++i]);
    else if (a === "--tolerance") out.tolerance = Number(argv[++i]);
    else if (a === "--months") out.months = Number(argv[++i]);
    else if (a === "--carrier") out.carrier = String(argv[++i]).toLowerCase();
    else if (a === "--key-file") out.keyFile = String(argv[++i]);
  }
  if (!Number.isFinite(out.amount)) throw new Error("--amount must be a number");
  if (!Number.isFinite(out.tolerance) || out.tolerance < 0) throw new Error("--tolerance must be >= 0");
  if (out.carrier && !CARRIERS.includes(out.carrier))
    throw new Error(`--carrier must be one of ${CARRIERS.join(", ")}`);
  return out;
}

// The service-account credential, from either the downloaded JSON FILE
// (--key-file, or GOOGLE_APPLICATION_CREDENTIALS) or the JSON STRING in
// FIREBASE_SERVICE_ACCOUNT_KEY that lib/firebase-admin.ts uses on Vercel.
//
// The file path is offered first because the key Firebase hands you is a
// multi-line JSON blob whose `private_key` contains literal \n escapes —
// pasting that into a shell variable mangles it in ways that surface as
// confusing auth errors, not as "your quoting was wrong".
export function readCredential(env, keyFile, readFile) {
  const source = keyFile
    ? { how: `--key-file ${keyFile}`, raw: readFile(keyFile) }
    : env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? { how: "FIREBASE_SERVICE_ACCOUNT_KEY", raw: env.FIREBASE_SERVICE_ACCOUNT_KEY }
      : env.GOOGLE_APPLICATION_CREDENTIALS
        ? {
            how: `GOOGLE_APPLICATION_CREDENTIALS (${env.GOOGLE_APPLICATION_CREDENTIALS})`,
            raw: readFile(env.GOOGLE_APPLICATION_CREDENTIALS),
          }
        : null;

  if (!source) {
    throw new Error(
      "No service-account credential found.\n\n" +
        "Get one from the Firebase console:\n" +
        "  Project settings -> Service accounts -> Generate new private key\n" +
        "  https://console.firebase.google.com/project/desert-shop-24af9/settings/serviceaccounts/adminsdk\n\n" +
        "Then point this script at the downloaded file:\n" +
        "  node scripts/find-parcel.mjs --key-file ~/Downloads/<file>.json --amount 18000\n\n" +
        "(Or set FIREBASE_SERVICE_ACCOUNT_KEY to the JSON string, as on Vercel.)"
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(source.raw);
  } catch {
    throw new Error(`${source.how} is not valid JSON.`);
  }
  if (parsed.type !== "service_account" || !parsed.private_key || !parsed.client_email) {
    throw new Error(
      `${source.how} is JSON, but not a service-account key ` +
        `(expected type "service_account" with private_key and client_email).\n` +
        `A Web-app config from "Your apps" is the usual mix-up — that one cannot read Firestore.`
    );
  }
  if (parsed.project_id && parsed.project_id !== PROJECT_ID) {
    console.error(
      `Warning: key is for project "${parsed.project_id}", but this app is "${PROJECT_ID}".\n`
    );
  }
  return parsed;
}

// firebase-admin is imported lazily so that a missing credential reports the
// credential — not a module-resolution stack trace from an uninstalled dep.
async function db(keyFile) {
  const { readFileSync } = await import("node:fs");
  const parsed = readCredential(process.env, keyFile, (f) => readFileSync(f, "utf8"));
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

  const snap = await (await db(args.keyFile)).collection("orders").get();
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

import { fileURLToPath } from "node:url";

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e?.message || e);
    process.exit(1);
  });
}
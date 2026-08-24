#!/usr/bin/env node
//
// Export successfully-delivered Yalidine parcels to an .xlsx workbook.
//
//   node scripts/yalidine-export.mjs
//   node scripts/yalidine-export.mjs --from 2026-01-01 --to 2026-08-24 --out delivered.xlsx
//
// Credentials come from the environment (YALIDINE_API_ID / YALIDINE_API_TOKEN),
// from .env.local / .env, or from --id/--token. They are never written into the
// output file — per context/code-standards.md carrier credentials stay out of
// anything client-visible or committed.
//
// "Delivered successfully" means Yalidine's own terminal success status,
// `last_status === "Livré"`. Their failure/return statuses ("Echèc livraison",
// "Retourné au vendeur", "Tentative échouée", …) are deliberately excluded;
// pass --status to widen the set.
//
// This is a read-only reporting script: it only ever GETs /v1/parcels/.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildXlsx, dateSerial, STYLE } from "./lib/xlsx.mjs";

const API_BASE = "https://api.yalidine.app/v1";
const DELIVERED_STATUS = "Livré";
// Yalidine caps a page at 100 records; larger values are rejected.
const MAX_PAGE_SIZE = 100;

// Meta wants an ISO-3166 alpha-2 country, lowercased. Yalidine only ships
// inside Algeria, so every customer this export can produce is Algerian.
const CUSTOMER_COUNTRY = "dz";
// Which parcel field represents what the customer was worth. `product_to_collect`
// is the full amount collected at the door (product + freight); `price` is the
// product value alone. The default matches the totals used for the existing
// Meta audience, so refreshed uploads stay comparable to what is already there.
const VALUE_FIELDS = ["product_to_collect", "price"];

// ───────── config ─────────

function loadDotEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const value = m[2].trim().replace(/^(['"])([\s\S]*)\1$/, "$2");
      if (!(m[1] in process.env)) process.env[m[1]] = value;
    }
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    const key = (eq === -1 ? a.slice(2) : a.slice(2, eq)).replace(/-/g, "_");
    if (eq !== -1) args[key] = a.slice(eq + 1);
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) args[key] = argv[++i];
    else args[key] = true;
  }
  return args;
}

const USAGE = `
Export successfully-delivered Yalidine parcels to Excel.

  node scripts/yalidine-export.mjs [options]

Options:
  --out <path>        Output .xlsx path (default: yalidine-delivered-<today>.xlsx)
  --from <date>       Only parcels whose last status landed on/after this date (YYYY-MM-DD)
  --to <date>         Only parcels whose last status landed on/before this date (YYYY-MM-DD)
  --status <list>     Comma-separated statuses (default: "Livré")
  --page-size <n>     Records per request, 1-100 (default: 100)
  --id <api-id>       Yalidine API ID    (else YALIDINE_API_ID)
  --token <api-token> Yalidine API token (else YALIDINE_API_TOKEN)
  --base-url <url>    Override the API base (testing only)
  --json <path>       Also dump the raw parcel JSON alongside the workbook
  --meta-csv <path>   Also write a Meta customer-list CSV (one row per unique
                      customer, phone + country + lifetime value) ready to
                      upload as a Custom Audience / value-based lookalike seed
  --value-field <f>   Which field is the customer's value in that CSV:
                      product_to_collect (default) or price
  -h, --help          Show this help
`.trim();

// ───────── api ─────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Yalidine returns its remaining quota on every response. Staying inside the
// per-second window is what actually matters for a paged export, so pause
// when that bucket runs dry rather than waiting to be rejected with a 429.
async function respectQuota(headers) {
  const left = (name) => {
    const v = Number(headers.get(name));
    return Number.isFinite(v) ? v : null;
  };
  const second = left("second-quota-left");
  const minute = left("minute-quota-left");
  if (second !== null && second <= 1) await sleep(1100);
  else if (minute !== null && minute <= 2) await sleep(5000);
}

class YalidineError extends Error {}

async function apiGet(cfg, path, params) {
  const url = new URL(cfg.baseUrl + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  let lastError;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt) await sleep(Math.min(1000 * 2 ** attempt, 15000));
    let res;
    try {
      res = await fetch(url, {
        headers: {
          "X-API-ID": cfg.id,
          "X-API-TOKEN": cfg.token,
          Accept: "application/json",
        },
      });
    } catch (err) {
      lastError = new YalidineError(`network error calling ${path}: ${err.message}`);
      continue;
    }

    // 401/403 are credential problems — retrying only burns quota.
    if (res.status === 401 || res.status === 403) {
      throw new YalidineError(
        `Yalidine rejected the credentials (HTTP ${res.status}). Check YALIDINE_API_ID / YALIDINE_API_TOKEN.`
      );
    }
    if (res.status === 429 || res.status >= 500) {
      lastError = new YalidineError(`Yalidine returned HTTP ${res.status} for ${path}`);
      const retryAfter = Number(res.headers.get("retry-after"));
      if (Number.isFinite(retryAfter) && retryAfter > 0) await sleep(retryAfter * 1000);
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new YalidineError(
        `Yalidine returned HTTP ${res.status} for ${path}: ${body.slice(0, 300)}`
      );
    }

    await respectQuota(res.headers);
    return res.json();
  }
  throw lastError;
}

// Walk every page of /parcels/ for the given filters.
async function fetchParcels(cfg, { statuses, from, to, pageSize }) {
  const params = { page_size: pageSize, last_status: statuses.join(",") };
  // Yalidine expresses a date filter as an inclusive "start,end" range; a
  // single bound is sent on its own.
  if (from && to) params.date_last_status = `${from},${to}`;
  else if (from) params.date_last_status = from;
  else if (to) params.date_last_status = `,${to}`;

  const all = [];
  const seen = new Set();
  let page = 1;
  let total = null;

  for (;;) {
    const body = await apiGet(cfg, "/parcels/", { ...params, page });
    const batch = Array.isArray(body?.data) ? body.data : [];
    if (total === null && Number.isFinite(Number(body?.total_data)))
      total = Number(body.total_data);

    for (const parcel of batch) {
      // Paging a live list can repeat a record if parcels change underneath
      // us; the tracking number is the carrier's own unique key.
      const key = parcel?.tracking ?? JSON.stringify(parcel);
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(parcel);
    }

    process.stderr.write(
      `\r  fetched ${all.length}${total ? ` / ${total}` : ""} parcels (page ${page})   `
    );

    if (!body?.has_more || batch.length === 0) break;
    page++;
    if (page > 10000) throw new YalidineError("aborting: pagination did not terminate");
  }
  process.stderr.write("\n");
  return { parcels: all, reportedTotal: total };
}

// ───────── shaping ─────────

// Yalidine timestamps are naive Algiers wall-clock strings
// ("2026-08-19 14:23:45"). Convert to an Excel serial so the column sorts and
// filters as a real date, without letting the runner's timezone shift it.
function toExcelDate(value) {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(value));
  if (!m) return String(value);
  return dateSerial(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : "";
}

function yesNo(value) {
  if (value === true || value === 1 || value === "1") return "Yes";
  if (value === false || value === 0 || value === "0") return "No";
  return "";
}

const COLUMNS = [
  { key: "tracking", header: "Tracking", width: 16, style: STYLE.TEXT },
  { key: "order_id", header: "Order ID", width: 22, style: STYLE.TEXT },
  { key: "date_creation", header: "Created", width: 17, style: STYLE.DATE },
  { key: "date_expedition", header: "Shipped", width: 17, style: STYLE.DATE },
  { key: "date_last_status", header: "Delivered", width: 17, style: STYLE.DATE },
  { key: "last_status", header: "Status", width: 14 },
  { key: "firstname", header: "First name", width: 14 },
  { key: "familyname", header: "Family name", width: 14 },
  { key: "contact_phone", header: "Phone", width: 14, style: STYLE.TEXT },
  { key: "address", header: "Address", width: 32 },
  { key: "to_wilaya_name", header: "To wilaya", width: 14 },
  { key: "to_commune_name", header: "To commune", width: 16 },
  { key: "is_stopdesk", header: "Stop desk", width: 10 },
  { key: "stopdesk_name", header: "Stop desk name", width: 22 },
  { key: "from_wilaya_name", header: "From wilaya", width: 14 },
  { key: "product_list", header: "Products", width: 30 },
  { key: "price", header: "Price (DA)", width: 12, style: STYLE.MONEY },
  { key: "delivery_fee", header: "Delivery fee (DA)", width: 14, style: STYLE.MONEY },
  { key: "product_to_collect", header: "To collect (DA)", width: 14, style: STYLE.MONEY },
  { key: "freeshipping", header: "Free shipping", width: 12 },
  { key: "do_insurance", header: "Insured", width: 10 },
  { key: "declared_value", header: "Declared value (DA)", width: 15, style: STYLE.MONEY },
  { key: "weight", header: "Weight (kg)", width: 11, style: STYLE.INT },
  { key: "payment_status", header: "Payment status", width: 15 },
  { key: "payment_id", header: "Payment ID", width: 14, style: STYLE.TEXT },
  { key: "has_exchange", header: "Exchange", width: 10 },
  { key: "economic", header: "Economic", width: 10 },
  { key: "parcel_type", header: "Parcel type", width: 12 },
];

function toRow(p) {
  return {
    ...p,
    date_creation: toExcelDate(p.date_creation),
    date_expedition: toExcelDate(p.date_expedition),
    date_last_status: toExcelDate(p.date_last_status),
    is_stopdesk: yesNo(p.is_stopdesk),
    freeshipping: yesNo(p.freeshipping),
    do_insurance: yesNo(p.do_insurance),
    has_exchange: yesNo(p.has_exchange),
    economic: yesNo(p.economic),
    price: num(p.price),
    delivery_fee: num(p.delivery_fee),
    product_to_collect: num(p.product_to_collect),
    declared_value: num(p.declared_value),
    weight: num(p.weight),
  };
}

function summarySheet(parcels, meta) {
  const sum = (key) =>
    parcels.reduce((t, p) => t + (Number.isFinite(Number(p[key])) ? Number(p[key]) : 0), 0);

  const byWilaya = new Map();
  for (const p of parcels) {
    const key = p.to_wilaya_name || "(unknown)";
    const e = byWilaya.get(key) || { wilaya: key, parcels: 0, value: 0 };
    e.parcels++;
    e.value += Number(p.price) || 0;
    byWilaya.set(key, e);
  }

  const rows = [
    { label: "Statuses included", value: meta.statuses.join(", ") },
    { label: "Date range (last status)", value: meta.range },
    { label: "Generated", value: meta.generated },
    { label: "", value: "" },
    { label: "Delivered parcels", value: parcels.length },
    { label: "Total parcel value (DA)", value: sum("price") },
    { label: "Total delivery fees (DA)", value: sum("delivery_fee") },
    { label: "", value: "" },
    { label: "By wilaya", value: "" },
    ...[...byWilaya.values()]
      .sort((a, b) => b.parcels - a.parcels)
      .map((e) => ({ label: `  ${e.wilaya}`, value: e.parcels })),
  ];

  return {
    name: "Summary",
    columns: [
      { key: "label", header: "Metric", width: 30 },
      {
        key: "value",
        header: "Value",
        width: 34,
        style: (v) => (typeof v === "number" ? STYLE.MONEY : STYLE.DEFAULT),
      },
    ],
    rows,
    autoFilter: false,
  };
}

// ───────── meta customer list ─────────
//
// Meta matches a customer list on hashed identifiers. Phone is the only strong
// one this data carries: Yalidine's `firstname`/`familyname` mix Arabic and
// Latin script and their order is inconsistent between records, so splitting a
// name would be guesswork, and city/state add little to the match rate without
// a name to pair them with. So the list is phone + country + value.
//
// Ads Manager hashes in the browser at upload time, so this file is written in
// plaintext — do NOT commit it or pass it anywhere it isn't going straight to
// Meta. It is customer PII.

// An Algerian mobile in the digits-only form Meta expects: country code, no
// "+", no separators. Returns "" for anything that isn't a mobile number.
export function normalizePhone(value) {
  // Operators sometimes land two numbers in one field ("0771... , 0551...");
  // the first is the one the parcel was actually delivered against.
  const first = String(value ?? "").split(/[,;/]| ou /i)[0];
  let d = first.replace(/\D/g, "");
  if (d.startsWith("00213")) d = d.slice(5);
  else if (d.startsWith("213")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);
  return /^[567]\d{8}$/.test(d) ? "213" + d : "";
}

// Collapse parcels into one row per customer, summing what they were worth.
// A repeat customer must be a single row carrying their lifetime value —
// uploading them once per order would both duplicate the person and understate
// their value to Meta's value-based model.
export function buildCustomerList(parcels, valueField = VALUE_FIELDS[0]) {
  const byPhone = new Map();
  let unusable = 0;

  for (const p of parcels) {
    const phone = normalizePhone(p.contact_phone);
    if (!phone) {
      unusable++;
      continue;
    }
    const amount = Number(p[valueField]);
    const entry = byPhone.get(phone) ?? { phone, orders: 0, value: 0 };
    entry.orders++;
    entry.value += Number.isFinite(amount) ? amount : 0;
    byPhone.set(phone, entry);
  }

  const customers = [...byPhone.values()].sort((a, b) => b.value - a.value);
  return { customers, unusable };
}

// Every column is digits or the literal "dz", so no CSV quoting is needed.
function writeMetaCsv(path, customers) {
  const lines = ["phone,country,value"];
  for (const c of customers) {
    lines.push(`${c.phone},${CUSTOMER_COUNTRY},${Math.round(c.value)}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, lines.join("\n") + "\n", "utf8");
}

// ───────── main ─────────

async function main() {
  loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log(USAGE);
    return 0;
  }

  const id = args.id || process.env.YALIDINE_API_ID;
  const token = args.token || process.env.YALIDINE_API_TOKEN;
  if (!id || !token) {
    console.error(
      "Missing Yalidine credentials.\n" +
        "Set YALIDINE_API_ID and YALIDINE_API_TOKEN (env or .env.local), or pass --id/--token.\n" +
        "They are the API ID / API TOKEN from the Yalidine dashboard (Développeurs → API).\n\n" +
        USAGE
    );
    return 2;
  }

  const statuses = String(args.status || DELIVERED_STATUS)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const pageSize = Math.min(Math.max(parseInt(args.page_size, 10) || MAX_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const from = typeof args.from === "string" ? args.from : "";
  const to = typeof args.to === "string" ? args.to : "";
  for (const [name, value] of [["--from", from], ["--to", to]]) {
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      console.error(`${name} must be YYYY-MM-DD, got "${value}"`);
      return 2;
    }
  }

  const valueField = typeof args.value_field === "string" ? args.value_field : VALUE_FIELDS[0];
  if (!VALUE_FIELDS.includes(valueField)) {
    console.error(`--value-field must be one of ${VALUE_FIELDS.join(" | ")}, got "${valueField}"`);
    return 2;
  }

  const today = new Date().toISOString().slice(0, 10);
  const out = resolve(
    typeof args.out === "string" ? args.out : `yalidine-delivered-${today}.xlsx`
  );
  const cfg = {
    id,
    token,
    baseUrl: (typeof args.base_url === "string" ? args.base_url : API_BASE).replace(/\/$/, ""),
  };

  console.error(`Fetching Yalidine parcels with status: ${statuses.join(", ")}`);
  const { parcels, reportedTotal } = await fetchParcels(cfg, { statuses, from, to, pageSize });

  // The status filter is applied server-side, but re-check locally so a
  // silently-ignored filter can never smuggle undelivered parcels into a
  // report titled "delivered".
  const wanted = new Set(statuses);
  const delivered = parcels.filter((p) => wanted.has(String(p.last_status)));
  const dropped = parcels.length - delivered.length;
  if (dropped > 0) {
    console.error(
      `  note: dropped ${dropped} parcel(s) whose status was not in [${statuses.join(", ")}]`
    );
  }
  if (reportedTotal !== null && reportedTotal !== parcels.length) {
    console.error(
      `  note: Yalidine reported total_data=${reportedTotal}, collected ${parcels.length}`
    );
  }

  if (!delivered.length) {
    console.error("No delivered parcels matched — writing an empty workbook with headers.");
  }

  // Newest delivery first.
  delivered.sort((a, b) => String(b.date_last_status ?? "").localeCompare(String(a.date_last_status ?? "")));

  const meta = {
    statuses,
    range: from || to ? `${from || "…"} → ${to || "…"}` : "all time",
    generated: new Date().toISOString().replace("T", " ").slice(0, 19),
  };

  const book = buildXlsx([
    { name: "Delivered Parcels", columns: COLUMNS, rows: delivered.map(toRow) },
    summarySheet(delivered, meta),
  ]);

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, book);

  if (typeof args.json === "string") {
    const jsonPath = resolve(args.json);
    mkdirSync(dirname(jsonPath), { recursive: true });
    writeFileSync(jsonPath, JSON.stringify(delivered, null, 2));
    console.error(`Wrote ${jsonPath}`);
  }

  if (typeof args.meta_csv === "string") {
    const csvPath = resolve(args.meta_csv);
    const { customers, unusable } = buildCustomerList(delivered, valueField);
    writeMetaCsv(csvPath, customers);
    const repeat = customers.filter((c) => c.orders > 1).length;
    const total = customers.reduce((t, c) => t + c.value, 0);
    console.error(
      `Wrote ${csvPath} — ${customers.length} unique customer(s) from ` +
        `${delivered.length} parcel(s); ${repeat} repeat, ` +
        `${Math.round(total).toLocaleString("en-US")} DA total (${valueField}).`
    );
    if (unusable > 0) {
      console.error(`  note: ${unusable} parcel(s) had no usable mobile number and were skipped`);
    }
    console.error("  contains customer PII in plaintext — upload it to Meta, do not commit it.");
  }

  console.log(`Wrote ${out} — ${delivered.length} delivered parcel(s).`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`\n${err instanceof YalidineError ? err.message : err.stack || err}`);
    process.exit(1);
  });

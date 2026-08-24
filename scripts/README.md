# scripts/

Standalone Node ops scripts. These are **not** part of the Next.js app or its
build — run them directly with `node`, from the repo root.

## `yalidine-export.mjs` — delivered-parcel Excel export

Pulls parcels from the Yalidine REST API (`GET /v1/parcels/`) and writes an
`.xlsx` workbook of the ones Yalidine considers **successfully delivered**
(`last_status === "Livré"`). Read-only: it never creates, edits, or cancels a
parcel.

```bash
# everything ever delivered
node scripts/yalidine-export.mjs

# a date window, to a chosen file
node scripts/yalidine-export.mjs --from 2026-01-01 --to 2026-08-24 --out reports/delivered-2026.xlsx

node scripts/yalidine-export.mjs --help
```

### Credentials

The script needs this store's Yalidine **API ID** and **API TOKEN** (Yalidine
dashboard → Développeurs → API). It reads them, in order, from:

1. `--id` / `--token` flags,
2. `YALIDINE_API_ID` / `YALIDINE_API_TOKEN` in the environment,
3. `.env.local` or `.env` in the repo root.

```bash
# .env.local  (already gitignored — never commit these)
YALIDINE_API_ID=...
YALIDINE_API_TOKEN=...
```

These are the same credentials stored server-side in the `private/yalidine`
Firestore doc that the Cloud Functions read. Per `context/code-standards.md`
they must never reach browser code, a committed file, or the export output —
the script only sends them as request headers and never writes them anywhere.

### Output

Two sheets:

- **Delivered Parcels** — one row per parcel, 28 columns (tracking, order id,
  customer, destination wilaya/commune, stop desk, products, price, delivery
  fee, amount collected, payment status, timestamps …). Header row is frozen
  and autofiltered; dates are real Excel dates, money and weights real numbers,
  and phone numbers stay text so leading zeros survive.
- **Summary** — statuses and date range covered, parcel count, total parcel
  value, total delivery fees, and a per-wilaya breakdown.

`--json <path>` additionally dumps the raw API records, useful when a column
you need isn't in the sheet yet.

### Meta customer list (`--meta-csv`)

`--meta-csv <path>` also writes a Facebook/Meta **customer list**: one row per
unique customer, ready to upload as a Custom Audience and use as a value-based
lookalike seed.

```bash
node scripts/yalidine-export.mjs --meta-csv reports/meta-audience.csv
node scripts/yalidine-export.mjs --meta-csv reports/meta-audience.csv --value-field price
```

Columns are `phone,country,value`:

- **phone** — normalized to Meta's digits-only international form
  (`213XXXXXXXXX`). Non-mobile or unparseable numbers are dropped and counted
  in the run summary; a cell holding two numbers keeps the first.
- **country** — always `dz`; Yalidine only ships inside Algeria.
- **value** — the customer's **lifetime** total across all their delivered
  parcels, so a repeat customer is one row carrying their full worth rather
  than several rows each understating it. `--value-field` picks the source:
  `product_to_collect` (default — the full amount collected at the door) or
  `price` (product value only, excluding freight).

Names and city/state are deliberately **not** included. Yalidine's
`firstname`/`familyname` mix Arabic and Latin script and their order is
inconsistent between records, so any split would be guesswork, and city/state
add little to Meta's match rate without a reliable name to pair them with.
Phone alone is a strong identifier in Algeria.

**This file is customer PII in plaintext.** That is correct for the Ads Manager
upload flow — your browser hashes it locally at upload time — but it must never
be committed or sent anywhere else. Write it under `reports/`, which is
gitignored along with the default workbook name.

### Notes

- Yalidine's status filter is applied server-side *and* re-checked locally, so
  a filter the API ignores can't leak undelivered parcels into the report.
- Paging follows `has_more`, de-duplicates by tracking number (a live list can
  shift under a paged read), and backs off on `429`/`5xx`. The per-second and
  per-minute quota headers Yalidine returns are respected between pages.
- Failure/return statuses (`Echèc livraison`, `Retourné au vendeur`,
  `Tentative échouée`, …) are excluded by design. `--status` widens the set,
  e.g. `--status "Livré,Echèc livraison"`.
- `lib/xlsx.mjs` is a small, self-contained OOXML writer so this report needs
  no npm dependency; it covers only what this export uses.

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

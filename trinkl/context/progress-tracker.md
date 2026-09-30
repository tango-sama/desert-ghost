# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state changes. It must reflect the actual, deployed state of desert-shop-24af9.web.app — not the intended state (see `development-workflow.md`).

## Current Phase

- Live in production — maintenance and incremental features.

## Current Goal

- Meta Pixel + Conversions API implemented (2026-08-24), not yet deployed — see Next Up.

## Completed

- Storefront: home, products, product detail, categories, collagen landing page, checkout — RTL Arabic, Blush Rose & Gold theme.
- Cart in localStorage; orders created in Firestore at checkout; optional WhatsApp order confirmation.
- Admin panel (`amelhadj.html`): products, categories, featured, orders, messages, income/expenses ledger, settings.
- Meta Pixel + Conversions API (2026-08-24): browser Pixel (`js/meta.js`, `window.Meta`) fires PageView/ViewContent/AddToCart/InitiateCheckout/Purchase; server CAPI mirrors ViewContent/AddToCart/InitiateCheckout via the `logMetaEvent` callable, and Purchase via the `onOrderCreatedMetaPurchase` Firestore trigger (fires only after an order doc is actually created — never from client code). Same client-generated `event_id` on both legs for Meta's deduplication. Credentials in `private/meta` (server-only, via Admin SDK); Pixel ID + on/off toggle in `site_settings` (admin Settings page, new "Meta Pixel + Conversions API" card). Idempotency via `order.meta.purchaseSent`. Skips seller-entered phone orders (`source: admin_phone`).
- Delivery carriers: Yalidine, Noest, ZR Express — idempotent parcel creation, tracking lookup, synced fee grids (`delivery_fees` / `delivery_data`), per-carrier enable toggles.
- Admin notifications: web push (`push_subs` + `push-sw.js`) and Gmail email on new orders/messages.
- Security lockdown (2026-07-19): admin panel gated by Firebase Auth email/password; `firestore.rules` tightened — catalog public-read/admin-write, orders & messages create-only for clients, customer data and expenses admin-only.
- WhatsApp site-wide toggle (2026-07-19): `site_settings.waEnabled` + admin Settings button; hides every WA surface via `html.no-wa` and guards JS openers.
- Context docs (2026-07-19): `CLAUDE.md` + `context/` folder; internal files excluded from Hosting (were publicly downloadable).
- Parcel refresh moved to 16:00 (2026-09-14, owner-requested): the
  `refreshAllParcels` schedule now runs at `0 16 * * *` `Africa/Algiers`
  instead of `0 0 * * *`. Nothing else about the run changed — same
  `runParcelRefresh`, same 350ms pacing, same 400-parcel cap, same 540s
  timeout, same "skip finished parcels" rule. The run is no longer
  overnight, so its log line is now `[parcels] daily refresh: {...}` (was
  `nightly refresh`) and the comments that said "nightly"/"00:00" were
  corrected to match. `syncMetaInsights` is untouched and still runs at
  03:00.
- Growth Phase 1 — canonical order outcome (2026-09-04): every place that writes
  `trackingStatus` now also writes a flat `outcome` string
  (`new`/`confirmed`/`shipped`/`delivered`/`returned`/`cancelled`) plus
  `outcomeAt`, via the new `outcomeFromStatus()` / `withOutcome()` helpers in
  `functions/index.js`. Applied at all three status write points
  (`getParcelStatus`, `zrWebhook`, `yalidineWebhook`) and at all three parcel
  creation sites (which stamp `confirmed`). `trackingStatus` is a rendering
  model — a stage index and an alert string shaped for the admin stepper — so
  it cannot be queried or aggregated; `outcome` is what makes "how many of last
  month's Meta orders actually delivered?" answerable, which the profit engine
  needs. Derived from the EXISTING per-carrier normalizers only; no new carrier
  logic and no migration (older orders simply have no `outcome`). Return alerts
  map to `returned`, but transient alerts ("الزبون لا يرد", "مشكلة في التوصيل")
  deliberately stay `shipped` — writing those off as returns would discard
  orders that go on to deliver. `withOutcome()` refuses to move an order
  backwards so a late/out-of-order webhook cannot un-deliver a completed order,
  while still allowing `delivered → returned`. Verified against all 7 alert
  strings the normalizers emit (14 assertions, all passing).
- Growth Phase 1 — analytics collections locked down (2026-09-04):
  `firestore.rules` now denies ALL client writes to `marketing/`, `analytics/`,
  `funnels/`, `experiments/` and `ai/`, admin-read-only. Closed rather than
  create-only (unlike `orders`/`messages`, which an anonymous customer must be
  able to submit to): nothing in these collections is authored by a visitor's
  browser, and leaving create open would let anyone forge conversions and ad
  spend directly into the numbers budget decisions are made from. Written
  server-side only, via Admin SDK.

## In Progress

- Nightly parcel refresh (2026-09-08, owner-requested): new
  `refreshAllParcels` (`onSchedule`, 00:00 `Africa/Algiers`, us-central1)
  refreshes every order that has a carrier tracking number and is not
  finished yet — the owner asked for the admin panel's
  «تحديث حالة الطرود المفتوحة» button to be deleted and the work to happen by
  itself every night.

  The button is now gone from BOTH panels: `amelhadj.html` here (the one
  actually live at www.desertshop.fit/amelhadj) and the ghost rebuild
  (branch `claude/admin-orders-auto-update-a8zq9v` there). It was removed
  from ghost first by mistake — ghost is not deployed, so that alone would
  have left the live panel unchanged. Removed alongside it here:
  `refreshAllTracking`, the toolbar bar and its `anyTracked`/`trackedCount`
  counts, the `#refreshAllTrack` click wiring, and
  `scrollAllSteppersToCurrent` + its only helper `centerStepper`. The
  per-order 🔄 button, `refreshTracking`, `applyTrackingResult`,
  `scrollTrackerToCurrent` and `startsFolded` all stay and are still used.

  The per-parcel work was factored out of `getParcelStatus` into
  `refreshOrderStatus(db, ref, o)`, and both the callable and the schedule
  call it — same reason `syncMetaInsightsNow` shares a code path with
  `syncMetaInsights`: a hand refresh and the nightly run cannot drift apart.
  «Finished» is read off the status already stored on the order, and the
  decision is `outcomeFromStatus`'s — the same normalizer every write path
  already uses to stamp `outcome` — so there is no second opinion to drift.
  Finished = `delivered`, `returned` or `cancelled` (that last one covers
  `notFoundAtCarrier`, i.e. deleted from the carrier's own dashboard). Only a
  stored status that still matches the order's current carrier + tracking
  number is trusted, so a re-created parcel reads as unfinished and gets
  refreshed. Transient alerts — «الزبون لا يجيب», «تأجيل التوصيل» — are NOT
  finished and keep being refreshed, which is the same distinction
  `outcomeFromStatus` already draws for the `outcome` field.

  Nothing needs pushing to the panel: `refreshOrderStatus` writes
  `trackingStatus`/`outcome` onto the order doc and the admin panel watches
  orders live, so an open panel shows the night's results on its own.

  Pacing and limits: one carrier call at a time, 350ms apart (same pacing the
  old bulk button used), `timeoutSeconds: 540`, `memory: '512MiB'`,
  `retryCount: 0` (a failed night is picked up by the next one; retrying a
  half-finished batch would just re-hit the carriers). A run is capped at
  `REFRESH_MAX_PARCELS = 400`, newest parcel first, and a truncated run is
  `console.warn`-ed rather than passing silently.

  `const { onSchedule } = require(...)` was hoisted from the notifications
  section to the top of `functions/index.js`: `refreshAllParcels` registers
  ~600 lines above where that require used to sit, and a `const` require is
  in TDZ until its own line runs, so the module would have thrown on load.

  Verified: `node --check` clean; the module loads with all 25 exports
  registering, and `refreshAllParcels.__endpoint` reads back the intended
  deployment config (`schedule '0 0 * * *'`, `timeZone 'Africa/Algiers'`,
  540s, 512MiB, retryCount 0, us-central1). The parcel-selection rule
  (`parcelCarrier` / `parcelIsFinished` / newest-first ordering) was
  exercised against 15 order shapes — delivered; returned via both «مرتجع»
  and «إرجاع»; cancelled via «ملغى»; deleted via `notFoundAtCarrier`;
  delivered-then-returned; the transient alerts that must NOT be skipped
  («الزبون لا يجيب», «تأجيل التوصيل»); finished-under-an-old-tracking-number;
  finished-under-a-different-carrier; no-status-yet; multi-carrier
  precedence — all green.

  **DEPLOYED to production 2026-09-08 13:48 UTC** via the repo's own CI
  (`firebase-hosting-merge.yml` on a push to `main`, run #53, all steps
  green): hosting shipped the button removal, `refreshAllParcels` logged
  `Successful create operation` as a new Node 20 2nd-gen function in
  us-central1 (the deploy enabled `cloudscheduler.googleapis.com` as part of
  it), `getParcelStatus` updated alongside it, and firestore rules re-released
  unchanged.

  **NOT yet run against real carrier APIs** — first firing is 00:00
  Africa/Algiers. Worth reading that first night's log line,
  `[parcels] nightly refresh: {...}`, for the real `targets` count: that is
  what says whether the 400 cap is anywhere near being hit, and whether the
  540s timeout is comfortable.

  Skipping returned/cancelled/deleted alongside delivered was the owner's
  explicit call (2026-09-08), asked and answered in the same session: the
  first cut skipped delivered only, which meant every dead parcel was re-asked
  every night forever and the nightly cost tracked orders ever placed rather
  than parcels in flight.

  The one cost of skipping `cancelled`: if a carrier ever 404s a LIVE parcel
  long enough for the fetchers to set `notFoundAtCarrier` (they wait out
  `NOT_FOUND_GRACE_MS` = 15 min first, so a freshly created parcel is never
  mistaken for a deleted one), the nightly run writes it off and stops asking.
  The panel's per-order 🔄 button still refreshes it by hand. Judged a fair
  trade — a parcel that has been missing at the carrier for over 15 minutes is
  almost always genuinely gone.

- Meta Pixel + CAPI: code complete, verified locally (client-side logic end-to-end; server functions syntax-checked but not deployed). Still needed before it does anything live: deploy `functions` (adds `logMetaEvent` + `onOrderCreatedMetaPurchase`), then enter the Pixel ID + Conversions API access token in the admin Settings page ("Meta Pixel + Conversions API" card).

- Growth Phase 2 — Meta ad spend ingestion (2026-09-04): new
  `syncMetaInsights` (scheduled, 03:00 Africa/Algiers), `syncMetaInsightsNow`
  (admin callable, same code path so the button and the schedule cannot drift)
  and `listMetaCampaigns` (populates the dashboard's campaign allowlist).
  Pulls **ad-level** daily insights into
  `marketing/meta/insights/{YYYY-MM-DD}_{adId}`. Ad level because that is
  where the variance is — the Glutathione campaign averages ~€6.34/purchase
  while its own "Primary" ad runs ~€10, so campaign totals hide what to
  scale; campaign and ad-set figures are just sums of these rows.
  Re-fetches a **rolling 14-day window every run** with deterministic doc ids
  and `set(merge)`, because Meta keeps revising a day's attributed
  conversions after the fact — writing each day once would freeze the first,
  wrong answer. Paginated (an account with many ads returns pages; stopping
  at the first would silently under-report spend), and batched in chunks of
  400 to stay under Firestore's 500-write batch cap.
  Converts EUR→DZD at `site_settings.eurToDzd` (owner: **1 EUR = 260 DA**)
  and **stores the rate on every row**, so editing the rate later cannot
  retroactively rewrite past months. Credentials: `private/meta.adsToken`,
  falling back to the existing `.accessToken` in case it already carries
  `ads_read`. **Never throws** — a missing token, missing account id or 403
  logs the reason and writes nothing, leaving the dashboard to show orders
  and margin with spend simply absent (same posture as `sendMetaEvent`).
  **No campaign filtering happens at write time** on purpose: the ad account
  is shared with an unrelated business, but the allowlist is applied when the
  dashboard reads, so excluded spend is still stored, still reportable as
  "unallocated", and a corrected allowlist applies retroactively.
  Verified with 9 assertions (purchase extraction from Meta's overlapping
  `actions` types, EUR conversion against the real €50.69 campaign, window).

## Next Up

- **Deploy Phase 2**: `firebase deploy --only functions` also deploys the new
  scheduled function, which requires the **Cloud Scheduler API enabled** on
  `desert-shop-24af9`. The callable "sync now" button works without it, so the
  dashboard is usable before that is sorted.
- **Owner action**: mint a Business Manager System User token with `ads_read`
  on ad account `839446010997263` and save it as `private/meta.adsToken`.
  Until then the sync writes nothing (by design) and the growth dashboard
  shows orders and margin without spend.
- **Deploy the `outcome` work**: `firebase deploy --only functions,firestore:rules`.
  Until the functions deploy, no order gets an `outcome` and the growth
  dashboard's delivery/return rates stay empty. Rules can deploy independently
  and are safe on their own (they only close collections nothing writes yet).
- Deploy the Meta Pixel/CAPI functions and fill in real credentials (see above), then verify with Meta Events Manager → Test Events per the implementation report.
- Port the security lockdown (auth gate + tightened rules) to Bazar Merabet (`mrabet-fb38c`) — its rules are still wide open, exposing its customer orders.
- Port the WhatsApp toggle to Bazar Merabet in the same pass.
- Commit the four untracked product images in `assets/collagen/` (referenced by the live site).

## Open Questions

- None. Add one here instead of guessing when a requirement is missing.

## Architecture Decisions

- Static site, no framework, no build step — files deploy as-is to Firebase Hosting.
- Firestore schema is append-only: new code tolerates old document shapes; no migrations.
- Single-admin auth: Firebase Auth email/password, `isAdmin()` in rules checks the exact admin email; customers stay anonymous.
- Carrier credentials live only in server-only `private/*` docs, read by Cloud Functions via Admin SDK.
- Parcel creation is idempotent per order per carrier — safe to re-run.
- `sw.js` is a permanent kill-switch: the site must never register a caching service worker again.
- Branding stays in theme tokens and the `SITE` config so the Bazar Merabet clone can rebase cleanly.
- Meta Purchase CAPI is sent by a Firestore trigger on `orders/{orderId}` creation, not by a client call after checkout — there's no order-creation API to hook (the browser writes orders straight to Firestore), so the trigger is the only point that's guaranteed to fire after — and only after — an order actually exists.

## Session Notes

- 2026-07-19: Security lockdown designed, deployed, and REST-verified (catalog 200, customer data 403, order create 200). Admin password is set in the Firebase console and known only to the owner — sign in once per device at `/amelhadj`. WhatsApp toggle added and deployed (default: enabled). Deploys run from this machine with the Firebase CLI (`firebase deploy --only hosting|firestore:rules|functions`).
- A test order named "TEST - rules check (delete me)" was created during rules verification — owner should delete it from the admin panel if not done yet.

# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state
changes. It must reflect the actual, deployed state of desert-shop-24af9.web.app —
not the intended state (see `development-workflow.md`).

## Current Phase

- Live static site (`tango-sama/trinkl`) still in production and working —
  its local working copy is at `C:\Users\Tango\Desktop\desert shop` on this
  machine; use that as the reference implementation whenever a `trinkl/...`
  path is mentioned in this file. In parallel, `ghost` is a from-scratch
  Next.js 16 + Tailwind v4 + shadcn/ui rebuild of the same product, being
  built phase by phase (see approved plan). Not yet deployed anywhere —
  local only.

## Current Goal

- Staging is live — see "Deployment" below. Next step is the owner's
  manual click-through (real credentialed admin-panel session, a real
  test order through checkout and the collagen modal) before any decision
  to cut the live domain over from the old static site to this rebuild.

## Deployment

- Staging: **https://ghost-staging--desert-shop-24af9.us-central1.hosted.app**
  — Firebase App Hosting backend `ghost-staging` (project
  `desert-shop-24af9`, region `us-central1`), connected to
  `github.com/tango-sama/desert-ghost` `main` branch. Deploys via
  `firebase apphosting:rollouts:create ghost-staging --git-branch main`;
  connecting the GitHub repo the first time required the owner to
  authorize Firebase's GitHub App in the console (browser-only OAuth
  step, not CLI-scriptable). This is a SEPARATE backend/URL from the live
  static site (`desert-shop-24af9.web.app`, still classic Firebase
  Hosting) — zero risk to production; nothing points end users at staging.
  Verified (2026-07-21): all five routes (`/`, `/products`, `/checkout`,
  `/amelhadj`, `/collagen`) return 200 with real Firestore data (8 product
  cards, RTL attrs, admin login card) on the actual deployed backend, not
  just local dev.
  Ghost's source now lives at `github.com/tango-sama/desert-ghost`
  (previously local-only) — 4 commits covering the full build: storefront,
  admin panel, collagen landing page, stores+docs.
  NOT done: no production cutover. The live `desert-shop-24af9.web.app`
  (old static `trinkl` site) is untouched and still what customers see.

- **Update (2026-08-07) — a real Vercel production deployment exists and
  appears to already be live**, discovered incidentally while wiring up
  `FIREBASE_SERVICE_ACCOUNT_KEY` (see Completed below): Vercel project
  `desert-ghost` (team `tango0es-3396s-projects`, not the same as the
  `trinkl` project below) is Git-connected to
  `github.com/tango-sama/desert-ghost` `main` and serves the custom domain
  **`desertshop.fit`** — confirmed serving this actual Next.js app (not the
  old static site): `https://www.desertshop.fit/` returns 200 and
  `/api/storage-closet` (this app's own route) responds correctly. This
  contradicts the "NOT done: no production cutover" line directly above,
  which was accurate as of 2026-07-21 but is now stale — **the owner should
  confirm whether `desertshop.fit` going live was an intentional cutover**
  (this session has no record of who set it up or when — the domain was
  registered 195 days ago, long before ghost existed, so it may have been
  repurposed from something else) before this file's "no cutover yet"
  framing is trusted anywhere else.
  **Trap for next time**: this Vercel team also has a project literally
  named `trinkl` that is ALSO Git-connected to the same
  `tango-sama/desert-ghost` repo/branch, but has no domain assigned and
  sits behind Vercel's own SSO "Vercel Authentication" deployment
  protection (`vercel inspect`/`curl` both 401/302 on it). Its
  `.vercel/project.json` used to be what this repo linked to (leftover
  from early setup, probably before the `desert-ghost` project existed)
  — every `vercel env`/`vercel deploy` command run from this repo was
  silently hitting the WRONG, unused project until this session
  re-linked it (`vercel link --project desert-ghost`). Always run
  `cat .vercel/project.json` and confirm `projectName: "desert-ghost"`
  before trusting any `vercel` CLI output against this repo.

## Completed

- New single-product landing page `/carnitine` for the real catalog item
  "HHS A1 L-Carnitine Lepidium — كبسولات تنحيف الجسم" (Firestore
  `products/1768873325495`, 14,500 د.ج, weight-loss/slimming category)
  (2026-08-22, ghost-only, not yet committed to a PR). Requested as a
  premium marketing landing page for this specific product; built as a
  fully self-contained funnel following the exact architecture already
  established by `/sunguard` and `/glutathione` (architecture-context.md:
  own top bar/footer, no shared storefront Nav/Footer/CartDrawer,
  `force-dynamic`, hardcoded product data separate from the live
  Firestore `products` collection except that this page deliberately
  keeps `id: "1768873325495"` equal to the real catalog doc id instead of
  a made-up slug, so admin-side traceability isn't lost).
  New `components/storefront/carnitine/` (own "flame" amber/terracotta
  CSS Module palette — `carnitine.module.css` — distinct from sunguard's
  pink, glutathione's gold, and collagen's teal; energy/fat-burn visual
  metaphor): `product.ts` (hardcoded SKU, real product photo downloaded
  from the live Firestore Storage URL into
  `public/assets/carnitine/product-shot.webp`), `topbar.tsx`, `hero.tsx`
  (flame-icon hero with a real-photo spotlight card, no illustrated
  cutout), `problems.tsx` (why weight-loss attempts stall — appetite,
  energy, metabolism), `ingredients.tsx` (the two real actives from the
  Firestore description — L-Carnitine and Lepidium — no invented third
  ingredient), `benefits.tsx`, `product-section.tsx`, `usage-section.tsx`
  (deliberately no invented dosage schedule — the source description only
  states 30 capsules per box, so copy stays generic and points to the
  box's own label instead of fabricating a regimen), `trust-strip.tsx`,
  `faq.tsx`, `cta-banner.tsx`, `footer.tsx`, `sticky-bar.tsx`,
  `order-modal.tsx` (byte-for-byte the same Noest/Yalidine-only carrier
  logic, validation, and totals math as sunguard/order-modal.tsx, just
  restyled and `source: "landing_carnitine"`), `carnitine-page.tsx`
  (assembler). Deliberately has NO before/after slider section (unlike
  sunguard/collagen) — there are no real customer transformation photos
  for this product, and inventing illustrative "before/after" weight-loss
  imagery for a slimming supplement was judged misleading rather than
  just cosmetic, so that section is skipped rather than faked.
  Wired into the existing multi-landing-page infrastructure exactly like
  the other three pages: `app/carnitine/page.tsx` (redirects to an
  admin-set custom slug when one exists, same as
  `app/sunguard/page.tsx`), `lib/firebase.ts` (`LandingPageKey` and
  `LANDING_RESERVED_SLUGS` both gained `"carnitine"`), `app/[slug]/page.tsx`
  (new `META.carnitine` entry + routing branch), and
  `components/admin/views/landing-pages-view.tsx` (new `"carnitine"` tab —
  🔥 التنحيف — added to `PAGES`/`HERO_PLACEHOLDER`/`PRODUCT_DEFAULTS`/
  `SINGLE_PRODUCT_PAGES`, with an empty `BA_SLOTS.carnitine` array since
  this page has no before/after section to edit) so an admin can edit the
  hero copy, product name/price/image, and custom URL slug for this page
  the same way they already do for the other three.
  Verified: `npx tsc --noEmit`, `npx eslint` (only the same pre-existing
  `no-img-element` warning `product-section.tsx` already carries on
  sunguard's identical file), and `npm run build` (`/carnitine` compiles
  as a dynamic route) all clean. Also verified live in a real headless
  Chromium session against `npm run dev`: hero/problems/ingredients/
  benefits/product-card/usage-steps/trust-strip/FAQ/CTA-banner/footer all
  render correctly end-to-end with the real product photo and real price,
  and the order modal opens with correct qty stepper, field validation,
  delivery-type toggle, and live totals math. The sandboxed test
  environment's headless browser could not reach the Firestore
  websocket/streaming backend (network egress restriction specific to
  this session, not the app), so the wilaya/commune selects correctly
  showed their existing "⏳ جاري التحميل..." loading-state fallback
  instead of live carrier data — expected behavior per
  `carrierDataReady()`, the same fallback every other landing page relies
  on, not something this change could exercise further in this sandbox.
  NOT yet verified: a real submitted order against production Firestore,
  and the live wilaya/commune dropdowns populating with real carrier data
  on an unrestricted network (both blocked by this session's own network
  sandbox, not by the code). NOT yet committed/pushed — pending review.

- Empty "📝 اسم المنتج على وصل التوصيل" no longer leaks the real product
  name onto the carrier's label (2026-08-21, both repos DEPLOYED). This
  admin field exists precisely so a real product name never has to appear
  on the parcel manifest a delivery driver sees — its own placeholder
  promises "لن يظهر الاسم الحقيقي" — but leaving it empty didn't actually
  keep that promise: all three `create*Parcel` functions (trinkl
  `functions/index.js`, `createYalidineParcel`/`createNoestParcel`/
  `createZrParcel`) fell back to the REAL `o.items` titles whenever
  `deliveryLabel` was empty/unset, for ANY order the admin hadn't
  explicitly labeled (not just typed-then-cleared — simply never touching
  the field before creating the parcel hit the same fallback). Owner asked
  for "cosm" as the default text. Fixed both ends: (1) trinkl — the
  fallback in all three carrier functions is now the literal string
  `'cosm'` instead of the joined real item titles, applied uniformly since
  the field/intent is carrier-agnostic; deployed
  `createYalidineParcel`/`createNoestParcel`/`createZrParcel` from the same
  `claude/commune-fees` worktree/branch as the fixes above (6253f77,
  pushed — still not merged into trinkl `main`). (2) ghost
  (`orders-view.tsx`) — the pre-shipping note field's `onBlur` now saves
  `"cosm"` (not `""`) when left blank, so the order's own `deliveryLabel`
  stays consistent with what actually gets sent to the carrier; placeholder
  updated to say so. Verified: `node --check`, `npx tsc --noEmit`,
  `npx eslint`, `npm run build` all clean. NOT yet verified live: create
  one more order with this field left untouched, create its parcel, and
  confirm the carrier's label/manifest shows "cosm", not the real product
  name.

- Yalidine parcel creation was double-charging the delivery fee (2026-08-21,
  trinkl DEPLOYED — `functions:createYalidineParcel`, branch
  `claude/commune-fees` c91f48d, pushed). Owner report: after creating a
  real order and pressing the parcel-creation ("طرد") button, the parcel
  created at Yalidine showed the delivery fee charged TWICE. Root cause:
  Yalidine's `/v1/parcels/` `price` field is the PRODUCT value only ("Prix
  colis" on Yalidine's own fee breakdown — see the owner's example earlier
  this session: Prix colis + frais de livraison + Supplément commune =
  Total à ramasser) — Yalidine independently computes its own freight from
  the destination/weight and ADDS it on top to get what the driver actually
  collects. But `createYalidineParcel` sent `o.total` (or an admin's
  `o.parcelPrice` override) as `price` — both already include OUR OWN
  `deliveryFee` estimate from checkout — so Yalidine added its freight on
  top of a number that already had ours baked in. Fix: subtract
  `o.deliveryFee` from the desired total before sending it as
  `price`/`declared_value`, recovering the product-only value Yalidine
  actually wants; only applied when the desired total actually included
  delivery (`o.total` or `o.parcelPrice` set — an admin's `parcelPrice`
  override replaces the FULL total per its "بدلاً من {origTotal}" label in
  orders-view.tsx, so it's treated the same way). The bare `o.subtotal`
  fallback (very old orders missing `o.total`) is left alone since it never
  had delivery baked in. `node --check` clean; deployed from the same
  `claude/commune-fees` worktree as the per-commune fee fix above (still
  NOT merged into trinkl `main` — see that entry for the divergence note).
  **RESOLVED — Yalidine-only, confirmed by the owner** (2026-08-21): asked
  directly whether Noest/ZR parcels also showed a doubled delivery fee —
  owner confirmed no, only Yalidine. `createNoestParcel`'s `montant` and
  `createZrParcel`'s `amount` are deliberately left untouched (they send a
  single all-inclusive COD figure with no separate freight field the
  carrier adds on top — unlike Yalidine's split "price + independently
  computed freight" model, which is what caused this bug).
  NOT yet verified end-to-end: the owner should create one more real
  Yalidine order and parcel now and confirm "Total à ramasser" on
  Yalidine's side matches the order's actual total (not double delivery).

- Yalidine webhook: fixed a real activation gap + a credential-save data-
  loss bug (2026-08-21, ghost-only). While walking the owner through
  enabling Yalidine's "🔔 تفعيل التتبع التلقائي (Webhook)" button, automatic
  registration was refused (as the code already anticipated) and the owner
  went to Yalidine's own manual webhook-creation screen — which turned out
  to show an "Email d'alerte" field and a 64-hex-char token IT generates
  itself, confirmed by the owner. The existing code's manual-fallback alert
  wrongly assumed Yalidine would accept OUR generated secret pasted into
  its dashboard (it has no such field) — so the manual path could never
  actually produce a working webhook: our `yalidineWebhook` receiver would
  keep verifying against a secret Yalidine never signed with, silently
  rejecting every real event as 401 forever, with no visible symptom.
  Fix in `settings-view.tsx`: corrected the alert copy (create the endpoint
  on Yalidine's dashboard with our URL, then copy the secret YALIDINE shows
  back to us — not the reverse), and added a new "سر Webhook من لوحة
  Yalidine" paste-in field + `saveYalidineWebhookSecret()` that writes it to
  `private/yalidine.webhookSecret` (merge:true) and marks
  `yalidineWebhookReady`. Separately found and fixed a related bug while in
  this code: `setDocIn()` (`lib/admin.ts`) did a plain Firestore `setDoc`
  with NO merge, so `saveYalidine`/`saveNoest`/`saveZr` — used every time
  the admin re-saves carrier API credentials — were silently WIPING
  `private/yalidine` and `private/zrexpress`'s server-written webhook
  fields (`webhookSecret`, `webhookUrl`, `webhookAt`, `webhookEndpointId`)
  on every credential re-save, which would have broken an already-working
  webhook the next time the admin touched those API keys. `setDocIn` now
  takes an optional `merge` param (defaults to false — every other call
  site unchanged); the three carrier credential saves now pass `true`.
  Verified: `npx tsc --noEmit`, `npx eslint`, `npm run build` all clean.
  NOT yet verified: the owner still needs to actually create the webhook on
  Yalidine's dashboard, paste the secret Yalidine shows into the new field,
  and confirm a real Yalidine status change lands on an order's
  `trackingStatus` with `viaWebhook: true` — this fix removes the blocker,
  it doesn't complete the setup.

- Yalidine per-commune delivery fee ("Supplément commune") now affects
  price (2026-08-21). Closes the gap flagged in the 2026-07-22 entry below:
  Yalidine's real fee varies by destination COMMUNE within a wilaya, not
  just the wilaya — e.g. the owner's own example: 950 DA base + 100 DA
  Supplément commune = 1050 DA total for that specific commune's Home
  delivery. Two-repo fix (Cloud Functions change + browser change kept as
  separate steps per `ai-workflow-rules.md`):
  (1) trinkl (`tango-sama/trinkl`, `functions/index.js`) — `yalidineFeeTable`
  already fetched `per_commune` from Yalidine's `/v1/fees` response for the
  existing per-wilaya mode calculation but discarded the per-commune values;
  it now ALSO returns a `communeFees` table (wilaya id -> commune name ->
  {home, desk}), read from each commune's own `express_home`/`express_desk`
  (falls back to the `per_commune` object's own key if `commune_name` is
  ever absent from a response — the exact field name is unconfirmed against
  a live response, see Verification below). No extra API calls — the data
  was already in every response. `writeCarrierData` stores it as an
  OPTIONAL `communeFees` field on `delivery_data/yalidine` (omitted
  entirely when empty, so Noest/ZR docs are untouched — schema stays
  append-only per architecture-context.md invariant 4). Built in an
  isolated worktree off `origin/main` (local trinkl `main` has ~300 lines
  of unrelated pre-existing uncommitted WIP — left completely untouched)
  and deployed as `functions:syncCarriers` to `desert-shop-24af9`
  (production) from branch `claude/commune-fees` (d303aa9, pushed to
  origin, NOT yet merged into trinkl `main` — merge when convenient, same
  pattern as the `lookup-parcel`/`webhooks` branches above). Merging is not
  a simple fast-forward, though: as of this entry, trinkl's LOCAL `main` is
  simultaneously 7 commits ahead of `origin/main` (its own unpushed local
  commits, e.g. `61e911e`, `9c1600a` — unrelated to this fix) and ~60
  commits behind `origin/main` (a long, separate line of webhook/tracking/
  lookupParcel work that only ever landed on `origin/main` via other
  worktree branches), AND still carries the ~300-line uncommitted WIP diff
  to `functions/index.js` mentioned above plus a few untracked asset files.
  `claude/commune-fees` itself is clean (based on `origin/main`, only this
  fix) — the divergence is entirely local `main`'s pre-existing state, not
  anything this fix touched. Whoever reconciles it should treat local
  `main`'s uncommitted WIP and unpushed commits as the owner's own
  in-progress work to preserve, not discard.
  (2) ghost (`lib/delivery.ts`) — `CarrierData.communeFees` (optional,
  matches the new Firestore field), `baseFeeForCarrier`/`feeForCarrier` now
  accept an optional `commune` and check the per-commune table first,
  falling back to the per-wilaya `fees` entry (unsynced carrier, no match,
  or a Stop Desk pick with no commune of its own). FEE_OVERRIDES still wins
  over the per-commune fee on purpose — the Alger (wilaya 16) override was
  owner-confirmed against a real order back when the synced grid used the
  wrong origin wilaya; re-verify it against a real order now that
  per-commune data syncs and remove the override if it's now redundant.
  Every order-creation surface now passes the selected commune through:
  `checkout-form.tsx`, `seller-order-modal.tsx`, `new-order-modal.tsx`
  (admin), `link-order-modal.tsx` (admin) only sharpen the HOME fee to a
  commune (Stop Desk has no commune — the customer picks a specific desk,
  not an address); `collagen`/`glutathione`/`sunguard`'s order modals have
  no separate desk picker (one commune select drives both delivery types)
  so they sharpen both Home and Office lookups to the same commune.
  `orders-view.tsx`'s carrier-switch desk-fee recompute is unchanged
  (office/desk-only context, no commune involved).
  Verified: `npx tsc --noEmit`, `npx eslint` (all changed files), and
  `npm run build` all clean; trinkl's `node --check` clean; the isolated
  worktree diff was confirmed to contain ONLY this change (71
  insertions/18 deletions against origin/main, nothing from the unrelated
  local WIP). NOT yet verified: a real `syncCarriers` run (the owner should
  trigger it from admin Settings) confirming `delivery_data/yalidine`
  actually gains a non-empty `communeFees` map with names matching the
  `communes` list, AND a real commune change in checkout actually moving
  the displayed price — the `commune_name` field assumption inside
  `per_commune` is unconfirmed against a live Yalidine response, so a
  mismatch there would silently degrade to "no per-commune fee found,
  keep using the wilaya fee" (safe, not a crash, but worth confirming).
  ghost's frontend changes are NOT yet committed/pushed (this repo's `main`
  auto-deploys to production via Vercel on push) — pending owner go-ahead.

- Delivery traffic light on order cards (2026-08-12, ghost-only; not yet
  committed). Per the owner's spec: a mini vertical traffic light in each
  order card's upper-left corner (left of the price block, in the always-
  visible header so folded cards keep it too). All dots lit off by default;
  GREEN when the delivery attempt begins — home: earliest out-for-delivery
  event (reuses `OUT_FOR_DELIVERY_RE`), office/Stop Desk: an explicit
  arrival-at-desk event matched by a new `AT_DESK_RE` (stop desk / point de
  retrait / disponible / pickup / `confirme_au_bureau` / "arrivé|déposé au"
  …) that must ALSO pass a best-effort destination-wilaya check
  (`isDestinationEvent`: event location/center vs order `wilayaFr`/`wilaya`,
  accents-normalized — this disambiguates ZR's `confirme_au_bureau` origin
  hub from the destination desk). ORANGE after 24h without delivery, RED
  after 48h — i.e. the carrier has had ~3 days to reach the client. The
  light DISAPPEARS ENTIRELY once delivered (`isDelivered`) or returned/
  cancelled (`trackingStatus.stage == null`); a delivery-problem alert
  (e.g. «الزبون لا يرد») does NOT hide it while the parcel is still out.
  Clock anchors to the carrier's own event timestamps (earliest match), so
  it's correct regardless of when the admin last hit 🔄 تتبع; a 60s
  `setInterval` tick re-renders the list so an open tab escalates live.
  All in `components/admin/views/orders-view.tsx` (`TrafficLight`,
  `trafficLightState`, `deliveryAttemptStart`, `AT_DESK_RE`,
  `isDestinationEvent`); `nowMs()` from `lib/time.ts`. Colors reuse the
  existing literals: green `var(--green)`, orange `#E8A413`, red `#E5484D`,
  off-dot `var(--border)`, pill on `var(--card-2)`. Purely client-side — no
  function/rules/schema changes. `npx tsc --noEmit` + `npx eslint` +
  `npm run build` clean. Known limitation: Noest's desk-arrival wording has
  never been seen in real data, so Noest office parcels may stay all-off
  until the regex is tuned against one; home parcels and ZR/Yalidine desk
  parcels are covered by the existing out-for-delivery regex + the new
  AT_DESK_RE. Real-data verification pending: the ZR parcel
  `04-8A7BKDIWSC-ZR` (out for delivery 2026-08-10/11) should already show
  orange/red on the admin panel.

- Client-not-answering alert now fires for ZR too (2026-08-11, trinkl functions
  DEPLOYED from the `lookup-parcel` worktree; ghost client change pending push).
  ZR reports "customer doesn't answer" as a parcel SITUATION («Ne répond pas 1»,
  metadata «Appel sans réponse»), not as a state event — so it never reached the
  admin panel, while Noest's "Tentative de livraison" already raised
  «معلّق — مشكلة في التوصيل» (DS-7181). Fix: `fetchZrStatus` and `zrWebhook` now
  surface `zrSituationName` on the TrackingStatus and, when the situation matches
  no-answer/refusal (`ne répond|sans réponse|injoignable|absent|raccroch`), raise
  the same `معلّق — مشكلة في التوصيل` alert → the order card shows the red banner
  with 📞 اتصل بالزبون / 💬 واتساب + the client's phone. Client-side `cardAlert`
  also checks `zrSituationName` as a fallback for cached rows. DS-7308 will show
  it after a 🔄 تتبع refresh.

- ZR tracker stage misclassification fixed (2026-08-11, trinkl DEPLOYED via
  `firebase deploy --only functions` from the `lookup-parcel` worktree).
  DS-7308 (`19-8ANH32JK4N-ZR`) showed «تم التأكيد والشحن» (stage 1) while the
  parcel was actually sitting at its DESTINATION sorting center (Hub El Eulma 19,
  Sétif) — ZR reuses the state name `confirme_au_bureau` at every hub (origin bag
  creation, transit, destination validation), so the current state name alone
  under-reported. Fix: `zrNormalize` now normalizes ZR's underscore state names
  (`commande_recue`/`pret_a_expedier`→0, `confirme_au_bureau`→disambiguated by
  content, `vers_wilaya`→2, `sortie_en_livraison`→3, `livree`/`encaisse`→4,
  `retour*`→alert) and `fetchZrStatus`/`zrWebhook` compute the stage as the
  HIGHEST milestone across the whole state-history timeline (same model as the
  Noest path) instead of trusting the single current state name. DS-7308 now
  renders stage 2 «في مركز الفرز» with its 7-event timeline; other in-flight ZR
  parcels self-correct on the next 🔄 تتبع refresh. Committed+deployed on
  `claude/lookup-parcel` (7a62fef). ZR's current situation for DS-7308 is
  «Ne répond pas 1» (customer not answering, 2026-08-10 11:20) — surfaced now by
  the client-not-answering alert entry above.

- Out-for-delivery tracking colors + whole-card glow, all carriers (2026-08-11,
  ghost-only; pushed to `main`, Vercel auto-deploys). From the real ZR parcel
  `04-8A7BKDIWSC-ZR` (state-history: `sortie_en_livraison` with situation
  «مجددا»; current state «No Answer 1, No answer 2»): (1) new shared
  `deliveryRuns(ts)` counts how many times a parcel has gone out for delivery
  from the carrier events (`OUT_FOR_DELIVERY_RE` now covers ZR
  `sortie_en_livraison`/`en_livraison`/`en cours de livraison`/`dispatch`,
  Noest `En livraison`/`Enlevé par le livreur`/`remis au livreur`, Yalidine
  `Out for delivery`; a «مجددا»/again situation name counts as at least a 2nd
  run). A parcel CURRENTLY out for delivery shows AMBER/ORANGE on its 1st run
  and RED on a 2nd run or more — same tone applied to the stage badge, the
  وضعية الشحنة line, and the redelivery event titles in 📋 تفاصيل الشحنة, and
  the ORDER CARD GLOWS to match (orange `#E8A413` halo on 1st run, red on 2nd+,
  overriding the customer/staff neon like the alert does). A redelivery (2nd+)
  reads «خرج للتوصيل مجددا» (orange→red was the earlier iteration; now 1st =
  orange, 2nd = red per the owner's latest spec, with «مجددا مجددا» from the
  3rd run on). (2) delivery-problem alerts still turn the WHOLE card red with
  an always-visible 🔺 banner carrying one-tap «📞 اتصل بالزبون» `tel:` and
  «💬 واتساب» `wa.me/` (via `waIntl`) buttons side by side (`cardAlert(o)` +
  `NO_ANSWER_RE` fallback catches ZR «No Answer», Noest «Client ne répond
  pas»...). New helpers `deliveryRuns`, `AGAIN_TONE_CLS`/`AGAIN_TONE_INK` in
  `orders-view.tsx`. Purely client-side; `npx tsc --noEmit` + `npx eslint` +
  `npm run build` clean; out-for-delivery regex verified against every real
  state name per carrier. The ZR functions (trinkl) still drop ZR's situation
  NAME («مجددا») from the event data and don't yet map «No Answer» to an alert
  — the client heuristic covers both for now; server-side normalization is a
  pending follow-up.

- «تفاصيل الشحنة» now shows the parcel's status + situation (2026-08-11,
  ghost-only, not yet committed). On every order card's expanded tracking
  log, a summary card sits at the top of 📋 تفاصيل الشحنة: **حالة الشحنة**
  (the Arabic stage badge — or the 🔺 alert / ⚠️ return badge when one
  applies — plus «حالة {carrier}: {lastLabel}» with the carrier's raw
  status text) and **وضعية الشحنة** (the single most recent activity event:
  label, driver/agent/center, 📍 location, 📝 reason, 🕒 date — picked by
  max date via a reduce, so it stays correct even if events arrive
  unsorted). The full events log renders unchanged below it. Purely
  frontend in `components/admin/views/orders-view.tsx` (`TrackStepper`);
  no function/API changes. `npx tsc --noEmit` clean; `npx eslint` clean for
  this file (the 4 remaining repo lint errors are pre-existing in
  `cart-drawer.tsx` and `.venv`). Not yet committed.

- Noest tracker now shows the livreur holding the parcel (2026-08-10,
  trinkl DEPLOYED). Noest reports the assigned driver top-level
  (`OrderInfo.driver_name` / `driver_phone`) and per-event `driver`, but the
  code ignored both — the tracker only showed the hub staff who scanned
  (`by`), so "with Livreur CHIKH MOHAMMED SEIF EDDINE · 0559379413" was
  invisible even though "En livraison" was correct. Fix (trinkl
  `functions/index.js`): split `driver` out of the event map (`by` = who
  performed the action, `driver` = the livreur) and added `livreur
  {name, phone}` to the status, falling back to the most recent event naming
  a driver when the top-level fields are empty. UI (`orders-view.tsx`):
  prominent `🚚 مع المندوب:` chip (with a `tel:` link) under the status when
  a livreur is reported, plus the livreur per activity event (hub scanner
  stays as 🏢). Verified against the live Noest API for `4JH-55A-19304060`
  (livreur = CHIKH MOHAMMED SEIF EDDINE, phone = 0559379413); types extended
  in `lib/admin.ts`; tsc + eslint clean; deployed all functions.

- ZR tracker: `vers_wilaya` (and other snake_case French) states showed the
  parcel as «تم التأكيد والشحن» instead of «في مركز الفرز» (2026-08-10,
  trinkl DEPLOYED). ZR's real state names are snake_case French
  (`commande_recue`, `pret_a_expedier`, `confirme_au_bureau`,
  `vers_wilaya`) but `zrNormalize` was written for English/camelCase
  keywords, so `vers_wilaya` fell through every rule → stage -1 → `getParcelStatus`
  kept the parcel's PREVIOUS stage (confirme_au_bureau = 1), misreporting an
  in-transit parcel as shipped. Confirmed against the live API:
  `state-history` of `58-8AQZ1Q3IB2-ZR` returned exactly those 4 states.
  Fix (`zrNormalize` in trinkl `functions/index.js`): normalize the raw name
  by splitting camelCase boundaries, lowercasing, stripping accents (NFD),
  and collapsing `_`/`-`/whitespace to spaces, so snake_case French names,
  their accented descriptions ("Prêt à expédier", "Commande reçue"), and the
  older camelCase English names all hit one keyword set — `vers wilaya` /
  `vers centre` / `vers bureau` now map to stage 2 (في مركز الفرز). Kept the
  safe `-1` fallback (unknown states keep their known stage); deliberately did
  NOT add a generic "arrive" match (an "arrivée chez client" would be
  delivered, not sorting). Verified 23/23 mapping cases incl. every real state
  name + description; `node --check` clean. Deployed all 19 functions
  (firebase deploy, retried after transient 409s on 2 functions), branch
  `claude/noest-link-fields` (c02e679) pushed and `origin/main` fast-forwarded
  so deployed == main again (local `main` working tree untouched).

- «ربط طلب» no longer blocks on read-only parcel data; phone/desk fixes for
  Yalidine + ZR (2026-08-10, ghost-only, `main` → Vercel). Live testing of the
  modal against real parcels exposed that the strict read-only validation
  dead-ends the save on data the admin CAN'T edit: ZR returns the phone as
  `+213669658943` and Yalidine returns MASKED PII (`0********6`,
  name/address redacted to `ا*ة` / `ح* ا*******`) because Yalidine's public
  API redacts recipient info by design (verified: the list endpoint — by
  tracking AND by order_id — returns masked values; Noest and ZR return full
  data; there is NO Yalidine endpoint this app can call that returns the
  unmasked values, so a linked Yalidine order carries the masked name/phone
  and the admin sees the real data on Yalidine's dashboard). Both failed
  `isValidPhone` (`/^0[567][0-9]{8}$/`), so every ZR/Yalidine link attempt
  was blocked by "رقم الهاتف غير موجود أو غير صالح في الطرد". A ZR office
  parcel also blocked with "مكتب الطرد غير مطابق" when the desk name didn't
  exactly match a synced center. Fix in `link-order-modal.tsx`:
  (1) read-only customer/address fields NEVER block the save anymore — the
  only hard requirement is the product list; missing/unmatched values save as
  the best available parcel data and surface as non-blocking yellow warnings
  (`ReadOnlyField` `warn`/`warnMsg`, `--warn-ink` border, `warns` state)
  instead of red errors that instructed fixing data at the carrier.
  (2) Phone: new `carrierPhoneOk` accepts `0[567]XXXXXXXX`, `+213XXXXXXXXX`,
  and Yalidine's masked `0*****XXXX`; `normalizeCarrierPhone` converts the
  stored `+213XXXXXXXXX` → local `0XXXXXXXXX` (the rest of the store uses
  local format). (3) Desk/commune: `communeValue`/`communeLabel` fall back to
  the parcel's OWN value (`pkg.commune`) when the desk/commune doesn't match
  the carrier's synced list, so the order records the parcel's real desk name
  and the fee still comes from the matched wilaya; office desk matching in
  `prefillFromPackage` is now exact-then-partial (contains) with collapsed
  whitespace. Note: the earlier ZR hub-name desk match WAS verified correct
  against the live API (hub.name === deliveryAddress.hubName for wilaya 58),
  so the remaining mismatch case was the user's specific parcel — now saved
  as-is rather than blocked. Verified: `npx tsc --noEmit` + `npx eslint`
  clean. NOT yet committed — pending owner review.

- Admin "ربط طلب" (link order) flow (2026-08-09) — for parcels that already
  exist at a carrier (created directly in the Yalidine/Noest/ZR dashboard,
  outside this app): a "🔗 ربط طلب" toolbar button in `orders-view.tsx` opens
  `components/admin/views/link-order-modal.tsx`, where the admin picks the
  carrier, types the tracking number, and a new admin-gated `lookupParcel`
  callable fetches that parcel's live info from the carrier WITHOUT creating
  anything: a normalized `TrackingStatus` (reuses the exact `fetch*Status`
  functions the tracker already uses) plus a `package` snapshot (receiver
  name/phone, wilaya/commune, address, product label, COD amount, delivery
  type, createdAt, raw carrier object). The callable is `requireAdmin`-gated
  (mirrors firestore.rules isAdmin() emails, like the register*Webhook
  callables) because the response carries customer PII — unlike the older
  open callables. Function committed on trinkl branch `claude/lookup-parcel`,
  built from `origin/main` in worktree `.claude/worktrees/lookup-parcel` (the
  local main is diverged) — MERGE `claude/lookup-parcel` INTO MAIN when
  convenient so deployed == main again. The modal confirms the parcel (shows
  the summary + current status), prefills the customer/address fields
  (wilaya/commune matched by NAME against that carrier's own live lists, same
  lookups as new-order-modal), and on submit writes a normal order via
  `saveOrder` that references the tracking directly — `[carrier]: { tracking,
  createdAt }`, `trackingStatus`, a `linkedParcel` snapshot, `source:
  "admin_linked"`, `fulfilled: true`, `status: "Confirmed"`, plus
  `parcelPrice` (the parcel's OWN COD amount — what the courier collects; the
  modal's computed total is only the store's internal record) and
  `deliveryLabel` (the parcel's product label). NO create*Parcel call ever
  runs — the parcel is already live at the carrier and this flow must not
  double-ship. Because the order ends up with real carrier tracking, the
  existing stepper/refresh/cancel machinery works as-is and the card's
  create-parcel buttons correctly hide (the `!carrier` gate). Orders-view
  shows a pink "🔗 طرد مربوط" badge (same convention as the other source
  tags) and a "بيانات الطرد المربوط" strip (product label, COD, created
  date) from the `linkedParcel` snapshot. New types
  `ParcelPackageInfo`/`ParcelLookupResult` and a `lookupParcel()` client
  helper in `lib/admin.ts`; `linkedParcel` added to the `Order` type.
  Deployed `functions:lookupParcel` to desert-shop-24af9 (live) and pushed
  `claude/lookup-parcel` to origin. Verified: `node --check` on the function,
  `npx tsc --noEmit` + `npx eslint` clean. NOT exercised live: a real lookup
  against the carriers' production APIs (package field names are read
  generously across the shapes the create/webhook code already uses, but the
  exact receiver-name/COD fields for parcels created OUTSIDE this app are
  unconfirmed) and a real submit — the admin should try one real tracking
  number per carrier and confirm the prefilled name/phone/COD match before
  trusting the extraction; mismatches degrade to editable fields, never a
  crash.

- Admin "ربط طلب" flow — client info is now READ-ONLY from the carrier, plus a
  Noest tracker false-"delivered" fix (2026-08-09, both DEPLOYED):
  (1) `link-order-modal.tsx` no longer lets the admin type
  name/phone/wilaya/commune/delivery-type/address when linking an existing
  parcel — they all come READ-ONLY from `lookupParcel`'s `package` (name/phone
  from the parcel; wilaya/commune matched by NAME against that carrier's live
  list, raw parcel value shown when unmatched; delivery type from
  `pkg.deliveryType`; address only for home delivery). The admin's only input
  is the product list (`ProductPicker`). Missing or locally-unmatched parcel
  values render as-is in red and BLOCK saving with a message to fix the data at
  the carrier and re-search. Added a local `ReadOnlyField`; removed the editable
  inputs/selects and the now-dead `selectWilaya`/`selectDeliveryType`/
  `wilayaList`/`sel`. Verified `tsc --noEmit` + `eslint` clean; pushed to ghost
  `main` (`5faeb2b`), Vercel auto-deploys.
  (2) Noest tracker bug in trinkl `functions/index.js`: an out-for-delivery
  parcel (e.g. `4JH-55A-19304135`) showed "تم الاستلام" while Noest's own log
  showed "En livraison". Root cause: the "Enlevé par le livreur" courier-pickup
  event mapped to stage 4 via BOTH `NOEST_STAGE.livre = 4` and the `/livr[ée]/`
  label rule matching "livre" inside "livreur", and `fetchNoestStatus` takes
  the max over ALL history so it stuck. Fix: `NOEST_STAGE.livre` → 3 (only
  `livred` = 4); `noestNormalize` catches "enlevé/remis/affecté par le livreur"
  as out-for-delivery and excludes "livreur" from the delivered rule;
  `fetchNoestStatus` now only trusts "delivered" when the CURRENT (latest)
  event confirms it (a history-pinned stage 4 downgrades to the current step,
  max 3, with a `console.log`). Unit-tested against the real event log
  (→ stage 3 "خرج للتوصيل", no alert), genuine delivered (→ 4), and
  delivered→redelivered (→ 3). Deployed all 21 functions to desert-shop-24af9
  and fast-forwarded trinkl `main` to `85b12e8` — this also resolves the
  "MERGE claude/lookup-parcel INTO MAIN" note in the entry below (deployed ==
  main again). NOTE: trinkl's local `main` working tree still carries its own
  uncommitted `functions/index.js` + untracked files — leave it alone.

- Noest «ربط طلب» lookup returned EMPTY client info — fixed by reading the
  real response shape (2026-08-09, DEPLOYED). Live test with tracking
  `4JH-55A-19304135`: the lookup succeeded (parcel box appeared) but
  name/phone/wilaya/commune/address were blank because `lookupNoest` read
  `entry.receiver_name`, `entry.parcel_price`, `entry.wilaya_name`, etc. —
  the real Noest `/get/trackings/info` response nests everything under
  `entry.OrderInfo` (`client`, `phone`, `adresse`, `wilaya_id` (NUMERIC
  code, not a name), `commune`, `montant`, `produit`, `created_at`,
  `stop_desk`) plus a top-level `recipientName`. Fixed the extraction in
  `lookupNoest` to read from `OrderInfo` (with `recipientName` fallback for
  the name, `montant` → `price` COD), and since Noest's `wilaya_id` is the
  numeric code, the modal now matches the wilaya by id first then by name
  (Yalidine/ZR still match by name). Verified the extraction against the
  live API → Zidi / 0781466055 / wilaya 6 (بجاية) / Akfadou / 11900 DZD.
  Deployed all functions from branch `claude/noest-link-fields` (7fe4f32,
  based on origin/main 85b12e8) and pushed it; ghost `main` updated in the
  same push as the read-only flow entry above (`link-order-modal.tsx`
  prefill). Remaining risk (tracker's earlier note): Yalidine/ZR `lookup*`
  field shapes are still unconfirmed against real production parcels — the
  admin should test one real tracking per carrier.

- ZR + Yalidine «ربط طلب» lookup verified/fixed against real parcels
  (2026-08-09, DEPLOYED). (1) ZR `58-8AQZ1Q3IB2-ZR` (pickup-point, wilaya 58
  El Meniaa, COD 15070): extraction mostly worked but the territory display
  name ("El Menia") does NOT match the synced app name ("El Meniaa"), and for
  a Stop Desk parcel the desk couldn't be selected. Fixed `lookupZr` to use
  `deliveryAddress.cityTerritoryCode` (numeric, like Noest's wilaya_id) as
  the wilaya, and for pickup-point parcels to put `deliveryAddress.hubName`
  (the exact synced center name, e.g. "Hub Menea 58 مكتب المنيعة") in
  `commune` so the modal selects the desk directly. (2) Yalidine
  `yal-UU40XP` (home, wilaya 55 Touggourt, COD 15200): field names already
  matched (firstname/familyname/contact_phone/to_wilaya_name/...
  — Yalidine masks PII in the public API: "ا*ة", "0********6"), but
  `deliveryType` read the nonexistent `is_stopdesk` — Stop Desk parcels are
  flagged by `stopdesk_id`/`stopdesk_name` (null = home). Fixed the check and
  also sent `to_wilaya_id` (numeric) as the primary wilaya. Modal
  (`link-order-modal.tsx`): wilaya matching now tries BOTH `pkg.wilaya` and
  `pkg.wilayaFr`, id-first then name (so any carrier's numeric code or name
  matches), and the office desk-name match collapses whitespace (ZR hub names
  have double spaces). All three carriers now verified against live parcels;
  extracted for ZR: نسرين / +213669658943 / wilaya 58 / "Hub Menea 58
  مكتب المنيعة" / 15070 DZD. Functions pushed on `claude/noest-link-fields`
  (1499ace), ghost `main` (same push as the entry below's modal work).

- Edit an existing order's products (2026-08-08, same admin-panel work as
  the entry directly below): a "✏️ تعديل المنتجات" button on each order card
  in `orders-view.tsx` lets staff add/remove products or change quantities
  on an order that's ALREADY been placed — not just at creation time. Only
  shown while the order has no carrier tracking yet (`!carrier`, the same
  gate the existing pre-shipping "delivery label"/"parcel price override"
  fields on this card already use) — once a real parcel exists, its
  manifest was already built from the original items, so this repo doesn't
  try to silently keep a carrier's label in sync with a later edit.
  Extracted the product-search-and-cart widget out of `new-order-modal.tsx`
  (built for the entry below) into a shared
  `components/admin/product-picker.tsx` (`ProductPicker` component +
  `CartItem` type + `addToCart`/`cartFromOrderItems` helpers) so the two
  modals can't drift — `new-order-modal.tsx` was refactored to use it too,
  net negative diff. `cartFromOrderItems` normalizes an order's stored
  `items[]` (old docs may carry `quantity` instead of `qty`, a string
  price, or no `image`) the same way `orders-view.tsx`'s own `picList`
  already tolerates, backfilling a missing image from the live catalog by
  id. New `components/admin/views/edit-items-modal.tsx`: opens with that
  order's current items pre-loaded (a lazy `useState` initializer, not an
  effect — the modal remounts via `key={editItemsOrderId}` when a different
  order is opened, same "state-syncing effect → key remount" pattern
  already used by the landing-pages admin tab), lets staff edit freely, and
  on save writes `{ items, subtotal, total }` via `updateDocIn` — delivery
  fee is intentionally left untouched (this app's fee model is per-wilaya,
  not per-order-weight, so a product change never changes what shipping
  costs). `patchOrder` (already local to `orders-view.tsx`) applies the
  same patch to the in-memory store immediately, matching every other
  optimistic-update in this file.
  Verified against real production Firestore (same already-authenticated
  admin session as the entry below): opened the modal on a real order
  (`DS-2060`, 2 items, 11,550 د.ج), confirmed the cart pre-filled exactly
  matching the order's real items, removed one item, bumped quantity
  (3→4, confirmed the double-click-with-no-render-yield result was a test-
  script artifact, not an app bug, by re-testing with a proper wait between
  clicks), searched and added a different real catalog product, confirmed
  the running total recalculated correctly (22,200 + 1,450 = 23,650), then
  hit Cancel and confirmed the real order was completely unchanged
  afterward (still its original 2 items and 11,550 total) — deliberately
  never clicked Save against this real order, to avoid mutating production
  order data without the owner's explicit go-ahead. Also confirmed the
  `!carrier` gate itself live: of 6 real orders on the page, exactly the 2
  that already had carrier tracking correctly had NO edit button.
  `npx tsc --noEmit`, `npx eslint`, and `npm run build` all clean.

- Admin panel "existing client" autocomplete + manual order creation
  (2026-08-08): ports the Noest/ZR Express feature the owner asked for —
  typing a returning customer's name while starting a new order suggests
  them in a dropdown, and picking one autofills phone/wilaya/commune/
  address. There was no manual "create order" screen anywhere in this app
  before this (admin only ever viewed orders that arrived via checkout/
  seller-modal/landing pages) and no separate `clients` collection — this
  had to be built from scratch, and where to put it was a real security
  decision, not just a UI one: the storefront's "seller mode" (product-page
  quick-order modal) is gated only by a password literally shipped in the
  page's JS (`tango88`, `checkout-form.tsx`), not real Firebase Auth, and a
  prior session explicitly decided customer PII (name/phone/address) must
  never be exposed through that gate — only derived integers (see the
  "in-closet" stock counter entry below). Confirmed with the owner via
  AskUserQuestion: build this **admin-panel-only** (`/amelhadj`, real
  Firebase Auth already required there); the storefront seller quick-order
  modal is untouched and still has no client lookup.
  New `lib/clients.ts` (admin-only — never import outside `/amelhadj`):
  `deriveExistingClients(orders)` groups the admin store's already-loaded
  `orders` by normalized phone (no extra Firestore reads — `orders` is
  admin-only-readable and the panel already holds them all via
  `watchOrders`), keeping each phone's MOST RECENT order as the client
  snapshot plus a running order count; `searchClients(clients, query)`
  matches typed text against name (ranked: starts-with → word-starts-with →
  contains) or phone digits (3+ digits typed), Noest/ZR search both too.
  New `components/admin/views/new-order-modal.tsx`: full manual order form
  (name with the live suggestion dropdown, phone, carrier picker, wilaya/
  commune or Stop Desk select, home/office toggle + fee preview, Yalidine
  insurance, a product search-to-add picker since admin has no single-
  product context like the storefront flows, qty +/-, running total) —
  reuses `lib/delivery.ts`'s carrier/fee helpers and `saveOrder` from
  `lib/firebase.ts` exactly like every other order-creation surface, with
  `source: "admin_phone"` — the SAME tag `checkout-form.tsx`'s staff mode
  already used, so `orders-view.tsx`'s existing "📞 أدخلتيه بنفسك" badge and
  neon-halo exclusion needed no changes. Wired a "➕ إضافة طلب" trigger into
  `OrdersView`'s toolbar (kept visible even when the order list is empty,
  unlike the search-driven empty state).
  Verified against the REAL production Firestore (`npm run dev`, signed-in
  admin session already active in the browser profile): searched a real
  customer ("نسرين"), confirmed the suggestion showed her phone/wilaya/order
  count, selected it, and confirmed phone + wilaya autofilled correctly.
  Caught and fixed a real bug this way (would have shipped broken without
  live data): Stop-Desk clients' `baladiya` stores the desk's display NAME
  (e.g. "مكتب المنيعة"), but the commune `<select>` is keyed by the desk's
  id — `selectClient` was setting the select's value to the name, so it
  silently failed to preselect. Fixed by resolving the id from the name
  against that carrier's live desk list (`centersForCarrier`) inside
  `selectClient` itself, reading the `cache` prop directly rather than
  component state that isn't committed yet at that point in the function.
  Re-verified after the fix: desk correctly preselected. Also verified the
  product search/add/qty/totals math live (real catalog data). Did NOT
  click the actual submit button — no test order written to production.
  Note for whoever reads this next: while this verification was running, a
  genuine unrelated order (`DS-9601`, customer "زهير كتفي") arrived live in
  the panel via the existing real-time `onSnapshot` — confirmed by its data
  matching nothing typed during this session (different customer/carrier/
  wilaya/products). Left untouched; recorded here only so it isn't mistaken
  for test data if it's ever traced back to this session.
  `npx tsc --noEmit`, `npx eslint`, and `npm run build` all clean.

- Yalidine fee correction override (2026-07-22): the synced Yalidine grid
  (`delivery_data/yalidine.fees`) is wrong — `site_settings.originWilaya` is
  correctly "Touggourt", but the server-side `syncCarriers` sync stored a
  national/Alger-origin table (Alger 500/300, and Touggourt itself 1050/600
  as a destination — not the cheapest row it would be from a true Touggourt
  origin), so northern destinations are ~200-300 DA too cheap. Root fix is
  in `tango-sama/trinkl` (syncCarriers must query `/v1/fees` from the real
  origin wilaya) — out of scope for this frontend repo. Interim in-repo fix:
  `FEE_OVERRIDES` in `lib/delivery.ts`, applied first in `baseFeeForCarrier`
  (override → synced → static), seeded with owner-confirmed Alger (wilaya
  16) = home 800 / desk 500 (was 500/300). Wins on all order surfaces
  (checkout, seller quick-order, collagen) since they share `feeForCarrier`.
  Add a wilaya per line as its correct fee is confirmed; remove once the
  upstream sync is fixed. Verified: resolution order correct (Alger→800/500,
  other wilayas unchanged, non-Yalidine carriers unaffected), tsc + lint
  clean.

- Yalidine weight/oversize fee calculation (2026-07-22): made the delivery
  fee model explicit and correct per Yalidine's `/v1/fees` spec —
  `total = base fee (home|desk) + weight ("oversize") fee`, where the
  weight fee applies only to billable weight above a 5 kg free threshold
  (first 5 kg free, then a per-kg rate for each additional whole kg).
  `lib/delivery.ts` now splits `baseFeeForCarrier()` (the synced per-wilaya
  home/desk lookup, unchanged) from `feeForCarrier()`, which adds the
  weight fee; new `FREE_WEIGHT_KG = 5` / `PARCEL_WEIGHT_KG = 1` constants,
  `billableOverweightKg()` and `weightFee()` helpers. This store ships a
  fixed ~1 kg per parcel, which is under the free threshold, so the weight
  fee is always 0 and the customer pays exactly the base fee — the rule is
  written out against a named constant (not a magic 0) so it stays correct
  if heavier products are ever added. `feeForCarrier`'s signature is
  backward-compatible (weight defaults to 1 kg), so checkout / seller
  quick-order / collagen order-modal are unchanged and remain the single
  source of truth. Verified: weight helper matches Yalidine's own doc
  examples (4 kg→0, 5 kg→0, 7 kg→100 @ 50 DA/kg), `tsc --noEmit` and lint
  clean. NOTE for full per-commune accuracy: Yalidine's real fees vary by
  commune within a wilaya (e.g. Adrar 1400 vs Akabli 1450 home), but the
  synced `delivery_data/{carrier}.fees` grid is stored PER WILAYA only (no
  per-commune fees, confirmed live 2026-07-22). Closing that gap requires
  the server-side `syncCarriers` in `tango-sama/trinkl` to store per-commune
  fees — out of scope for this frontend repo.

- Collagen landing page at `/collagen` (2026-07-21): full port of
  `trinkl/collagen.html` from `origin/main` (the local trinkl working copy
  lacks this — it's ~36 commits behind and missing the before/after +
  glutathione sections added later). See
  `context/feature-specs/04-collagen-landing.md`. Self-contained route
  (`app/collagen/page.tsx`, outside `(storefront)`, own top bar/footer, no
  shared Nav/CartDrawer/WhatsAppFloat) with its own teal/deep-green
  palette. 14 image assets (before/after photos, story cards, problem-card
  backgrounds, glutathione) extracted via `git show origin/main:...` into
  `public/assets/collagen/` (didn't exist in the local trinkl working
  tree's untracked files, which had older/differently-named assets from an
  abandoned attempt). Ported as a scoped `collagen.module.css` (not
  Tailwind utilities) given the density of custom animation/3D/drag CSS —
  a scroll-linked 3D story carousel (`story-stack.tsx`), draggable
  before/after comparison sliders (`before-after.tsx`), a 3D swipe drum
  (`trust-strip.tsx`), and a masonry review grid with staggered reveal
  (`reviews.tsx`) — all kept as direct imperative `useEffect`+refs
  matching the source's own DOM-manipulation style, safer for physics/
  timing fidelity than reworking into declarative state. Hardcoded
  five-product list (`components/storefront/collagen/products.ts`,
  deliberately separate from the Firestore `products` collection per
  architecture-context.md) including the glutathione "special offer" with
  its gold shimmer animation and ribbon badge. Multi-select order modal
  (`order-modal.tsx`) — a customer can add several products to one order;
  the selection persists across modal open/close within the page visit
  (lifted into the parent `collagen-page.tsx` since it's a direct
  consequence of clicking a product's order button, not something to
  derive via an effect — avoided a `react-hooks/set-state-in-effect` lint
  error this way). This page only ever offers Noest or Yalidine (never
  ZR), a faithful port of the source's own rule — applied the same
  `carrierDataReady()` gating fix from the checkout/seller-modal work so
  wilaya/commune here also never show another carrier's data while
  loading. Order submission reuses `saveOrder`/`generateOrderNumber`,
  `source: "landing_collagen"`, same shape as checkout.
  Verified: lint + build clean (`force-dynamic`, correct route). Full
  visual + interactive verification via a real (non-virtual-time) headless
  Chrome instance driven over the DevTools Protocol: screenshotted hero,
  before/after sliders (drag divider correctly positioned), 3D story
  stack (correct depth/perspective), problem-cards grid, benefits, and the
  products section — then drove a real click-through: clicked a product's
  order button, confirmed the modal opened with that product pre-selected,
  filled name/phone, selected a real wilaya (confirmed live Noest data
  loaded — "1 - أدرار" — not the static fallback), and confirmed the
  delivery-fee preview updated live and correctly (1,500 د.ج home / 700
  د.ج office, matching Adrar's real Noest rates). No console errors, no
  React error boundaries triggered. NOT exercised: an actual successful
  submit-and-confirm (didn't want to write a fake order to production
  Firestore without the owner's say-so) — the code path is identical to
  checkout's already-verified submit logic, just worth one real click
  before fully trusting it.

- Commune/wilaya list integrity (2026-07-20): the earlier carrier-switch
  fix (clearing a stale wilaya/commune on switch) left a real gap — on
  first load, and briefly on any carrier re-fetch, `wilayasFor`/
  `communesForCarrier` silently fell back to the static generic
  (Yalidine-shaped) list for WHICHEVER carrier was selected, so a
  customer could pick a wilaya/commune that carrier doesn't actually
  serve. New `carrierDataReady(company, cache)` in `lib/delivery.ts`
  makes this explicit; `checkout-form.tsx` and `seller-order-modal.tsx`
  now render the wilaya select as disabled with an "⏳ جاري تحميل قائمة
  الولايات..." placeholder — and show NO options at all — until that
  carrier's own live-synced list has loaded, instead of ever displaying
  another carrier's (or the static fallback's) data as if it were real.
  `selectCompany` also now clears the current wilaya/commune outright if
  the newly chosen carrier's data isn't loaded yet, rather than resolving
  the match against the wrong shape. The static WILAYAS/COMMUNES list is
  now ONLY ever used for `fee()`'s price estimate (intentional per the
  original design, e.g. ZR having no fee grid of its own) — never for
  eligibility/option lists. Verified live data is genuinely distinct per
  carrier (Firestore `delivery_data/*`, synced 2026-07-19): Yalidine 58
  wilayas, Noest 56, ZR 54 — different commune sets too. Verified the fix
  itself with a real (non-virtual-time) headless Chrome instance driven
  over the DevTools Protocol (dump-dom's `--virtual-time-budget` does not
  reliably wait for real client-side fetch() calls, a harness quirk, not
  a product bug) — confirmed each carrier's `carrierDataReady` flips true
  and shows its own correct counts once loaded (noest 56/1478, yalidine
  58/1458, zr 54/1531), and that before loading no cross-carrier data
  ever renders.
- Carrier webhooks (2026-07-20, DEPLOYED to desert-shop-24af9): live
  parcel-status push from ZR Express (Svix-signed, per their integration
  guide — events parcel.state.updated / parcel.state.situation.created /
  parcel.isReturn.updated) and Yalidine (GET crc_token echo handshake +
  X-YALIDINE-SIGNATURE HMAC-SHA256). New functions (committed on trinkl
  branch `webhooks`, 32df793, built on origin/main in worktree
  `.claude/worktrees/webhooks` because the local main is diverged — MERGE
  `webhooks` INTO MAIN so deployed == main again): `zrWebhook` +
  `yalidineWebhook` receivers verify signatures against
  `private/{zrexpress,yalidine}.webhookSecret`, dedupe by event id, map
  statuses through the SAME normalizers as getParcelStatus and write
  `trackingStatus` (+ events log entries) onto the order matched by
  zr.parcelId/zr.tracking or yalidine.tracking; `registerZrWebhook` /
  `registerYalidineWebhook` are ADMIN-GATED callables (mirror
  firestore.rules isAdmin() emails — unlike the older open callables)
  that register the endpoint with the carrier and store the secret
  server-side; Yalidine's registration API is undocumented, so on refusal
  it returns {manual:true, url, secret} and the ghost settings alert
  shows what to paste into the Yalidine dashboard. Ghost settings gained
  "🔔 تفعيل التتبع التلقائي (Webhook)" buttons on the Yalidine and ZR
  cards (flags yalidineWebhookReady/zrWebhookReady). The panel needs no
  other changes — orders stream via onSnapshot, so webhook writes move
  the tracking steppers live. Noest offers no public webhooks (manual 🔄
  stays). Verified on production: GET handshake echoes crc_token,
  unsigned POSTs → 401 on both receivers, anonymous register call → 403.
  NOT yet exercised end-to-end with a real carrier event — after clicking
  the تفعيل buttons, the next real parcel status change is the true test.
- Carrier picker fixes (2026-07-20): default carrier is now Noest (first
  enabled in `CARRIER_ORDER` = noest → yalidine → zr, matching the live
  site's checkout/product defaults — ghost had been defaulting to Yalidine
  via object-key order), picker buttons render Noest first, and switching
  carrier clears a selected wilaya/commune the new carrier doesn't serve
  (fee follows automatically since it's derived). Applied to both
  `checkout-form.tsx` and `seller-order-modal.tsx`.
  Also: "Wilaya de départ: Touggourt" on Yalidine parcels is DATA, not a
  bug — live `site_settings.originWilaya` = "Touggourt"; owner must pick
  the right ولاية الإرسال in Settings. Ghost's settings now persist
  `originWilaya` through every save button (the old panel only saved it
  via the Yalidine save button, so general-save silently reverted it).
- Admin orders search (2026-07-19, ghost-only — not in trinkl): search box
  in the admin topbar, shown on the orders tab only; the topbar is now
  sticky (`bg-background/95` + blur) so title + search stay visible while
  scrolling. Query lives in the admin store (`ordersSearch`), cleared on
  tab switch; matches order number, customer, phone, wilaya/commune,
  address and item titles; refresh-all only touches the filtered list;
  dedicated "لا توجد طلبات مطابقة للبحث" empty state.
- Sync with trinkl origin/main (2026-07-19): the live site gained ~36
  commits after the admin-panel port (order-tracking rework PRs #5–#9,
  collagen landing work, carrier-API normalization fixes in
  `functions/index.js` — the functions changes are server-side and already
  deployed, so ghost consumes them without porting). Ported into ghost:
  (1) orders view rework — sorted strictly by date placed (and fixed
  `orderStamp` mixing `placedAt` seconds with `createdAt` ms), cards fold
  when older than 7 days or delivered (customer/phone/location stay visible
  on folded cards; click to expand), customer website orders get the
  #00D1FF neon halo (upstream's own version of the earlier owner request),
  redesigned tracking stepper (steps always visible; reached steps green
  with ringed current step; delivery problems pin the parcel before the
  final step with a red 🔺 marker on the line; status badge + the
  carrier's raw status text + 🕒/📍/🔄 meta), new "📋 تفاصيل الشحنة"
  collapsible shipment log rendering the carrier `events` (agent, hub,
  location, causer, reason — colour-coded by `badge-class`), refresh now
  scrolls the stepper to the current step, refresh-all only touches
  expanded cards; (2) `TrackEvent`/`events` added to `TrackingStatus` in
  `lib/admin.ts`; (3) mobile hamburger stays fixed while scrolling;
  (4) checkout WA-resend guard simplified (`if (openWa)`), matching
  upstream. Already-covered upstream changes needing no port: seller
  quick-order ZR Express + per-carrier fees (ghost had it), contact-form
  WA guard semantics. NOT ported yet (future collagen phase): all
  collagen.html work (before/after section, glutathione offer, webp
  assets). NOTE: the local reference copy `C:\Users\Tango\Desktop\desert
  shop` is on a diverged local branch (5 local commits vs origin) and is
  ~36 commits behind origin/main — port future work from `origin/main`
  (fetched in that repo), not the working tree. Verified: lint + build
  clean, all routes 200, headless screenshots of the reworked stepper in
  all five states (empty / in-progress / delivery-problem / return /
  delivered) match the origin design.
- Next.js rebuild — admin panel at `/amelhadj` (2026-07-19): full port of
  `trinkl/amelhadj.html` per `context/feature-specs/03-admin-panel.md`.
  Route group `app/(admin)/amelhadj` (obscure URL kept, `robots: noindex`),
  auth gate on Firebase email/password (`components/admin/admin-panel.tsx`;
  sign-in also sets the storefront's `ds_staff` flag), dark-default theme
  with the owner's `ds_theme` light toggle — admin tokens scoped under
  `.admin` in `app/globals.css`, with the old panel's light-mode
  `[style*=...]` color hacks replaced by proper state tokens
  (`--ok-ink`, `--info-bg`, ...). `lib/admin.ts` is the admin-only data
  layer (Auth/Storage/Functions SDKs + orders/messages/expenses reads +
  generic writes + WebP upload + `callFn` for the deployed us-central1
  callables) so storefront bundles stay clean; `stores/admin-store.ts`
  (Zustand) holds panel state with live `onSnapshot` watchers on orders and
  expenses (old `watchLedger`, now updating orders + income views). All
  seven views ported (`components/admin/views/*`): products (search/filter/
  pager/bulk delete/extra images), categories (color, visibility, reorder),
  featured (reorder), orders (pending-first sort, source/carrier tags,
  parcel creation for Yalidine/Noest/ZR with label+price inputs, tracking
  stepper, sequential refresh-all, Noest label PDFs incl. multi-select
  print bar), messages, income (stat cards, expenses, expandable ledger),
  settings (notifications/email/push, general, TikTok live, WhatsApp
  toggle, three carrier credential cards + sync, min-one-carrier rule).
  `public/push-sw.js` copied from trinkl so push activation works when
  deployed. Deliberate small fixes vs. the original, all schema-compatible:
  (1) product edit loads `images.slice(1)` as extras — the old panel
  reloaded the full array and duplicated the main image on every edit-save
  cycle, and removing all extras now actually clears the stale `images[]`;
  (2) the TikTok live toggle additionally writes `tiktokLiveUntil`
  (additive field) because the ghost storefront's `TikTokLiveButton` reads
  it — the old site keeps computing from `tiktokLiveAt + hours` and is
  unaffected. Owner-requested change (2026-07-19): order-card highlighting
  is inverted vs. the old panel — staff-entered orders (`admin_phone`,
  `seller_direct`) are plain, and customer website orders (checkout +
  collagen landing) glow with a blue neon border instead of the old purple
  `byadmin` accent. React Compiler lints fixed properly again (toast visibility
  derived from keys instead of setState-in-effect; `Date.now()` in a
  compiled handler moved behind `lib/time.ts nowMs()`).
  Verified: `lint` + `build` clean (`/amelhadj` builds as a static shell —
  correct, all data is client-fetched after auth), storefront routes still
  200; headless Chrome render shows clean JS execution (React mounts, HMR
  connects, zero console errors); a Node probe with the same SDK confirmed
  `onAuthStateChanged` fires `null` (~1ms, so the login card appears) and
  the Auth backend rejects bad credentials with `auth/invalid-credential`
  (the login card's error branch). NOT done: a real credentialed
  click-through (sign in, save a product, create a parcel) — owner should
  do that once before trusting the panel; parcel creation is idempotent so
  re-runs are safe.

- Next.js rebuild — checkout, delivery data layer, seller-direct modal
  (2026-07-19): `lib/delivery-data.ts` (58 wilayas + communes + per-carrier
  home/stopdesk fee defaults) generated programmatically from
  `trinkl/js/yalidine.js`'s data literals via a one-off Node script — not
  hand-transcribed, so the ~68KB of data is guaranteed byte-faithful.
  `lib/delivery.ts` ports the pure lookup functions
  (`wilaya`/`communes`/`fee`/`wilayasFor`/`wilayaForCarrier`/
  `communesForCarrier`/`feeForCarrier`) but drops the original's
  module-level mutable `CARRIER` cache in favor of passing a `CarrierCache`
  value explicitly — same behavior, no shared-mutable-singleton in a React
  tree. `getDeliveryData`/`saveOrder` added to `lib/firebase.ts`;
  `hooks/use-delivery-data.ts` fetches all three carriers' live Firestore
  data (`delivery_data/{carrier}`) into that cache client-side.
  `app/(storefront)/checkout/page.tsx` + `components/storefront/
  checkout-form.tsx`: cart summary (qty +/-/remove), staff/seller mode
  (`hooks/use-staff.ts`, `useSyncExternalStore`-based — same `tango88`
  prompt as the original; this is a cosmetic UI toggle only, not a Firestore
  security boundary, so it wasn't in scope for the admin-panel auth fix),
  carrier picker (staff-only) + Yalidine insurance toggle, wilaya/commune
  selects with live fee preview per delivery type, phone/field validation,
  order submission (`saveOrder`) with a success overlay and "resend via
  WhatsApp" (`buildMessage`, ported line-for-line from
  `trinkl/checkout.html`). Added the seller-direct quick-order modal
  (`components/storefront/seller-order-modal.tsx`) to the product detail
  page — the piece deliberately deferred from the previous phase — reusing
  the same delivery data layer instead of duplicating it.
  Two React Compiler purity/effect lints surfaced and were fixed properly
  rather than suppressed: `Math.random()` order-number generation moved to
  a plain `lib/order.ts` helper (same pattern as the earlier `Date.now()`
  fix), and a "read localStorage on mount, setState in an effect" pattern
  for staff-mode replaced with `useSyncExternalStore`
  (`hooks/use-staff.ts`) — SSR-safe and reactive within the same tab.
  Verified: `lint` and `build` clean (all dynamic routes correctly inherit
  the storefront layout's `force-dynamic`), then `curl` checks against a
  running `npm run dev` — empty-cart state on `/checkout`, seller-direct
  trigger button present on a real product page. Full interactive
  walkthrough (selecting a wilaya, watching fees update, submitting an
  order) was not driven end-to-end in this session — no browser automation
  tooling available; recommend clicking through it manually before trusting
  it fully.
- Next.js rebuild — categories, products, product detail (2026-07-19):
  `app/(storefront)/categories/page.tsx` (all visible categories, no cap —
  extracted the tile grid itself into `components/storefront/
  category-tile-grid.tsx` so the home page's capped-at-8 `CategoryGrid` and
  this full listing share the same tile markup instead of duplicating it).
  `app/(storefront)/products/page.tsx` + `components/storefront/
  products-browser.tsx` (client): search (debounce-free, since it's an
  in-memory filter over already-fetched products, not a re-fetch), sort
  (new/price-asc/price-desc/name), category pills synced to the `?cat=`
  query param via `router.replace`, matching `trinkl/products.html`'s
  behavior. `app/(storefront)/product/[id]/page.tsx` +
  `components/storefront/product-detail.tsx` (client): gallery with
  thumbnail switching, quantity stepper, add-to-cart, WhatsApp deep link,
  benefits checklist, related products (same-category first, filled with
  others, capped at 4) — matches `trinkl/product.html` **except** the
  seller-direct quick-order modal, deliberately deferred to the
  checkout phase (see Current Goal) rather than half-built or duplicated.
  Missing product id shows an inline "المنتج غير موجود" message (200, not a
  hard 404) matching the original's behavior.
  Verified: `lint` and `build` clean (all three new routes correctly inherit
  `force-dynamic` from the storefront layout), then a full `npm run dev`
  pass — real product/category data confirmed rendering, category-filtered
  product listing works, product detail page shows real title/price/
  benefits, missing-product fallback confirmed. Also caught and fixed: (1)
  a copy-paste bug in the "all" filter pill where both branches of a ternary
  produced identical classes; (2) a stale dev server left listening on port
  3000 from earlier verification that could have masked whether checks were
  hitting old vs. new code — killed all listeners and re-verified clean.
- Next.js rebuild — theme, shared layout, home page (2026-07-19): real Blush
  Rose & Gold tokens ported from `context/ui-context.md` into
  `app/globals.css` (mapped onto shadcn's semantic variables so existing
  shadcn components pick up the brand palette automatically; admin's
  dark-default theme deliberately not built yet — no admin UI exists in
  `ghost` to use it). `app/layout.tsx` switched to Cairo via `next/font`,
  `lang="ar" dir="rtl"`. New `lib/firebase.ts` (modular Firebase SDK,
  typed `getProducts`/`getProduct`/`getCategories`/`getFeatured`/
  `getSettings`/`saveMessage`/`priceNum`/`priceFmt`/`benefits`/
  `productImages`, mirroring `trinkl/js/firebase.js`'s `DS`, same
  collections/schema). New `stores/cart-store.ts` (Zustand + localStorage,
  replacing `trinkl/js/cart.js`'s `Cart`). Added shadcn `sheet` (cart
  drawer). Built `components/storefront/*`: `nav`, `footer`, `cart-drawer`,
  `whatsapp-float`, `tiktok-live-button`, `hero`, `feature-strip`,
  `category-grid`, `featured-carousel`, `product-card`, `product-grid`,
  `contact-form`, `section-head`, `reveal-root` (scroll-reveal via
  `hooks/use-reveal.ts`, an `IntersectionObserver` wrapper). Home page at
  `app/(storefront)/page.tsx`. Icons switched from `trinkl`'s hand-copied
  inline SVGs to `lucide-react`, except the WhatsApp/TikTok brand marks
  (kept as literal assets/SVG per `ui-context.md`'s convention). Copied
  brand assets (`logo.webp`, social PNGs) from `trinkl/assets/` into
  `public/assets/`. `next/image` dropped for admin-pasted product/category/
  hero images once real data showed hosts outside Firebase Storage (e.g.
  `images.unsplash.com`) — those now render as plain `<img loading="lazy">`
  like the original site; `next/image` kept only for the local logo/social
  assets. `app/(storefront)/layout.tsx` marked `export const dynamic =
  "force-dynamic"` after a build revealed the home page would otherwise get
  statically prerendered with stale/empty catalog data. Verified: `npm run
  lint` and `npm run build` clean, `npm run dev` home page inspected via
  curl — real category/product images from `desert-shop-24af9` Firebase
  Storage rendering, 8 product cards, `د.ج` pricing, RTL `<html>` attrs,
  compiled CSS confirmed carrying the real `--rose`/`--primary` brand values
  (not shadcn's generic gray defaults), no error boundaries in the response.
  Not checked in an actual browser window (no screenshot tooling available
  in this environment) — only HTML-level verification.
  Links to `/products`, `/categories`, `/checkout`, `/product/[id]` 404 for
  now — next roadmap phase.
- Design system & UI primitives (2026-07-19): `shadcn/ui` installed and configured
  (`components.json`, style `base-nova`, base color `neutral`, CSS variables, RSC),
  `lucide-react` installed, `lib/utils.ts` with `cn()` (clsx + tailwind-merge).
  Components added: Button, Card, Dialog, Input, Tabs, Textarea, ScrollArea in
  `components/ui/*` (generated, unmodified). Theme tokens written to
  `app/globals.css` by the shadcn init (light/dark CSS variables); no prior theme
  existed in this repo to match. Verified via `next build` (typecheck + static
  generation clean) and a temporary smoke page exercising every component, `cn()`,
  and a `lucide-react` icon — real Tailwind/shadcn classes and an ~11KB CSS bundle
  confirmed in rendered output, then removed. See
  `context/feature-specs/01-design-system.md`.
- Storefront: home, products, product detail, categories, collagen landing page,
  checkout — RTL Arabic, Blush Rose & Gold theme.
- Cart in localStorage; orders created in Firestore at checkout; optional WhatsApp
  order confirmation.
- Admin panel (`amelhadj.html`): products, categories, featured, orders, messages,
  income/expenses ledger, settings.
- Delivery carriers: Yalidine, Noest, ZR Express — idempotent parcel creation,
  tracking lookup, synced fee grids (`delivery_fees` / `delivery_data`),
  per-carrier enable toggles.
- Admin notifications: web push (`push_subs` + `push-sw.js`) and Gmail email on
  new orders/messages.
- Security lockdown (2026-07-19, actually deployed): the entry previously here
  claimed this was already done — it wasn't. Confirmed by re-cloning
  `tango-sama/trinkl` fresh: `firestore.rules` had no `isAdmin()` at all
  (`products`/`categories`/`orders`/`messages`/`expenses` all `read:true,
  write:true`), `storage.rules` was `allow read, write: if true` for the whole
  bucket, `private/*` (carrier credentials) was unreadable but **writable by
  anyone**, and `amelhadj.html`'s only gate was a hardcoded client-side
  password (`tango88`), not Firebase Auth. Firebase Auth already had two real
  accounts (`tango0es@gmail.com`, `hadjajamel1988@gmail.com`) — they just
  weren't wired into anything. Fixed in two deployed steps: (1) patched
  `amelhadj.html` to sign in via `firebase.auth().signInWithEmailAndPassword`
  against those accounts instead of the hardcoded password; (2) added a real
  `isAdmin()` to `firestore.rules` (public read / admin-write on catalog,
  create-only on orders/messages, admin-only on expenses, `private/*` write
  now `isAdmin()`-gated instead of open) and `storage.rules` (public read,
  admin-only write). Both deployed to `desert-shop-24af9` and REST-verified:
  catalog read 200, anonymous order/expenses read 403, anonymous `private/*`
  write and Storage write now 403 (previously 200 — this was the actual
  credential-theft hole). Committed to `tango-sama/trinkl`
  (`2390136`, `95c176f`).
- WhatsApp site-wide toggle (2026-07-19): `site_settings.waEnabled` + admin
  Settings button; hides every WA surface via `html.no-wa` and guards JS openers.
- Context docs (2026-07-19): `CLAUDE.md` + `context/` folder; internal files
  excluded from Hosting (were publicly downloadable).

## In Progress

- None yet.

## Completed (this session)

- Sunguard landing page at `/sunguard` (2026-07-22): a second single-product
  marketing funnel, same self-contained pattern as `/collagen`
  (architecture-context.md — hardcoded product data, own top bar/footer, no
  shared storefront Nav/CartDrawer). Product: Jula's Herb Watermelon 3D Aura
  Sun Guard SPF50+ PA++++, 30g, price 3,500 د.ج (owner-provided; hardcoded in
  `components/storefront/sunguard/product.ts`, deliberately separate from the
  Firestore `products` collection). Own hot-pink/watermelon palette scoped in
  `sunguard.module.css`, distinct from the site's Blush Rose & Gold theme and
  from collagen's teal. Sections: hero (illustrated product spotlight — no
  real product photo exists yet, so this is a hand-drawn SVG sun icon +
  badge card, not a photo), "skin problems from sun exposure" grid (6 cards:
  sunburn, pigmentation, premature aging, dryness, greasy residue, sensitivity
  irritation), before/after comparison sliders, product benefits, single-
  product order card, how-it-works, CTA banner, sticky mobile order bar.
  Order modal (`order-modal.tsx`) reuses the same delivery data layer as
  collagen/checkout (`lib/delivery.ts`, Noest/Yalidine only, same rule as
  collagen) with a quantity stepper instead of collagen's multi-product
  picker (single SKU). Orders save via `saveOrder` with
  `source: "landing_sunguard"`.
  Before/after images: the owner chose illustrative graphics over real
  customer photos (no before/after photography exists for this product) —
  `before-after.tsx` draws abstract skin-patch SVG comparisons (dark spots /
  sunburn redness / fine lines vs. a smooth healed panel) with the same
  "illustrative, not real customer photos" disclaimer text the collagen page
  already carries, reusing its exact drag-slider mechanic (`--ba` custom
  property + pointer events) with inline SVG layers instead of `<img>`.
  Admin panel: orders placed through this funnel get a pink neon halo
  (`#FF2EC4`) in `orders-view.tsx`, distinct from the existing blue
  (`#00D1FF`) halo on other customer-placed orders (checkout, collagen) —
  owner-requested so this funnel's orders are visually distinguishable at a
  glance. Added a "🍉 صفحة واقي الشمس" tag badge (same convention as
  collagen's teal tag) and new `--pink-ink`/`--pink-bg` tokens in
  `app/globals.css` (`.admin`/`.admin.light`), alongside the existing
  `--teal-*`/`--purple-*` state-accent tokens.
  Fixed along the way: the topbar brand name/subtitle/back-link were dark
  maroon text on the dark hero gradient (unscrolled state) — nearly
  illegible. Made them white/light-pink by default, switching to the dark
  ink color only once `.scrolled` adds the light blurred background
  (transition on both), then re-verified.
  Verified: `npm run lint` and `npm run build` clean (`/sunguard` builds as
  `force-dynamic`, correct route group placement outside `(storefront)`).
  Full visual + interactive verification via a real (non-virtual-time)
  headless Chromium instance (Playwright, system browser at
  `/opt/pw-browsers/chromium`): screenshotted hero, problems grid,
  before/after sliders, benefits, product/order card; drove a real
  click-through opening the order modal, confirmed the quantity stepper,
  delivery-type toggle, and totals correctly compute
  `3,500 د.ج × qty + fee`. The only console errors were the expected
  Firestore-offline fallback (`getDeliveryData` catches and the wilaya
  select shows "⏳ جاري التحميل..." — this sandbox has no outbound Firebase
  connectivity), confirming the storefront-must-render-offline invariant
  holds. NOT exercised: an actual successful submit against production
  Firestore, and the admin-panel pink-halo rendering itself (both require
  live Firestore/credentialed admin auth unavailable in this sandbox) — the
  admin change is a small, mechanical extension of the already-verified blue
  neon halo logic (same conditional, new branch), reviewed line-by-line
  instead. Owner should place one real test order through `/sunguard` and
  confirm the pink halo + badge render correctly in `/amelhadj` before fully
  trusting it, same recommendation given for collagen's admin integration.

- Real product photo added (2026-07-23): owner supplied a studio shot of the
  actual tube + box (Jula's Herb Watermelon 3D Aura Sun Guard). Converted to
  `public/assets/sunguard/product-shot.webp` (Pillow, quality 88, same
  per-product-line asset convention as `assets/collagen/`) and swapped in for
  the hand-drawn `TubeIcon` SVG placeholder in `product-section.tsx`'s
  `.sgProdVisual` slot. The hero's illustrated spotlight card is left as-is
  (deliberate design choice, not a placeholder-for-lack-of-photo situation
  anymore) — comment updated to point at the product section instead of
  claiming no photo exists.

- Admin "صفحات الهبوط" (Landing Pages) tab added (2026-07-23): lets the
  owner edit the hero title/lead and the 3 before/after cards (title, text,
  optional photo pair) for both `/sunguard` and `/collagen` without touching
  code. New `components/admin/views/landing-pages-view.tsx`, registered in
  `admin-shell.tsx` (nav key `landing`). Deliberately stores content under
  the existing `site_settings` doc (`landingPages.sunguard` /
  `landingPages.collagen`, typed in `lib/firebase.ts` as
  `LandingPageContent`/`LandingHeroContent`/`LandingBaItem`) rather than a
  new Firestore collection — this repo has no `firestore.rules` file to
  edit, and `site_settings` is already public-read/admin-write, so the
  feature needed zero rules changes. Hero/before-after components in both
  `sunguard/` and `collagen/` folders now take an optional `content`/`items`
  prop and fall back to their original hardcoded copy whenever a field is
  blank — an admin who never opens the new tab sees no change at all
  (confirmed via screenshot diff against the pre-change pages). Before/after
  cards merge by fixed position (3 slots per page, matching the storefront's
  hardcoded card order) — the admin panel doesn't support adding/removing
  cards, only editing the 3 that exist. For `/sunguard`, whose before/after
  is currently hand-drawn SVG (no real photos yet — see the entry above),
  supplying both a "before" and "after" photo in the admin form switches
  that card to real photos (added a `.baImg` CSS class mirroring collagen's,
  new `isPhoto` branch in `sunguard/before-after.tsx`'s `BaFrame`); leaving
  either blank keeps the illustration. Admin form fields are empty by
  default with the current default copy as a placeholder — an admin who
  saves without touching a field keeps the default (empty string persisted
  reads back as "use default", never as literal blank copy).
  Uploads reuse the existing `pickImage`/`uploadImage` pipeline (WebP
  conversion → Firebase Storage), same as every other admin image field.
  Editing state resets correctly per page tab via React's key-based remount
  (`<PageEditor key={page} .../>`) instead of a state-syncing effect, to
  satisfy the `react-hooks/set-state-in-effect` lint rule.
  Verified: `npm run lint` and `npm run build` clean. Confirmed via headless
  Chromium screenshots that both landing pages render byte-for-byte
  identical to before this change when no override is saved. Separately
  confirmed the full override path renders correctly end-to-end (hero
  title/lead swap, before/after text swap, and the illustration→real-photo
  swap on sunguard) by temporarily forcing `getSettings()` to return test
  `landingPages` data, screenshotting, then reverting that temporary code
  before committing (confirmed clean via `git diff` — no test code shipped).
  NOT exercised: the actual admin UI at `/amelhadj` (the new tab, the save
  button, the upload button) end-to-end with real Firebase Auth login —
  this sandbox has no admin credentials. Owner should open the new "صفحات
  الهبوط" tab once, edit a field, save, and refresh the corresponding
  landing page to confirm the write round-trips against production
  Firestore before relying on it.

- Custom landing-page link ("رابط الصفحة") added to the same admin tab
  (2026-07-23): lets the owner change the public URL path for `/sunguard`
  and `/collagen` (e.g. to an Arabic slug) without a code change or losing
  old shared links. Added `LandingPageContent.slug` (`lib/firebase.ts`) plus
  an exported `LANDING_RESERVED_SLUGS` list reused by both the admin form's
  validation and — implicitly, by being the source of truth — the route
  precedence reasoning below. New catch-all route `app/[slug]/page.tsx`
  reads `settings.landingPages.<page>.slug` and renders `SunguardPage` or
  `CollagenPage` directly (no redirect) when it matches; unmatched slugs
  call `notFound()`. `app/sunguard/page.tsx` and `app/collagen/page.tsx`
  gained a check at the top: if a custom slug is set, `redirect()` (307) to
  `/<slug>` — so the built-in route always keeps working as a forwarding
  address instead of breaking existing links once the owner renames it.
  Static file routes (`app/checkout`, `app/products`, etc.) always take
  precedence over the `[slug]` catch-all in Next's router, so a custom slug
  colliding with a reserved name would silently make that page unreachable
  at the new path — the admin form blocks reserved names and blocks reusing
  the other landing page's slug, client-side before save.
  Found and fixed a real bug during verification: Next 16.2.10 (Turbopack)
  does not consistently URL-decode non-ASCII `params.slug` — `page.tsx`'s
  own params were still percent-encoded while `generateMetadata`'s were
  decoded, in the same request. Fixed by explicitly `decodeURIComponent`-ing
  inside `matchPage()` (wrapped in try/catch for malformed sequences) rather
  than trusting the framework — worth remembering if another dynamic route
  ever needs a non-ASCII segment.
  Verified end-to-end against the real, reachable production Firestore this
  session (unlike earlier entries, this sandbox had outbound connectivity
  this time): confirmed `/sunguard` issues a 307 to the encoded Arabic slug,
  the slug path itself renders the full sunguard page (screenshot), an
  unmatched slug 404s, and `/collagen` is untouched when no slug is set for
  it — all via a temporary forced override of `getSettings()`, reverted
  (and confirmed reverted via `git diff`) before committing.
  NOT exercised: the admin form's new "رابط الصفحة" field and its
  validation messages through a real login — same sandbox constraint as the
  rest of this tab.

- Editable product name/image/price added to the same admin tab (2026-07-23):
  the "🧴 المنتج/المنتجات" card lets the owner override each landing page's
  product title, price, and photo — everything else (brand, size, headline,
  bullets, icons, colors) stays page-defined. Added `LandingProductOverride`
  (`lib/firebase.ts`) and `product?`/`products?` on `LandingPageContent` —
  `product` for sunguard's single SKU, `products` for collagen's 5-item
  array (4 core + the glutathione special offer), both matched by position
  like `beforeAfter`. `SUNGUARD_PRODUCT` gained an `image` field (previously
  the photo path was hardcoded inline in `product-section.tsx`) so the
  default now lives in one place.
  The nontrivial part: `SUNGUARD_PRODUCT`/`COLLAGEN_PRODUCTS` were each
  imported directly into 3–4 sibling components (`hero.tsx`,
  `product-section.tsx`/`products-section.tsx`, `order-modal.tsx`) with no
  shared prop — editing name/price only where it's *displayed* without also
  fixing where it's *charged* would have let a customer see one price and
  get billed another. Fixed by computing the merged product(s) once in
  `sunguard-page.tsx` / `collagen-page.tsx` and threading it down as a
  `product`/`products` prop everywhere, replacing every direct import of the
  raw constant in those 6 files so display and checkout total can never
  disagree.
  Verified: `npm run lint` / `npm run build` clean. Confirmed via screenshot
  that both pages are byte-for-byte unchanged with no override saved.
  Separately forced a real override through `getSettings()` (temporary, then
  reverted — confirmed via `git diff`) and confirmed via screenshots: the
  sunguard product section, hero spotlight would also update (same prop,
  not independently re-verified visually), and — most importantly — the
  order modal shows the overridden title and the overridden price in the
  actual total (9,999 د.ج), and collagen's product #1 shows its override in
  both the product grid and the order modal's product-picker list, while
  products #2–5 are untouched.
  NOT exercised: the admin form's new product fields through a real login —
  same sandbox constraint as the rest of this tab.

- Real before/after photos for `/sunguard` (2026-07-25): replaced the three
  hand-drawn SVG skin-patch comparisons in `sunguard/before-after.tsx` with
  AI-generated macro photography (dark spots, sunburn, aging — one before/
  after pair each), matching the default-hardcoded-pair pattern already used
  by `collagen/before-after.tsx` (`CARDS` now carries `before`/`after` webp
  paths directly; admin override logic unchanged — still needs both photos
  in a pair to replace the default). Images generated via RunningHub
  (webapp `2081007670147997698`, a bare FLUX/z-image-turbo txt2img app —
  only a single CLIPTextEncode `text` field is exposed, no img2img/aspect
  control), one `run_task_and_wait` call per image with a macro-photography
  prompt tailored to each before/after state; downloaded PNGs into
  `/images`, converted to WebP via `sharp` (quality 82, ~60-120KB each),
  final assets at `public/assets/sunguard/ba-{spots,burn,aging}-{before,after}.webp`.
  Removed the now-unused `SkinPanel` SVG component and the `isPhoto`
  conditional branch entirely — real photos are always shown now, no
  illustration fallback path left in this component. The "illustrative,
  not real customer photos" disclaimer text stays (still true: AI-generated
  macro photography, not actual customers).
  Verified: `tsc --noEmit` clean; `npm run dev` + browser screenshot
  confirmed all three photo pairs render correctly on the live page with
  working drag-to-reveal sliders; `get_page_text` confirmed all card
  copy intact.

- Glutathione landing page at `/glutathione` (2026-07-26): a third
  self-contained single-product marketing funnel, same pattern as
  `/collagen` and `/sunguard` (architecture-context.md — hardcoded product
  data, own top bar/footer, no shared storefront Nav/CartDrawer). Prompted
  by the owner wanting to replicate CreaX.io's high-converting single-
  product landing-page approach — this repo already builds that exact
  pattern, so this is a new instance of it rather than a new mechanism.
  Product: "Glutathione, Cysteine & C" (Life Extension), 100 capsules,
  14,500 د.ج — pulled live from the real Firestore `products/1780283875728`
  doc (title, price, description, image) via a direct Firestore REST read,
  then hardcoded into `components/storefront/glutathione/product.ts`
  (`GLUTATHIONE_PRODUCT`), deliberately separate from the live catalog
  document per the established funnel convention. This same product already
  exists as the 5th "special offer" item inside `/collagen`
  (`col-glutathione`, hardcoded at a different price, 14,000 د.ج) — the two
  pages are independent and intentionally not kept in sync; only this new
  page's price was updated to match the current catalog (owner chose the
  live catalog price over collagen's older special-offer price when asked).
  Product photo: no clean studio shot existed, so the real (messy, multi-
  product) Firestore Storage photo was downloaded and cropped in Python/
  Pillow to isolate just the bottle, saved to
  `public/assets/glutathione/product-shot.webp` — used for both the hero
  spotlight and the product section (no illustrated placeholder, unlike
  sunguard's original hero).
  Sections: hero, "problems this solves" grid (6 cards: pigmentation, dull
  skin, toxin buildup/liver fatigue, weak immunity, free-radical aging, weak
  collagen support), a new "science/ingredient trio" section
  (`science.tsx` — Glutathione / L-Cysteine / Vitamin C breakdown, copy
  sourced from the real Firestore product description) used INSTEAD OF a
  before/after slider, since this is a swallowed supplement with no
  before/after photography (unlike sunguard/collagen's topical products) —
  a truthful section beats a fabricated comparison. Benefits grid (4 items),
  product/order card, how-it-works (ordering steps, not usage instructions —
  usage directions live in the product bullet list instead), CTA banner,
  sticky mobile order bar. Order modal (`order-modal.tsx`) reuses the same
  delivery data layer as collagen/sunguard/checkout (`lib/delivery.ts`,
  Noest/Yalidine only, same rule as the other two funnels) with a quantity
  stepper (single SKU, no multi-product picker). Orders save via `saveOrder`
  with `source: "landing_glutathione"`.
  Own deep-espresso/amber-gold palette (`glutathione.module.css`, `.gl*`
  class prefix) — distinct from sunguard's pink and collagen's teal, reuses
  the `#C9A24A`-family gold hue already established for this exact product's
  special-offer badge inside `/collagen`.
  Deliberately NOT done in this step (kept scope to "build the page", same
  as sunguard's original build before its own admin-editing step came
  later): no `settings.landingPages` admin-override support (hero/before-
  after/product editing via the "صفحات الهبوط" admin tab) and no custom-slug
  redirect wiring in `app/[slug]/page.tsx` — `LandingPageKey` in
  `lib/firebase.ts` is still `"sunguard" | "collagen"` only. Add "glutathione"
  to that union plus a `META` entry in `app/[slug]/page.tsx` and a form in
  `landing-pages-view.tsx` if/when the owner wants it admin-editable.
  Verified: `npm run lint` and `npm run build` clean (`/glutathione` builds
  as `force-dynamic`, correct route). Full visual verification via a real
  (non-virtual-time) headless Chromium instance (Playwright, system browser
  at `/opt/pw-browsers/chromium`, installed temporarily for this session's
  verification only — not added to `package.json`/lockfile): screenshotted
  hero, problems grid, science section, benefits, product/order section, and
  the order modal opened via a real click. Modal correctly shows the
  quantity stepper, delivery-type toggle, and a running total of
  `14,500 د.ج × qty + fee`. The only console errors were the expected
  Firestore-offline fallback (this sandbox has no outbound Firebase
  connectivity — same as every other landing-page verification in this
  file), confirming the storefront-must-render-offline invariant holds. NOT
  exercised: an actual successful submit against production Firestore —
  same recommendation as collagen/sunguard, owner should place one real test
  order through `/glutathione` before fully trusting it.

- `/glutathione` restyled to an "ad-style" direct-response look (2026-07-26,
  same session): the owner sent a reference screenshot (a Landify/CreaX-
  style mobile funnel for an unrelated hair-removal product) and asked for
  that visual method, not the original soft boutique-DTC look the page
  launched with. Kept every section, all copy, and the order flow
  identical — this was a restyle, not a re-scope. Changes, all in the
  existing `glutathione/*` files (no new page): (1) `topbar.tsx` now
  renders a stacked fixed header — a slim promo/trust strip (`.glPromo`)
  above the brand nav, collapsing to 0 height once scrolled past 30px.
  Deliberately did NOT copy the reference's "+8K customers" social-proof
  stat — that number doesn't exist for this product/store, so fabricating
  it would be a false marketing claim; used only verified claims instead
  (free delivery, COD, "100% original product"); (2) `hero.tsx` switched
  from the dark radial-gradient hero to a light cream/white background with
  a much larger stacked headline and a solid gold `<mark>` highlight chip
  behind "إشراقاً حقيقياً" (a literal highlight-chip word, not just
  gradient text), plus a new pill badge under the lead paragraph; the
  product spotlight card is now a plain white card (was a dark glass
  panel) with a small gold corner badge on the photo; (3) new
  `highlight.tsx` section added between Hero and Problems — the
  reference's "best choice" panel (kicker + bold claim + "الخيار الأمثل"
  gold badge + product photo + a small rosette callout). The rosette says
  "نتائج تراكمية مع الاستخدام المنتظم" (gradual results with regular use)
  rather than anything implying fast/instant results — this is a supplement
  taken over weeks, and the reference's "in minutes" framing (fine for a
  topical cream) would be a misleading claim here; (4) CSS: added
  `.glHeader`/`.glPromo` (stacked fixed header), rewrote all hero styles
  for the light background, added `.glHighlight`/`.glHi*` for the new
  section, bumped `.glTitle` size slightly for a punchier feel across the
  rest of the page (Problems/Science/Benefits/etc. kept their existing
  structure and content, no tsx changes needed there).
  Verified: `npm run lint` / `npm run build` clean. Full visual
  verification via headless Chromium (desktop 1280px + mobile 420px
  viewports): confirmed the promo bar, highlight badge chip, new
  highlight section, and the rest of the page all render correctly, RTL
  layout holds (image/text sides swap correctly in the new highlight
  grid), and the promo bar's third badge correctly hides on narrow mobile
  widths to avoid crowding. Only console output was the same expected
  Firestore-offline fallback noted throughout this file (no outbound
  Firebase access in this sandbox).

- `/glutathione` rebuilt again to match a second, much more specific owner
  reference (2026-07-26, same session): a full mockup made for this exact
  product (navy + gold, matching the real Life Extension bottle branding).
  Ported the structure section-by-section: Hero (rewritten to dark navy —
  palette changed from the earlier espresso-brown to navy/gold, `--gl-deep`
  now `#0f1f3d`, since the reference's colors match the real bottle),
  6-column Benefits strip, a new `formula.tsx` (two-column ingredient-trio
  split with product photo + decorative "molecule" circles, replacing the
  old 3-card `science.tsx`), a new `gift.tsx` free-gift section, a new
  `care-routine.tsx` (before/after slider + usage-instructions, two
  columns, replacing `how-it-works.tsx`'s ordering-steps content), a new
  `trust-strip.tsx` (dark navy icon row), and a new `faq.tsx`. Deleted the
  now-unused `problems.tsx`, `science.tsx`, `highlight.tsx`, and
  `how-it-works.tsx` rather than leaving orphaned files.
  Three things in the reference were NOT copied as-is because they'd be
  dishonest claims, per a round of clarifying questions with the owner
  before building:
  (1) **Free gift is real, not decorative** — the owner confirmed this is
  an actual promotion. Found the real catalog product it refers to
  (Firestore `products/1768441716115`, "صابون حليب الأرز / Jam Rice Milk
  Soap", 1,700 د.ج) and added `GIFT_SOAP` to `product.ts` with its real
  photo (`public/assets/glutathione/gift-soap.webp`, downloaded from the
  live Storage URL). Critically, `order-modal.tsx` now adds the gift as a
  real zero-price line item (`{id: gift.id, title: "🎁 هدية مجانية: ...",
  price: 0, qty: 1}`) on every submitted order — not just marketing copy —
  so fulfillment staff actually see it and pack it; also shown in the
  modal's totals breakdown ("مجاناً") and a note above the form fields.
  (2) **Testimonials section omitted entirely** — the reference shows 4
  named customers with photos and star ratings; this store has no real
  review data, so fabricating attributed quotes would be fake social
  proof. Owner chose to omit rather than fake it.
  (3) **Before/after uses the existing illustrative disclaimer, not a
  fabricated "real result"** — reused the same dark-spots/pigmentation
  macro photography already on `/sunguard`
  (`public/assets/sunguard/ba-spots-{before,after}.webp`) instead of
  generating a new "real-looking" face-photo pair, since a human face
  reads as a much stronger implied-real-testimonial claim than an
  abstract skin patch. Kept the same "توضيحية وليست صوراً حقيقية لعملاء"
  disclaimer. Also skipped the reference's 5-star rating graphic and
  "+8K/thousands of customers" trust claim in the hero — no real rating
  or customer-count data exists for this product, so `glTrust` in the
  hero only lists verified, generic claims (100% original, COD, delivery
  nationwide), matching the honesty bar already set on the `/glutathione`
  and `/sunguard` before/after work above.
  Found and fixed one real bug during verification: the FAQ's delivery
  answer had "Yalidine وNoest" (Arabic waw glued directly onto a Latin
  word with no space) — the bidi algorithm rendered it as garbled
  "Noestg Yalidine". Fixed by adding the missing space
  ("Yalidine و Noest"); worth remembering as a recurring mixed-direction
  gotcha whenever Arabic "و" precedes a Latin word with no space.
  Verified: `npm run lint` / `npm run build` clean. Full visual
  verification via headless Chromium: screenshotted hero, benefits,
  formula split, gift section, care-routine (before/after + usage),
  product/order card, trust strip, FAQ, and CTA — all render with real
  content. Confirmed the before/after drag slider is still interactive
  (dragged it, clip-path moved correctly). Note for next verification
  pass: a `fullPage: true` Playwright screenshot taken immediately on load
  showed large blank gaps between sections — this is NOT a bug, it's the
  existing sitewide scroll-reveal pattern (`RevealRoot`/`.reveal`, opacity
  0 until an `IntersectionObserver` fires) not having triggered yet for
  never-scrolled-past sections; confirmed each section renders correctly
  once actually scrolled into view. Only console errors were the usual
  expected Firestore-offline fallback (no outbound Firebase access in this
  sandbox). NOT exercised: an actual successful submit against production
  Firestore (same outstanding recommendation as every other landing page
  in this file) — owner should also confirm the gift-soap inventory is
  ready before this goes live, since every order will now promise it.

- Product photo swapped for an owner-supplied cleaner shot (2026-07-26,
  same session): the previous `public/assets/glutathione/product-shot.webp`
  was cropped from the raw Firestore catalog photo and still showed
  visible clutter at the edges (a neighboring product's box color bleeding
  in — visible once actually looking at the rendered hero card). Owner
  supplied a polished replacement (same real bottle/label, staged on
  marble with plants, no other products in frame) — swapped in directly
  (447×504 source, saved as webp, quality 90) with no code changes needed
  since every section already reads `GLUTATHIONE_PRODUCT.image`. Verified
  via headless Chromium screenshots that the new photo renders cleanly in
  all three places it's used: hero spotlight card, the formula section's
  molecule-decorated visual, and the product/order card.

- `/glutathione` wired into the admin "صفحات الهبوط" (Landing Pages) tab
  (2026-07-26, same session): brings it up to parity with `/sunguard` and
  `/collagen` — hero title/lead, product name/price/photo, and a custom
  slug are now admin-editable, per the owner's request to add this page's
  content to the existing admin tab.
  `LandingPageKey` (`lib/firebase.ts`) extended to
  `"sunguard" | "collagen" | "glutathione"`, and `"glutathione"` added to
  `LANDING_RESERVED_SLUGS`. `app/[slug]/page.tsx`'s `matchPage`/`META`
  generalized from two hardcoded pages to a loop over all three keys
  (previously `sunguard`/`collagen` were each named explicitly). Built-in
  `app/glutathione/page.tsx` gained the same slug-redirect other pages
  have (redirects to the custom slug once one is set, so the built-in URL
  keeps forwarding). `glutathione-page.tsx` now merges
  `settings.landingPages.glutathione.product` into one `product` object
  threaded through Hero/Formula/ProductSection/OrderModal — same fix as
  sunguard/collagen's product-override work, so an edited name/price can
  never disagree between what's displayed and what's charged at checkout.
  `hero.tsx` takes an optional `content` prop; an edited title renders as
  plain white text (loses the two-tone gold split), same editability
  trade-off already accepted on sunguard.
  Admin view (`landing-pages-view.tsx`) changes: added a third "💊
  الجلوتاثيون" tab; generalized `productOverrideAt`/the save branch from
  an `page === "sunguard"` special case to a `SINGLE_PRODUCT_PAGES`
  list (now `["sunguard", "glutathione"]`) so both single-SKU pages share
  the same code path collagen's multi-SKU array doesn't use; generalized
  `slugError`'s slug-collision check from a single hardcoded "other page"
  to looping over all pages; generalized `slotsFromSaved` to take a slot
  count instead of a hardcoded `[0,1,2]`.
  Deliberately did NOT add before/after editing for glutathione: unlike
  sunguard/collagen's 3 independent before/after cards, glutathione's
  single before/after card directly reuses sunguard's illustrative asset
  (see care-routine.tsx) rather than being its own configurable claim, so
  `BA_SLOTS.glutathione = []` and the "قبل / بعد" admin card now renders
  conditionally (only when a page has slots) instead of always.
  Verified: `npm run lint` / `npm run build` clean. Confirmed via
  screenshot that `/glutathione` renders byte-for-byte identical to
  before this change with no override saved. Then temporarily forced
  `getSettings()` to return a test override (hero title/lead + product
  title/price) directly in `app/glutathione/page.tsx`, screenshotted, and
  confirmed the override renders correctly in all three places at once —
  hero headline/spotlight card, the product/order section, and the order
  modal's quantity label — with the price correctly carried through to
  the modal total (9,999 د.ج). Reverted the temporary code before
  committing (confirmed via `git diff`). NOT exercised: the actual admin
  UI at `/amelhadj` (the new tab, its form, the save button) through a
  real login — same sandbox constraint noted on the original "صفحات
  الهبوط" tab entry above.

- Independent hero/formula-section photos for glutathione (2026-07-26,
  same session): owner pointed at two screenshots (the hero spotlight
  card and the "تركيبة ثلاثية الجمال" formula section) and asked that
  both be admin-editable — previously both silently shared the single
  `product.image` field, so editing "the product photo" changed all three
  photo placements (hero, formula, product/order card) at once with no
  way to vary them.
  Added two new optional fields: `LandingHeroContent.image` (hero visual)
  and `LandingPageContent.formulaImage` (the formula-section visual) —
  both currently read only by `/glutathione`; sunguard/collagen's types
  gained the fields for free (shared `LandingPageContent`) but their
  components don't read them, so this is a no-op for those two pages.
  `hero.tsx` and `formula.tsx` each resolve their own image
  (`content?.image?.trim() || product.image` /
  `image?.trim() || product.image`) — falling back to the shared product
  photo when blank, so leaving both new fields empty reproduces the old
  shared-photo behavior exactly. The product/order card keeps reading
  `product.image` directly, unaffected.
  Admin view gained a "صورة الواجهة (Hero)" field inside the existing
  Hero card and a new "🧬 صورة قسم التركيبة" card, both rendered only
  when `page === "glutathione"` (sunguard/collagen don't get these
  fields — their hero visuals aren't independently overridable).
  Verified: `npm run lint` / `npm run build` clean. Confirmed via
  screenshot that the default (no-override) render is byte-for-byte
  unchanged. Then temporarily forced two deliberately mismatched test
  images (the gift soap photo for hero, the sunguard product photo for
  formula) directly in `app/glutathione/page.tsx`, screenshotted all
  three photo spots, and confirmed each one is now independently
  correct — hero showed the soap, the formula section showed the
  sunscreen tube, and the product/order card still showed the real
  glutathione bottle unaffected. Reverted the temporary code before
  committing (confirmed via `git diff`, no changes left on that file).

- Formula-section visual rebuilt as real markup instead of an uploaded
  image (2026-07-26, same session): the owner had already used the new
  "🧬 صورة قسم التركيبة" admin field (added earlier this session) to
  upload an AI-generated "orbit of ingredient badges around the bottle"
  graphic, then asked to "make it big and readable" because the text was
  illegible. Inspected the actual uploaded file
  (`landing_glutathione/1785106108405_...webp`, pulled from the live
  Firestore `site_settings` doc via a public REST read) and found the
  problem wasn't size — the Arabic labels are genuinely garbled/
  malformed glyphs baked into the image pixels (not real text), a
  duplicated "فيتامين C" label appears twice instead of a distinct third
  ingredient, and even the English text on the bottle label itself is
  wrong ("Amiro Acids ForImmune Suppoirt", "100 CAPSUIES", "OFFTARY
  GLVPLLAIENT" instead of the real label text) — a fundamental AI-image
  text-rendering failure no amount of resizing could fix. Owner chose to
  rebuild the same visual concept in real code rather than revert to the
  plain default.
  Rewrote `formula.tsx`/the CSS from the old two-column
  image+list layout to a single centered "orbit" diagram: an SVG ring
  (gold gradient stroke + 3 bead dots) behind the real product photo,
  with 3 real-text badge nodes (icon circle + bold title + real
  description, reusing the existing accurate `TRIO` copy) positioned at
  the top/bottom-left/bottom-right — no image-based text anywhere, so it
  can never be illegible or wrong no matter the size. Used the page's
  established gold/navy/cream palette (not the AI image's mismatched
  blue) to stay visually consistent with the rest of `/glutathione`. On
  narrow screens (`max-width: 720px`) the ring hides and everything
  collapses into a simple centered vertical stack (photo, then the three
  nodes in order) instead of trying to preserve absolute positioning at
  small sizes.
  The `formulaImage` override field (from the earlier "independently
  editable photos" work) still exists and still works — it now overrides
  just the center bottle photo inside this new diagram, not the whole
  scene — but its still-live stored value is the broken AI graphic, which
  will keep showing as a wrong "bottle" photo until the owner clears that
  field in the admin panel (blank + save); I don't have write access to
  production Firestore from this sandbox to clear it myself (admin-only
  write, no credentials here). Updated that field's admin help text to
  warn against uploading images with baked-in text/full scenes for
  exactly this reason.
  Found and fixed one real bug during verification: on mobile, the top
  orbit node kept the desktop centering trick's `transform:
  translateX(-50%)` (meant to pair with `left: 50%` for absolute
  centering) even after switching to `position: static`, which left it
  shifted noticeably left instead of centered — `transform` still applies
  to statically positioned elements even though positional offsets don't.
  Fixed by resetting `transform: none` on `.glOrbitNode` inside the
  mobile media query.
  Verified: `npm run lint` / `npm run build` clean. Screenshotted the
  broken source image directly to confirm the diagnosis, then
  screenshotted the new diagram at desktop and mobile widths (before and
  after the transform fix) with the bad `formulaImage` override
  temporarily cleared in `app/glutathione/page.tsx` to isolate the new
  component's own correctness from the separate live-data cleanup the
  owner still needs to do — reverted that temporary code before
  committing (confirmed via `git diff`).

- `formulaImage` can now replace the whole formula section, not just the
  center bottle photo (2026-07-26, same session): after the previous
  broken AI graphic, the owner generated and uploaded a much better one —
  a complete, legible, accurately-worded marketing graphic (headline,
  4-point benefit sidebar, orbit-style ingredient badges, real product
  label text, all correctly spelled this time — verified by fetching and
  viewing the actual file) — and asked for it to be "the whole section
  background."
  `formula.tsx` now branches: if `formulaImage` is set, the section
  renders as just that image (full width, rounded corners, shadow,
  `max-width: 640px`) with no separate heading or orbit diagram — the
  image supplies its own; if unset, the existing real-markup orbit
  diagram (heading + ring + 3 text badges) still renders as before. This
  is an explicit, acknowledged tradeoff: once an image is set, the
  ingredient copy for that section is no longer independently editable
  as text — changing it means uploading a new image. Updated that
  field's admin help text accordingly (previously discouraged full-scene
  images; now explains an uploaded image replaces the section entirely
  and to double-check its text before uploading, since a bad one can't
  be fixed except by re-uploading).
  Verified: `npm run lint` / `npm run build` clean. Firebase Storage is
  unreachable from this sandbox (confirmed again — the real uploaded
  image 404s here), so verification used a local copy of the exact same
  uploaded file temporarily referenced via `formulaImage` in
  `app/glutathione/page.tsx`, screenshotted at desktop and mobile widths
  (both legible, mobile sidebar text is small but readable), then
  reverted (temp code and temp asset both removed, confirmed via
  `git diff` and `git status`).

- `formulaImage` made truly full-bleed (2026-07-26, same session): the
  previous full-image render still wrapped the image in a padded,
  rounded-corner, drop-shadowed "card" (`max-width: 640px`), so it read
  as an image floating inside the section rather than the section
  itself — owner circled the visible padding/whitespace in a screenshot
  and asked for it to actually fill the section. Removed the wrapper's
  padding and background, and the image's max-width cap, border-radius,
  and box-shadow — it now renders edge-to-edge at the section's full
  width with a hard-cut transition from the sections above/below, on
  both desktop and mobile.
  Verified: `npm run lint` / `npm run build` clean. Re-used the same
  local-copy-of-the-live-image technique (Firebase Storage unreachable
  from this sandbox) to screenshot the full-bleed result at desktop
  (both a short and a tall viewport, to confirm the headline at the
  image's top isn't an issue — it only gets briefly covered by the fixed
  header during the scroll transition itself, same as any section's top
  edge passing under a fixed nav, not a lost-content problem) and mobile.
  Reverted the temporary verification code and asset before committing
  (confirmed via `git diff` / `git status`).

- Hero product photo enlarged (2026-07-26, same session): owner still has
  the messy uncropped catalog photo set as `hero.image` (flagged earlier
  this session, not yet cleared/replaced on their end) but this time
  asked only to make it bigger, not to fix the content — respected that
  scope exactly. Bumped `.glSpotVisual img` from `max-height: 210px` to
  `320px` and `.glSpotVisual` from `min-height: 190px` to `300px` in
  `glutathione.module.css`; width scales proportionally since it's
  `width: auto`, so this enlarges whatever photo is set (default or
  override) without changing aspect ratio or cropping.
  Verified: `npm run lint` / `npm run build` clean. Firebase Storage was
  actually reachable via a plain `curl` from this sandbox this time
  (unlike earlier in the session) — downloaded the real live
  `hero.image` file directly and used it (not a substitute) for a
  temporary local override in `app/glutathione/page.tsx`, screenshotted
  at desktop and mobile widths confirming the larger size fits cleanly
  in the card at both, then reverted the temporary code and deleted the
  downloaded file (confirmed via `git diff` / `git status`).

- Animated gold rotating border on the free-gift callout box
  (2026-07-26, same session): owner circled the `glGiftBox` (hero's
  "هدية مجانية" row) and asked for a golden animated border. Implemented
  with the standard rotating-conic-gradient-behind-an-opaque-inset-mask
  technique rather than animating a gradient angle via `@property`
  (broader browser support, no feature-detection concerns): `.glGiftBox`
  gained `position: relative; overflow: hidden` and a new `::before`
  (an oversized spinning `conic-gradient` in gold tones, clipped to the
  box's rounded shape by the parent's `overflow: hidden`) plus `::after`
  (a 2px-inset opaque navy+white-wash fill that masks the gradient down
  to a thin rotating ring) — replacing the previous static
  `border: 1px solid rgba(gold, .35)`. New `glGiftSpin` keyframe (3.5s
  linear infinite `rotate`); added to the existing
  `prefers-reduced-motion: reduce` block so it can be turned off, same
  as every other animation on this page.
  Verified: `npm run lint` / `npm run build` clean. Screenshotted three
  frames ~0.9s apart and cropped tightly to the box — confirmed the gold
  arc visibly moves position frame to frame (top-right → bottom-right →
  back toward top), i.e. it's actually rotating, not a static gradient,
  with no clipping artifacts and box content still fully legible on top.

- Admin orders view: glutathione orders get a blue neon halo + badge
  (2026-07-26, same session): owner asked for `/glutathione` orders to
  have a blue neon border in the admin panel. Checked the existing halo
  logic in `orders-view.tsx` first — it already gives every
  non-staff, non-sunguard order (checkout, `landing_collagen`, and thus
  already `landing_glutathione` too) the shared blue `#00D1FF` neon halo
  by default, only sunguard opts out into its own pink one — so the
  border itself needed no code change, glutathione orders already had
  it. What glutathione was missing (unlike collagen's teal tag and
  sunguard's pink tag) was its own recognizable badge chip. Added a new
  `--cyan-ink`/`--cyan-bg` token pair to `app/globals.css` (`.admin` /
  `.admin.light`, following the exact pattern of the existing
  `--teal-*`/`--pink-*`/`--purple-*` state-accent tokens — a legible
  cyan-blue distinct from the muted `--blue` info token already used
  elsewhere) and a "💊 صفحة الجلوتاثيون" badge for
  `o.source === "landing_glutathione"` in `orders-view.tsx`, right after
  the collagen badge.
  Verified: `npm run lint` / `npm run build` clean. This sandbox has no
  admin credentials (same constraint noted on every other `/amelhadj`
  entry in this file), so instead of a real login, rendered the new
  token values and badge/halo markup in an isolated throwaway HTML file
  (same colors, same class shapes) and screenshotted it — confirmed the
  new cyan badge is legible and visually distinct from the existing
  purple/teal/pink badges, and that the blue halo card style renders
  correctly. Deleted the throwaway file after. NOT exercised: an actual
  `/glutathione` order flowing through the real admin panel end to end.

## Completed (this session)

- Admin "عداد المخزون" (Storage Counter) tab added (2026-07-31): new tab in
  the ghost admin panel (`/amelhadj`) listing every product with its
  category, an admin-editable "الكمية الأساسية" (total-ever-stocked)
  number, and three live-computed columns — قيد الشحن (sending), المرتجعة
  (return), تم التسليم (delivered) — plus a derived "في المحل" (in closet)
  count, category filter, and a search bar. Owner explicitly chose
  auto-decrement (asked via AskUserQuestion) over manually retyping a
  closet count each time: `products.stock` (new optional field,
  `lib/firebase.ts`) is the total units ever brought into the shop, and "in
  closet" = `stock - sending - delivered - returned` (clamped at 0),
  computed live in `components/admin/views/storage-counter-view.tsx` from
  the already-loaded `orders` store slice — no new writes needed as orders
  move through delivery. Sending/delivered reuse the exact same
  `trackingStatus.stage`/`alert` derivation `orders-view.tsx`'s stepper
  already uses (`stage == null` → still counts as "sending" pending a real
  return signal; last stage reached with no alert → delivered).
  The "المرتجعة" (return) column is a placeholder — always 0 — because
  there's no order-level "mark as failed delivery / return" flag yet; the
  owner said that's future work on the order cards. Once that field exists,
  wire it into this same per-product aggregation instead of the hardcoded
  `0` (see Open Questions below).
  New tab registered in `components/admin/admin-shell.tsx` (`ViewKey`/`NAV`/
  `TITLES`/`VIEWS`, icon 🧮). New view file follows `products-view.tsx`'s
  established list pattern exactly (local `useState` search/filter/page,
  `useMemo` filtering, shared `tblWrap`/`thCls`/`tdCls`/`tagCls`/`Pager`/
  `EmptyState` from `components/admin/ui.tsx`, hand-rolled `<table>` — no
  shadcn Table/Select exist in this repo, kept consistent).
  Verified: `npm run lint` / `npm run build` clean. This sandbox has no
  admin credentials (same recurring constraint as every other `/amelhadj`
  entry in this file), so instead of a real login, seeded the Zustand admin
  store with fake products/categories/orders on a temporary throwaway route
  (deleted before committing, confirmed via `git status`) and screenshotted
  it with a temporarily-installed Playwright (`--no-save`, removed after,
  `package-lock.json` reverted via `git checkout`) against the real system
  Chromium — confirmed the table renders with correct dark RTL styling,
  search narrows results, category filter works, and the closet/sending/
  delivered math is exactly correct against hand-computed expected values
  (e.g. stock 50, one order qty 5 delivered + one order qty 3 in-transit →
  closet 42 / sending 3 / delivered 5). Also confirmed editing the base
  stock number updates the computed closet count live (optimistic store
  patch) with no console errors. NOT exercised: an actual write round-trip
  against production Firestore, and the real admin UI end-to-end through a
  real login — same standing recommendation as every other `/amelhadj`
  tab in this file.

- Storage Counter tab: sticky table header (2026-07-31, same feature,
  follow-up): owner asked for the product table's header row to stay
  visible while scrolling. Found a real bug while verifying the first
  attempt (`sticky` + `top-16` on each `<th>`, matching the topbar's
  height): it didn't stick at all — screenshotted proof, header just
  scrolled away with the rows. Root cause is a CSS overflow-computation
  quirk, not a typo: the table's `.overflow-x-auto` wrapper (needed for
  horizontal scroll on narrow admin screens) forces its computed
  `overflow-y` to `auto` too (per spec, pairing a non-`visible` overflow-x
  with a `visible` overflow-y computes the latter as `auto`), which makes
  that div — not the page/window — the nearest scroll container for any
  sticky descendant. Since that div's own `scrollTop` never moves (its
  height is intrinsic, nothing forces it to scroll), a `sticky` element
  inside it never sticks relative to the page.
  Fixed by giving that wrapper a real, bounded scroll box instead of
  relying on window scroll: `max-h-[65vh] overflow-auto` (both axes) so it
  becomes the actual scrolling context, and pinning each `<th>` (still
  `components/admin/views/storage-counter-view.tsx`) to `sticky top-0
  z-[5] bg-card` within it (the standard "sticky header, cell-level not
  thead-level" technique for `border-collapse` tables) — table now scrolls
  internally past ~65% of the viewport height instead of the whole page
  scrolling through it, with search/filter and the pager staying outside
  that box, always visible.
  Verified: `npm run lint` / `npm run build` clean. Same throwaway-route +
  seeded-store technique as the original tab's verification (20 fake
  products, deleted before committing, confirmed via `git status`);
  measured the header `<th>`'s bounding rect via Playwright before and
  after fixing — first attempt: header scrolled to a negative/off-screen
  `top` after scrolling; after the fix: header's `top` stays exactly equal
  to its scroll container's `top` (offset 0) after scrolling the container
  400px, and a screenshot confirms it visually — rows 7-11 scroll under an
  opaque, pinned header row with no see-through or clipping.

- Admin orders: "تعليم كجديد" now resets a fulfilled order all the way back
  to its pre-parcel starting state, and Stop Desk orders prompt for a new
  desk when the admin switches carriers (2026-08-03, owner-requested).
  `components/admin/views/orders-view.tsx`'s `toggleFulfilled`: when marking
  a fulfilled order with an already-created parcel back to "New", it now
  also clears `deliveryLabel`, `parcelPrice`, `yalidine`/`noest`/`zr` (whichever
  carrier's tracking existed), and `trackingStatus` — not just the
  fulfilled/status flags as before — behind a `confirm()` since it's
  destructive locally (does NOT cancel anything already created on the
  carrier's own side, just this app's record of it). This makes `orderCarrier(o)`
  go back to `null`, which is what un-hides the carrier-picker button row, so
  a fresh label can be created with any company again — exactly the
  "starting state" the owner asked for. Left `deliveryCompany` (the
  customer's original pick) untouched; only the carrier-specific parcel data
  is cleared.
  Second part: for a `deliveryType === "office"` (Stop Desk) order, if the
  admin clicks a carrier button that differs from `o.deliveryCompany`, the
  desk name already saved in `o.baladiya` belongs to the OLD carrier's own
  agency list and is meaningless for the new one (each carrier runs its own
  stop-desk network). New `requestCreateParcel()` detects this case and
  opens a popup (instead of creating the parcel immediately) asking which of
  the NEW carrier's own desks — filtered to the order's wilaya via
  `centersForCarrier(co, wilayaId, cache)` (`lib/delivery.ts`, already built
  for the customer-facing checkout/seller forms) — to use. New
  `resolveOrderWilayaId()` reads the order's saved `wilayaId` (present on
  every order since the original delivery-data-layer build) with a
  name-matching fallback (`o.wilaya`/`o.wilayaFr` against the new carrier's
  own wilaya list) for any older order that predates that field. Confirming
  the popup awaits writing `{baladiya: desk.name, deliveryCompany: co}` to
  Firestore FIRST (must land before the create-parcel callable reads the
  order server-side, otherwise it would still see the stale desk), then
  proceeds into the existing `createParcel()` flow unchanged. Home-delivery
  orders, and any case where the admin re-picks the SAME company the
  customer already chose, are unaffected — parcel creation happens
  immediately with no popup, exactly as before.
  Added `wilayaId`/`wilayaFr` to the `Order` type (`lib/admin.ts`, previously
  only reachable through its catch-all index signature) and widened
  `yalidine`/`noest`/`zr`/`trackingStatus`/`deliveryLabel` to accept `null`
  (needed to actually clear those fields in Firestore — `updateDoc` rejects
  `undefined` field values, so `null` is the only way to blank a field, same
  as the pre-existing `parcelPrice: number | null`).
  Depends on real Stop Desk data existing in `delivery_data/{carrier}.centers`
  (see "Next Up"/"Open Questions" below) — until `syncCarriers` is extended,
  the new popup correctly shows "لا توجد مكاتب متاحة" rather than any wrong
  data, same empty-state convention `centersForCarrier` already had in the
  customer-facing forms.
  Verified: `tsc --noEmit`, `npm run lint`, and `npm run build` all clean.
  NOT exercised against a real credentialed admin session (no live Firebase
  Auth in this environment) — owner should click through both flows once:
  mark a test parcel-having order back to "new" and confirm the label/parcel
  info disappears and the carrier buttons reappear; then, on a Stop Desk
  order, click a carrier other than the customer's original pick and confirm
  the desk-selection popup appears (it will show "no مكاتب" until real desk
  data is synced — that's the expected/correct state, not a bug).

- Admin orders: "تعليم كجديد" now actually cancels the parcel with the
  carrier's own API first, not just clears our local record of it
  (2026-08-03, owner-requested follow-up to the entry above — the owner
  pointed out clearing Firestore alone doesn't stop a real shipment).
  Verified against primary sources (not guessed) that all three carriers
  support programmatic cancellation: **Yalidine** `DELETE /v1/parcels/
  {tracking}` (confirmed from the `feeefapp/yalidine` open-source SDK's
  actual HTTP client code — same `X-API-ID`/`X-API-TOKEN` headers and
  `api.yalidine.app/v1` base this repo's `createYalidineParcel` already
  uses), but Yalidine only allows this while the parcel is still "En
  préparation" (not yet picked up) — past that the API refuses and it has
  to be cancelled from Yalidine's own dashboard instead; **Noest** `POST
  /api/public/delete/order` with `{tracking, user_guid}` (confirmed from a
  real Noest integration's source, `Trikooo/Kotek`); **ZR Express**
  `DELETE /api/v1/parcels/{id}` using ZR's OWN internal parcel id (already
  stored as `o.zr.parcelId`), confirmed from ZR's own live OpenAPI
  reference at docs.zrexpress.app — refuses on exchange/return parcels.
  This is cross-repo: the actual carrier calls live in `functions/
  index.js` in `tango-sama/trinkl`, not in `ghost`. New
  `cancelYalidineParcel`/`cancelNoestParcel`/`cancelZrParcel` callables
  added there, each mirroring its `create*Parcel` counterpart's
  credentials/auth, clearing only its own order field
  (`yalidine`/`noest`/`zr` via `FieldValue.delete()`) on success — on
  failure the order is left completely untouched so a parcel that's still
  live with the carrier is never silently forgotten locally.
  Deployed and live (owner chose "merge to main and deploy now" when
  asked): the local reference clone at `C:\Users\Tango\Desktop\desert shop`
  had uncommitted changes to `functions/index.js` and was diverged from
  `origin/main` (7 ahead / 38 behind), so it was never touched. Instead,
  the new functions were built in an isolated git worktree
  (`.claude/worktrees/cancel-parcel-apis`, branch `claude/cancel-parcel-
  apis`) based on `origin/main`, committed there (`8c55c9a`), pushed as a
  branch, then fast-forward-merged directly onto `origin/main` (a clean
  fast-forward since the branch was exactly `origin/main` + one commit —
  no interaction with the dirty local working tree at all) and deployed
  with `firebase deploy --only functions:cancelYalidineParcel,
  functions:cancelNoestParcel,functions:cancelZrParcel --project
  desert-shop-24af9`. All three now show as live `v2 callable` functions
  in `us-central1` (`firebase functions:list`).
  Ghost side: `components/admin/carriers.ts` gained a `CANCEL_FN` map
  (mirroring `CREATE_FN`); `orders-view.tsx`'s `toggleFulfilled` now calls
  `callFn(CANCEL_FN[carrier], {orderId})` and AWAITS success before
  clearing anything locally — if the cancel call throws (carrier already
  shipped it, etc.) the whole reset aborts with an alert naming the
  carrier and telling the admin to cancel manually via that carrier's
  dashboard, and nothing is deleted. The confirm-dialog copy was updated
  to say a real cancellation will be attempted first.
  Verified: `tsc --noEmit`, `npm run build` clean on the ghost side.
  Deployed functions verified live (not just syntax-checked) via a direct
  Node probe using the same public web SDK config `lib/firebase.ts` uses —
  called all three with a deliberately bogus/nonexistent orderId and got
  the expected `functions/not-found: Order not found` from every one,
  confirming each is reachable, correctly wired to Firestore, and fails
  the way the code says it should — without touching any real order or
  carrier credential. NOT exercised end-to-end against a REAL parcel with
  any of the three carriers (that requires an actual live order — no test
  parcel was created/cancelled in this session). The owner should test
  each carrier once against a real but low-stakes test order before fully
  trusting this, especially Yalidine's "only before pickup" restriction
  and ZR's exchange/return-parcel restriction.

- Fixed a pre-existing, unrelated trinkl CI failure surfaced by the
  cancel-functions push above (2026-08-03, same session): the owner got a
  "Deploy to Firebase on merge" GitHub Actions failure email right after
  the fast-forward push — `firebase deploy` (full, unscoped) found
  `registerYalidineWebhook`/`registerZrWebhook`/`yalidineWebhook`/
  `zrWebhook` live in production but absent from `main`'s source, and
  aborted rather than silently delete them non-interactively. Root cause
  predates this session entirely: the earlier carrier-webhooks work
  (`context/progress-tracker.md`'s own 2026-07-20 entry already flagged
  "MERGE webhooks INTO MAIN so deployed == main again" as outstanding) was
  deployed manually from its own branch/worktree at the time but that
  branch (`webhooks`, commit `32df793`) was never actually merged into
  `main` — confirmed this isn't something the cancel-functions push
  broke: the immediately-preceding CI run on `main` (the `syncCarriers`
  commit, 2026-07-30) had failed with the exact same error, so any push
  to main would have hit this.
  Fixed the same way as the cancel functions: reviewed the `webhooks`
  branch's diff first (admin-gated `registerZrWebhook`/
  `registerYalidineWebhook` via a `requireAdmin()` matching
  `firestore.rules`' `isAdmin()`, per-carrier webhook secrets read from
  server-only `private/*` docs, timing-safe HMAC/Svix signature checks,
  replay-window guard on ZR's Svix timestamp — no red flags), then merged
  `origin/webhooks` into a fresh worktree based on `origin/main`
  (`.claude/worktrees/merge-webhooks-main`) — a clean automatic merge, no
  conflicts. Manually deployed the 4 previously-orphaned functions from
  that merged source first (`firebase deploy --only
  functions:zrWebhook,functions:registerZrWebhook,functions:yalidineWebhook,
  functions:registerYalidineWebhook`) to confirm they update cleanly and
  bring production back in sync with source, THEN fast-forward-pushed the
  merge onto `origin/main` (`8b26667`) — deliberately in that order, so
  the CI's next automatic full deploy wouldn't be the first real test of
  whether this diff deploys cleanly.
  Verified: watched the resulting "Deploy to Firebase on merge" run
  (`gh run watch`) to completion — succeeded end-to-end this time, no
  orphaned-functions error. `firebase functions:list` confirms all 7
  functions (3 cancel + 4 webhook) live and healthy in `us-central1`.

- Stop Desk carrier-switch popup now recomputes the delivery fee
  (2026-08-03, owner-requested follow-up — different carriers charge
  different Stop Desk rates for the same wilaya, so switching carrier can
  change what the customer owes, not just which desk they pick up from).
  `orders-view.tsx`'s desk-prompt popup now calls the existing
  `feeForCarrier(co, wilayaId, deliveryType, cache)` (`lib/delivery.ts` —
  already the single source of truth for every other order surface) for
  the NEW carrier, shows it in the popup ("💰 رسم التوصيل لدى Yalidine: X
  د.ج (بدلاً من Y د.ج لدى Noest)" when it actually differs, no
  parenthetical when it doesn't), and `confirmDeskAndCreateParcel` now
  writes the recomputed `deliveryFee` and `total` (`subtotal + newFee`,
  deriving `subtotal` from `total - deliveryFee` for older orders that
  never stored `subtotal` directly) onto the order alongside the desk/
  company change — previously it silently kept the OLD carrier's stale
  fee. Scoped exactly to the Stop Desk carrier-switch popup, matching what
  was asked; a Home-delivery carrier switch still goes straight through
  `createParcel` with no popup and no fee recompute — the same
  "fee can differ per carrier" gap exists there too but wasn't in scope
  here (flagged to the owner, not fixed).
  Verified: `tsc --noEmit`, `npm run lint` (only the same pre-existing
  unrelated warnings elsewhere in the repo), `npm run build` all clean.
  NOT exercised through a real admin session — same sandbox constraint as
  the rest of this feature; owner should confirm the shown fee matches
  the new carrier's real synced rate for a couple of wilayas once
  real Stop Desk fee data exists.

- Diagnosed (not yet fully resolved) a real "تعذّر إنشاء طرد ZR Express"
  failure the owner hit (2026-08-03): confirmed via `git diff` that
  `createZrParcel`'s own function body is byte-identical to before any of
  this session's trinkl changes — the failure isn't a regression from the
  cancel-functions/webhooks work. `firebase functions:log`'s plain-text
  formatter showed blank content for the actual error lines (no `gcloud`
  CLI available in this sandbox to pull the full structured payload), so
  diagnosis relied on a screenshot of the real admin-panel alert instead:
  `رفضت ZR Express الطرد: One or more validation errors occurred`. Root
  cause of THAT unhelpful message (not necessarily of the underlying order
  problem itself): `zrErrMsg()` in `functions/index.js` checked
  `body.detail` before `body.errors` — ZR's 400 responses always carry
  that same generic "One or more validation errors occurred" wrapper text
  in `detail`, while the actual actionable per-field problem (which field,
  why) sits in `errors[]` — so EVERY ZR validation failure surfaced this
  identical useless message regardless of what was actually wrong,
  swallowing the real diagnostic. Fixed (isolated worktree
  `.claude/worktrees/fix-zr-error-message`, commit `90901e4`, deployed and
  fast-forward-merged onto `origin/main` the same way as the two entries
  above — deploy-then-push order, verified via `gh run watch`): `errors[]`
  is now checked first, falling back to `detail`/`title` only when it's
  empty. Redeployed the 5 functions that share this helper:
  `createZrParcel`, `cancelZrParcel`, `getParcelStatus`, `syncCarriers`,
  `registerZrWebhook`.
  NOT resolved: the actual underlying reason ZR is rejecting THIS order
  (a real field validation problem on the order data sent to
  `POST /parcels`) — that only becomes visible once the owner retries
  parcel creation on the SAME failing order and we see the specific
  message this fix now surfaces instead of the generic one. Owner should
  retry and report back the new (hopefully specific) error text.

- "تعليم كجديد" now disables itself once a parcel can no longer actually
  be cancelled with the carrier (2026-08-03, owner-requested — the owner
  pointed out the button should be unclickable the moment the parcel is
  confirmed/shipped, not just fail loudly when clicked). New
  `isPastCancelWindow(o)` in `components/admin/carriers.ts`, wired into
  the button's `disabled`/`title` in `orders-view.tsx` (only for the
  "mark as new" direction — "✓ تم التنفيذ" is untouched). Per-carrier
  signal, matching what the owner described from actually using each
  carrier's dashboard: **Noest** — `o.noest.validated` (already tracked)
  or the shared stage normalizer reaching stage 1 ("traitement" maps
  there); **Yalidine** — exposes no separate validation step at all, so
  ANY real tracking update is treated as the point of no return (their
  API only allows deleting a parcel while "En préparation", and once it's
  moved even once we can't tell that apart from what comes after);
  **ZR Express** — the trickiest one: `zrNormalize` (already deployed
  server-side) buckets "just received" and "Prêt à expédier" into the
  same stage-0 step, because ZR's workflow state NAMES are configurable
  per-tenant rather than a fixed enum — confirmed by reading ZR's own
  OpenAPI reference rather than assuming, so a numeric stage boundary
  can't tell those two apart. Falls back to matching the RAW status text
  (`trackingStatus.lastLabel`, which already carries the carrier's literal
  state name) against "Prêt à expédier" specifically (the exact term the
  owner used); anything genuinely further along is still caught by
  `stage >= 1` as before.
  Explicitly a UX shortcut, not a new safety boundary: the real guarantee
  is still the cancel-then-clear flow from the entry above (`toggleFulfilled`
  awaits the carrier's cancel call and aborts, deleting nothing, if it
  fails) — this only saves the admin a doomed round-trip and gives instant
  feedback via the tooltip instead of an alert after the fact. If ZR's raw
  "Prêt à expédier" wording turns out to differ from what's matched
  (their state names are configurable, so this is a real risk), the worst
  case is unchanged: the button stays clickable a little longer than
  ideal, and the existing cancel-call safety net still catches it.
  Verified: `tsc --noEmit`, `npm run lint` (only the same pre-existing
  unrelated warnings), `npm run build` all clean. NOT exercised against a
  real validated/en-traitement/Prêt-à-expédier order in any carrier — no
  live admin session in this sandbox; owner should confirm the button
  actually greys out at the right moment for at least one real order per
  carrier.

- Detect a parcel deleted directly from the carrier's own dashboard
  (2026-08-03, owner-requested — pressing "🔄 تحديث" on a parcel that was
  deleted at Yalidine/Noest/ZR outside this app just showed "waiting to be
  processed" forever, with no indication anything was actually wrong).
  Root cause: all three carrier status fetchers in `getParcelStatus`
  (`fetchNoestStatus`/`fetchYalidineStatus`/`fetchZrStatus`,
  `functions/index.js`) treat "carrier doesn't have this parcel" as
  meaning ONE thing only — "just created, not indexed yet" — which is the
  normal/common case right after creation, but is IDENTICAL to what a
  genuinely deleted parcel looks like forever after. Fixed by gating on
  age: new `parcelIsStale(o, carrier)` / `NOT_FOUND_GRACE_MS` (15 minutes
  — real parcels get indexed within seconds to a couple minutes, so this
  is a conservative buffer against false positives) — still-fresh "not
  found" keeps the existing "still pending" status unchanged; a parcel
  missing well past that age now returns a `notFoundAtCarrier: true`
  status (`stage: null`, a clear alert naming the carrier and telling the
  admin to press "تعليم كجديد") via new `deletedAtCarrierStatus()`.
  Needed no new UI code on the ghost side to SHOW this — `stage: null` +
  `alert` already renders through `TrackStepper`'s existing return/cancel
  banner path (`isReturn = ts.stage == null`), the exact same mechanism
  already used for actual returns/cancellations.
  Two things had to change to make the reset ACTUALLY completable once
  detected, not just visible: (1) `isPastCancelWindow()`
  (`components/admin/carriers.ts`) now unlocks "تعليم كجديد" whenever
  `trackingStatus.notFoundAtCarrier` is true, regardless of carrier —
  there's nothing left to protect against once it's confirmed gone; (2)
  all three `cancel*Parcel` functions now treat "already not found" as
  SUCCESS rather than failure (Yalidine/ZR return a real 404; Noest's
  tracking-info endpoint answers "not found" as a 200 with a French
  message rather than an HTTP 404, so its cancel function checks both
  shapes) — otherwise clicking "تعليم كجديد" on an already-deleted parcel
  would itself fail trying to cancel something that no longer exists,
  blocking the exact reset this whole feature exists to unblock. Added
  `TrackingStatus.notFoundAtCarrier?: boolean` to `lib/admin.ts`.
  Deployed (isolated worktree `.claude/worktrees/carrier-not-found-
  handling`, commit `766ad88`, fast-forward-merged onto trinkl's
  `origin/main` and pushed the same way as every entry above — deploy
  four functions first, then push, then verify via `gh run watch`):
  `getParcelStatus`, `cancelYalidineParcel`, `cancelNoestParcel`,
  `cancelZrParcel`.
  Verified: `tsc --noEmit`, `npm run lint` (only the same pre-existing
  unrelated warnings), `npm run build` all clean on ghost; the trinkl CI
  deploy run succeeded end-to-end. NOT exercised against a REAL deleted
  parcel with any carrier (would need an actual parcel manually removed
  from a carrier's dashboard and 15+ minutes of wait, not reproducible in
  this sandbox) — owner should verify this once when the opportunity
  naturally comes up, rather than manufacture a test deletion against a
  real carrier account.

- Fixed ZR Express's "encaisse" status (delivered) reporting as "just
  created", plus a related normalizer ordering bug (2026-08-03,
  owner-reported: "حالة ZR Express: encaisse — this state means the
  parcel is delivered successfully"). Pure trinkl-side fix, no ghost
  files touched. Root cause confirmed by isolating and unit-testing
  `zrNormalize` directly (`node -e`, not just reading the regex): the
  function had no branch matching "encaisse"/"Encaissé" (COD payment
  collected, which only happens once delivered) at all, so it fell
  through the entire chain to the catch-all `{stage: 0}` — a delivered
  ZR parcel showed as "تم إنشاء الطلب" (order just created) in the
  tracker. Fixed by adding it to the same branch as "delivered"/"livré"
  (stage 4).
  While testing found a SECOND, related bug in the same function: "Prêt
  à expédier" (not yet shipped) was incorrectly landing on stage 1
  (dispatched) because "expédie" is a substring of "expédier", so it
  matched the dispatched-parcel regex before ever reaching the intended
  pre-shipping bucket — confirmed this is the exact same class of bug
  `yalidineNormalize` already has an explicit fix + comment for
  ("Pre-shipping FIRST..."), just never applied to `zrNormalize`.
  Reordered so the pre-shipping check runs first, matching Yalidine's
  existing pattern. This actually changes (corrects) the signal
  `isPastCancelWindow`'s ZR branch (added two entries above) relies on —
  before this fix, "Prêt à expédier" accidentally already tripped the
  `stage >= 1` half of that check (for the wrong reason); after this fix
  it correctly falls through to the raw-text match instead, which was
  always the intended path. No ghost-side change needed as a result —
  just noting the two are no longer coincidentally-double-covering the
  same case.
  Also hardened the catch-all itself: unrecognized ZR status text now
  signals `stage: -1` (was `0`) so both callers (`fetchZrStatus`,
  `zrWebhook`) fall back to the previously known stage instead of
  visibly regressing an in-progress parcel back to "just created" the
  next time ZR uses wording this mapping doesn't recognize — mirrors how
  `noestNormalize`'s existing `-1` signal already works. Both callers log
  the raw unrecognized text (`console.log`) so a future gap in this
  mapping is visible in Cloud Functions logs instead of silently
  misreporting, same visibility Noest's fetcher already had.
  Deployed (isolated worktree `.claude/worktrees/fix-zr-encaisse-status`,
  commit `1e42e38`, fast-forward-merged onto trinkl's `origin/main` and
  pushed the same way as every entry above): `getParcelStatus`,
  `zrWebhook`. CI deploy run verified via `gh run watch`.
  NOT exercised against a real ZR order reaching "encaisse" in
  production — verified via isolated unit-testing of the extracted
  `zrNormalize` function only (real inputs, real regex, just not run
  inside an actual Cloud Function invocation against live data). Owner
  should confirm the next real delivered ZR order shows "تم الاستلام"
  correctly.

- Fixed a real production bug the owner hit from the "deleted at carrier"
  feature two entries above (2026-08-03, owner report: "on mobile it
  looks like a side white page" after pressing تحديث on a Noest order
  they believed was deleted). Root cause, confirmed once the owner pasted
  the exact alert text: the new `notFoundAtCarrier` alert message is a
  full sentence (~100+ characters), but the badge that renders any
  `trackingStatus.alert` (`TrackStepper` in `orders-view.tsx`, both the
  `isReturn` and `hasAlert` branches) used `whitespace-nowrap` — fine for
  the short alerts this component was originally built for (e.g. "مرتجع /
  ملغى — تحتاج متابعة"), but it forces ANY text onto one unbroken line
  no matter how long, so the long new sentence pushed the badge (and the
  page) far wider than a mobile viewport, producing exactly the
  described horizontal-scroll-into-blank-space symptom. Two-part fix,
  matching "fix the class of bug, not just this one message" since a
  future long alert could hit the same thing again: (1) ghost —
  `whitespace-nowrap` → `max-w-full break-words` on both alert badges, so
  long text wraps within the available width instead of forcing overflow
  (left the third badge, `stageAr`, on `whitespace-nowrap` since it only
  ever renders a short fixed `STAGE_LABELS` entry); (2) trinkl — per
  owner's explicit request, shortened `deletedAtCarrierStatus()`'s alert
  from the full explanatory sentence down to just `'تم حذف هذا الطرد'`
  (deployed `getParcelStatus`, isolated worktree `.claude/worktrees/
  shorten-deleted-alert`, commit `05882a6`, same fast-forward-then-verify-
  CI flow as every entry above).
  Also swept the rest of `components/admin/` for the same
  `whitespace-nowrap`-on-variable-length-text pattern — the only other
  hits (`income-view.tsx` table cells, a `landing-pages-view.tsx` URL
  display) are pre-existing, unrelated, and intentional (numeric/URL
  columns that legitimately shouldn't wrap), so left untouched.
  Verified: `tsc --noEmit`, `npm run lint` (only the same pre-existing
  unrelated warnings), `npm run build` all clean on ghost; trinkl CI
  deploy succeeded. NOT re-verified in an actual mobile browser against
  the live fix (no credentialed admin session in this sandbox) — the
  owner's own bug report supplied the exact failing string, which is
  what made this fixable without guessing; worth a quick real-device
  check next time this scenario comes up.

- `/glutathione` free gift swapped from rice-milk soap to a different real
  catalog product (2026-08-06, owner request via product URL
  `desertshop.fit/product/1780279395143`): `GIFT_SOAP` in
  `components/storefront/glutathione/product.ts` now points at Firestore
  `products/1780279395143` ("صابون Nawarna Dose Astaxanthin Mask", 2,900
  د.ج, id `gl-gift-astaxanthin-soap`) instead of the earlier
  `products/1768441716115` rice-milk soap — title/price/description pulled
  live via a direct Firestore REST read, same convention as
  `GLUTATHIONE_PRODUCT`. Real product photo downloaded from the live
  Firestore Storage URL and saved over `public/assets/glutathione/
  gift-soap.webp` (same filename, so every component importing that path
  picked up the new image with no further changes). Since every gift-
  related surface reads `GIFT_SOAP`/its `gift` prop rather than
  reimplementing the name, most call sites (hero gift badge, gift section
  heading, order-modal line item + totals) updated automatically; four
  places had the old product's name or ingredients hardcoded in copy and
  needed manual edits: `gift.tsx`'s bullet list (rewrote the rice-extract/
  collagen claims to the real ingredients — astaxanthin, niacinamide,
  coconut oil — from the new product's Firestore description),
  `faq.tsx`'s "is the gift real" question, `care-routine.tsx`'s usage-step
  copy, and `order-modal.tsx`'s success-message sentence (also switched
  that one from a hardcoded string to `gift.title` so it can never drift
  from `product.ts` again). `glutathione-3d` (the sibling funnel reusing
  the same `GIFT_SOAP` import) needed no changes — verified it had no
  hardcoded gift copy of its own.
  Verified: `npm run lint` / `npm run build` clean (pre-existing warnings
  in unrelated files only). Headless Chromium screenshots of both the hero
  gift badge and the gift detail section confirm the new product name and
  the new product photo (red Nawarna soap box) render correctly.

- Reverted the whole `/glutathione` hero/formula picture-swap saga from
  earlier tonight (2026-08-06, owner request — "remove the last changes
  on the swapping pictures"): six commits undone (`9bdd192`, `6abdae4`,
  `eb322c6`, `b025970`, `101459e`, `c3686d1`; the intermediate flip/revert
  pair `3b5aa0e`/`c6b3199` had already cancelled itself out). `hero.tsx`,
  `formula.tsx`, `glutathione-page.tsx`, `topbar.tsx`,
  `landing-pages-view.tsx`, `lib/firebase.ts`, and
  `glutathione.module.css` are back to their pre-saga state (commit
  `13b1668`); the promo strip is back in the topbar; `banner-section.tsx`,
  `formula-background-section.tsx`, `formula-visual.tsx`,
  `product-spot.tsx`, `product-spot-section.tsx`, and the
  `formula-infographic.webp`/`hero-shot.webp` assets introduced along the
  way are deleted. The unrelated free-gift product swap above (`43121e2`)
  was left untouched. Verified: `npm run lint` clean of anything in the
  touched files (the two errors present are pre-existing, in
  `cart-drawer.tsx` and a vendored `runninghub-mcp/.venv` file).

- Removed the bottle-photo image from the center of `/glutathione`
  Formula section's ingredient-orbit diagram (owner request via
  annotated screenshot, 2026-08-06) — the ring, heading, and the three
  ingredient callouts (جلوتاثيون / سيستئين / فيتامين C) stay, only the
  `.glOrbitBottle` product-photo overlay is gone. `Formula` no longer
  takes a `product` prop (it was only used for that photo); updated the
  call site in `glutathione-page.tsx` and dropped the now-dead
  `.glOrbitBottle` / `.glOrbitBottle img` CSS rules (desktop + the
  720px mobile override). Admin's `formulaImage` override path
  (full-image render, bypassing the orbit entirely) is untouched.

- Moved `/glutathione` hero's floating product-spotlight card out of the
  hero into its own standalone section right after Benefits (owner
  request via annotated screenshot, 2026-08-06). New
  `product-spot.tsx` (`ProductSpot`, pure presentational — same JSX the
  card always had) and `product-spot-section.tsx` (`ProductSpotSection`,
  wraps it in `RevealRoot`/`.glSec`, new `.glSpotStandalone` centers it
  at 380px). `hero.tsx` is now text-only, single column
  (`.glHeroInner` collapsed to `grid-template-columns: 1fr`, text capped
  via new `.glHeroTextOnly { max-width: 640px }`) — dropped its unused
  `product` prop and the now-redundant 980px media-query override.
  `glutathione-page.tsx` renders `<ProductSpotSection product={product}
  image={landing?.hero?.image} />` between `<Benefits />` and
  `<Formula />`; the admin "صورة الواجهة (Hero)" override still feeds
  this card's photo, just re-homed from Hero's props to
  ProductSpotSection's. `glutathione-3d`'s own hero is untouched (it's a
  separate component, `glutathione-3d/hero.tsx`), and its shared
  `<Formula />` call — found broken by `tsc` from the *previous* entry's
  prop removal (still passing the now-nonexistent `product` prop) — was
  fixed too. Verified via `npx tsc --noEmit` (0 errors project-wide,
  down from 1) and `npm run lint` (clean of anything in touched files).
  Screenshot-based visual verification was unreliable this session (the
  chrome extension's screenshot tool returned stale/ghosted frames after
  scrolling — a capture-timing issue, not an app bug); confirmed the new
  layout instead via live DOM inspection (`document.querySelectorAll`)
  in the running dev server: hero contains no `.glSpot`, and the section
  immediately after Benefits contains `.glSpotStandalone`, before
  Formula.

- Reordered `/glutathione` so Benefits comes after the product-spotlight
  card instead of before it (owner request, 2026-08-06 — "benefits
  after the picture of the power of glutathione"): swapped
  `<ProductSpotSection>` and `<Benefits />` in `glutathione-page.tsx`.
  New order: Hero → ProductSpotSection → Benefits → Formula → Gift →
  ... Downloaded and visually inspected both the product-spot card's
  image and the Formula section's `formulaImage` from their live
  Firebase Storage URLs to resolve which one the owner meant — turned
  out the admin currently has the *same* "قوة الجلوتاثيون" graphic set
  for both fields, so the picture renders twice in a row
  (ProductSpotSection then Formula); asked the owner to disambiguate,
  who chose "right after the product card" specifically (Benefits now
  sits between the two picture appearances, not after both). Not
  deduplicating that repeated image — out of scope, flagging here in
  case it's worth a follow-up. Updated the stale section-order comment
  at the top of `glutathione-page.tsx` (still described the original
  pre-2026-08-06 mockup order). Verified via `npx tsc --noEmit` / `npm
  run lint` (both clean) and live DOM inspection in the dev server
  (section order: glHero, ProductSpotSection, Benefits, glFormula, ...).

- Follow-up re-order on `/glutathione` (owner, same day): "move the
  product card down further, just before the benefit section... after
  the big picture" — moved `<Formula>` (the full-bleed "big" picture)
  up to right after `<Hero>`, ahead of `<ProductSpotSection>` (the
  smaller card picture), which now sits directly before `<Benefits>`.
  New order: Hero → Formula (big picture) → ProductSpotSection (card) →
  Benefits → Gift → ... This is the third ordering iteration on these
  same three sections today; see the two entries above for the prior
  states. Verified via `npx tsc --noEmit` / `npm run lint` (clean) and
  live DOM inspection in the dev server.

- Fourth ordering iteration, same day: "the floating product picture...
  just before the gift section... the big picture... just after the
  hero section." The big-picture requirement was already satisfied
  (Formula was already right after Hero from the previous entry) — only
  moved `<ProductSpotSection>` down past `<Benefits>`, to sit directly
  before `<Gift>`. New (current) order: Hero → Formula (big picture) →
  Benefits → ProductSpotSection (card) → Gift → CareRoutine →
  ProductSection → TrustStrip → Faq → CtaBanner → Footer. Verified via
  `npx tsc --noEmit` / `npm run lint` (clean) and live DOM inspection in
  the dev server.

- Added a new 3D-model showcase section to `/glutathione` (owner
  request, 2026-08-06), between the before/after slider and the usage
  steps. Owner supplied the model as a local file
  (`C:\Users\Tango\Desktop\gluta\qqq.glb`, ~8.1MB); copied into
  `public/assets/glutathione/product-3d.glb`. Reused
  `glutathione-3d/product-3d-viewer.tsx`'s `<model-viewer>` wrapper
  as-is (it was already presentational/generic — src, poster, alt,
  className props only, nothing specific to that page) instead of
  duplicating it; new `product-3d-section.tsx` wraps it with its own
  light-background styling (`.gl3dSection`/`.gl3dStage`/`.gl3dModel`/
  `.gl3dHint`/`.gl3dFsBtn` in glutathione.module.css — the glutathione-3d
  module's equivalent rules float the model on that page's navy hero,
  wrong look for this page's cream background).
  Before/after and usage steps used to be two columns of one section
  (`CareRoutine`, still used unchanged by `/glutathione-3d`) — asked the
  owner to confirm since inserting a section between them meant
  splitting that into two stacked full-width sections; owner confirmed.
  Split into `before-after-section.tsx` (`BeforeAfterSection`) and
  `usage-section.tsx` (`UsageSection`), each importing the now-exported
  `BeforeAfterCard` / `USAGE_STEPS` from `care-routine.tsx` rather than
  duplicating them. New `.glCareSolo` CSS class centers each at 560px
  (same width the two columns already had inside the old 1200px/2-col
  `.glCareInner`, so nothing changed size, just stacked) — mirrors the
  centering `.glCareCol` already got under 900px, just applied
  unconditionally.
  New order: Hero → Formula → Benefits → ProductSpotSection → Gift →
  BeforeAfterSection → Product3DSection → UsageSection → ProductSection
  → TrustStrip → Faq → CtaBanner → Footer.
  Verified: `npx tsc --noEmit` / `npm run lint` clean; live in the dev
  server — section order correct via DOM inspection, and confirmed the
  `<model-viewer>` actually finished loading the new glb
  (`mv.loaded === true`, `mv.src` resolves to `product-3d.glb`) with no
  console errors.

- Replaced `/glutathione`'s 3D model with a fixed version (owner,
  2026-08-06). First attempt at a re-upload (`qqq.glb` again) turned out
  byte-identical to what was already committed (same SHA-256) — flagged
  it instead of silently no-op'ing, owner re-exported and sent
  `aaa.glb` instead (confirmed genuinely different via SHA-256 this
  time, and notably bigger: 25.1MB vs the previous 8.1MB). Copied over
  `public/assets/glutathione/product-3d.glb` (same filename/path, so
  product-3d-section.tsx needed no changes). Verified in the dev server:
  `<model-viewer>` loads it with no console errors (`mv.loaded ===
  true`). Not flagging the size on my own initiative beyond noting it
  here — 25MB is a real jump from the previous two models on this page
  (6.4MB, 8.1MB) and worth knowing about if load time ever comes up.

- A follow-up re-upload attempt (`5.glb`) was also byte-identical to
  the already-committed model (same SHA-256 as `aaa.glb` above, same
  size/timestamp too) — flagged it again rather than no-op committing;
  no code change made for that one.

- Gave `/glutathione`'s 3D-model section (`.gl3dSection` in
  glutathione.module.css) a blue background (owner request, 2026-08-06)
  — reused the exact navy radial gradient `.glHero` already uses
  (`--gl-navy2`/`--gl-deep`), full-bleed (`max-width: none`) like
  `.glCare`, so it reads as a deliberate banner rather than a boxed
  card. That flipped the section from light to dark, so also fixed
  contrast on everything that assumed a light background: `.glTitle`/
  `.glLabel` get scoped `.gl3dSection` overrides (white / gold, same
  treatment `.glHero`'s own heading uses), and `.gl3dHint`/`.gl3dFsBtn`
  switch from navy (now indistinguishable from the section itself) to
  the near-black chip `glutathione-3d.module.css` already uses for this
  exact contrast problem. Also matched `.gl3dModel:fullscreen`'s
  background to the same navy gradient (was cream) for consistency.
  Verified via computed styles in the dev server (not screenshots — the
  chrome extension's screenshot tool is unreliable again after
  scrolling, same reveal-on-scroll timing issue noted earlier this
  session): section background-image resolves to the navy gradient,
  `.glTitle` color is white, `.glLabel` is gold, hint chip is
  near-black-on-cream.

- Live "في المحل" (in-closet) storage counter added to checkout, seller mode
  only (2026-08-07): owner asked for the same live stock number the admin
  Storage Counter tab shows (`stock - sending - delivered - returned`) to
  appear on both cart checkout and the single-product seller quick-order
  modal, next to each item, so a seller taking a phone order can see what's
  actually left. Confirmed with the owner via AskUserQuestion — they wanted
  the accurate live number (not just the raw `products.stock` total-ever-
  stocked field), and per-item placement in the order summary.
  This crossed a real boundary: `firestore.rules` keeps `orders` admin-only
  readable (an explicit invariant — see architecture-context.md), and the
  storefront's "seller mode" is only a client-side `ds_staff` flag, not real
  Firebase Auth, so it can never read `orders` directly. Rather than widen
  that boundary, added a small server-side aggregation layer that computes
  the same derivation with the Admin SDK (bypasses rules server-side only)
  and returns nothing but the derived integer per product — no order
  documents (customer name/phone/address) ever reach the browser:
  - `lib/storage-counter.ts` (new): the pure `stock - sending - delivered -
    returned` math, extracted out of `storage-counter-view.tsx` so the admin
    tab and this new endpoint compute from the exact same function and can't
    drift apart. `storage-counter-view.tsx` refactored to import it instead
    of keeping its own copy (no behavior change there — verified via a
    diff-only re-read).
  - `lib/firebase-admin.ts` (new): server-only Admin SDK singleton, prefers
    `FIREBASE_SERVICE_ACCOUNT_KEY` (service-account JSON string), falls back
    to `applicationDefault()`, returns `null` on any init failure instead of
    throwing.
  - `app/api/storage-closet/route.ts` (new, this repo's first API route):
    `POST { ids: string[] }` → `{ closet: Record<id, number> }`. Skips ids
    whose product doc has no admin-entered `stock` at all (omitted, not
    shown as 0 — an untracked product isn't "out of stock", it just hasn't
    been counted yet, and 0 would read as a false signal to a seller
    mid-checkout). Any failure (missing/invalid credentials, Firestore
    error) is caught and degrades to `{ closet: {} }` rather than a 500 —
    matches the "storefront must render even when Firestore is unreachable"
    invariant; verified locally (no admin credentials configured in this
    sandbox either) that the endpoint returns `{closet:{}}` and `/checkout`
    still renders 200 across repeated calls, no crash.
  - `hooks/use-storage-closet.ts` (new): client hook, only fetches when
    `enabled` (staff mode) and there are ids; the "disabled/no ids" case is
    handled by the hook's own return expression rather than a synchronous
    `setState` in the effect body, to satisfy `react-hooks/set-state-in-effect`
    (same class of fix this file has needed elsewhere — see
    `hooks/use-staff.ts`'s entry above).
  - Wired into `checkout-form.tsx` (per-cart-item, gold badge "📦 في المحل: N"
    next to the price) and `seller-order-modal.tsx` (same badge next to the
    single product line in the order-summary box) — both gated on
    `useIsStaff()`, so regular customers never trigger the fetch or see the
    badge.
  Added `firebase-admin` to `package.json`/`package-lock.json`.
  NOT done / owner action required: this repo has no Google credentials
  configured anywhere (confirmed — no `apphosting.yaml`, no
  `firebase-admin` usage before this, `.env.local` only has Vercel/
  RunningHub keys), and the project is linked to Vercel
  (`.vercel/project.json` → project `trinkl`), which has no ambient Google
  credentials the way Firebase App Hosting/Cloud Run would. **The owner
  must generate a service-account key for `desert-shop-24af9`** (Firebase
  Console → Project Settings → Service Accounts → Generate new private
  key) and set its JSON as the `FIREBASE_SERVICE_ACCOUNT_KEY` env var in
  whichever platform actually serves production traffic (Vercel project
  settings, and/or Firebase App Hosting secrets if that backend is used
  instead) — until then this feature silently shows no badges at all
  (verified fail-safe, not a crash) rather than wrong numbers.
  Verified: `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean.
  NOT exercised: real data through this endpoint (no credentials in this
  sandbox, same standing constraint as every Firestore-touching entry in
  this file) — once the owner sets the env var, open `/checkout` or a
  product page in seller mode with items whose `stock` is set and confirm
  the badge shows the same number as `/amelhadj`'s Storage Counter tab.

- Home page "أبرز المنتجات" (الأكثر طلباً) section sorted by live in-closet
  stock (2026-08-07, same feature family): owner asked for the featured
  product grid on `/` to show the product with the most stock left first,
  instead of the previous newest-first (`lastModified`) order.
  `product-grid.tsx` is a Server Component (no `"use client"`), so this
  reuses the closet math directly server-side instead of going through the
  client-facing `/api/storage-closet` route — no extra network hop, and it
  keeps the privileged Admin SDK orders read entirely server-side. Added
  `getOrderStats()` to `lib/firebase-admin.ts` (reads `orders`, returns the
  same per-product sending/delivered/returned shape `statsByProduct`
  already produces — refactored `/api/storage-closet` to call this too
  instead of duplicating the read) and made `ProductGrid` an `async`
  function that awaits it, then sorts all products by
  `closetFor(stock, stats[id])` descending before slicing the top 8.
  Sort tie-breaks, since the owner didn't specify: products with no
  admin-entered `stock` (never tracked) always sort after every tracked
  product — an unknown quantity can't outrank a known one — but keep the
  original recency order among themselves; equal closet counts also
  tie-break by recency. If `getOrderStats()` returns null (orders read
  failed, e.g. `FIREBASE_SERVICE_ACCOUNT_KEY` not set yet), this is treated
  as "couldn't check" and the whole grid falls back to the original
  recency-only sort — explicitly NOT treated as "zero orders", which would
  have wrongly shown every product's full un-decremented stock as its
  closet count. Same missing-credentials caveat as the checkout badge
  above: shows the old sort order until the owner sets the env var, never
  wrong numbers.
  Verified: `npx tsc --noEmit`, `npm run lint`, `npm run build` clean; dev
  server confirmed `/` still renders 200 and the section's Arabic heading
  is present with no credentials configured (graceful fallback path).
  NOT exercised: the actual reordering against real stock/order data (same
  standing sandbox constraint) — once the env var is set, confirm the
  featured section's order matches `/amelhadj`'s Storage Counter "في
  المحل" column, highest first.

- 2026-08-21: Admin "المنتجات" (Products) tab list now sorts by quantity
  too, matching the Storage Counter tab and the storefront featured grid
  instead of being the one place left on plain recency. Previously
  `components/admin/views/products-view.tsx` sorted purely by
  `lastModified ?? id` descending, with no quantity signal at all. Now
  pulls `orders` from the admin store (same slice `StorageCounterView`
  already reads) and computes each product's `closetFor(stock,
  statsByProduct(orders)[id])` — the same "في المحل" (in-closet) number
  shown in the Storage Counter tab, not the raw `stock` total-ever-stocked
  field (that one's documented as NOT a live quantity) — sorts most-in-
  closet first, and ties (equal closet count, including untracked
  products both landing at 0) fall back to the pre-existing recency sort.
  Verified: `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean
  (same two pre-existing, unrelated findings noted in the prior entries —
  `cart-drawer.tsx`/`sunguard/product-section.tsx`). NOT exercised: the
  actual reordering against real stock/order data in a live `/amelhadj`
  session (same standing sandbox constraint as the other entries above).

## Completed (this session, 2026-08-22)

- Meta Pixel `AddToCart`/`InitiateCheckout` wired into the main
  `/product/[id]` → `/checkout` funnel (per architecture-context.md's
  Analytics section, Pixel infra had only ever been wired for
  `/glutathione`'s `ViewContent`/`Purchase` — the standard product-grid +
  cart flow fired nothing). All three call sites use the shared
  `trackPixelEvent()` helper with the same `content_ids`/`content_type`/
  `value`/`currency: "DZD"` shape as the working `Purchase` call in
  `order-modal.tsx`:
  - `AddToCart` in `components/storefront/product-detail.tsx`'s
    `handleAdd()` (the PDP's "أضيفي إلى السلة" button) — `value` is
    `priceNum(product.price) * qty`.
  - `AddToCart` in `components/storefront/product-card.tsx`'s quick-add
    button too (product grid / related-products tiles) — same event
    shape, `value` for one unit, since it's the same add-to-cart action
    just from a different surface.
  - `InitiateCheckout` in `components/storefront/checkout-form.tsx`, fired
    once on mount once the cart has items (ref-guarded against Strict
    Mode's double-invoke, same pattern as `ViewContent` in
    `glutathione-page.tsx`) — covers both a direct `/checkout` load and
    navigating there via the cart drawer's "إتمام الطلب" link, without
    double-firing on the pre-hydration empty-cart flash.
  Verified: `npx tsc --noEmit` and `npx eslint` on the three touched files
  both clean. NOT exercised: an actual `fbq` call captured in a real
  browser session (same standing sandbox constraint as other entries).

- Follow-up (same day): added the missing `Purchase` event to
  `checkout-form.tsx`'s `placeOrder()`, same `order-modal.tsx` shape/
  `eventID: orderRef.id` convention as the other funnels. This also fixed
  a real pre-existing bug in `placeOrder()`, not just a Pixel gap: it used
  to `try { await saveOrder(data) } catch (e) { console.error(e) }` and
  then fall through UNCONDITIONALLY to the success UI, cart clear, and
  WhatsApp message — so a failed `saveOrder()` (offline, Firestore rules,
  etc.) still told the customer "order received" while nothing was
  actually saved. `placeOrder()` now `return`s early on a `saveOrder()`
  failure, shows a real inline error (`submitError` state, mirrors
  `order-modal.tsx`'s pattern) instead of the false-success screen, and
  only fires `Purchase` after a genuine `saveOrder()` resolution — so the
  Pixel can no longer log a conversion for an order that was never saved.
  `architecture-context.md`'s Analytics section updated to match.
  Verified: `npx tsc --noEmit` and `npx eslint` on `checkout-form.tsx`
  clean. NOT exercised: a real failed-`saveOrder()` path or a captured
  `fbq('track','Purchase', ...)` call in a live browser session.

## Completed (this session, 2026-08-23)

- Fixed the main `/product/[id]` funnel's missing `ViewContent`: reported
  as ViewContent/AddToCart/InitiateCheckout/Purchase all appearing to fire
  on the homepage URL instead of each individual product page, breaking
  Dynamic Ads/retargeting. Root cause was narrower than the report:
  AddToCart, InitiateCheckout, and Purchase were already wired correctly
  (2026-08-22 entry above) with the right `content_ids` and, via `fbq`'s
  own automatic `event_source_url`, the right page URL — but
  `components/storefront/product-detail.tsx` never fired `ViewContent` at
  all. Pixel infra had only ever wired `ViewContent` for the `/glutathione`
  landing funnel (`glutathione-page.tsx`); the standard catalog product
  page every other product actually uses had zero view-content signal, so
  Meta had no per-product ViewContent to key Dynamic Ads/retargeting off
  for any of the catalog's real products — only the four special landing
  pages ever produced one.
  - Added the same ref-guarded once-per-mount `ViewContent` (survives
    Strict Mode's dev-only double-invoke, keyed off `product.id` alone so
    an admin price override loading async after mount can't cause a
    second fire) to `product-detail.tsx`, right next to its existing
    `AddToCart`. Same event shape as everywhere else: `content_ids`,
    `content_type: "product"`, `content_name`, `value`, `currency: "DZD"`.
  - No `event_source_url` override needed/added — `fbq` reads
    `window.location.href` fresh at call time, so a `ViewContent` fired
    from `product-detail.tsx` on `/product/{id}` already reports that
    product's own URL, not the homepage's, once it fires at all.
  - `architecture-context.md`'s Analytics section updated to document
    `ViewContent` as part of the `/product/[id]` → `/checkout` funnel.
  Verified: `npx tsc --noEmit`, `npx eslint`, and `npm run build` all
  clean. NOT exercised: a captured `fbq('track','ViewContent', ...)` call
  in a live browser session or a real Meta Events Manager check (same
  standing sandbox constraint as the other Pixel entries above).

- Follow-up (same day): full Pixel signal-quality pass across every
  remaining funnel, prompted by an owner ask for the max useful signal Meta
  can get out of this site. An audit turned up `/sunguard`, `/collagen`,
  and `/carnitine` firing ZERO pixel events despite being structurally
  identical to `/glutathione` (which had `ViewContent`/`Purchase` already);
  `seller-order-modal.tsx` (a real order-saving path) firing nothing;
  every WhatsApp/contact-form inquiry going untracked; no Advanced
  Matching; no server-side Conversions API. See
  `architecture-context.md`'s Analytics section for the full, current
  picture — summary of what changed:
  - `/sunguard`, `/collagen`, `/carnitine`, and the `/glutathione-3d` A/B
    variant now all fire `ViewContent` (page mount) and `InitiateCheckout`
    (order-modal open, ref resets on close so a reopen fires again) —
    `/glutathione` itself was retrofitted with `InitiateCheckout` too,
    since it had never had it either. `/sunguard`/`/collagen`/`/carnitine`'s
    `order-modal.tsx`s now also fire `Purchase` after a confirmed
    `saveOrder()` — this required fixing the same swallowed-`saveOrder()`-
    error bug `checkout-form.tsx` had before its 2026-08-22 fix (`submit()`
    used to log the error and fall through to the success UI regardless);
    added `submitError` state/UI to match `/glutathione`'s already-correct
    modal.
  - `seller-order-modal.tsx` (PDP "leave order with seller" flow) now fires
    `Purchase` on a confirmed order — it saves a real order via the same
    `saveOrder()` `checkout-form.tsx` uses and previously fired nothing.
  - New non-order signals: `contact-form.tsx` fires `Lead` (and got the
    same swallowed-error fix as above — success/WhatsApp-handoff/`Lead` now
    gate on a real `saveMessage()` resolution); `product-detail.tsx`'s
    direct-WhatsApp button and the site-wide `whatsapp-float.tsx` button
    (converted to a client component for this) both fire `Contact`;
    `products-browser.tsx` fires `Search` with `search_string`, debounced
    ~600ms after typing stops and deduped per distinct settled query.
  - Advanced Matching: new `setAdvancedMatching()` in `lib/meta-pixel.ts`
    re-issues `fbq('init', pixelId, { ph, fn })` with the customer's
    validated phone/name right before every `Purchase` call (checkout,
    every landing order-modal, seller-order-modal) — previously `fbq('init',
    ...)` never passed any matching data, so Meta could only match events
    to a browser cookie, never a real identity. Phone normalized to E.164
    via the new exported `normalizeDzPhone()`.
  - Server-side Conversions API: new `app/api/meta-capi/route.ts` (Next.js
    Route Handler, same convention as `app/api/storage-closet` — not the
    separate `trinkl` Firebase Functions) double-sends `Purchase` to the
    Graph API via a new `sendCapiPurchase()` helper, fire-and-forget,
    called alongside every client-side `Purchase` call above with the same
    `eventID` for dedup. **NOT YET ACTIVE** — needs `META_CAPI_ACCESS_TOKEN`
    (Business Manager → System Users → generate a token with
    pixel/ads_management access), which nothing in this repo has yet (same
    "owner must generate + set the env var on whichever platform serves
    production" situation as `FIREBASE_SERVICE_ACCOUNT_KEY` above). Until
    it's set, the route is a documented no-op (`{ skipped: true }`) — every
    call site already fires-and-forgets it, so this can't break checkout
    either way.
  Verified: `npx tsc --noEmit`, `npx eslint` on every touched file, and
  `npm run build` all clean. NOT exercised: any of this against real Meta
  infrastructure (same standing sandbox constraint as every prior Pixel
  entry) — once deployed, verify via Meta Events Manager's Test Events tool
  + the Meta Pixel Helper browser extension, and check the "Event Match
  Quality" score after Advanced Matching lands. CAPI additionally can't be
  exercised at all until `META_CAPI_ACCESS_TOKEN` is set.

## Next Up

- **Owner action required**: generate a Meta CAPI access token (Business
  Manager → System Users → a token with pixel/ads_management access) and
  set it as `META_CAPI_ACCESS_TOKEN` on whichever platform serves
  production traffic, to activate the server-side `Purchase` double-send
  in `app/api/meta-capi/route.ts` (see the entry above and
  `architecture-context.md`'s Analytics section) — until then it's a
  no-op, same fail-safe pattern as the Storage Counter endpoint's missing
  `FIREBASE_SERVICE_ACCOUNT_KEY` above.

- Extend the `syncCarriers` Cloud Function (in `tango-sama/trinkl/functions`)
  to also sync each carrier's stop-desk/agency list into
  `delivery_data/{carrier}.centers` (shape: `Record<wilayaId, {id, name,
  address?}[]>`), matching the new `CarrierData.centers` field added in
  `lib/delivery.ts` this session. Until that lands, the Stop Desk dropdown
  in checkout/seller-order forms correctly shows "no desks available" for
  every wilaya instead of the old bug (silently showing communes) — but it
  has no real desks to show yet.

## Open Questions

- Storage Counter's "المرتجعة" (return) column is a hardcoded 0 — the owner
  wants a future feature where an order card gets an explicit "mark as
  failed delivery / return" state (owner note: returns usually take ~3
  weeks to physically get back to the closet). No schema field or UI for
  that exists yet. Once it's built (likely a boolean/state field on
  `Order`, set from `orders-view.tsx`), update
  `components/admin/views/storage-counter-view.tsx`'s `classifyOrder()` to
  read it instead of the placeholder — the aggregation, closet-math, and
  table column are already wired and waiting for a real signal.
- Real Stop Desk (agency office) data doesn't exist anywhere yet — not in
  Firestore `delivery_data/{carrier}`, not in the static `delivery-data.ts`
  fallback. `lib/delivery.ts`'s `centersForCarrier()` is wired up and ready
  to read `CarrierData.centers`, but that field is only populated once
  `syncCarriers` is extended (see Next Up). Until then Stop Desk mode is
  correctly empty rather than wrong.
- ~~Two live features now depend on `getAdminDb()`/`getOrderStats()`...~~
  **RESOLVED (2026-08-07)**: `FIREBASE_SERVICE_ACCOUNT_KEY` is now set on
  the real `desert-ghost` Vercel project (Production + Preview) — see the
  Deployment section's 2026-08-07 update above for the project-mixup story.
  Confirmed live against `https://www.desertshop.fit/api/storage-closet`:
  returns real per-product numbers (e.g. `{"1780283875728":31}`), not an
  empty result. Both the checkout badge and the home page sort should now
  be showing real data on the live site — owner should do one real visual
  check (open `/checkout` in seller mode, and compare the home page's
  featured order against `/amelhadj`'s Storage Counter "في المحل" column)
  since this session only verified the API layer, not a rendered page.

## Architecture Decisions

- Static site, no framework, no build step — files deploy as-is to Firebase Hosting.
- Firestore schema is append-only: new code tolerates old document shapes; no migrations.
- Single-admin auth: Firebase Auth email/password, `isAdmin()` in rules checks the
  exact admin email; customers stay anonymous.
- Carrier credentials live only in server-only `private/*` docs, read by Cloud
  Functions via Admin SDK.
- Parcel creation is idempotent per order per carrier — safe to re-run.
- `sw.js` is a permanent kill-switch: the site must never register a caching
  service worker again.
- Branding stays in theme tokens and the `SITE` config so the Bazar Merabet clone
  can rebase cleanly.

## Session Notes

- 2026-07-19: Security lockdown designed, deployed, and REST-verified (catalog 200,
  customer data 403, order create 200). Admin password is set in the Firebase
  console and known only to the owner — sign in once per device at `/amelhadj`.
  WhatsApp toggle added and deployed (default: enabled). Deploys run from this
  machine with the Firebase CLI (`firebase deploy --only hosting|firestore:rules|functions`).
- A test order named "TEST - rules check (delete me)" was created during rules
  verification — owner should delete it from the admin panel if not done yet.
- 2026-07-19 (this session): started rebuilding Desert Shop as a Next.js +
  shadcn/ui app in `ghost`, using `tango-sama/trinkl` (the actual live static
  site) as the reference. That's when the entries above turned out to be
  aspirational rather than deployed — see the corrected "Security lockdown"
  entry above for what was *actually* wrong and what's now fixed for real.
  An order titled "RULES VERIFICATION TEST - delete me" was created in
  `orders` during the REST verification of the new rules — owner should
  delete it from the admin panel.
  Firebase CLI in this environment is authenticated as `tango0es@gmail.com`
  with access to all of that account's projects (`desert-shop-24af9`,
  `br-studio`, `caminy-b10d2`, `fari-4795a`, `luxe-f3665`, `mrabet-fb38c`,
  `webstore-adb30`) — deploys in this session went to `desert-shop-24af9` only.
  Next up: Phase 1 of the rebuild (port the real Blush Rose & Gold theme into
  `ghost/app/globals.css`'s Tailwind/shadcn tokens), then shared layout +
  Firebase data layer, then the home page. Full phase breakdown is in the
  approved plan; remaining phases (products/checkout/collagen landing/admin
  panel rebuild) will each get their own `context/feature-specs/NN-*.md` as
  they're started.
- 2026-07-19 (later): admin panel rebuilt at `/amelhadj` (see Completed).
  It talks to the same production Firestore/Functions as the live site, so
  the old `amelhadj.html` panel and this one can be used interchangeably
  during the transition. Remaining rebuild phase: collagen landing page.
  One environment note: during headless-browser verification, a
  `taskkill /IM chrome.exe` was run on this machine, which closes ALL
  Chrome windows — if a Chrome session was open then, that's why it died.
- 2026-07-19 (later still): owner reported the order tracking stepper
  "broken" in the new panel. Root cause was NOT the component — the dev
  server's Turbopack cache was corrupted after an earlier native crash and
  the shared CSS chunk was being served truncated/unstable (same URL
  alternating between full ~117KB and partial content with no Tailwind
  rules), so the panel rendered unstyled. Verified via a temporary
  mock-data stepper page + headless screenshots (before: unstyled vertical
  list; after: correct RTL 5-step pipeline). Remedy that fixed it and to
  reuse if it recurs: stop the dev server, delete `.next`, `npm run dev`.
  Callable path separately verified healthy (modular-SDK probe of
  `getParcelStatus` → `not-found` for a fake orderId, as expected).
- 2026-07-29: Fixed the admin/staff order form's Stop Desk bug in
  `checkout-form.tsx` and `seller-order-modal.tsx` (the two forms where
  staff explicitly pick a delivery company — gated behind `useIsStaff()`).
  Root cause: both forms derived a single `communeOptions` list from
  `communesForCarrier()` and reused it for the البلدية dropdown regardless
  of delivery type, so Stop Desk mode showed communes because no separate
  stop-desk data path existed at all — `CarrierData` (`lib/delivery.ts`)
  only ever had `wilayas`/`communes`/`fees`. Added a `centers` field to
  `CarrierData` and a `centersForCarrier()` reader (deliberately no
  static/commune fallback), and branched the dropdown on `deliveryType`:
  Home → communes, Stop Desk → this carrier's desks in this wilaya only.
  Also tightened the clearing rules to match spec exactly: changing
  delivery company now unconditionally clears wilaya + delivery type +
  commune/desk (previously it only cleared them if the new carrier
  couldn't resolve the old wilaya); changing delivery type now clears the
  commune/desk pick too (previously it didn't, so a stale commune string
  could resurface). Real stop-desk data still needs a backend change — see
  Next Up / Open Questions — so Stop Desk correctly renders empty
  ("no مكاتب available") until `syncCarriers` is extended to sync it.
- 2026-08-02: New `/glutathione-3d` landing page — an A/B variant of
  `/glutathione` (owner asked for "like the [glutathione-social-ad-square.png]
  ad, but the product as 3D") that swaps only the hero's static bottle photo
  for an interactive, auto-rotating 3D model. Every other section, all copy,
  the real free-gift offer, and the order flow are the *same* components
  `/glutathione` uses, imported directly from `components/storefront/
  glutathione/*` rather than duplicated (`Topbar`, `Benefits`, `Formula`,
  `Gift`, `CareRoutine`, `ProductSection`, `TrustStrip`, `Faq`, `CtaBanner`,
  `Footer`, `StickyBar`, `OrderModal`, `product.ts`, and the shared
  `glutathione.module.css`) — so the two pages can't drift out of sync on
  anything except the hero visual. New files are scoped to
  `components/storefront/glutathione-3d/`: `hero.tsx` (copy of the original
  hero with the `<img>` in `.glSpotVisual` replaced by a 3D viewer + a
  "اسحبي للتدوير 360°" hint badge), `product-3d-viewer.tsx` (thin wrapper
  around `@google/model-viewer`'s `<model-viewer>` custom element — new dep,
  first 3D usage in this repo), `glutathione-3d.module.css` (just the
  viewer's sizing/shadow), and `glutathione-3d-page.tsx` (page shell). Route
  at `app/glutathione-3d/page.tsx`, same self-contained funnel pattern as the
  other landing pages (own metadata, `force-dynamic`, outside `(storefront)`).
  Deliberately NOT wired into `settings.landingPages` (no admin hero/product
  override, no custom-slug redirect) — same "build the page first" scope
  call made for sunguard/collagen/glutathione's own initial builds; add
  "glutathione-3d" to `LandingPageKey` later if the owner wants it
  admin-editable.
  Model asset: the owner supplied `gluta.glb` (~6.4MB, generated by an
  image-to-3D tool from the same product photo — file was named
  `图像转3D_...glb` in the source folder) at `C:\Users\Tango\Desktop\gluta\`;
  copied as-is into `public/assets/glutathione/gluta-3d.glb` (no compression
  pass — worth revisiting with `gltf-transform` if hero LCP on slow
  connections becomes a concern, since this is the only sizeable new asset
  weight added). `Product3DViewer` renders the same static `product-shot.webp`
  as a poster/fallback until `@google/model-viewer`'s JS loads client-side
  (dynamically imported with `next/dynamic({ssr:false})`, since the custom
  element needs `window`/`customElements` and can't render on the server) —
  so there's no blank flash, just a brief photo-then-model swap.
  Verified: `tsc --noEmit`, `npm run lint`, and `npm run build` clean
  (`/glutathione-3d` builds as `force-dynamic`, correct route, no new lint
  errors — the pre-existing `cart-drawer.tsx`/`sunguard` lint warnings and
  the `runninghub-mcp/.venv` vendor-file lint errors are unrelated and
  predate this change). Full interactive verification via a real Chrome
  session (claude-in-chrome, not headless): confirmed the `.glb` request
  returns 200, `document.querySelector('model-viewer').loaded === true`
  (the actual custom element, not just the poster `<img>` — checked via
  `customElements.get('model-viewer')`), and dragging the model rotates it
  to reveal the bottle's back "Supplement Facts" label — genuine 3D
  geometry, not a flat image. Compared side-by-side against `/glutathione`
  at the same viewport to confirm the rest of the page (hero copy layout,
  RTL, sections below the fold) is pixel-identical to the original. NOT
  exercised: an actual successful order submit (same outstanding
  recommendation as every other landing page in this file — this page reuses
  the already-verified `OrderModal`/`saveOrder` path unchanged, so the risk
  is low, but one real test order is still worth doing before trusting it).
- 2026-08-02 (same day, follow-up): owner asked to drop the white card
  behind the 3D model, make it zoomable, and use a "shadow catcher plane."
  `components/storefront/glutathione-3d/product-3d-viewer.tsx`: removed
  `disable-zoom` (camera-controls alone only covers drag-rotate — scroll/
  pinch now zooms too); model-viewer's `shadow-intensity`/`shadow-softness`
  (already set) ARE its built-in shadow-catcher-plane implementation — an
  invisible ground plane that only renders the object's contact shadow —
  so no new geometry/library was needed. The bigger change is CSS: the
  hero spotlight no longer reuses `/glutathione`'s shared `.glSpot`
  (opaque white card) — `glutathione-3d.module.css` now has its own
  `.spot`/`.spotVisual`/`.spotCorner`/`.spotBrand`/`.spotTitle`/
  `.spotBadges`/`.spotBadge` (structurally mirroring the shared ones but
  `background: transparent`, `box-shadow: none`, title/brand text
  recolored to white/gold so they stay legible directly on the navy hero
  gradient instead of on a white surface); `hero.tsx` updated to use these
  local classes instead of the shared module's. Result: the bottle floats
  directly on the hero background with only its own ground shadow, no
  card frame. Also dropped the CSS `filter: drop-shadow(...)` that was on
  `.model3d` — redundant/conflicting now that model-viewer's own 3D shadow
  is the real shadow.
  Verified: `tsc --noEmit`, `npm run build` clean. Interactive check via a
  real Chrome session: confirmed visually the white card is gone (bottle
  floats on the navy gradient, badges still legible), scroll-wheel over
  the model zooms the camera in (confirmed via before/after screenshots),
  and drag-to-rotate still works. No new console errors (only the same
  expected offline-Firestore fallback noted throughout this file).
- 2026-08-02 (same day, second follow-up): owner asked for the model to
  "dominate the view," be zoomable without the page stealing the scroll
  gesture, and support fullscreen.
  `glutathione-3d.module.css`: `.spotVisual` went from a fixed 300–320px
  box to `height: min(60vh, 640px)` (`min(48vh, 420px)` under 640px) —
  real viewport-relative sizing instead of a small card, and a new
  `.heroInner` class (layered onto the shared `.glHeroInner`) rebalances
  the hero grid from the shared page's 1.05fr/0.95fr to 0.8fr/1.2fr so the
  product column is now the dominant one. `.model3d` switched from a fixed
  height to `width/height:100%` of that box (`object-fit:contain` so the
  poster-image fallback doesn't stretch), plus `touch-action:none` and
  `overscroll-behavior:contain` so pinch/scroll interaction never escapes
  into page scrolling/panning.
  `product-3d-viewer.tsx`: added a non-passive `wheel` listener on the
  model-viewer element that always calls `preventDefault()` — without it,
  once the camera hit its own min/max zoom the browser's default wheel
  behavior took back over and scrolled the page instead (verified via a
  direct `dispatchEvent(new WheelEvent(...))` test: `defaultPrevented`
  flips from unset to `true` once the listener is attached). Added a
  fullscreen toggle button (expand/compress icon, swaps based on
  `document.fullscreenElement`) calling `requestFullscreen()` /
  `exitFullscreen()` on the model-viewer element itself — gated behind a
  `document.fullscreenEnabled && typeof document.documentElement.
  requestFullscreen === "function"` check so the button doesn't render at
  all on iOS Safari, which has no `Element.requestFullscreen` (only
  `<video>` gets its own webkit fullscreen there); both calls `.catch(()
  => {})` since a Permissions-Policy can legitimately still reject the
  request even when the API exists.
  Verified: `tsc --noEmit`, `npm run lint`, `npm run build` clean. Real
  Chrome session: confirmed the product is now dramatically larger and
  the grid is visibly rebalanced toward it; confirmed via a direct
  `WheelEvent` dispatch that `preventDefault` is correctly wired (the
  automation tool's own synthetic multi-tick scroll gesture still leaked
  some page scroll during testing — a known Chromium "fling" fast-path
  quirk for CDP-injected input, not something a real trackpad/mouse wheel
  hits, and now further guarded by touch-action/overscroll-behavior).
  Fullscreen: this session's automated Chrome tab rejects
  `requestFullscreen()` with `Permissions check failed` regardless of
  gesture — confirmed via instrumenting the call that the button IS wired
  correctly and DOES invoke it on click, so the rejection is this specific
  sandboxed tab's environment, not the app; not exercised end-to-end in an
  ordinary top-level browser tab in this session — worth a real click
  before fully trusting it.
- 2026-08-02 (same day, third follow-up): owner asked to lock the model
  to the center — rotation and zoom only, no x/y movement.
  `product-3d-viewer.tsx`: added `disable-pan` to the model-viewer
  element. model-viewer's `camera-controls` otherwise also enables a pan
  gesture (right-click-drag / two-finger-drag) that shifts the camera
  *target* off the model; `disable-pan` turns that off while leaving
  orbit (drag-rotate) and zoom untouched. `camera-target` was never set
  explicitly so it already defaulted to "auto" (the model's own center),
  and stays there now with no way to drag it off.
  Verified: `tsc --noEmit` and `npm run build` clean. Real Chrome session:
  confirmed `disable-pan` is present on the live element, then simulated
  a right-mouse-button drag directly via `PointerEvent`s (the same input
  path model-viewer's pan gesture listens on) and read `getCameraTarget()`
  / `getCameraOrbit()` before and after — both identical, confirming pan
  is fully inert while the element is otherwise interactive.
- 2026-08-04: admin orders tab — renamed the per-order tracking-check
  button from "🔄 تحديث" to "🔄 تتبع" (`orders-view.tsx`'s `TrackStepper`),
  then added bulk order deletion: a `selected` map (order id → checked)
  drives a checkbox on each card (in the header row, `stopPropagation`d so
  it doesn't also toggle fold/unfold), a "☑️ تحديد الكل" / "✕ إلغاء تحديد
  الكل" toggle in the toolbar (selects/deselects everything in the current
  filtered `list`, not the full unfiltered order set), and a floating
  "🗑️ حذف المحدد (N)" button (bottom-right, `bg-destructive`, separate
  corner from the existing Noest-print floating bar so the two don't
  overlap) that confirms once, deletes all selected via
  `Promise.allSettled(deleteDocIn(...))`, and reports how many succeeded
  vs. failed in the toast.
  Verified: file parses clean via `esbuild --loader=tsx` (no local
  `node_modules` in this session, so `tsc`/`npm run build` couldn't run —
  worth a real `tsc --noEmit` / `npm run build` pass before fully
  trusting it); not exercised in a live browser session.
- 2026-08-04: Fixed the home page's "المنتجات المميزة" (featured products)
  section not appearing at all. It WAS already positioned correctly (right
  after the category section, in `app/(storefront)/page.tsx`) and had
  correct data-fetch logic — the bug was scroll-reveal wiring: `<
  FeaturedCarousel>`'s root `<section>` carries the `reveal` CSS class
  (`opacity:0` until an `IntersectionObserver` adds `.in`, see
  `app/globals.css`), but `useReveal` (`hooks/use-reveal.ts`) only scans for
  `.reveal` descendants inside the specific `<RevealRoot>` div it's attached
  to, on mount. `FeaturedCarousel` was rendered as a bare sibling between two
  `<RevealRoot>` blocks, not inside one, so no observer ever watched it and
  it stayed permanently invisible (`opacity:0`, translated 30px down) even
  when `featured_products` had real data — a silent, permanent-not-rendered
  bug rather than an empty-data or positioning issue. Fix: wrapped
  `<FeaturedCarousel items={featured} />` in its own `<RevealRoot>` in
  `app/(storefront)/page.tsx`, matching the pattern used for every other
  section on the page.
  Verified: `esbuild --loader:.tsx=tsx` parses the changed file clean (no
  local `node_modules` in this session, so `npm run lint`/`build` couldn't
  run — worth a real `npm run build` + browser check before fully trusting
  it, and worth confirming at least one row exists in `featured_products` so
  there's something to see).
- 2026-08-05: Made the whole card in the home page's "المنتجات المميزة"
  (featured products) carousel clickable, not just the CTA button —
  `components/storefront/featured-carousel.tsx`. Previously only the
  bottom `Link` (the "تفاصيل أكثر" button) navigated to `f.productLink`;
  clicking the image or the product-name text did nothing. Restructured
  so the outer card itself (`data-fcard`) is the `Link` wrapping the
  image, name, description, and CTA, and turned the former nested CTA
  `Link` into a `span` styled identically (avoids invalid nested `<a>`
  tags). `data-fcard` stayed on the same element so the arrow-button
  scroll-step logic in the same file (`querySelector("[data-fcard]")` →
  `offsetWidth`) is unaffected. Regular product cards
  (`components/storefront/product-card.tsx`) already had this pattern
  (multiple `Link`s covering image/title, only the add-to-cart `button`
  excluded) — no change needed there.
  Verified: `npm run lint` clean (pre-existing unrelated warning/error in
  `cart-drawer.tsx`/`sunguard/product-section.tsx`, not touched here),
  `npm run build` clean, and a real `npm run dev` + `curl` check of the
  rendered HTML confirmed each featured card is now a single `<a
  href="/...">` wrapping the image/title/CTA (previously only the CTA
  span-equivalent carried the href).

- 2026-08-05: Added a header search icon next to the cart icon, sitewide
  (`components/storefront/nav.tsx`) — clicking it toggles a slide-down
  search bar (same visual slot/z-index as the mobile menu panel, but
  shown at all breakpoints since the trigger icon itself isn't
  `md:hidden`); submitting navigates to `/products?q=<query>`. Reused the
  existing `/products` in-memory filtering (`components/storefront/
  products-browser.tsx`) rather than building a second search mechanism:
  `ProductsPage` now reads a `q` searchParam alongside the existing `cat`
  one and passes it as `ProductsBrowser`'s new `initialQuery` prop, which
  seeds the page's own search box — so the header search and the
  in-page search box are the same state, just two entry points into it.
  Broadened the match itself so "search anything on the site" is
  meaningfully true for the catalog: the filter predicate now also
  matches the product's category name (`catMap[p.category]`), not just
  title/subtitle as before — a query like "عطور" now surfaces every
  product in that category even if the word never appears in an
  individual product's own title. (Scope note: this searches the product
  catalog — title, subtitle, category — which is the site's only
  structured, indexable content; the three single-product landing pages
  `/collagen`, `/sunguard`, `/glutathione` are separate marketing funnels
  with hardcoded copy, not part of this index, same boundary the funnels
  already keep from the main catalog per architecture-context.md.)
  Verified: `npm run lint` clean (same two pre-existing, unrelated
  findings as the prior entry — `cart-drawer.tsx`/`sunguard/
  product-section.tsx` — nothing new introduced here), `npm run build`
  clean, and a real `npm run dev` + `curl` check confirmed the search
  icon renders in the nav (`aria-label="بحث"`) and that
  `/products?q=عطر` server-renders the search input pre-filled with
  `value="عطر"`.- 2026-08-24: Meta Conversions API (CAPI) reworked from a client-relayed
  Purchase-only stub into a real server-side implementation, and
  `ViewContent` added as a second dual-sent event. New `lib/meta-capi.ts`
  holds the SERVER-ONLY transport (`sendMetaEvent()` + `buildUserData()`);
  `app/api/meta-capi/route.ts` was rewritten around it. Three real defects
  in the previous version are fixed: (1) the endpoint accepted a
  client-supplied `value`, so anyone with curl could inject fake
  conversions — Purchase now sends nothing but `orderId` and the route
  re-reads the order from Firestore with the Admin SDK, deriving value/
  `contents`/`num_items`/`order_id`/matching from the stored document, so a
  Purchase can only exist for an order that genuinely does; (2) the
  server-side phone hash was computed over the `+213…` form, which Meta can
  never match — it now hashes digits-only per Meta's spec (this silently
  destroyed all server-side phone matching); (3) there was no idempotency —
  a Firestore transaction now claims the send via `meta.purchaseInFlight`
  (5-minute stale-claim escape) and records `meta.{purchaseEventId,
  purchaseSent,purchaseSentAt,purchaseError}`, so a retry can never produce
  a second Purchase while a genuine failure can still be retried. Event ids
  are built in exactly one place each (`purchaseEventId()` /
  `trackViewContent()`) so the browser and server copies cannot drift;
  Purchase's is derived from the Firestore order id and is therefore stable
  across retries. Match quality raised well beyond the previous `ph`+`fn`:
  `ln`, `ct` (Latin `communeFr`/`baladiya`), `st` (Latin `wilayaFr`),
  `country`, and `external_id` — a random per-browser `ds_vid` written by
  the base pixel script BEFORE `fbq('init')` so every browser event carries
  it, including the ones with no server twin. `_fbc` is now reconstructed
  from a `fbclid` URL param when the cookie is absent, so ad-click
  attribution survives a blocked pixel. Call sites collapsed onto two
  helpers (`trackPurchase()` × 6 order flows, `trackViewContent()` × 6
  product/landing pages); no checkout logic, order schema, or UI changed.
  Verified: `npx tsc --noEmit` clean; `npm run lint` clean apart from the
  same two pre-existing unrelated findings (`cart-drawer.tsx`,
  `*/product-section.tsx`); `npm run build` clean; the built client bundles
  contain neither `META_CAPI_ACCESS_TOKEN` nor `graph.facebook.com`
  (server/client boundary holds); a 19-assertion runtime check of the
  hashing/normalization and event-id construction passed (including proof
  the digits-only phone hash differs from the old `+`-form); and a live
  `next start` + curl run confirmed every failure path returns HTTP 200
  (garbage body, unknown event, forged Purchase for a nonexistent order,
  Graph API error) with the access token never appearing in any log line.
  NOT verifiable from the dev sandbox: a successful Graph API round-trip —
  `graph.facebook.com` is outside this environment's egress allowlist, so
  the send path was exercised only through its error branch. Needs
  confirming in Events Manager → Test Events after `META_CAPI_ACCESS_TOKEN`
  and `FIREBASE_SERVICE_ACCOUNT_KEY` are set (Purchase CAPI now depends on
  the latter too — without Admin credentials the order can't be verified
  and nothing is sent).


- 2026-08-26: **AI-drafted WhatsApp replies (Meta Cloud API).** The shop's
  only WhatsApp integration until now was a `wa.me` deep link
  (`lib/whatsapp.ts`) plus the "رد" button in the الرسائل tab — every customer
  conversation was answered by hand on a phone. This adds a real two-way
  channel and an AI draft on top of it. Owner decisions recorded during
  planning: **Meta WhatsApp Cloud API** as the channel (the only officially
  supported programmatic route, and it reuses the Meta Business Manager
  account already running the Pixel/CAPI); **AI drafts, owner approves** —
  nothing reaches a customer without a tap; scope limited to **product/price
  questions and delivery fees/FAQ**, with order-status lookups and in-chat
  order-taking explicitly out of scope for now.
  New server-only modules: `lib/whatsapp-cloud.ts` (Graph transport,
  signature verification, 24h-window check), `lib/wa-store.ts` (Admin SDK
  persistence for `wa_threads`), `lib/whatsapp-ai.ts` (the draft), and the
  pure `lib/wa-draft-text.ts`. New routes: `app/api/whatsapp` (webhook) and
  `app/api/whatsapp/send` (admin-authenticated outbound). New admin tab
  واتساب (`components/admin/views/inbox-view.tsx`) with a live thread list,
  the AI draft preloaded into an editable composer, and a 24h-window badge.
  `lib/firebase-admin.ts` gained `getAdminAuth()` / `isAdminRequest()` —
  the send route is the first in this repo that must not be open, since an
  unauthenticated one would let anyone message customers from the shop's
  number.
  Three things worth remembering about the design: the webhook verifies the
  HMAC against the RAW body before parsing (re-serialized JSON never
  matches); it returns 200 before drafting, doing the model call in
  `after()`, because Meta disables slow webhooks; and message docs are keyed
  by Meta's `wamid`, so a webhook retry is idempotent by construction rather
  than by a flag. The model is grounded on a Firestore-built facts block
  rather than a tool loop, so it cannot quote a price it wasn't handed, and
  the AI path never touches `orders`.
  Verified: `npx tsc --noEmit` clean; `npm run lint` clean apart from the
  same three pre-existing unrelated findings (`cart-drawer.tsx`,
  `carnitine/product-section.tsx`, `sunguard/product-section.tsx`);
  `npm run build` clean with both routes registered; the built client bundles
  contain none of `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`,
  `WHATSAPP_VERIFY_TOKEN`, `ANTHROPIC_API_KEY`, `graph.facebook.com`,
  `api.anthropic.com`, nor the Anthropic SDK itself (server/client boundary
  holds). Live `next start` + curl: 9/9 webhook checks (handshake echoes the
  challenge, wrong token/mode/no-params → 403; valid signature → 200, bad and
  missing signature → 403; a body tampered under a previously-valid signature
  → 403; a malformed-but-signed body → 200 so Meta stops retrying) and 5/5
  send-route auth checks (no header, junk bearer, non-bearer scheme, empty
  bearer, and a well-formed **forged JWT claiming the admin email** all → 401,
  with zero Graph calls attempted). 40 isolated assertions over the pure
  logic: 23 on `parseInbound` (batched entries/changes, status callbacks with
  no messages array, non-text types, blank bodies, seconds→ms timestamps,
  per-`wa_id` profile-name matching rather than positional, garbage payloads)
  and the window/signature edge cases including the exact 24h boundary; 17 on
  `wa-draft-text` (the handoff marker stripped wherever it lands — last line,
  mid-text, start, repeated, inline — and `toTurns` dropping leading outbound
  messages so the first turn is always `user`). One real defect was caught
  and fixed by those: stripping a whole-line marker left a stray blank line
  mid-reply.
  NOT verifiable from this sandbox: a real Graph API round-trip
  (`graph.facebook.com` is outside the egress allowlist, same caveat as the
  Meta CAPI entry above) and any live model call (no `ANTHROPIC_API_KEY` in
  the sandbox) — so draft *quality* in Arabic has not been read yet, only the
  code paths around it, which were confirmed to degrade to "no draft" rather
  than to an error. Both need confirming after deploy.
  **Open questions for the owner, blocking go-live:**
  1. **Which phone number.** A number active in the WhatsApp Business *mobile
     app* cannot also be on the Cloud API. Putting `213662705830` (the default
     in `lib/whatsapp.ts`) on the API means it stops working on the phone —
     accept that, or register a second number for the API.
  2. **`firestore.rules` must gain `wa_threads` as `allow read, write: if
     isAdmin()`** before the panel can read the inbox. Those rules live with
     the Cloud Functions project, not this repo, and per
     `context/ai-workflow-rules.md` a rules change is its own step, verified
     with anonymous REST checks before and after deploy. Until it lands the
     inbox will log a permissions error and stay empty.
  3. Meta setup itself: add the WhatsApp product to the app, register the
     number, mint a System User permanent token with
     `whatsapp_business_messaging` + `whatsapp_business_management`, and point
     the webhook at `https://<domain>/api/whatsapp` subscribed to `messages`.

- 2026-08-27: WhatsApp inbox — pre-launch pass, then merged to `main` for
  deployment. Three things.
  **(1) The reply persona is now written for the shop's actual customers:**
  Algerian women, in Algerian darja, addressed in the feminine. The first
  version defaulted to "darja or MSA" and referred to the customer in the
  masculine third person, which is the register a model reaches for by
  default and the wrong one for this shop — "شحال" not "كم", "وين" not "أين",
  "راكِ/تحبي/عندكِ" not the masculine forms. Darja↔French mixing is now
  explicitly allowed since that is how customers actually write, and a
  masculine fallback is stated outright so a man who messages is not
  addressed as a woman. Added one rule the previous persona lacked: no
  medical advice — on a skin/health question the reply points to a doctor,
  which matters for a store selling glutathione and collagen.
  **(2) The 24-hour window badge never ticked.** `windowLeft()` was computed
  during render with nothing to re-render it, so a panel left open — the
  normal way it will be used — kept showing a stale "يمكن الرد: 3 سا" and
  left the composer enabled after the window had actually shut. The send was
  still refused server-side (409), so this misled rather than broke, but it
  undermined the one piece of UI whose entire job is telling the truth about
  time. Now re-renders once a minute, which is the finest granularity the
  badge displays.
  **(3) Removed dead `isConfigured()`** from `lib/whatsapp-cloud.ts` — never
  called; `sendText()` does its own credential check.
  Verified: tsc/lint/build clean (same three pre-existing findings); all 40
  isolated assertions still pass, which matters here because `waWindowOpen`
  is shared by the badge and the send route; client bundles still carry none
  of the WhatsApp/Anthropic secrets, hosts, the SDK, or the persona text;
  live smoke test — Meta's handshake echoes the challenge, wrong verify token
  403, signed inbound 200, unsigned 403, send without an admin token 401.
  **Merged to `main`:** the feature branch was 2 commits ahead and unmerged,
  so `/api/whatsapp` was a 404 in production and Meta's webhook could never
  have verified against it — the owner had already added the access token to
  Vercel against a route that did not exist. Note a Vercel *preview* URL is
  not a workaround: Deployment Protection answers Meta with 401.
  Still owner-side before it can work: `WHATSAPP_PHONE_NUMBER_ID`
  (= 1389895586445932), `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` and
  `ANTHROPIC_API_KEY` in Vercel + a fresh build; the `wa_threads` rules
  block; and the webhook subscription. Draft quality in darja still has NOT
  been observed against the live model — no `ANTHROPIC_API_KEY` in the dev
  sandbox and `graph.facebook.com` remains outside its egress (HTTP 000).

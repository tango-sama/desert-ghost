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

## Completed

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

## Next Up



## Open Questions

- None. Add one here instead of guessing when a requirement is missing.

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
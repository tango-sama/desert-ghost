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

## Next Up

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
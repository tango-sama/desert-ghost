# Architecture Context

## Stack

| Layer          | Technology                        | Role                                                              |
| -------------- | --------------------------------- | ----------------------------------------------------------------- |
| Frontend       | Static HTML + vanilla JS (ES5)    | Storefront pages and admin panel; no framework, no build step     |
| Styling        | Plain CSS (`css/theme.css`)       | Single shared stylesheet; RTL Arabic, Blush Rose & Gold tokens    |
| Data           | Firestore (compat SDK)            | Products, categories, orders, messages, settings, expenses        |
| Backend        | Cloud Functions v2 (Node, onCall) | Delivery-carrier APIs, push/email notifications, fee syncing      |
| Hosting        | Firebase Hosting                  | Serves the repo root; `cleanUrls`, no-cache HTML, cached assets   |
| Notifications  | Web Push (VAPID) + email          | Admin alerts on new orders and messages                           |
| Delivery       | Yalidine, Noest, ZR Express       | Parcel creation, tracking, and fee grids for Algerian shipping    |

## System Boundaries

- Root `*.html` — one page per file. Storefront: `index`, `products`, `product`,
  `categories`, `collagen`, `checkout`. Admin: `amelhadj.html` (unlinked, obscure
  URL by design).
- `js/` — shared browser layer: `firebase.js` (Firestore data layer, exposes
  `window.DS`), `site.js` (shared UI, `window.SITE`), `cart.js` (`window.Cart`,
  localStorage cart), `yalidine.js` (delivery-fee/wilaya helpers).
- `functions/` — the only server-side code and the only npm-managed package. All
  carrier credentials and privileged Firestore access live here.
- `css/theme.css` — the single stylesheet every page loads.
- `assets/` — images in per-product-line subfolders; prefer `.webp`.
- `sw.js` — kill-switch service worker: clears caches and unregisters itself
  (legacy cleanup). Do not add caching back.
- `push-sw.js` — web-push service worker, registered from the admin panel only;
  never intercepts fetches.

## Data Model (Firestore)

- **Public read, admin-only write**: `products`, `categories`, `featured_products`,
  `site_settings` (single doc).
- **Create-only for customers, admin-only read/update/delete**: `orders`, `messages`
  (they contain names, phones, addresses).
- **Admin-only**: `expenses`; `private/*` and `push_subs` are admin-writable but
  never client-readable (`private/*` holds carrier API credentials, read only by
  Cloud Functions via Admin SDK).
- **Read-only for clients**: `delivery_fees`, `delivery_data` — carrier fee grids
  and wilaya/commune lists, written only by the `syncCarriers`/`syncNoestFees`
  functions.
- The cart lives in localStorage on the client; an order document is created at
  checkout.
- Orders accumulate carrier state in-place: parcel creation writes
  `{ tracking, label }` under a per-carrier key (`yalidine`, `noest`, `zr`) on
  the order doc.
- `products.stock` (optional number, admin-entered on restock) is the total
  units ever stocked for a product — not a live closet count. The admin
  Storage Counter tab (`/amelhadj`) derives "in closet" as
  `stock - sending - delivered - returned`, where sending/delivered are
  computed live from `orders[].items[].qty` grouped by each order's
  `trackingStatus` (same derivation the orders-tracking stepper already
  uses). "Returned" is a placeholder (always 0) until order cards gain a
  manual failed-delivery/return flag — a planned follow-up, not yet built.
  This math lives in `lib/storage-counter.ts` (pure, no Firebase imports),
  shared by the admin view and `app/api/storage-closet` below so both can
  never drift apart.

## Storefront-safe closet-stock access (`lib/firebase-admin.ts`)

- The storefront's "seller mode" (`ds_staff` localStorage flag) is cosmetic
  UI only, not real Firebase Auth — it cannot read `orders` (admin-only per
  `firestore.rules`), so it cannot compute the live "in closet" number the
  same way the admin panel does. `lib/firebase-admin.ts` bridges that gap:
  server-only Firebase **Admin SDK** access (bypasses `firestore.rules`
  entirely — NEVER imported by any "use client" file) exposing
  `getOrderStats()`, which reads `orders` and returns the same per-product
  sending/delivered/returned shape `lib/storage-counter.ts`'s
  `statsByProduct` already produces for the admin panel. Two call sites:
  - `app/api/storage-closet` (this repo's only API route) — `POST { ids }`
    → `{ closet: Record<productId, number> }`, fetched client-side by
    `hooks/use-storage-closet.ts`, only in seller mode
    (`checkout-form.tsx`, `seller-order-modal.tsx`). Regular customers
    never trigger this request.
  - `components/storefront/product-grid.tsx` (the home page's "أبرز
    المنتجات" section) — a Server Component, so it calls `getOrderStats()`
    directly at render time (no network hop) to sort all products by
    closet count before picking the top 8. This one runs for every visitor,
    not just seller mode, since it only affects display order, not any
    data exposed to the page.
- **Invariant: nothing downstream of `getOrderStats()` may expose order
  fields** (customer name/phone/address, carrier data, etc.) to the
  browser — only derived integers. Any future change to either call site
  above must preserve that; this is the one place in the codebase where
  privileged Firestore access feeds into what the public internet gets
  served, so the response/render shape at each call site is the entire
  security boundary.
- Credentials: `FIREBASE_SERVICE_ACCOUNT_KEY` env var (service-account JSON
  string) — required, since production traffic is served from Vercel (no
  ambient Google credentials). Falls back to `applicationDefault()` for
  environments that provide it natively. Missing/invalid credentials or any
  Firestore error make `getOrderStats()` return `null` — callers must treat
  that as "couldn't check" (fail to the pre-existing behavior: no badge,
  original recency sort), never as "zero orders" — conflating the two would
  make every product's full un-decremented `stock` look like its live
  closet count. Consistent with invariant 2 below.

## Analytics

- Meta Pixel ("amel", id in `NEXT_PUBLIC_META_PIXEL_ID`) loads once from
  `app/layout.tsx` via `components/analytics/meta-pixel.tsx` — never
  per-funnel — so it survives client-side navigation without
  re-initializing. `components/analytics/meta-pixel-route-tracker.tsx`
  fires `PageView` again on each subsequent route change. Funnel
  components call the shared `trackPixelEvent()` helper (`lib/meta-pixel.ts`)
  for `ViewContent`/`Purchase` instead of touching `window.fbq` directly.
- Wired for `/glutathione` (`ViewContent` on mount in `glutathione-page.tsx`,
  `Purchase` after a confirmed `saveOrder()` success in `order-modal.tsx`,
  keyed to the real order total/items — never a hardcoded value).
  `/sunguard` and `/collagen` follow the same `order-modal.tsx` pattern and
  are expected to reuse this same infrastructure once `/glutathione` is
  verified.
- Also wired for the main `/product/[id]` → `/checkout` funnel:
  `ViewContent` fires once per product-page mount (`product-detail.tsx`,
  same ref-guarded once-per-mount pattern keyed off `product.id`, so it
  carries that product's own id/name/price and — via `fbq`'s own automatic
  `event_source_url` — that product's own page URL, not the homepage's);
  `AddToCart` fires from both the product page's add-to-cart button
  (`product-detail.tsx`) and the product-grid quick-add button
  (`product-card.tsx`); `InitiateCheckout` fires once on `/checkout` mount
  once the cart has items (`checkout-form.tsx`, same ref-guarded
  once-per-mount pattern as `ViewContent`); `Purchase` fires from
  `checkout-form.tsx`'s `placeOrder()` after a confirmed `saveOrder()`
  success, same shape/eventID convention as `order-modal.tsx`. Fixing this
  also fixed a real bug: `placeOrder()` used to swallow a failed
  `saveOrder()` and fall through to the success UI/cart-clear regardless —
  it now only treats a genuine `saveOrder()` resolution as success, so
  Purchase can never fire for an order that wasn't actually saved.
- No server-side Conversions API yet. `Purchase`'s Pixel call already
  passes `eventID: orderRef.id` (the Firestore order doc id) so a future
  CAPI call for the same order can dedupe against it.

## Auth Model

- Customers browse and order anonymously — no customer accounts.
- The admin is a single Firebase Auth email/password account (`tango0es@gmail.com`).
  `amelhadj.html` gates the panel behind `signInWithEmailAndPassword` (email
  hardcoded, password-only form), and `firestore.rules` defines `isAdmin()` as a
  signed-in user with that exact email.
- Everything sensitive requires `isAdmin()`: reading orders/messages, all of
  `expenses`, catalog and settings writes, and writes to `private/*` / `push_subs`.
  `private/*` is never client-readable — only the Admin SDK inside Cloud Functions
  reads it.
- On sign-in the panel sets the `ds_staff` localStorage flag, which
  product/checkout pages use for staff-only UI (convenience, not security).
- Any change to `firestore.rules` must preserve these asymmetries: secrets stay in
  `private/*`, order/message reads stay admin-only, and `delivery_fees` /
  `delivery_data` stay function-written.

## Cloud Functions Model

- All callable functions are `onCall` in `us-central1`, invoked from the admin
  panel: `createYalidineParcel`, `createNoestParcel`, `createZrParcel`,
  `getParcelStatus`, `getNoestLabels`, `syncNoestFees`, `syncCarriers`,
  `getPushKey`, `sendTestEmail`.
- Firestore triggers: `onNewOrder` and `onNewMessage` send web-push (and email)
  notifications to every subscription in `push_subs`.
- Pattern for every carrier function: validate `req.data` → throw typed
  `HttpsError` → load credentials from `private/*` and origin wilaya from
  `site_settings` → call the carrier API → write results back onto the order doc.
- Parcel creation is idempotent: if the order already carries a tracking number
  for that carrier, return it instead of creating a duplicate parcel.

## Delivery Carrier Model

- Three interchangeable carriers (Yalidine, Noest, ZR Express); the admin picks
  per order. Each has its own API base, credential shape in `private/*`, and
  result key on the order doc.
- Fee grids and wilaya/commune lists are synced by function into `delivery_fees` /
  `delivery_data` so the storefront checkout can show shipping costs without ever
  touching carrier APIs or credentials.
- Tracking status is fetched on demand (`getParcelStatus`) from the admin panel,
  not polled.

## Invariants

1. No secrets in browser code. Carrier credentials exist only in `private/*`
   Firestore docs, read only by Cloud Functions. (The Firebase web config in
   `js/firebase.js` is public by design.)
2. The storefront must render even when Firestore is unreachable — every read in
   `js/firebase.js` catches and returns `[]`/`null`.
3. All user- or admin-entered strings are escaped with `esc()` before being
   interpolated into HTML.
4. The Firestore schema is append-only in practice: new code tolerates old
   document shapes (`title||name`, `images[]||image`) and never migrates
   existing docs.
5. Carrier parcel creation is idempotent per order per carrier.
6. Prices flow through `DS.priceNum()` / `DS.priceFmt()` only; display currency is `د.ج`.
7. The storefront never registers a caching service worker; `sw.js` stays a
   kill-switch.
8. Branding lives in theme tokens and the `SITE` config object — Bazar Merabet
   (project `mrabet-fb38c`) is a downstream rebranded clone of this codebase,
   and scattered brand literals break that portability.
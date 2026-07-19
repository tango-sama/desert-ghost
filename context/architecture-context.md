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
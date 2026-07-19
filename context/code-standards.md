# Desert Shop — Code Standards

Static women's beauty & wellness storefront for Algeria. Plain HTML/CSS/JS (no framework, no build step) on Firebase: Firestore for data, Hosting for the site, Cloud Functions for delivery-carrier calls. All storefront pages are RTL Arabic.

## General

- No build step, no bundler, no framework. Ship plain `.html`, `.css`, `.js` files that run as-is.
- Keep each script single-purpose and wrapped in an IIFE; expose exactly one global (`window.DS`, `window.Cart`, `window.SITE`, …).
- Fix root causes — do not layer workarounds.
- Respect the system boundaries defined in `context/architecture-context.md`.
- Follow the spec-driven process in `context/development-workflow.md`; keep `context/progress-tracker.md` in sync with what is actually deployed.
- ES5-style code in browser scripts (`var`, `function`, string concatenation) — match the existing files; modern syntax is fine only in `functions/`.
- Read/write the EXISTING Firestore schema. Never rename fields or migrate documents; tolerate both old and new shapes (e.g. `p.title || p.name`, `images[]` else `[image]`).

## Browser JavaScript

- Escape everything interpolated into HTML with the shared `esc()` helper — product data comes from Firestore and admin input.
- Prices: parse with `DS.priceNum()` (accepts `2500`, `"2500 DA"`, …), display with `DS.priceFmt()` → `"2 500 د.ج"`. Never format prices by hand.
- Every Firestore read catches its own error, logs `[DS] <fn>` to console, and returns a safe fallback (`[]` or `null`) — pages must render even when a query fails.
- Use event delegation on `data-*` attributes (`[data-add]`, `[data-id]`) instead of per-element listeners.
- Images: always provide the SVG `PLACEHOLDER` fallback and an `onerror` swap; use `loading="lazy"` on card images.

## HTML Pages

- Every storefront page: `<html lang="ar" dir="rtl">`, shared nav/footer markup, `css/theme.css`, then Firebase compat SDK scripts, then `js/firebase.js` → `js/site.js` → page script — in that order.
- `amelhadj.html` is the admin panel; its obscure filename is intentional. Never link to it from any storefront page or sitemap.
- Customer-facing text is Arabic; keep numbers, phone numbers and prices LTR with the `.ltr` / `.num` helpers.

## Styling

- Plain CSS only in `css/theme.css` — no Tailwind, no preprocessors, no inline `<style>` blocks for shared components.
- Use the CSS custom properties from `:root` (`--rose`, `--rose-deep`, `--gold`, `--bg`, `--ink`, `--line`, `--shadow`, …). No new hardcoded hex values for anything that has a token.
- Design language is "Blush Rose & Gold": soft shadows tinted with the rose color, `--ease` cubic-bezier for transitions, gradient accents from `--gold` to `--rose`.
- Everything must work RTL-first. Position with `right`/`left` deliberately; test that underlines, badges and drawers animate from the correct side.

## Firestore

- Collections: `products`, `categories`, `orders`, `messages`, `expenses`, `site_settings` (single doc), and server-only `private/*` docs.
- Carrier API credentials (Yalidine, ZR Express, Noest) live ONLY in `private/*` docs that clients cannot read — enforced by `firestore.rules`. Never put an API token, secret, or credential in browser JS or HTML.
- The Firebase web config in `js/firebase.js` is public by design; that is not a leak.
- Admin access = Firebase Auth sign-in as `tango0es@gmail.com` (`isAdmin()` in `firestore.rules`); the admin panel signs in with email/password.
- Any rules change must keep: public read on catalog data, create-only `orders`/`messages` from clients, admin-only reads on customer data, no client access to `private/*`.

## Cloud Functions (`functions/`)

- Node.js, CommonJS, `firebase-functions/v2` `onCall` handlers, region `us-central1`.
- Validate `req.data` first and throw `HttpsError` with a specific code (`invalid-argument`, `not-found`, `failed-precondition`) before any logic.
- Carrier-parcel creation must stay idempotent: if the order already has a tracking number, return it instead of creating a second parcel.
- Functions read credentials from `private/*` and settings from `site_settings` via the Admin SDK — never accept credentials from the client payload.
- Write results (tracking number, label URL, errors) back onto the order doc so the admin panel reflects state without polling the carrier.

## File Organization

- Root `.html` files — one page per file (storefront pages + `amelhadj.html` admin).
- `js/` — shared browser scripts: `firebase.js` (data layer), `site.js` (shared UI behavior), `cart.js`, carrier helpers.
- `css/theme.css` — the single shared stylesheet.
- `functions/` — Cloud Functions only; the only place with `node_modules` and npm dependencies.
- `assets/` — images, organized in per-product-line subfolders (e.g. `assets/collagen/`); prefer `.webp`.
- `firestore.rules`, `storage.rules`, `firebase.json` — deployment config; keep the hosting `ignore` list in sync when adding non-public folders.

## Deployment & Testing

- Local preview: `npm run dev` (serves the folder on port 8000). There is no test suite — verify changes by loading the affected page.
- Deploy hosting and functions with the Firebase CLI; hosting serves the repo root with `cleanUrls` and no-cache HTML / week-long-cache assets.
- Bazar Merabet (project `mrabet-fb38c`) is a downstream rebranded clone of this site — keep storefront changes portable (theme tokens and `SITE` config carry the branding, not scattered literals).

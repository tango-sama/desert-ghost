# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state
changes. It must reflect the actual, deployed state of desert-shop-24af9.web.app —
not the intended state (see `development-workflow.md`).

## Current Phase

- Live in production — maintenance and incremental features.

## Current Goal



## Completed

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
- Security lockdown (2026-07-19): admin panel gated by Firebase Auth
  email/password; `firestore.rules` tightened — catalog public-read/admin-write,
  orders & messages create-only for clients, customer data and expenses admin-only.
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
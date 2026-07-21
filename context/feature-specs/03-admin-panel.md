Read `AGENTS.md` before starting.

Rebuild the admin panel (`trinkl/amelhadj.html`) in the Next.js app.

Keep the obscure URL: the panel lives at `/amelhadj`, is never linked from
the storefront, and carries `robots: noindex, nofollow`.

Auth: Firebase email/password (`signInWithEmailAndPassword`) against the
existing accounts — the deployed `firestore.rules` `isAdmin()` is the real
boundary. Signing in sets the `ds_staff` localStorage flag the storefront
already reads. No new rules, no new Cloud Functions: the panel calls the
already-deployed `us-central1` callables (`createYalidineParcel`,
`createNoestParcel`, `createZrParcel`, `getParcelStatus`, `getNoestLabels`,
`syncCarriers`, `getPushKey`, `sendTestEmail`).

Theme: dark by default with the owner-toggled light mode (`ds_theme` in
localStorage, same key as the old panel), scoped under an `.admin` class in
`app/globals.css` so storefront tokens stay untouched. Emoji icons stay,
per `context/ui-context.md`.

Views (same seven as the old panel, same Firestore schema, append-only):

- Products — CRUD, WebP upload to Storage, extra images, search, category
  filter, 20-per-page pager, bulk delete.
- Categories — CRUD, color picker, visibility toggle, ↑/↓ reorder
  (`sortOrder` rewrite).
- Featured — CRUD + reorder (`order`).
- Orders — pending-first sort, source/carrier tags, item photo strip,
  per-carrier parcel creation (with delivery-label + parcel-price inputs and
  a confirm dialog), tracking stepper via `getParcelStatus`, sequential
  refresh-all, Noest label printing (single + multi-select bar),
  fulfilled toggle, WhatsApp link, delete.
- Messages — list, WhatsApp reply, delete.
- Income — stat cards, expense entry, merged sales/expenses ledger with
  expandable order details; orders + expenses stay live via `onSnapshot`.
- Settings — theme toggle, Gmail notification setup (`private/notify`),
  test email, web-push activation (`/push-sw.js` + `push_subs`), general
  site settings, WhatsApp site toggle, TikTok live button, three carrier
  credential cards (`private/yalidine|noest|zrexpress`) with enable
  toggles (min. one carrier stays on) and fee-grid sync.

Admin-only code stays out of storefront bundles: Auth/Storage/Functions
load through `lib/admin.ts`, imported only by `components/admin/*`.

### Check when done.

- `/amelhadj` serves 200 with noindex and the dark login card.
- Login with wrong credentials shows the Arabic error toast; the auth
  backend answers (`auth/invalid-credential`).
- `npm run lint` and `npm run build` clean; storefront routes unaffected.
- Full credentialed click-through (sign in, save a product, create a
  parcel) done manually by the owner before trusting it — parcel creation
  is idempotent, so re-runs are safe.

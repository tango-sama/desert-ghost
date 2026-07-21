Read `AGENTS.md` before starting.

Rebuild the collagen landing page (`trinkl/collagen.html`, origin/main —
the local trinkl working copy is ~36 commits behind and does not have the
before/after or glutathione sections; always port from `origin/main`).

Self-contained marketing funnel (architecture-context.md): own top bar and
footer, no shared storefront Nav/Footer/CartDrawer/WhatsAppFloat, so the
route sits at `app/collagen/page.tsx`, outside the `(storefront)` group.
`force-dynamic` (settings can change from the admin panel anytime).

Hardcoded product list (`components/storefront/collagen/products.ts`) —
NOT the Firestore `products` collection: four collagen SKUs plus a
glutathione "special offer" fifth product with its own gold shimmer
styling and a ribbon badge. Multi-select order modal lets a customer add
several products to one order; state persists across modal open/close
within the page visit (a running "shopping list"), reset only after a
successful submit.

Own teal/deep-green palette (`--col-deep/--col-mid/--col-teal/--col-pearl`,
distinct from the site's Blush Rose & Gold) — ported as a scoped CSS
Module (`collagen.module.css`) rather than Tailwind utilities, given the
density of custom animation/3D/drag CSS (a scroll-linked 3D story
carousel, draggable before/after sliders, a 3D swipe drum, a masonry
review grid with staggered reveal, a shimmering gold "special offer"
option). These interactive pieces are ported as direct imperative
`useEffect` + refs (matching the source's own DOM-manipulation style)
rather than reworked into declarative state — safer for exact physics/
timing fidelity than reinventing the transform math.

Delivery: this page only ever offers Noest or Yalidine (never ZR) — a
faithful port of the source's own rule (`noestOn || !yaliOn ? 'noest' :
'yalidine'`), which never fetched ZR's delivery data either. Wilaya/
commune options must come from that carrier's own live-synced list only
— gate on `carrierDataReady()` from `lib/delivery.ts` exactly like
checkout and the seller quick-order modal; never show a fallback/
wrong-carrier list.

Order submission: same shape as checkout (`saveOrder`, `source:
"landing_collagen"`), `generateOrderNumber()` from `lib/order.ts`.

### Check when done.

- `/collagen` builds under `force-dynamic`, lint clean.
- Hero, before/after drag sliders, 3D story stack, trust-strip drum,
  products (incl. the glutathione special offer), reviews masonry, and
  the multi-select order modal all render correctly.
- Order modal: wilaya/commune populate only once that carrier's real data
  has loaded (no flash of wrong-carrier data); delivery fee updates live
  per wilaya/delivery-type; submit creates a real Firestore order with
  `source: "landing_collagen"` and all selected items.

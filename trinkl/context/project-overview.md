# Project Overview

## Product

Desert Shop (Arabic brand: «جمالكِ الخارجي») is a women's beauty & wellness online store for Algeria. Customers browse a small curated catalog (collagen, skincare, wellness products), add to cart, and order with cash on delivery — no online payment, no customer accounts.

Live at **desert-shop-24af9.web.app**. The store owner runs everything from a hidden admin panel (`/amelhadj`) on her phone or laptop.

## Customers

- Algerian women, browsing almost entirely on mobile phones.
- Arabic-speaking; the whole storefront is RTL Arabic.
- Pay cash on delivery; delivery reaches all 58 wilayas via courier companies.
- Many prefer confirming orders over WhatsApp rather than forms.

## How an Order Works

1. Customer adds products to the cart (localStorage) and opens checkout.
2. Checkout shows the delivery fee for her wilaya/commune (synced carrier fee grids) and creates an order in Firestore — optionally also opening WhatsApp with the order summary (site-wide toggleable).
3. The owner gets a push notification + email, reviews the order in the admin panel, and confirms it with the customer by phone/WhatsApp.
4. The owner creates the delivery parcel with one click (Yalidine, Noest, or ZR Express); the tracking number is saved on the order.
5. The courier collects payment on delivery.

## Goals

- Fast, pretty, trustworthy storefront that sells — conversion over complexity.
- Zero monthly cost beyond Firebase's free/low tier; no servers to maintain.
- The owner manages everything herself: catalog, orders, expenses, settings, carrier credentials.
- Customer data (names, phones, addresses) stays private — readable only by the signed-in owner.

## Features (current)

- Storefront: home, category browsing, product pages, collagen landing page, cart + checkout.
- Admin panel: products, categories, featured products, orders, customer messages, income/expenses ledger, site settings.
- Three delivery carriers with one-click parcel creation, tracking lookup, and synced fee grids.
- Owner notifications: web push + Gmail email on new orders/messages.
- Site-wide toggles: per-carrier visibility, WhatsApp on/off, TikTok-live floating button.

## Non-Goals (out of scope unless the owner asks)

- No online payment of any kind.
- No customer accounts, login, wishlists, or reviews.
- No multi-language / LTR version — Arabic RTL only.
- No framework rewrite, build pipeline, or npm dependencies outside `functions/`.
- No inventory management beyond what the admin panel already does.

## Related Project

Bazar Merabet (Firebase project `mrabet-fb38c`) is a rebranded clone of this codebase selling shoes. Keep improvements portable: branding belongs in theme tokens and the `SITE` config, not scattered literals. Ports to the clone are tracked in `progress-tracker.md`.

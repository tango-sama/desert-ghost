# Desert Shop

## Overview
Desert Shop is a real-time e-commerce operations platform: an admin panel and storefront system for running Arabic RTL retail stores (currently Bazar Merabet — shoes & bags). Store staff manage catalogs and orders together on a shared live admin panel, an AI pipeline turns raw product photo dumps into structured catalog entries, and every order is tracked end-to-end through Algerian delivery carriers (Yalidine, Noest).

## Goals
1. Let authenticated owners/staff create and manage store projects.
2. Provide a real-time collaborative admin panel for catalog and order management.
3. Let staff import prebuilt storefront templates into a store at any point.
4. Let AI turn a batch of raw product photos into structured catalog listings.
5. Let staff refine AI-generated catalog entries together in the admin panel.
6. Track every order end-to-end through carrier APIs (Yalidine, Noest).
7. Convert order/delivery data into a persistent, downloadable report.

## Core User Flow
1. Owner/staff signs in.
2. User creates or selects a store.
3. User enters the store's admin workspace.
4. User optionally imports a starter storefront template into the store.
5. User uploads a batch of raw product photos for the AI pipeline.
6. AI organizes, tags, and writes catalog entries into the store.
7. Staff refine products, pricing, and categories together in the shared admin panel.
8. Orders arrive from the storefront; staff track them via the Yalidine/Noest progress tracker.
9. User triggers report generation (e.g., a daily order/delivery manifest).
10. App persists the generated report and links it to the store; owner reviews or downloads it.

## Features

### Authentication and Stores
* Owner/staff sign-in and route protection.
* Store creation, ownership, and staff access.
* Store list and admin workspace navigation.

### Collaborative Admin Panel
* Shared real-time catalog and order management.
* Live presence indicators for staff editing the same store.
* Inline product editing, multi-photo upload, color picker.
* Collapsible sidebar navigation.

### Starter Storefront Templates
* A curated library of prebuilt storefront/landing page templates (single-file, Arabic RTL, brand palette, scroll-reveal animations).
* Staff can import a starter template into a store at any point.
* Covers common patterns: single-product landing pages, multi-product catalogs, WhatsApp-order flows.

### AI Photo & Catalog Pipeline
* AI (Qwen2-VL) organizes and tags a batch of raw product photos.
* Output is structured catalog data: optimized images plus Firebase-ready JSON.
* Idempotent via a manifest file, so re-runs don't duplicate entries.
* Runs as a background job, independent of the live admin panel.

### Order Tracking and Carrier Integration
* Orders sync with Yalidine and Noest carrier APIs.
* Five-step Arabic RTL progress tracker rendered on each order card.
* Delivery status updates persist to the order record in real time.

### Reporting and Exports
* Order and delivery data converts into a persisted report (e.g., a daily manifest).
* Reports are stored as files and linked to the store.
* Users can view and download generated reports.

## Scope

### In Scope
* Authentication and route protection
* Store creation and ownership
* Staff access per store
* Starter storefront template library and import
* Real-time shared admin panel (catalog + orders)
* AI-powered photo-to-catalog pipeline
* Yalidine/Noest order tracking
* Order/delivery report generation and download
* Persistent storage for store, catalog, order, and report data (Firestore)

### Out Of Scope
* Online payment gateway integration (orders remain COD via carrier)
* Enterprise permission tiers beyond owner and staff
* Versioned catalog/order history
* Production object storage migration (currently Firestore)
* Native mobile apps

## Success Criteria
1. A signed-in owner/staff member can create and open a store.
2. Multiple staff can edit the same store's catalog/orders at once without conflicts.
3. A user can import a prebuilt storefront template into a store.
4. The AI pipeline can turn a raw photo batch into catalog-ready entries.
5. Staff can refine AI-generated listings together in the admin panel.
6. An order can be tracked end-to-end through the Yalidine/Noest 5-step tracker.
7. Order/delivery reports can be generated, persisted, and downloaded.

## Notes
* Auth, core admin panel, product editing, and Yalidine integration already exist.
* AI photo pipeline and the Noest/order-tracker UI are in progress.
* Reporting/exports is proposed, not yet built.

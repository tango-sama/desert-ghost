import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  serverTimestamp,
  type QuerySnapshot,
  type DocumentData,
} from "firebase/firestore";
import type { CarrierData } from "@/lib/delivery";
import { orderAttribution } from "@/lib/attribution";

// Public web config for project desert-shop-24af9 — safe to ship to the
// client (see context/architecture-context.md). Reads/writes the existing
// Firestore schema; no migration.
const firebaseConfig = {
  apiKey: "AIzaSyAP_qj-4hpHN6Vjn8ZbcnqRfzB5SvOmgmM",
  authDomain: "desert-shop-24af9.firebaseapp.com",
  projectId: "desert-shop-24af9",
  storageBucket: "desert-shop-24af9.firebasestorage.app",
  messagingSenderId: "791427566190",
  appId: "1:791427566190:web:9b6f2a8f90dbb8f8b6f47f",
  measurementId: "G-LYPS3KBY0W",
};

// `app` is exported for the admin-only layer (lib/admin.ts) so Auth/
// Storage/Functions SDKs load only in admin bundles, not the storefront.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Per-product landing content for the templated /offer page.
//
// Stored on the product document itself (`products/<id>.landing`), NOT under
// site_settings like the four hand-built funnels' `landingPages`. Two reasons:
// site_settings is a single document and 149 products of landing copy would run
// at the 1 MB document limit, and this content belongs next to the product it
// describes. Both collections are already public-read/admin-write, so neither
// placement needs a firestore.rules change.
//
// Every field is optional and every blank field means "keep the generated
// default" — the same convention `LandingPageContent` already uses. Nothing
// here is ever required for a product to get a landing page; it only makes one
// richer. See lib/landing-content.ts for how these layer over the category
// archetypes and the product's own fields.
export type LandingBenefit = { ic?: string; title?: string; text?: string };
export type LandingIngredient = { name?: string; text?: string };
export type LandingUsageStep = { ic?: string; p?: string };
export type LandingFaqItem = { q?: string; a?: string };
/** An owner-entered review. `stars` is admin-set, never inferred — this shop
 *  stores no rating data and inventing one would be a lie shown to every
 *  visitor (context/ui-context.md). */
export type LandingReview = {
  stars?: number;
  text?: string;
  name?: string;
  where?: string;
};

export type ProductLanding = {
  headline?: string;
  subhead?: string;
  benefits?: LandingBenefit[];
  ingredients?: LandingIngredient[];
  usage?: LandingUsageStep[];
  faq?: LandingFaqItem[];
  /** Real uploaded photo pairs only. The template NEVER falls back to a
   *  category default or an illustrative stand-in for these — an invented
   *  transformation photo is a claim about a customer's body. */
  beforeAfter?: LandingBaItem[];
  reviews?: LandingReview[];
};

export type Product = {
  id: string;
  title?: string;
  name?: string;
  subtitle?: string;
  description?: string | string[];
  price?: number | string;
  category?: string;
  image?: string;
  images?: string[];
  lastModified?: number;
  // Total units ever stocked (admin-entered on restock) — NOT a live closet
  // count. The Storage Counter admin tab derives "in closet" from this
  // minus units currently out (sending/delivered/return).
  stock?: number;
  // What ONE unit costs us to buy, in dinars. Optional: when absent the
  // profit engine falls back to site_settings.cogsRate (see lib/profit.ts).
  // Only worth filling in for products actually being advertised.
  cost?: number;
  // Owner-written landing content for /offer. Absent on almost every product —
  // the template generates a full page without it.
  landing?: ProductLanding;
  [key: string]: unknown;
};

export type Category = {
  id: string;
  name: string;
  image?: string;
  color?: string;
  visible?: boolean;
  sortOrder?: number;
};

export type Featured = {
  id: string;
  productName: string;
  image: string;
  rightText?: string;
  leftText?: string;
  ctaText?: string;
  productLink?: string;
  order?: number;
};

// Editable copy for the self-contained landing funnels (/sunguard,
// /collagen) — admin-editable via the "صفحات الهبوط" panel tab, stored
// under site_settings (already public-read/admin-write) instead of a new
// collection so no Firestore rules change is needed. Empty/missing fields
// mean "keep the page's built-in default" — each landing component falls
// back to its hardcoded copy when a field is blank.
export type LandingHeroContent = {
  title?: string;
  lead?: string;
  // Hero visual override — currently only read by /glutathione (see
  // glutathione/hero.tsx); sunguard/collagen keep their built-in hero
  // visuals. Falls back to the page's product photo when blank.
  image?: string;
};

export type LandingBaItem = {
  title?: string;
  text?: string;
  before?: string;
  after?: string;
};

// Product-field overrides — title/image/price only (not brand, size, or
// collagen's headline/bullets/icons, which stay page-defined). Matched by
// position: `product` is sunguard's single SKU, `products` lines up with
// COLLAGEN_PRODUCTS by index.
export type LandingProductOverride = {
  title?: string;
  image?: string;
  price?: number;
};

export type LandingPageContent = {
  hero?: LandingHeroContent;
  beforeAfter?: LandingBaItem[];
  product?: LandingProductOverride;
  products?: LandingProductOverride[];
  // Photo for the ingredient/formula split section — currently only read
  // by /glutathione (see glutathione/formula.tsx). Falls back to the
  // page's product photo when blank.
  formulaImage?: string;
  // Custom path segment (no slashes/spaces) serving this page's content at
  // /<slug> via app/[slug]/page.tsx, in addition to its built-in route —
  // the built-in route (app/sunguard, app/collagen) redirects to it once
  // set, so old shared links keep working.
  slug?: string;
};

export type LandingPageKey = "sunguard" | "collagen" | "glutathione" | "carnitine";

export type LandingPagesContent = Partial<Record<LandingPageKey, LandingPageContent>>;

// Path segments a custom landing-page slug must not collide with — the
// static file routes under app/ always win over the app/[slug] catch-all,
// so reusing one of these would make that page's content unreachable.
export const LANDING_RESERVED_SLUGS = [
  "quiz",
  "offer",
  "sunguard",
  "collagen",
  "glutathione",
  "carnitine",
  "checkout",
  "categories",
  "products",
  "product",
  "amelhadj",
];

export type SiteSettings = {
  waNumber?: string;
  waEnabled?: boolean;
  storeName?: string;
  heroImage?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  tiktokLiveUntil?: number;
  landingPages?: LandingPagesContent;
  // Fraction of selling price that goods cost us, as a decimal (0.65 = a 35%
  // gross margin). The profit engine's global fallback wherever a product has
  // no explicit `cost`. See lib/profit.ts DEFAULT_COGS_RATE.
  cogsRate?: number;
  // Meta bills this account in EUR while every price and cost in the shop is
  // in dinars, so spend is unusable until it is converted. Stored on each
  // spend row at sync time as well, so changing this never rewrites history.
  eurToDzd?: number;
  // Ad account the spend sync reads (digits only, no `act_` prefix).
  metaAdAccountId?: string;
  // Campaigns that count as Desert Shop's. The ad account is shared with an
  // unrelated business, so the growth dashboard reports only these — and
  // reports everything else as "unallocated" rather than dropping it.
  metaCampaignIds?: string[];
  [key: string]: unknown;
};

function mapDocs<T>(snap: QuerySnapshot<DocumentData>): T[] {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

// title||name, price parsing, etc. tolerate both old and new document shapes
// per the append-only Firestore schema (context/architecture-context.md).
export function priceNum(v: unknown): number {
  if (typeof v === "number") return v;
  return parseInt(String(v ?? "").replace(/[^0-9]/g, "") || "0", 10) || 0;
}

export function priceFmt(v: unknown): string {
  return priceNum(v).toLocaleString("en-US") + " د.ج";
}

export function benefits(desc: Product["description"]): string[] {
  if (Array.isArray(desc)) return desc.filter(Boolean) as string[];
  return String(desc ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function productImages(p: Product): string[] {
  const arr = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
  if (!arr.length && p.image) return [p.image];
  return arr;
}

export async function getProducts(): Promise<Product[]> {
  try {
    const snap = await getDocs(collection(db, "products"));
    return mapDocs<Product>(snap);
  } catch (e) {
    console.error("[DS] getProducts", e);
    return [];
  }
}

export async function getProduct(id: string): Promise<Product | null> {
  try {
    const d = await getDoc(doc(db, "products", id));
    return d.exists() ? ({ id: d.id, ...d.data() } as Product) : null;
  } catch (e) {
    console.error("[DS] getProduct", e);
    return null;
  }
}

export async function getCategories(): Promise<Category[]> {
  try {
    const snap = await getDocs(collection(db, "categories"));
    return mapDocs<Category>(snap).sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    );
  } catch (e) {
    console.error("[DS] getCategories", e);
    return [];
  }
}

export async function getFeatured(): Promise<Featured[]> {
  try {
    const snap = await getDocs(collection(db, "featured_products"));
    return mapDocs<Featured>(snap).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } catch (e) {
    console.error("[DS] getFeatured", e);
    return [];
  }
}

export async function getSettings(): Promise<SiteSettings> {
  try {
    const snap = await getDocs(collection(db, "site_settings"));
    const list = mapDocs<SiteSettings>(snap);
    return list.length ? list[0] : {};
  } catch (e) {
    console.error("[DS] getSettings", e);
    return {};
  }
}

export async function saveMessage(msg: {
  name: string;
  phone?: string;
  message: string;
}) {
  return addDoc(collection(db, "messages"), { timestamp: Date.now(), ...msg });
}

/**
 * Create an order document.
 *
 * Every order path in the app funnels through here — the main checkout, all
 * four landing funnels, and the admin's seller/phone modal — so this is the
 * one place ad attribution has to be stamped for every entry point to be
 * instrumented at once.
 *
 * Seller-entered phone orders are attributed as `phone` and carry no ad
 * fields: they are placed from the shop's own browser, which may hold a stale
 * ad click from the owner's own browsing, and crediting them to that campaign
 * would quietly inflate its numbers. Same reasoning that makes the Meta
 * Purchase trigger skip `source: admin_phone`.
 *
 * Attribution is merged BEFORE `...order` so an explicit caller-supplied value
 * still wins, and is best-effort: if it throws, the order must still save.
 */
export async function saveOrder(order: Record<string, unknown>) {
  let attribution: Record<string, unknown> = {};
  try {
    attribution = orderAttribution(
      order.source === "admin_phone" ? "phone" : undefined,
    ) as unknown as Record<string, unknown>;
  } catch (e) {
    console.error("[DS] saveOrder attribution", e);
  }
  return addDoc(collection(db, "orders"), {
    status: "New",
    fulfilled: false,
    placedAt: serverTimestamp(),
    createdAt: Date.now(),
    ...attribution,
    ...order,
  });
}

export async function getDeliveryData(carrier: string): Promise<CarrierData | null> {
  try {
    const d = await getDoc(doc(db, "delivery_data", carrier));
    return d.exists() ? (d.data() as CarrierData) : null;
  } catch (e) {
    console.error("[DS] getDeliveryData", e);
    return null;
  }
}

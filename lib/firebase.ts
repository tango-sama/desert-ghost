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
};

export type LandingBaItem = {
  title?: string;
  text?: string;
  before?: string;
  after?: string;
};

export type LandingPageContent = {
  hero?: LandingHeroContent;
  beforeAfter?: LandingBaItem[];
};

export type LandingPageKey = "sunguard" | "collagen";

export type LandingPagesContent = Partial<Record<LandingPageKey, LandingPageContent>>;

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

export async function saveOrder(order: Record<string, unknown>) {
  return addDoc(collection(db, "orders"), {
    status: "New",
    fulfilled: false,
    placedAt: serverTimestamp(),
    createdAt: Date.now(),
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

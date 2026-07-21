// Admin-only Firebase layer for /amelhadj — auth, privileged reads
// (orders/messages/expenses), generic writes, Storage uploads, and the
// deployed us-central1 callables. Mirrors trinkl/js/firebase.js's DS admin
// surface; imported only by admin components so the storefront bundles
// never pull in Auth/Storage/Functions.
import { app, db } from "@/lib/firebase";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import {
  collection,
  doc,
  getDocs,
  addDoc as fsAddDoc,
  setDoc as fsSetDoc,
  updateDoc as fsUpdateDoc,
  deleteDoc as fsDeleteDoc,
  onSnapshot,
  type QuerySnapshot,
  type DocumentData,
} from "firebase/firestore";

export const auth = getAuth(app);

// ───────── admin document types (existing Firestore schema, append-only) ─────────

export type CarrierKey = "yalidine" | "noest" | "zr";

export type ParcelInfo = {
  tracking?: string;
  label?: string | null;
  validated?: boolean;
  createdAt?: number;
};

// One carrier activity event as normalized by getParcelStatus — agent,
// hub, free-text reason, and a colour hint (badge) for the shipment log.
export type TrackEvent = {
  key?: string;
  label?: string;
  date?: string | number | null;
  location?: string | null;
  by?: string | null;
  center?: string | null;
  content?: string | null;
  causer?: string | null;
  badge?: string | null;
};

export type TrackingStatus = {
  carrier?: string;
  tracking?: string;
  stage?: number | null;
  stageLabels?: string[];
  alert?: string;
  lastLabel?: string;
  lastDate?: string | number;
  lastLocation?: string;
  updatedAt?: number;
  noestValidated?: boolean;
  events?: TrackEvent[];
};

export type OrderItem = {
  id?: string | number;
  title?: string;
  qty?: number;
  quantity?: number;
  price?: number | string;
  image?: string;
};

export type Order = {
  id: string;
  num?: string | number;
  customer?: string;
  phone?: string;
  wilaya?: string;
  baladiya?: string;
  address?: string;
  deliveryType?: string;
  deliveryCompany?: string;
  deliveryFee?: number;
  subtotal?: number;
  total?: number;
  items?: OrderItem[];
  fulfilled?: boolean;
  status?: string;
  source?: string;
  placedAt?: { seconds?: number };
  createdAt?: number;
  yalidine?: ParcelInfo;
  noest?: ParcelInfo;
  zr?: ParcelInfo;
  trackingStatus?: TrackingStatus;
  deliveryLabel?: string;
  parcelPrice?: number | null;
  [key: string]: unknown;
};

export type MessageDoc = {
  id: string;
  name?: string;
  phone?: string;
  message?: string;
  timestamp?: number;
};

export type Expense = {
  id: string;
  amount?: number;
  note?: string;
  createdAt?: number;
};

function mapDocs<T>(snap: QuerySnapshot<DocumentData>): T[] {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

export function orderStamp(o: Order): number {
  // placedAt is in seconds, createdAt in ms — normalize to ms so mixed
  // orders sort correctly (upstream fix from trinkl).
  return o.placedAt?.seconds ? o.placedAt.seconds * 1000 : o.createdAt || 0;
}

// ───────── admin reads ─────────

export async function getOrders(): Promise<Order[]> {
  try {
    const snap = await getDocs(collection(db, "orders"));
    return mapDocs<Order>(snap).sort((a, b) => orderStamp(b) - orderStamp(a));
  } catch (e) {
    console.error("[DS] getOrders", e);
    return [];
  }
}

export async function getMessages(): Promise<MessageDoc[]> {
  try {
    const snap = await getDocs(collection(db, "messages"));
    return mapDocs<MessageDoc>(snap).sort(
      (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)
    );
  } catch (e) {
    console.error("[DS] getMessages", e);
    return [];
  }
}

export async function getExpenses(): Promise<Expense[]> {
  try {
    const snap = await getDocs(collection(db, "expenses"));
    return mapDocs<Expense>(snap).sort(
      (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
    );
  } catch (e) {
    console.error("[DS] getExpenses", e);
    return [];
  }
}

// Live listeners for the collections that change while the panel is open
// (new orders arriving, ledger entries). Return unsubscribe functions.

export function watchOrders(cb: (orders: Order[]) => void): () => void {
  return onSnapshot(
    collection(db, "orders"),
    (snap) => cb(mapDocs<Order>(snap).sort((a, b) => orderStamp(b) - orderStamp(a))),
    (e) => console.error("[DS] watchOrders", e)
  );
}

export function watchExpenses(cb: (expenses: Expense[]) => void): () => void {
  return onSnapshot(
    collection(db, "expenses"),
    (snap) =>
      cb(mapDocs<Expense>(snap).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))),
    (e) => console.error("[DS] watchExpenses", e)
  );
}

// ───────── admin writes (generic, same numeric-string ids as the old admin) ─────────

export function setDocIn(
  coll: string,
  id: string | number,
  data: Record<string, unknown>
) {
  return fsSetDoc(doc(db, coll, String(id)), data);
}

export function updateDocIn(
  coll: string,
  id: string | number,
  data: Record<string, unknown>
) {
  return fsUpdateDoc(doc(db, coll, String(id)), data);
}

export function deleteDocIn(coll: string, id: string | number) {
  return fsDeleteDoc(doc(db, coll, String(id)));
}

export async function addDocIn<T extends Record<string, unknown>>(
  coll: string,
  data: T
): Promise<T & { id: string }> {
  const ref = await fsAddDoc(collection(db, coll), data);
  return { id: ref.id, ...data };
}

// ───────── image upload (WebP convert → Storage), ported from js/firebase.js ─────────

function convertToWebP(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type) || /gif$/i.test(file.type)) return resolve(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const max = 1400;
        let w = img.width;
        let h = img.height;
        if (w > max || h > max) {
          const r = Math.min(max / w, max / h);
          w = Math.round(w * r);
          h = Math.round(h * r);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("WebP conversion failed"));
            resolve(
              new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                type: "image/webp",
              })
            );
          },
          "image/webp",
          0.85
        );
      };
      img.onerror = reject;
      img.src = ev.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadImage(file: File, folder = "uploads"): Promise<string> {
  const webp = await convertToWebP(file);
  const ref = storageRef(getStorage(app), `${folder}/${Date.now()}_${webp.name}`);
  const snap = await uploadBytes(ref, webp);
  return getDownloadURL(snap.ref);
}

// ───────── deployed Cloud Functions (us-central1 onCall) ─────────

export async function callFn<R = Record<string, unknown>>(
  name: string,
  data?: Record<string, unknown>
): Promise<R> {
  const fns = getFunctions(app, "us-central1");
  const res = await httpsCallable(fns, name)(data ?? {});
  return res.data as R;
}

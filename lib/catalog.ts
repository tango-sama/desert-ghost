/* Pure catalog helpers: price parsing and formatting, and the two readers that
   tolerate both shapes of the append-only Firestore schema.
 *
 * These live here rather than in lib/firebase.ts for one reason, and it is a
 * loading-speed reason. lib/firebase.ts calls initializeApp() and
 * getFirestore() at module scope, so importing ONE value from it — even a
 * two-line price formatter — pulls the whole Firestore SDK into whatever
 * bundle did the importing. On /quiz that was ~139 KB over the wire and
 * ~466 KB to parse, for a page that never talks to Firestore from the browser
 * at all: the catalog is fetched on the server and handed over as props.
 *
 * Types are not the problem and have not moved — `import type` is erased
 * before it reaches a bundle. Only value imports pull code, so only the
 * values moved. lib/firebase.ts re-exports all four, so every existing
 * `from "@/lib/firebase"` import keeps working unchanged; client components
 * should import from here instead.
 */
import type { Product } from "@/lib/firebase";

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

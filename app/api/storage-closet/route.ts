// Storefront-safe stock endpoint: given a set of product ids (the cart, or
// a single product on a seller quick-order), returns each product's live
// "في المحل" (in-closet) count — the same `stock - sending - delivered -
// returned` derivation the admin Storage Counter tab shows (lib/
// storage-counter.ts). Reads `orders` server-side with the Admin SDK
// (lib/firebase-admin.ts) precisely so the browser never gets order
// documents (customer names/phones/addresses) — only the derived integer
// per product. This must stay the ONLY thing this route ever returns; do
// not add order fields to the response.
//
// Products that have never had a `stock` number entered by the admin are
// omitted from the response (not shown as 0) — an untracked product isn't
// "out of stock", it's just never been counted, and showing 0 would read
// as a false out-of-stock signal to a seller mid-checkout.
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getOrderStats } from "@/lib/firebase-admin";
import { closetFor, EMPTY_STATS } from "@/lib/storage-counter";

export const dynamic = "force-dynamic";

const MAX_IDS = 50;

export async function POST(req: NextRequest) {
  let ids: string[] = [];
  try {
    const body = (await req.json()) as { ids?: unknown };
    if (Array.isArray(body.ids)) {
      const strIds = body.ids
        .filter((x): x is string | number => typeof x === "string" || typeof x === "number")
        .map((x) => String(x))
        .filter(Boolean);
      ids = Array.from(new Set(strIds)).slice(0, MAX_IDS);
    }
  } catch {
    // malformed body — fall through and return an empty result below
  }
  if (!ids.length) return NextResponse.json({ closet: {} });

  const adb = getAdminDb();
  if (!adb) return NextResponse.json({ closet: {} });

  try {
    const [productSnaps, stats] = await Promise.all([
      Promise.all(ids.map((id) => adb.collection("products").doc(id).get())),
      getOrderStats(),
    ]);
    // stats === null means the orders read itself failed — NOT "no orders
    // exist". Treating that as EMPTY_STATS would report full, un-decremented
    // stock as if nothing had ever sold. Fail to an empty result instead.
    if (!stats) return NextResponse.json({ closet: {} });

    const closet: Record<string, number> = {};
    for (const snap of productSnaps) {
      const data = snap.data() as { stock?: number } | undefined;
      if (!snap.exists || data?.stock == null) continue; // untracked — omit, don't show as 0
      closet[snap.id] = closetFor(Number(data.stock), stats[snap.id] ?? EMPTY_STATS);
    }
    return NextResponse.json({ closet });
  } catch (e) {
    console.error("[DS] /api/storage-closet", e);
    return NextResponse.json({ closet: {} });
  }
}

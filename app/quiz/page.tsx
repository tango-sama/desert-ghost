import type { Metadata } from "next";
import { getCachedProducts } from "@/lib/catalog";
import { QuizPage } from "@/components/storefront/quiz/quiz-page";

// Self-contained funnel, like /collagen and /glutathione — its own layout, no
// shared storefront nav or cart, so it sits outside the (storefront) group.
// Renders per-request because the catalog and the carrier/WhatsApp toggles
// change from the admin panel at any time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ما المنتج المناسب لكِ؟ | Desert Shop",
  // Kept in step with the quiz itself: this used to promise five questions and
  // mention a budget, both of which the funnel no longer does. It is the text
  // that shows in search results and when the link is shared, so a stale
  // promise here is the first thing a visitor reads.
  description:
    "أجيبي على 4 أسئلة قصيرة ونقترح عليكِ المنتجات التي تناسب هدفكِ وحالتكِ. الدفع عند الاستلام وتوصيل لكل الولايات.",
};

export default async function Page() {
  // The whole catalog is scored client-side, so it is fetched once here rather
  // than round-tripping per answer — the quiz must feel instant between
  // questions, and 149 products is small enough to hand over in one payload.
  //
  // Settings are no longer read here: the order is taken on /offer now, and
  // that page fetches the carrier and WhatsApp toggles it needs itself.
  //
  // Read through the catalog cache rather than hitting Firestore directly: this
  // is the page every quiz-funnel ad clicks into, and `force-dynamic` above
  // meant the collection was re-read on every one of those clicks before any
  // HTML went out. Catalog edits show up within the TTL in lib/catalog.ts.
  const products = await getCachedProducts();
  return <QuizPage products={products} />;
}

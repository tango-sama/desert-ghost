import type { Metadata } from "next";
import { getProducts } from "@/lib/firebase";
import { slimForQuiz } from "@/lib/quiz";
import { QuizPage } from "@/components/storefront/quiz/quiz-page";

// Self-contained funnel, like /collagen and /glutathione — its own layout, no
// shared storefront nav or cart, so it sits outside the (storefront) group.
//
// Regenerated on a timer rather than per request. It was force-dynamic so the
// catalog and the carrier/WhatsApp toggles could never go stale — but the
// toggles moved to /offer, and what is left is a Firestore round trip for all
// 149 products on the critical path of every single visitor. This is the page
// ads point at: a hundred people arriving at once meant a hundred identical
// catalog reads, each one paid for in TTFB.
//
// Nothing on this page varies by request — no searchParams, no cookies, and
// the A/B variant is derived in the browser from the session id — so the
// rendered output is the same for everybody and can simply be cached. Five
// minutes is well inside what the content tolerates: a product added or
// renamed in the admin panel starts being recommended within five minutes, and
// `stock` is a total-ever-stocked figure (see Product.stock), not a live count
// that could sell something twice.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "ما المنتج المناسب لكِ؟ | Desert Shop",
  // Kept in step with the quiz itself — it is the text that shows in search
  // results and when the link is shared, so a stale promise here is the first
  // thing a visitor reads. Five questions, no budget question, no sign-up.
  description:
    "أجيبي على 5 أسئلة قصيرة ونقترح عليكِ المنتج الذي يناسب هدفكِ وروتينكِ. الدفع عند الاستلام وتوصيل لكل الولايات.",
};

export default async function Page() {
  // The whole catalog is scored client-side, so it is fetched once here rather
  // than round-tripping per answer — the quiz must feel instant between
  // questions, and 149 products is small enough to hand over in one payload.
  //
  // Small, that is, once it is only the fields the quiz reads. Handing over the
  // raw documents put every product's entire /offer landing copy into this
  // page's HTML — see slimForQuiz(), which is what makes "one payload" a
  // defensible claim rather than a 282 KB one.
  //
  // Settings are no longer read here: the order is taken on /offer now, and
  // that page fetches the carrier and WhatsApp toggles it needs itself.
  const products = await getProducts();
  return <QuizPage products={slimForQuiz(products)} />;
}

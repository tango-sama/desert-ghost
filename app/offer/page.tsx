import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProducts, getSettings, type Product } from "@/lib/firebase";
import { QUESTIONS, type Answers } from "@/lib/quiz";
import { OfferPage } from "@/components/storefront/offer/offer-page";

// The quiz funnel's landing page. Self-contained like /quiz and the four
// hand-built funnels — its own layout, no shared storefront nav or cart, so it
// sits outside the (storefront) group. Renders per-request because the catalog
// and the carrier/WhatsApp toggles change from the admin panel at any time.
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// A single page is one product's worth of sections repeated, so the count has
// to be bounded: the quiz produces at most three, plus whatever she ticked
// from the alternates. Four blocks is already a long scroll; more than that
// and nothing on the page gets read.
const MAX_PRODUCTS = 4;

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/**
 * The answers, read back off the URL.
 *
 * Validated against QUESTIONS rather than trusted: these are short codes that
 * steer the page's Arabic copy and get stamped on the order, and an
 * unrecognised value must fall out entirely rather than reach either. Looking
 * them up by key (not by position) means reordering or removing a question
 * cannot silently mis-map an answer — the same trap the quiz's own
 * `fallbackWhy` was fixed for.
 */
function readAnswers(sp: { [key: string]: string | string[] | undefined }): Answers {
  const a: Record<string, string> = {};
  for (const q of QUESTIONS) {
    const raw = one(sp[q.key]);
    if (raw && q.options.some((o) => o.value === raw)) a[q.key] = raw;
  }
  return a as Answers;
}

/** The chosen products, in the order the quiz ranked them (hero first). */
function readProducts(
  sp: { [key: string]: string | string[] | undefined },
  catalog: Product[],
): Product[] {
  const ids = one(sp.ids)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const byId = new Map(catalog.map((p) => [String(p.id), p]));
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const id of ids) {
    // Unknown ids are dropped, not fatal: a link shared after a product was
    // deleted from the catalog should still sell the rest of the selection.
    const p = byId.get(id);
    if (!p || seen.has(id)) continue;
    seen.add(id);
    out.push(p);
    if (out.length >= MAX_PRODUCTS) break;
  }
  return out;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const sp = await searchParams;
  const products = readProducts(sp, await getProducts());
  const hero = products[0];
  if (!hero) return { title: "ما المنتج المناسب لكِ؟ | Desert Shop" };
  const name = hero.title ?? hero.name ?? "";
  return {
    title: `${name} | Desert Shop`,
    description:
      `${name} — الفوائد، طريقة الاستعمال، وكل ما تحتاجين معرفته قبل الطلب. ` +
      `الدفع عند الاستلام وتوصيل لكل الولايات.`,
    // A result page built from one visitor's answers has nothing to offer a
    // search index, and indexing it would compete with the real product pages.
    robots: { index: false, follow: true },
  };
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  // The whole catalog is fetched rather than each id individually: it is one
  // request instead of up to four, and /quiz already pays the same cost.
  const [settings, catalog] = await Promise.all([getSettings(), getProducts()]);
  const products = readProducts(sp, catalog);

  // No resolvable product — a hand-typed URL, an expired link, or every id
  // deleted from the catalog. Send her back to the quiz to get a real
  // recommendation rather than showing an empty sales page.
  if (!products.length) redirect("/quiz");

  return <OfferPage products={products} answers={readAnswers(sp)} settings={settings} />;
}

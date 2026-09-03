import type { Metadata } from "next";
import { getCategories, getProducts } from "@/lib/firebase";
import { sortByCloset } from "@/lib/closet-sort";
import { ProductsBrowser } from "@/components/storefront/products-browser";

export const metadata: Metadata = {
  title: "كل المنتجات | جمالكِ الخارجي — Desert Shop",
  description:
    "تصفّحي كل منتجات الجمال والعناية النسائية — العناية بالبشرة والشعر، العطور، التنحيف والتسمين والمزيد.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; q?: string }>;
}) {
  const [{ cat, q }, products, categories] = await Promise.all([
    searchParams,
    getProducts(),
    getCategories(),
  ]);

  // The listing opens on «الأكثر توفراً» — most units in the closet first —
  // so ordering it is this Server Component's job: the closet counts come
  // from privileged `orders` data (lib/closet-sort.ts) that a client
  // component must never see. `ProductsBrowser` keeps this order as-is for
  // that sort option and only re-sorts for the price/name/recency ones, so
  // no closet number is ever sent to the browser.
  const ordered = await sortByCloset(products);

  return (
    <ProductsBrowser
      products={ordered}
      categories={categories}
      initialCat={cat || "all"}
      initialQuery={q || ""}
    />
  );
}

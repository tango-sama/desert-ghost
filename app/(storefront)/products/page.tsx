import type { Metadata } from "next";
import { getCategories, getProducts } from "@/lib/firebase";
import { ProductsBrowser } from "@/components/storefront/products-browser";

export const metadata: Metadata = {
  title: "كل المنتجات | جمالكِ الخارجي — Desert Shop",
  description:
    "تصفّحي كل منتجات الجمال والعناية النسائية — العناية بالبشرة والشعر، العطور، التنحيف والتسمين والمزيد.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const [{ cat }, products, categories] = await Promise.all([
    searchParams,
    getProducts(),
    getCategories(),
  ]);

  return (
    <ProductsBrowser products={products} categories={categories} initialCat={cat || "all"} />
  );
}

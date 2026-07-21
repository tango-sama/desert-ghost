import type { Metadata } from "next";
import Link from "next/link";
import { getCategories, getProduct, getProducts, getSettings } from "@/lib/firebase";
import { ProductDetail } from "@/components/storefront/product-detail";
import { ProductCard } from "@/components/storefront/product-card";

type Params = { id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  const title = product?.title || product?.name;
  return { title: title ? `${title} | جمالكِ الخارجي` : "المنتج غير موجود" };
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const [product, categories, settings] = await Promise.all([
    getProduct(id),
    getCategories(),
    getSettings(),
  ]);
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  if (!product) {
    return (
      <div className="mx-auto max-w-[1240px] px-5 py-32 text-center md:px-12">
        <h1 className="mb-4 text-2xl font-black">المنتج غير موجود</h1>
        <Link href="/products" className="font-bold text-[var(--rose-deep)]">
          العودة للمنتجات
        </Link>
      </div>
    );
  }

  const categoryName = catMap[product.category ?? ""];
  const products = await getProducts();
  const related = products.filter((p) => String(p.id) !== String(product.id));
  const sameCategory = related.filter((p) => p.category === product.category);
  const otherCategory = related.filter((p) => p.category !== product.category);
  const relatedList = [...sameCategory, ...otherCategory].slice(0, 4);

  return (
    <div>
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-2 px-5 pt-26 pb-2 text-[0.82rem] text-[var(--ink-3)] md:px-12 md:pt-24">
        <Link href="/" className="hover:text-[var(--rose-deep)]">الرئيسية</Link>
        <span className="opacity-50">/</span>
        <Link
          href={product.category ? `/products?cat=${encodeURIComponent(product.category)}` : "/products"}
          className="hover:text-[var(--rose-deep)]"
        >
          {categoryName || "المنتجات"}
        </Link>
        <span className="opacity-50">/</span>
        <span>{product.title || product.name}</span>
      </div>

      <ProductDetail product={product} categoryName={categoryName} settings={settings} />

      {relatedList.length > 0 && (
        <div className="mx-auto max-w-[1240px] border-t border-border px-5 pt-8 pb-16 md:px-12">
          <h2 className="mb-7 text-center text-[1.6rem] font-black text-foreground">
            منتجات <em className="text-[var(--rose-deep)] not-italic">قد تعجبكِ</em>
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {relatedList.map((p) => (
              <ProductCard key={p.id} product={p} categoryName={catMap[p.category ?? ""]} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

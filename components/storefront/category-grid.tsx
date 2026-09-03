import type { Category, Product } from "@/lib/firebase";
import { SectionHead } from "@/components/storefront/section-head";
import { CategoryCarousel } from "@/components/storefront/category-carousel";

export function CategoryGrid({
  categories,
  products,
}: {
  categories: Category[];
  products: Product[];
}) {
  const visible = categories.filter((c) => c.visible !== false);

  // Live per-category product counts. `Product.category` holds the category
  // document id, the same key the tiles link with.
  const counts: Record<string, number> = {};
  for (const p of products) {
    if (p.category) counts[p.category] = (counts[p.category] ?? 0) + 1;
  }

  return (
    <section id="categories" className="reveal mx-auto max-w-[1320px] px-5 py-22 md:px-12">
      <SectionHead
        label="تسوّقي حسب الفئة"
        title="تصنيفاتنا"
        sub="اختاري ما يناسب احتياجكِ من مجموعتنا المتنوّعة للعناية والجمال."
      />
      <CategoryCarousel categories={visible} counts={counts} />
    </section>
  );
}

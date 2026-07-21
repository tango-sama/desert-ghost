import type { Category } from "@/lib/firebase";
import { SectionHead } from "@/components/storefront/section-head";
import { CategoryTileGrid } from "@/components/storefront/category-tile-grid";

export function CategoryGrid({ categories }: { categories: Category[] }) {
  const visible = categories.filter((c) => c.visible !== false).slice(0, 8);

  return (
    <section id="categories" className="reveal mx-auto max-w-[1320px] px-5 py-22 md:px-12">
      <SectionHead
        label="تسوّقي حسب الفئة"
        title="تصنيفاتنا"
        sub="اختاري ما يناسب احتياجكِ من مجموعتنا المتنوّعة للعناية والجمال."
      />
      <CategoryTileGrid categories={visible} />
    </section>
  );
}

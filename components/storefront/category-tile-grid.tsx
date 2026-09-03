import type { Category } from "@/lib/firebase";
import { CategoryTile } from "@/components/storefront/category-tile";

export function CategoryTileGrid({ categories }: { categories: Category[] }) {
  if (categories.length === 0) {
    return <p className="text-center text-[var(--ink-3)]">لا توجد تصنيفات بعد.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
      {categories.map((c) => (
        <CategoryTile key={c.id} category={c} />
      ))}
    </div>
  );
}

import type { Metadata } from "next";
import { getCategories } from "@/lib/firebase";
import { CategoryTileGrid } from "@/components/storefront/category-tile-grid";
import { RevealRoot } from "@/components/storefront/reveal-root";

export const metadata: Metadata = {
  title: "التصنيفات | جمالكِ الخارجي — Desert Shop",
  description: "تصنيفات منتجات الجمال والعناية النسائية في ديزرت شوب.",
};

export default async function CategoriesPage() {
  const categories = await getCategories();
  const visible = categories.filter((c) => c.visible !== false);

  return (
    <div>
      <div className="mx-auto max-w-[1320px] px-5 pt-30 pb-4 text-center md:px-12 md:pt-32">
        <span className="mb-3.5 inline-block rounded-full border border-[rgba(217,168,108,.5)] bg-[rgba(217,168,108,.14)] px-4.5 py-1.5 text-[0.74rem] font-extrabold tracking-[.3px] text-[var(--rose-deep)]">
          تسوّقي حسب الفئة
        </span>
        <h1 className="inline-block bg-gradient-to-br from-[var(--rose-deep)] to-[var(--gold)] bg-clip-text text-[clamp(1.8rem,4vw,2.7rem)] leading-[1.15] font-black text-transparent">
          كل التصنيفات
        </h1>
        <div className="mx-auto mt-3.5 h-[3px] w-20 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--rose)]" />
      </div>
      <RevealRoot>
        <section className="reveal mx-auto max-w-[1320px] px-5 pt-6 pb-16 md:px-12">
          <CategoryTileGrid categories={visible} />
        </section>
      </RevealRoot>
    </div>
  );
}

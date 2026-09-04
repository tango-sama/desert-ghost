import { getCategories, getFeatured, getProducts, getSettings } from "@/lib/firebase";
import { HeroBanner } from "@/components/storefront/hero-banner";
import { FeatureStrip } from "@/components/storefront/feature-strip";
import { CategoryGrid } from "@/components/storefront/category-grid";
import { ProductGrid } from "@/components/storefront/product-grid";
import { ContactForm } from "@/components/storefront/contact-form";
import { RevealRoot } from "@/components/storefront/reveal-root";

export default async function HomePage() {
  const [settings, categories, products, featured] = await Promise.all([
    getSettings(),
    getCategories(),
    getProducts(),
    getFeatured(),
  ]);

  return (
    <>
      <HeroBanner items={featured} heroImage={settings.heroImage} />
      <RevealRoot>
        <FeatureStrip />
        <CategoryGrid categories={categories} products={products} />
      </RevealRoot>
      <RevealRoot>
        <ProductGrid products={products} categories={categories} />
        <ContactForm settings={settings} />
      </RevealRoot>
    </>
  );
}

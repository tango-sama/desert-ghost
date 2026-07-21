import { getCategories, getFeatured, getProducts, getSettings } from "@/lib/firebase";
import { Hero } from "@/components/storefront/hero";
import { FeatureStrip } from "@/components/storefront/feature-strip";
import { CategoryGrid } from "@/components/storefront/category-grid";
import { FeaturedCarousel } from "@/components/storefront/featured-carousel";
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
      <Hero heroImage={settings.heroImage} />
      <RevealRoot>
        <FeatureStrip />
        <CategoryGrid categories={categories} />
      </RevealRoot>
      <FeaturedCarousel items={featured} />
      <RevealRoot>
        <ProductGrid products={products} categories={categories} />
        <ContactForm settings={settings} />
      </RevealRoot>
    </>
  );
}

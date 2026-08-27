import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings, type LandingPageKey, type SiteSettings } from "@/lib/firebase";
import { isBefore } from "@/lib/time";
import { SunguardPage } from "@/components/storefront/sunguard/sunguard-page";
import { CollagenPage } from "@/components/storefront/collagen/collagen-page";
import { GlutathionePage } from "@/components/storefront/glutathione/glutathione-page";
import { CarnitinePage } from "@/components/storefront/carnitine/carnitine-page";

// Serves the self-contained landing funnels at an admin-chosen custom path
// (settings.landingPages.<page>.slug, edited from the "صفحات الهبوط" admin
// tab) in addition to their built-in /sunguard, /collagen, /glutathione
// routes (which redirect here once a slug is set — see those pages).
// Settings can change anytime, so this must render per-request like the
// rest of the storefront.
export const dynamic = "force-dynamic";

type Params = { slug: string };

const META: Record<LandingPageKey, Metadata> = {
  sunguard: {
    title: "واقي الشمس المائي SPF50+ | Desert Shop",
    description:
      "واقي شمس Jula's Herb Watermelon 3D Aura بحماية SPF50+ PA++++ فيزيائية وكيميائية، خفيف وغير دهني. الدفع عند الاستلام وتوصيل لكل الولايات.",
  },
  collagen: {
    title: "كولاجين بريميوم | جمالكِ الخارجي — Desert Shop",
    description:
      "أربع تركيبات كولاجين مختارة بعناية لبشرة أكثر نضارة، شعر أقوى، أظافر صحية، ومفاصل مرنة. الدفع عند الاستلام وتوصيل لكل الولايات.",
  },
  glutathione: {
    title: "جلوتاثيون للتفتيح Life Extension | Desert Shop",
    description:
      "مكمل Glutathione, Cysteine & C من Life Extension لتفتيح البشرة وتوحيد لونها، دعم وظائف الكبد، وتعزيز المناعة. الدفع عند الاستلام وتوصيل لكل الولايات.",
  },
  carnitine: {
    title: "كبسولات تنحيف الجسم HHS A1 L-Carnitine | Desert Shop",
    description:
      "مكمل عشبي تركي طبيعي HHS A1 L-Carnitine Lepidium يدعم فقدان الوزن، يعزز الطاقة، ويساعد على الشعور بالامتلاء. الدفع عند الاستلام وتوصيل لكل الولايات.",
  },
};

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

async function matchPage(
  rawSlug: string
): Promise<{ key: LandingPageKey; settings: SiteSettings } | null> {
  const settings = await getSettings();
  // Non-ASCII slugs (Arabic) aren't consistently decoded by the time this
  // route sees `params.slug` — decode defensively; a no-op for plain text.
  const slug = safeDecode(rawSlug);
  const keys: LandingPageKey[] = ["sunguard", "collagen", "glutathione", "carnitine"];
  for (const key of keys) {
    const saved = settings.landingPages?.[key]?.slug?.trim();
    if (saved && saved === slug) return { key, settings };
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const match = await matchPage(slug);
  return match ? META[match.key] : {};
}

export default async function CustomSlugPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const match = await matchPage(slug);
  if (!match) notFound();
  const { key, settings } = match;
  const isTikTokLive = isBefore(settings.tiktokLiveUntil as number | undefined);
  if (key === "sunguard") return <SunguardPage settings={settings} isTikTokLive={isTikTokLive} />;
  if (key === "collagen") return <CollagenPage settings={settings} isTikTokLive={isTikTokLive} />;
  if (key === "glutathione") return <GlutathionePage settings={settings} isTikTokLive={isTikTokLive} />;
  return <CarnitinePage settings={settings} isTikTokLive={isTikTokLive} />;
}

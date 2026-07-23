import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/firebase";
import { isBefore } from "@/lib/time";
import { CollagenPage } from "@/components/storefront/collagen/collagen-page";

// Self-contained marketing funnel (architecture-context.md) — its own top
// bar/footer, no shared storefront Nav/Footer/CartDrawer, so this route
// intentionally sits outside the (storefront) group. Settings can change
// from the admin panel anytime (TikTok live window, carrier toggles), so
// this must render per-request like the rest of the storefront.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "كولاجين بريميوم | جمالكِ الخارجي — Desert Shop",
  description:
    "أربع تركيبات كولاجين مختارة بعناية لبشرة أكثر نضارة، شعر أقوى، أظافر صحية، ومفاصل مرنة. الدفع عند الاستلام وتوصيل لكل الولايات.",
};

export default async function Page() {
  const settings = await getSettings();
  // Admin picked a custom link (صفحات الهبوط tab) — forward there so old
  // shared /collagen links keep working instead of breaking.
  const slug = settings.landingPages?.collagen?.slug?.trim();
  if (slug) redirect(`/${encodeURIComponent(slug)}`);
  const isTikTokLive = isBefore(settings.tiktokLiveUntil as number | undefined);
  return <CollagenPage settings={settings} isTikTokLive={isTikTokLive} />;
}

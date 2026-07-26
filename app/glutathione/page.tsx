import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/firebase";
import { isBefore } from "@/lib/time";
import { GlutathionePage } from "@/components/storefront/glutathione/glutathione-page";

// Self-contained marketing funnel (architecture-context.md), same pattern
// as /sunguard and /collagen — its own top bar/footer, no shared storefront
// Nav/Footer/CartDrawer, so this route sits outside the (storefront) group.
// Settings can change from the admin panel anytime (TikTok live window,
// carrier toggles), so this must render per-request like the rest of the
// storefront.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "جلوتاثيون للتفتيح Life Extension | Desert Shop",
  description:
    "مكمل Glutathione, Cysteine & C من Life Extension لتفتيح البشرة وتوحيد لونها، دعم وظائف الكبد، وتعزيز المناعة. الدفع عند الاستلام وتوصيل لكل الولايات.",
};

export default async function Page() {
  const settings = await getSettings();
  // Admin picked a custom link (صفحات الهبوط tab) — forward there so old
  // shared /glutathione links keep working instead of breaking.
  const slug = settings.landingPages?.glutathione?.slug?.trim();
  if (slug) redirect(`/${encodeURIComponent(slug)}`);
  const isTikTokLive = isBefore(settings.tiktokLiveUntil as number | undefined);
  return <GlutathionePage settings={settings} isTikTokLive={isTikTokLive} />;
}

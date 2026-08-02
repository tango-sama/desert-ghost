import type { Metadata } from "next";
import { getSettings } from "@/lib/firebase";
import { isBefore } from "@/lib/time";
import { Glutathione3DPage } from "@/components/storefront/glutathione-3d/glutathione-3d-page";

// Self-contained marketing funnel (architecture-context.md), same pattern
// as /glutathione, /sunguard and /collagen — its own top bar/footer, no
// shared storefront Nav/Footer/CartDrawer, so this route sits outside the
// (storefront) group. Settings can change from the admin panel anytime
// (TikTok live window, carrier toggles), so this must render per-request
// like the rest of the storefront.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "جلوتاثيون للتفتيح Life Extension | عرض 3D | Desert Shop",
  description:
    "مكمل Glutathione, Cysteine & C من Life Extension لتفتيح البشرة وتوحيد لونها، دعم وظائف الكبد، وتعزيز المناعة — بعرض تفاعلي ثلاثي الأبعاد للمنتج. الدفع عند الاستلام وتوصيل لكل الولايات.",
};

export default async function Page() {
  const settings = await getSettings();
  const isTikTokLive = isBefore(settings.tiktokLiveUntil as number | undefined);
  return <Glutathione3DPage settings={settings} isTikTokLive={isTikTokLive} />;
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/firebase";
import { isBefore } from "@/lib/time";
import { SunguardPage } from "@/components/storefront/sunguard/sunguard-page";

// Self-contained marketing funnel (architecture-context.md), same pattern
// as /collagen — its own top bar/footer, no shared storefront Nav/Footer/
// CartDrawer, so this route sits outside the (storefront) group. Settings
// can change from the admin panel anytime (TikTok live window, carrier
// toggles), so this must render per-request like the rest of the storefront.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "واقي الشمس المائي SPF50+ | Desert Shop",
  description:
    "واقي شمس Jula's Herb Watermelon 3D Aura بحماية SPF50+ PA++++ فيزيائية وكيميائية، خفيف وغير دهني. الدفع عند الاستلام وتوصيل لكل الولايات.",
};

export default async function Page() {
  const settings = await getSettings();
  // Admin picked a custom link (صفحات الهبوط tab) — forward there so old
  // shared /sunguard links keep working instead of breaking.
  const slug = settings.landingPages?.sunguard?.slug?.trim();
  if (slug) redirect(`/${encodeURIComponent(slug)}`);
  const isTikTokLive = isBefore(settings.tiktokLiveUntil as number | undefined);
  return <SunguardPage settings={settings} isTikTokLive={isTikTokLive} />;
}

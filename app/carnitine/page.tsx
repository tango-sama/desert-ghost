import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/firebase";
import { isBefore } from "@/lib/time";
import { CarnitinePage } from "@/components/storefront/carnitine/carnitine-page";

// Self-contained marketing funnel (architecture-context.md), same pattern
// as /sunguard and /collagen — its own top bar/footer, no shared storefront
// Nav/Footer/CartDrawer, so this route sits outside the (storefront) group.
// Settings can change from the admin panel anytime (TikTok live window,
// carrier toggles), so this must render per-request like the rest of the
// storefront.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "كبسولات تنحيف الجسم HHS A1 L-Carnitine | Desert Shop",
  description:
    "مكمل عشبي تركي طبيعي HHS A1 L-Carnitine Lepidium يدعم فقدان الوزن، يعزز الطاقة، ويساعد على الشعور بالامتلاء. الدفع عند الاستلام وتوصيل لكل الولايات.",
};

export default async function Page() {
  const settings = await getSettings();
  // Admin picked a custom link (صفحات الهبوط tab) — forward there so old
  // shared /carnitine links keep working instead of breaking.
  const slug = settings.landingPages?.carnitine?.slug?.trim();
  if (slug) redirect(`/${encodeURIComponent(slug)}`);
  const isTikTokLive = isBefore(settings.tiktokLiveUntil as number | undefined);
  return <CarnitinePage settings={settings} isTikTokLive={isTikTokLive} />;
}

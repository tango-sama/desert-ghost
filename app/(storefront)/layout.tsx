import { getSettings } from "@/lib/firebase";
import { isBefore } from "@/lib/time";
import { Nav } from "@/components/storefront/nav";
import { Footer } from "@/components/storefront/footer";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import { WhatsAppFloat } from "@/components/storefront/whatsapp-float";
import { TikTokLiveButton } from "@/components/storefront/tiktok-live-button";

// Catalog/settings come live from Firestore and change outside a deploy
// (admin edits products, toggles WA, starts a TikTok live window) — this
// must render per-request, not get baked in at build time.
export const dynamic = "force-dynamic";

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSettings();
  const isTikTokLive = isBefore(settings.tiktokLiveUntil as number | undefined);

  return (
    <>
      <div className="fixed inset-0 z-0 pointer-events-none [background:radial-gradient(ellipse_50%_40%_at_88%_8%,rgba(224,114,140,.10),transparent_60%),radial-gradient(ellipse_40%_40%_at_8%_28%,rgba(217,168,108,.10),transparent_55%)]" />
      <div className="relative z-[1] flex min-h-full flex-col">
        <Nav settings={settings} />
        <main className="flex-1">{children}</main>
        <Footer settings={settings} />
      </div>
      <TikTokLiveButton settings={settings} isLive={isTikTokLive} />
      <WhatsAppFloat settings={settings} />
      <CartDrawer />
    </>
  );
}

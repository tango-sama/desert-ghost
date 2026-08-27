"use client";

import Image from "next/image";
import type { SiteSettings } from "@/lib/firebase";
import { waLink } from "@/lib/whatsapp";
import { trackPixelEvent } from "@/lib/meta-pixel";

export function WhatsAppFloat({ settings }: { settings: SiteSettings }) {
  if (settings.waEnabled === false) return null;
  return (
    <a
      href={waLink(settings, "مرحباً، لدي استفسار")}
      target="_blank"
      rel="noopener"
      aria-label="WhatsApp"
      // No product context here (this button floats site-wide, not tied to
      // any one page) — still a real top-of-funnel "Contact" signal, just a
      // coarser one than product-detail.tsx's own WhatsApp button. Doesn't
      // preventDefault; the link still opens normally.
      onClick={() => trackPixelEvent("Contact", { content_name: "whatsapp_float" })}
      className="fixed bottom-6 left-6 z-[150] flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-[#1A7A34] to-[#25D366] shadow-[0_6px_24px_rgba(37,211,102,.45)] transition-transform hover:scale-110 before:absolute before:inset-0 before:-z-10 before:animate-ping before:rounded-full before:bg-[#25D366] before:opacity-40"
    >
      <Image src="/assets/whatsapp.png" alt="" width={28} height={28} className="brightness-0 invert" />
    </a>
  );
}

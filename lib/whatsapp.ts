import type { SiteSettings } from "@/lib/firebase";

const DEFAULT_WA_NUMBER = "213662705830";

export function waLink(settings: SiteSettings, text: string): string {
  const raw = (settings.waNumber as string) || DEFAULT_WA_NUMBER;
  const number = raw.replace(/[^0-9]/g, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

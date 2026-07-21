import Link from "next/link";
import Image from "next/image";
import type { SiteSettings } from "@/lib/firebase";
import { waLink } from "@/lib/whatsapp";

const SOCIALS = [
  { key: "instagram", icon: "/assets/instagram.png", label: "Instagram" },
  { key: "facebook", icon: "/assets/facebook.png", label: "Facebook" },
  { key: "tiktok", icon: "/assets/tiktok.png", label: "TikTok" },
] as const;

export function Footer({ settings }: { settings: SiteSettings }) {
  const year = new Date().getFullYear();
  return (
    <footer className="relative z-10 mt-12 border-t border-border bg-card px-5 pt-14 pb-8 md:px-12">
      <div className="mx-auto max-w-[1320px]">
        <div className="grid grid-cols-1 gap-10 border-b border-border pb-10 md:grid-cols-[1.6fr_1fr_1fr_1.2fr]">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <Image src="/assets/logo.webp" alt="Desert Shop" width={48} height={48} className="h-12 w-auto" />
              <span className="text-xl font-extrabold">جمالكِ الخارجي</span>
            </div>
            <p className="max-w-[290px] text-sm leading-8 text-muted-foreground">
              وجهتكِ الأولى لمنتجات الجمال والعناية النسائية في الجزائر. جودة أصلية،
              خصوصية تامة، وتوصيل لكل الولايات.
            </p>
            <div className="mt-4 flex gap-2.5">
              <a
                href={waLink(settings, "مرحباً")}
                target="_blank"
                rel="noopener"
                aria-label="WhatsApp"
                className="flex size-9 items-center justify-center rounded-xl bg-muted transition-all hover:-translate-y-0.5 hover:bg-[var(--rose-tint)]"
              >
                <Image src="/assets/whatsapp.png" alt="WhatsApp" width={18} height={18} />
              </a>
              {SOCIALS.map(
                (s) =>
                  settings[s.key] && (
                    <a
                      key={s.key}
                      href={settings[s.key] as string}
                      target="_blank"
                      rel="noopener"
                      aria-label={s.label}
                      className="flex size-9 items-center justify-center rounded-xl bg-muted transition-all hover:-translate-y-0.5 hover:bg-[var(--rose-tint)]"
                    >
                      <Image src={s.icon} alt={s.label} width={18} height={18} />
                    </a>
                  )
              )}
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-[0.7rem] font-extrabold tracking-[2px] text-[var(--rose-deep)] uppercase">تسوّقي</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><Link href="/products" className="hover:text-[var(--rose-deep)]">كل المنتجات</Link></li>
              <li><Link href="/categories" className="hover:text-[var(--rose-deep)]">التصنيفات</Link></li>
              <li><Link href="/#collection" className="hover:text-[var(--rose-deep)]">الأكثر طلباً</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-[0.7rem] font-extrabold tracking-[2px] text-[var(--rose-deep)] uppercase">المتجر</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><Link href="/#contact" className="hover:text-[var(--rose-deep)]">تواصلي معنا</Link></li>
              <li><a href={waLink(settings, "مرحباً")} target="_blank" rel="noopener" className="hover:text-[var(--rose-deep)]">محادثة في واتساب</a></li>
              <li><Link href="/checkout" className="hover:text-[var(--rose-deep)]">سلة المشتريات</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-[0.7rem] font-extrabold tracking-[2px] text-[var(--rose-deep)] uppercase">الدفع والتوصيل</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>الدفع عند الاستلام</li>
              <li>توصيل لكل الولايات</li>
              <li>منتجات أصلية مضمونة</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-6 text-[0.74rem] text-[var(--ink-3)]">
          <div>© {year} جمالكِ الخارجي — Desert Shop · جميع الحقوق محفوظة</div>
          <div>صُنع بحبّ في الجزائر 🇩🇿</div>
        </div>
      </div>
    </footer>
  );
}

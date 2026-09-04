import { Headset, ShieldCheck, Truck, Wallet, type LucideIcon } from "lucide-react";

const FEATURES: { icon: LucideIcon; title: string; sub: React.ReactNode }[] = [
  { icon: Wallet, title: "الدفع عند الاستلام", sub: "توصيل لـ 58 ولاية" },
  { icon: ShieldCheck, title: "منتجات أصلية", sub: <>ضمان الجودة <span className="num">100%</span></> },
  { icon: Truck, title: "توصيل سريع", sub: "إلى باب المنزل" },
  { icon: Headset, title: "خدمة زبائن", sub: "7/7 أيام" },
];

// The trust band, directly under the hero. It used to be four separate
// floating cards in the page flow; now it is one card pulled up over the
// banner's bottom edge, so the promises read as part of the first screen
// instead of as the first thing you scroll to.
export function FeatureStrip() {
  return (
    <section className="reveal relative z-10 mx-auto -mt-10 max-w-[1320px] px-5 md:px-12">
      <div className="rounded-[24px] border border-[var(--line-2)] bg-card/95 p-5 shadow-[var(--shadow-lg)] backdrop-blur-sm md:p-6">
        <div className="grid grid-cols-2 gap-y-5 md:grid-cols-4 md:gap-y-0">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex items-center gap-2.5 px-1 md:gap-3.5 md:px-5 [&:not(:last-child)]:md:border-s [&:not(:last-child)]:md:border-s-[var(--line)]"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--rose-tint)] to-[var(--gold-soft)] text-[var(--rose-deep)] md:size-12 md:rounded-2xl">
                <f.icon className="size-5 md:size-6" />
              </div>
              <div className="min-w-0">
                <div className="text-[0.8rem] leading-snug font-extrabold text-balance text-foreground md:truncate md:text-[0.95rem]">
                  {f.title}
                </div>
                <div className="mt-0.5 text-[0.68rem] leading-snug text-[var(--ink-3)] md:truncate md:text-[0.78rem]">
                  {f.sub}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* The social-proof line the old split hero carried, kept here where
            it sits under every promise rather than beside one photo. */}
        <div className="mt-5 flex items-center justify-center gap-3.5 border-t border-[var(--line)] pt-4">
          <div className="flex">
            {["👩", "🧕", "💁‍♀️", "💃"].map((e, i) => (
              <div
                key={i}
                className="-ms-2.5 flex size-8 items-center justify-center rounded-full border-2 border-card bg-gradient-to-br from-[var(--rose-soft)] to-[var(--gold-light)] text-sm first:ms-0"
              >
                {e}
              </div>
            ))}
          </div>
          <div className="text-[0.78rem] text-muted-foreground">
            <b className="font-extrabold text-foreground">+5000 زبونة سعيدة</b> يثقن في
            ديزرت شوب
          </div>
        </div>
      </div>
    </section>
  );
}

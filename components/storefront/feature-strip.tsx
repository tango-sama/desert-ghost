import { Headset, ShieldCheck, Truck, Wallet } from "lucide-react";

const FEATURES = [
  { icon: Wallet, title: "الدفع عند الاستلام", sub: "توصيل لـ 58 ولاية" },
  { icon: ShieldCheck, title: "منتجات أصلية", sub: "ضمان الجودة 100%" },
  { icon: Truck, title: "توصيل سريع", sub: "إلى باب المنزل" },
  { icon: Headset, title: "خدمة زبائن", sub: "7/7 أيام" },
];

export function FeatureStrip() {
  return (
    <section className="reveal mx-auto grid max-w-[1320px] grid-cols-2 gap-5 px-5 md:grid-cols-4 md:px-12">
      {FEATURES.map((f) => (
        <div
          key={f.title}
          className="flex items-center gap-4 rounded-[18px] border border-[var(--line-2)] bg-card p-5 shadow-[var(--shadow)] transition-all hover:-translate-y-1 hover:border-[rgba(217,168,108,.5)] hover:shadow-[var(--shadow-lg)]"
        >
          <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--rose-tint)] to-[var(--gold-soft)] text-[var(--rose-deep)]">
            <f.icon className="size-6.5" />
          </div>
          <div>
            <div className="text-[0.95rem] font-extrabold text-foreground">{f.title}</div>
            <div className="mt-0.5 text-[0.78rem] text-[var(--ink-3)]">{f.sub}</div>
          </div>
        </div>
      ))}
    </section>
  );
}

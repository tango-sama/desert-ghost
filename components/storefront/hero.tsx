import Link from "next/link";
import { Star, Truck } from "lucide-react";

export function Hero({ heroImage }: { heroImage?: string }) {
  return (
    <header className="mx-auto grid min-h-[88vh] max-w-[1320px] grid-cols-1 items-center gap-10 px-5 pt-28 pb-16 md:grid-cols-[1.05fr_1fr] md:gap-12 md:px-12 md:pt-32">
      <div className="relative z-[2] text-center md:text-right">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[rgba(217,168,108,.45)] bg-[rgba(217,168,108,.16)] px-4.5 py-2 text-[0.72rem] font-extrabold tracking-[2px] text-[var(--rose-deep)] uppercase md:mx-0">
          <span className="size-[7px] animate-pulse rounded-full bg-[var(--rose)]" />
          أناقتكِ تبدأ من هنا
        </div>
        <h1 className="mb-5 text-[clamp(2.4rem,5.2vw,4rem)] leading-[1.18] font-black text-foreground">
          كل ما تحتاجينه{" "}
          <em className="bg-gradient-to-br from-[var(--rose)] to-[var(--gold)] bg-clip-text not-italic text-transparent">
            لجمالكِ
          </em>{" "}
          وعنايتكِ في مكان واحد
        </h1>
        <p className="mx-auto mb-8 max-w-[460px] text-[1.05rem] leading-[1.9] text-muted-foreground md:mx-0">
          منتجات أصلية مختارة بعناية للعناية بالبشرة والشعر، العطور الفرمونية،
          والمكمّلات النسائية — بجودة مضمونة، أسعار مناسبة، وتوصيل لكل ولايات
          الوطن.
        </p>
        <div className="flex flex-wrap justify-center gap-4 md:justify-start">
          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-[var(--rose)] to-[var(--rose-deep)] px-9 py-4 text-[0.92rem] font-extrabold text-white shadow-[0_8px_22px_rgba(224,114,140,.35)] transition-all hover:-translate-y-0.75 hover:shadow-[0_14px_32px_rgba(224,114,140,.5)]"
          >
            تسوّقي الآن
          </Link>
          <Link
            href="/categories"
            className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[var(--line)] bg-card px-6 py-4 text-[0.9rem] font-bold text-foreground transition-all hover:-translate-y-0.5 hover:border-[var(--rose)] hover:text-[var(--rose-deep)]"
          >
            تصفّحي التصنيفات
          </Link>
        </div>
        <div className="mt-9 flex items-center justify-center gap-4 md:justify-start">
          <div className="flex">
            {["👩", "🧕", "💁‍♀️", "💃"].map((e, i) => (
              <div
                key={i}
                className="-mr-2.5 flex size-9 items-center justify-center rounded-full border-2 border-background bg-gradient-to-br from-[var(--rose-soft)] to-[var(--gold-light)] text-base"
              >
                {e}
              </div>
            ))}
          </div>
          <div className="text-[0.8rem] leading-tight text-muted-foreground">
            <b className="font-extrabold text-foreground">+5000 زبونة سعيدة</b>
            <br />
            يثقن في ديزرت شوب
          </div>
        </div>
      </div>

      <div className="relative h-[80vh] max-h-[620px]">
        <div className="absolute inset-0 overflow-hidden rounded-[32px] bg-gradient-to-br from-[var(--rose-soft)] via-[var(--gold-light)] to-[var(--blush)] shadow-[var(--shadow-lg)]">
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin-pasted URL, arbitrary host
            <img src={heroImage} alt="جمالكِ الخارجي" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-[9rem] drop-shadow-[0_14px_28px_rgba(58,42,48,.18)]">
              💄
            </div>
          )}
        </div>
        <div className="absolute top-6 right-6 z-[3] flex items-center gap-2.5 rounded-2xl border border-[var(--line)] bg-background/92 px-4.5 py-3.5 shadow-[var(--shadow-lg)] backdrop-blur-md">
          <Star className="size-4 fill-[var(--gold)] text-[var(--gold)]" />
          <div className="text-[0.72rem] text-muted-foreground">
            <b className="font-extrabold text-foreground">4.9</b> · تقييم الزبائن
          </div>
        </div>
        <div className="absolute bottom-6 left-6 z-[3] flex items-center gap-2.5 rounded-2xl border border-[var(--line)] bg-background/92 px-4.5 py-3.5 shadow-[var(--shadow-lg)] backdrop-blur-md">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--rose-tint)]">
            <Truck className="size-[22px] text-[var(--rose-deep)]" />
          </div>
          <div>
            <div className="text-[0.78rem] font-extrabold text-foreground">توصيل سريع</div>
            <div className="text-[0.7rem] text-[var(--ink-3)]">لكل 58 ولاية</div>
          </div>
        </div>
      </div>
    </header>
  );
}

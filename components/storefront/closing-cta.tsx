import Link from "next/link";
import type { Product } from "@/lib/firebase";

// The page's last word before the footer. The count is the real catalog
// size, taken from the products the home page already fetched — it lives
// here rather than in the shared Footer so no other route pays for a second
// catalog read just to print a number.
export function ClosingCta({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <section className="reveal border-t border-[var(--line)] bg-gradient-to-b from-[var(--blush)] to-[var(--cream)]">
      <div className="mx-auto max-w-[1320px] px-5 py-16 text-center md:px-12 md:py-20">
        <h2 className="bg-gradient-to-br from-[var(--rose-deep)] to-[var(--gold)] bg-clip-text text-[clamp(1.6rem,4vw,2.6rem)] leading-[1.2] font-black text-transparent">
          أكثر من <span className="num">{products.length}</span> منتج لجمالكِ
        </h2>
        <div className="mx-auto mt-4 h-[3px] w-20 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--rose)]" />
        <div className="mt-8">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[var(--rose)] to-[var(--rose-deep)] px-10 py-4 text-[0.94rem] font-extrabold text-white shadow-[0_8px_22px_rgba(224,114,140,.35)] transition-all hover:-translate-y-0.75 hover:shadow-[0_14px_32px_rgba(224,114,140,.5)]"
          >
            تسوّقي الآن
          </Link>
        </div>
      </div>
    </section>
  );
}

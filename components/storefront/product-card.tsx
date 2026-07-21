"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import type { Product } from "@/lib/firebase";
import { priceFmt, productImages } from "@/lib/firebase";
import { useCartStore } from "@/stores/cart-store";

export function ProductCard({ product, categoryName }: { product: Product; categoryName?: string }) {
  const add = useCartStore((s) => s.add);
  const image = productImages(product)[0];
  const title = product.title || product.name || "";

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-[20px] border border-[var(--line-2)] bg-card shadow-[var(--shadow)] transition-all hover:-translate-y-2 hover:border-[rgba(217,168,108,.55)] hover:shadow-[var(--shadow-lg)]">
      <Link href={`/product/${product.id}`} className="relative block aspect-square overflow-hidden bg-gradient-to-br from-[var(--bg-3)] to-[var(--blush)]">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element -- admin-pasted URL, arbitrary host
          <img
            src={image}
            alt={title}
            loading="lazy"
            className="absolute inset-0 size-full object-cover transition-transform duration-600 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-106"
          />
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4.5 pb-5">
        {categoryName && (
          <div className="mb-1.5 text-[0.62rem] font-bold tracking-[1.5px] text-[var(--gold)] uppercase">
            {categoryName}
          </div>
        )}
        <Link href={`/product/${product.id}`} className="mb-1 line-clamp-2 text-[1rem] leading-[1.4] font-extrabold text-foreground">
          {title}
        </Link>
        {product.subtitle && (
          <div className="mb-3 line-clamp-1 text-[0.78rem] text-[var(--ink-3)]">{product.subtitle}</div>
        )}
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="text-[1.1rem] font-black text-[var(--rose-deep)]">{priceFmt(product.price)}</span>
          <button
            type="button"
            aria-label="أضيفي للسلة"
            onClick={() => add(product)}
            className="flex size-10.5 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--rose)] to-[var(--rose-deep)] text-white transition-all hover:scale-108 hover:-rotate-6 hover:shadow-[0_8px_18px_rgba(224,114,140,.45)]"
          >
            <Plus className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import type { Product } from "@/lib/firebase";
import { priceFmt, priceNum, productImages } from "@/lib/firebase";
import { trackPixelEvent } from "@/lib/meta-pixel";
import { useCartStore } from "@/stores/cart-store";

// The one product card in the storefront: the home page's «أبرز المنتجات»
// grid, the /products listing, and the "related" rail on a product page.
//
// `soldCount` and `isNew` are optional and default off, so only the home page
// (the one call site that can afford the server-side order read) shows a
// badge; the other two render exactly as before. `soldCount` is already
// bucketed by lib/closet-sort.ts — never print an exact figure here.
export function ProductCard({
  product,
  categoryName,
  soldCount,
  isNew,
}: {
  product: Product;
  categoryName?: string;
  soldCount?: number;
  isNew?: boolean;
}) {
  const add = useCartStore((s) => s.add);
  const image = productImages(product)[0];
  const title = product.title || product.name || "";

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-[20px] border border-[var(--line-2)] bg-card shadow-[var(--shadow)] transition-all duration-300 hover:-translate-y-2 hover:border-[rgba(217,168,108,.55)] hover:shadow-[var(--shadow-lg)]">
      <Link
        href={`/product/${product.id}`}
        className="relative block aspect-square overflow-hidden bg-gradient-to-br from-[var(--bg-3)] to-[var(--blush)]"
      >
        {image && (
          // eslint-disable-next-line @next/next/no-img-element -- admin-pasted URL, arbitrary host
          <img
            src={image}
            alt={title}
            loading="lazy"
            className="absolute inset-0 size-full object-cover transition-transform duration-600 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-106"
          />
        )}
        {soldCount ? (
          <span className="absolute top-3 start-3 rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-light)] px-3 py-1 text-[0.66rem] font-extrabold text-[#5A3F2A] shadow-[0_4px_12px_rgba(217,168,108,.4)]">
            بيع <span className="num">+{soldCount}</span> مرة
          </span>
        ) : isNew ? (
          <span className="absolute top-3 start-3 rounded-full bg-gradient-to-br from-[var(--rose)] to-[var(--rose-deep)] px-3 py-1 text-[0.66rem] font-extrabold text-white shadow-[0_4px_12px_rgba(224,114,140,.4)]">
            جديد
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col p-4 pb-4.5 md:p-4.5 md:pb-5">
        {categoryName && (
          <div className="mb-1.5 line-clamp-1 text-[0.62rem] font-bold tracking-[1.5px] text-[var(--gold)] uppercase">
            {categoryName}
          </div>
        )}
        <Link
          href={`/product/${product.id}`}
          className="mb-1 line-clamp-2 text-[0.98rem] leading-[1.4] font-extrabold text-foreground transition-colors [overflow-wrap:anywhere] hover:text-[var(--rose-deep)]"
        >
          {title}
        </Link>
        {product.subtitle && (
          <div className="mb-2 line-clamp-1 text-[0.76rem] text-[var(--ink-3)] [overflow-wrap:anywhere]">
            {product.subtitle}
          </div>
        )}
        <div className="mt-auto pt-2.5">
          <div className="mb-3 text-[1.1rem] font-black text-[var(--rose-deep)]">
            <span className="num">{priceFmt(product.price)}</span>
          </div>
          {/* Full-width, labelled, and the widest tap target on the card.
              The round + it replaces asked shoppers to guess what it did. */}
          <button
            type="button"
            onClick={() => {
              add(product);
              trackPixelEvent("AddToCart", {
                content_ids: [product.id],
                content_type: "product",
                content_name: title,
                value: priceNum(product.price),
                currency: "DZD",
              });
            }}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-[var(--rose)] to-[var(--rose-deep)] py-3 text-[0.84rem] font-extrabold text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(224,114,140,.45)]"
          >
            <ShoppingBag className="size-4" />
            أضيفي للسلة
          </button>
        </div>
      </div>
    </div>
  );
}

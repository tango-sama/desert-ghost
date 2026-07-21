"use client";

import { useState } from "react";
import { Check, CreditCard, Minus, Package, Plus, ShieldCheck, Truck } from "lucide-react";
import type { Product } from "@/lib/firebase";
import { benefits, priceFmt, productImages } from "@/lib/firebase";
import { waLink } from "@/lib/whatsapp";
import type { SiteSettings } from "@/lib/firebase";
import { useCartStore } from "@/stores/cart-store";
import { SellerOrderBadge, SellerOrderModal, SellerOrderTrigger } from "@/components/storefront/seller-order-modal";

const META_ROWS = [
  { icon: CreditCard, label: "الدفع", strong: "عند الاستلام" },
  { icon: Truck, label: "توصيل لكل الولايات ·", strong: "58 ولاية" },
  { icon: ShieldCheck, label: "منتج", strong: "أصلي 100% مضمون" },
  { icon: Package, label: "تغليف", strong: "سرّي ومحترم للخصوصية" },
];

export function ProductDetail({
  product,
  categoryName,
  settings,
}: {
  product: Product;
  categoryName?: string;
  settings: SiteSettings;
}) {
  const images = productImages(product);
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [sellerModalOpen, setSellerModalOpen] = useState(false);
  const [sellerOrderNum, setSellerOrderNum] = useState<string | null>(null);
  const add = useCartStore((s) => s.add);
  const title = product.title || product.name || "";
  const benefitList = benefits(product.description);

  function handleAdd() {
    for (let i = 0; i < qty; i++) add(product, { silent: i < qty - 1 });
  }

  function handleWhatsApp() {
    const text = `مرحباً، أريد طلب هذا المنتج:\n${title}\nالسعر: ${priceFmt(product.price)}\nالكمية: ${qty}`;
    window.open(waLink(settings, text), "_blank");
  }

  return (
    <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-7 px-5 py-4 md:grid-cols-2 md:gap-12 md:px-12">
      <div className="md:sticky md:top-24 md:self-start">
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-3xl border border-[var(--line-2)] bg-gradient-to-br from-[var(--bg-3)] to-[var(--blush)] shadow-[var(--shadow)]">
          {images.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin-pasted URL, arbitrary host
            <img src={images[activeImage]} alt={title} className="size-full object-cover" />
          ) : (
            <div className="text-8xl">🌸</div>
          )}
          {typeof product.badge === "string" && product.badge && (
            <span className="absolute top-4.5 right-4.5 rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-light)] px-3.5 py-1.5 text-[0.66rem] font-extrabold tracking-wide text-[#5A3F2A] uppercase">
              {product.badge}
            </span>
          )}
        </div>
        {images.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2.5">
            {images.map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={() => setActiveImage(i)}
                className={`size-19.5 overflow-hidden rounded-2xl border-2 bg-muted transition-colors ${
                  i === activeImage ? "border-[var(--rose)]" : "border-[var(--line)]"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- admin-pasted URL, arbitrary host */}
                <img src={src} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        {categoryName && (
          <div className="mb-2.5 text-[0.72rem] font-extrabold tracking-[2px] text-[var(--gold)] uppercase">
            {categoryName}
          </div>
        )}
        <h1 className="mb-2 text-[clamp(1.6rem,3.2vw,2.3rem)] leading-[1.25] font-black text-foreground">{title}</h1>
        {product.subtitle && <div className="mb-5 text-[1rem] text-muted-foreground">{product.subtitle}</div>}
        <div className="mb-5 flex items-center gap-2">
          <span className="tracking-widest text-[var(--gold)]">★★★★★</span>
          <span className="text-[0.78rem] text-[var(--ink-3)]">تقييم 4.9 · منتج موثوق</span>
        </div>
        <div className="mb-6 border-b border-border pb-6 text-[2rem] font-black text-[var(--rose-deep)]">
          {priceFmt(product.price)}
        </div>

        {benefitList.length > 0 && (
          <div className="mb-7">
            <h3 className="mb-3.5 flex items-center gap-2 text-[1.05rem] font-extrabold text-foreground">
              ✨ الفوائد والمميزات
            </h3>
            <ul className="flex flex-col gap-2.5">
              {benefitList.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[0.92rem] leading-relaxed text-muted-foreground">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-[var(--rose-tint)]">
                    <Check className="size-3.5 text-[var(--rose-deep)]" />
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-6 flex items-center gap-4">
          <span className="text-[0.82rem] font-bold text-[var(--ink-2)]">الكمية</span>
          <div className="flex items-center overflow-hidden rounded-2xl border-[1.5px] border-[var(--line)] bg-card">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-12 w-11.5 items-center justify-center hover:bg-[var(--rose-tint)]">
              <Minus className="size-4" />
            </button>
            <span className="w-12.5 text-center text-[1.05rem] font-extrabold">{qty}</span>
            <button type="button" onClick={() => setQty((q) => q + 1)} className="flex h-12 w-11.5 items-center justify-center hover:bg-[var(--rose-tint)]">
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-3.5">
          <button
            type="button"
            onClick={handleAdd}
            className="min-w-45 flex-1 rounded-full bg-gradient-to-br from-[var(--rose)] to-[var(--rose-deep)] px-6 py-4 text-[0.92rem] font-extrabold text-white shadow-[0_8px_22px_rgba(224,114,140,.35)] transition-all hover:-translate-y-0.75"
          >
            أضيفي إلى السلة
          </button>
          {settings.waEnabled !== false && (
            <button
              type="button"
              onClick={handleWhatsApp}
              className="min-w-45 flex-1 rounded-full bg-gradient-to-br from-[#1A7A34] to-[#25D366] px-6 py-4 text-[0.92rem] font-extrabold text-white shadow-[0_8px_25px_rgba(37,211,102,.4)] transition-all hover:-translate-y-0.75"
            >
              محادثة في واتساب
            </button>
          )}
        </div>

        {sellerOrderNum ? (
          <SellerOrderBadge orderNum={sellerOrderNum} />
        ) : (
          <SellerOrderTrigger onClick={() => setSellerModalOpen(true)} />
        )}
        <SellerOrderModal
          product={product}
          qty={qty}
          settings={settings}
          open={sellerModalOpen}
          onClose={() => setSellerModalOpen(false)}
          onSuccess={(num) => {
            setSellerOrderNum(num);
            setSellerModalOpen(false);
          }}
        />

        <div className="rounded-[18px] border border-[var(--line-2)] bg-card p-4.5 shadow-[var(--shadow)]">
          {META_ROWS.map((row) => (
            <div key={row.label} className="flex items-center gap-3 py-2.5 text-[0.86rem] text-muted-foreground">
              <span className="flex size-8.5 shrink-0 items-center justify-center rounded-[10px] bg-[var(--gold-soft)]">
                <row.icon className="size-4.5 text-[var(--gold)]" />
              </span>
              <span>
                {row.label} <b className="font-bold text-foreground">{row.strong}</b>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

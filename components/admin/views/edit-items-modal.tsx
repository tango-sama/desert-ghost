"use client";

import { useState } from "react";
import { priceFmt, type Product } from "@/lib/firebase";
import type { Order } from "@/lib/admin";
import { updateDocIn } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { btn, rowActions } from "@/components/admin/ui";
import { ProductPicker, cartFromOrderItems, type CartItem } from "@/components/admin/product-picker";

// Lets staff change what's in an ALREADY-PLACED order — add/remove
// products, adjust quantities — reusing the exact same picker widget the
// new-order modal uses. Only ever rendered (see orders-view.tsx) while the
// order has no carrier tracking yet, matching the existing rule for the
// other pre-shipping-only edits on this card (delivery label / parcel price
// override): once a real parcel exists, its manifest was already built from
// the original items, so this repo doesn't try to silently keep it in sync.
export function EditItemsModal({
  order,
  products,
  onClose,
  onSaved,
  toast,
}: {
  order: Order;
  products: Product[];
  onClose: () => void;
  onSaved: (id: string, patch: Partial<Order>) => void;
  toast: (msg: string) => void;
}) {
  const [items, setItems] = useState<CartItem[]>(() => cartFromOrderItems(order.items ?? [], products));
  const [showError, setShowError] = useState(false);
  const [saving, setSaving] = useState(false);

  const subtotal = items.reduce((n, it) => n + it.price * it.qty, 0);
  const deliveryFee = order.deliveryFee ?? 0;
  const total = subtotal + deliveryFee;

  async function save() {
    if (!items.length) {
      setShowError(true);
      return;
    }
    setSaving(true);
    const patch: Partial<Order> = {
      items: items.map((it) => ({ id: it.id, title: it.title, price: it.price, qty: it.qty, image: it.image })),
      subtotal,
      total,
    };
    try {
      await updateDocIn("orders", order.id, patch);
      onSaved(order.id, patch);
      toast("تم تحديث منتجات الطلب ✓");
      onClose();
    } catch (err) {
      console.error("[DS] updateDocIn (edit items)", err);
      toast("تعذّر حفظ التعديل، حاولي مجدداً.");
    }
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-[500] flex items-start justify-center overflow-y-auto bg-black/60 p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="my-auto w-full max-w-[460px] rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-lg)]">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-[1.05rem] font-extrabold">
            ✏️ تعديل منتجات الطلب {order.num != null ? `#${order.num}` : ""}
          </h3>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="text-[var(--ink-3)]">
            ✕
          </button>
        </div>

        <ProductPicker products={products} items={items} setItems={setItems} hasError={showError} />

        <div className="mb-4 mt-3 rounded-[11px] bg-[var(--card-2)] p-4 text-[.9rem]">
          <div className="mb-1.5 flex justify-between text-[var(--ink-2)]">
            <span>المنتجات</span>
            <span className="num">{priceFmt(subtotal)}</span>
          </div>
          <div className="mb-1.5 flex justify-between text-[var(--ink-2)]">
            <span>التوصيل</span>
            <span>{priceFmt(deliveryFee)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-1.5 text-base font-black">
            <span>الإجمالي</span>
            <span className="text-[var(--rose)]">{priceFmt(total)}</span>
          </div>
        </div>

        <div className={cn(rowActions, "justify-end")}>
          <button type="button" className={btn("gray")} onClick={onClose}>
            إلغاء
          </button>
          <button type="button" disabled={saving} className={btn("rose")} onClick={save}>
            {saving ? "⏳ جاري الحفظ..." : "✅ حفظ التعديلات"}
          </button>
        </div>
      </div>
    </div>
  );
}

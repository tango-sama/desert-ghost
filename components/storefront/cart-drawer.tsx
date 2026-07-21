"use client";

import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { priceFmt } from "@/lib/firebase";
import { useCartStore, cartTotal } from "@/stores/cart-store";

export function CartDrawer() {
  const isOpen = useCartStore((s) => s.isOpen);
  const close = useCartStore((s) => s.close);
  const items = useCartStore((s) => s.items);
  const setQty = useCartStore((s) => s.setQty);
  const remove = useCartStore((s) => s.remove);
  const total = cartTotal(items);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent side="left" className="w-[min(420px,92vw)]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-lg">
            <ShoppingBag className="size-5" /> سلة المشتريات
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          {items.length === 0 ? (
            <div className="py-12 text-center font-semibold text-muted-foreground">
              <div className="mb-4 text-5xl">🛍️</div>
              السلة فارغة حالياً
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 rounded-2xl border border-[var(--line-2)] bg-card p-3"
                >
                  <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {item.image && (
                      // eslint-disable-next-line @next/next/no-img-element -- admin-pasted URL, arbitrary host
                      <img src={item.image} alt={item.title} className="size-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-bold">{item.title}</div>
                    <div className="mt-0.5 text-sm font-extrabold text-[var(--rose-deep)]">
                      {priceFmt(item.price)}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQty(item.id, item.qty - 1)}
                        className="flex size-7 items-center justify-center rounded-lg border border-border bg-muted hover:bg-[var(--rose-tint)]"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="min-w-6 text-center font-extrabold">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => setQty(item.id, item.qty + 1)}
                        className="flex size-7 items-center justify-center rounded-lg border border-border bg-muted hover:bg-[var(--rose-tint)]"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="إزالة"
                    onClick={() => remove(item.id)}
                    className="self-start p-1.5 text-[var(--rose)]"
                  >
                    <Trash2 className="size-4.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <SheetFooter className="border-t border-border bg-card">
            <div className="mb-2 flex items-center justify-between text-lg font-black">
              <span>المجموع</span>
              <span className="text-[var(--rose-deep)]">{priceFmt(total)}</span>
            </div>
            <Button render={<a href="/checkout" />} className="rounded-full" size="lg">
              إتمام الطلب
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

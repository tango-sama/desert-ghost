import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/lib/firebase";
import { priceNum, productImages } from "@/lib/firebase";

export type CartItem = {
  id: string;
  title: string;
  price: number;
  image: string;
  qty: number;
};

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  add: (product: Product, opts?: { silent?: boolean }) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      add: (product, opts) => {
        const items = get().items;
        const existing = items.find((i) => i.id === product.id);
        const next = existing
          ? items.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i))
          : [
              ...items,
              {
                id: product.id,
                title: product.title || product.name || "",
                price: priceNum(product.price),
                image: productImages(product)[0] || "",
                qty: 1,
              },
            ];
        set({ items: next, isOpen: opts?.silent ? get().isOpen : true });
      },
      remove: (id) => set({ items: get().items.filter((i) => i.id !== id) }),
      setQty: (id, qty) =>
        set({
          items: get().items.map((i) =>
            i.id === id ? { ...i, qty: Math.max(1, qty) } : i
          ),
        }),
      clear: () => set({ items: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    { name: "ds_cart", partialize: (state) => ({ items: state.items }) }
  )
);

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.qty, 0);
}

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.qty * i.price, 0);
}

"use client";

import { create } from "zustand";
import {
  getProducts,
  getCategories,
  getFeatured,
  getSettings,
  type Product,
  type Category,
  type Featured,
  type SiteSettings,
} from "@/lib/firebase";
import {
  getOrders,
  getMessages,
  getExpenses,
  watchOrders,
  watchExpenses,
  type Order,
  type MessageDoc,
  type Expense,
} from "@/lib/admin";

// One shared store per panel session, mirroring the old amelhadj.html
// `state` object. Orders and expenses additionally stay live via
// onSnapshot (the old panel's watchLedger) so new orders and ledger
// entries appear without a reload.

type AdminStore = {
  loaded: boolean;
  products: Product[];
  categories: Category[];
  featured: Featured[];
  orders: Order[];
  messages: MessageDoc[];
  expenses: Expense[];
  settings: SiteSettings;
  toastMsg: string;
  toastKey: number;
  // orders-tab search box (lives in the sticky topbar, filters OrdersView)
  ordersSearch: string;
  setOrdersSearch: (q: string) => void;
  toast: (msg: string) => void;
  loadAll: () => Promise<void>;
  stopWatchers: () => void;
};

let unsubOrders: (() => void) | null = null;
let unsubExpenses: (() => void) | null = null;

export const useAdminStore = create<AdminStore>()((set) => ({
  loaded: false,
  products: [],
  categories: [],
  featured: [],
  orders: [],
  messages: [],
  expenses: [],
  settings: {},
  toastMsg: "",
  toastKey: 0,
  ordersSearch: "",

  setOrdersSearch: (q) => set({ ordersSearch: q }),

  toast: (msg) => set((s) => ({ toastMsg: msg, toastKey: s.toastKey + 1 })),

  loadAll: async () => {
    const [products, categories, featured, orders, messages, settings, expenses] =
      await Promise.all([
        getProducts(),
        getCategories(),
        getFeatured(),
        getOrders(),
        getMessages(),
        getSettings(),
        getExpenses(),
      ]);
    set({ loaded: true, products, categories, featured, orders, messages, settings, expenses });
    if (!unsubOrders) unsubOrders = watchOrders((o) => set({ orders: o }));
    if (!unsubExpenses) unsubExpenses = watchExpenses((e) => set({ expenses: e }));
  },

  stopWatchers: () => {
    unsubOrders?.();
    unsubExpenses?.();
    unsubOrders = null;
    unsubExpenses = null;
  },
}));

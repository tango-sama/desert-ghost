"use client";

import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/admin";
import { setStaffFlag } from "@/hooks/use-staff";
import { useAdminStore } from "@/stores/admin-store";
import { cn } from "@/lib/utils";
import { ProductsView } from "@/components/admin/views/products-view";
import { CategoriesView } from "@/components/admin/views/categories-view";
import { FeaturedView } from "@/components/admin/views/featured-view";
import { OrdersView } from "@/components/admin/views/orders-view";
import { MessagesView } from "@/components/admin/views/messages-view";
import { IncomeView } from "@/components/admin/views/income-view";
import { SettingsView } from "@/components/admin/views/settings-view";

type ViewKey =
  | "products"
  | "categories"
  | "featured"
  | "orders"
  | "messages"
  | "income"
  | "settings";

const NAV: { key: ViewKey; icon: string; label: string }[] = [
  { key: "products", icon: "🧴", label: "المنتجات" },
  { key: "categories", icon: "📁", label: "التصنيفات" },
  { key: "featured", icon: "⭐", label: "المميزة" },
  { key: "orders", icon: "📦", label: "الطلبات" },
  { key: "messages", icon: "💬", label: "الرسائل" },
  { key: "income", icon: "💰", label: "الأرباح" },
  { key: "settings", icon: "⚙️", label: "الإعدادات" },
];

const TITLES: Record<ViewKey, string> = {
  products: "المنتجات",
  categories: "التصنيفات",
  featured: "المنتجات المميزة",
  orders: "الطلبات",
  messages: "رسائل الزبائن",
  income: "الأرباح والمصاريف",
  settings: "إعدادات الموقع",
};

const VIEWS: Record<ViewKey, React.ComponentType> = {
  products: ProductsView,
  categories: CategoriesView,
  featured: FeaturedView,
  orders: OrdersView,
  messages: MessagesView,
  income: IncomeView,
  settings: SettingsView,
};

export function AdminShell() {
  const [view, setView] = useState<ViewKey>("products");
  const [menuOpen, setMenuOpen] = useState(false);
  const loaded = useAdminStore((s) => s.loaded);
  const ordersSearch = useAdminStore((s) => s.ordersSearch);
  const setOrdersSearch = useAdminStore((s) => s.setOrdersSearch);
  const nProducts = useAdminStore((s) => s.products.length);
  const nCats = useAdminStore((s) => s.categories.length);
  const nFeat = useAdminStore((s) => s.featured.length);
  const nNewOrders = useAdminStore(
    (s) => s.orders.filter((o) => !o.fulfilled).length
  );
  const nMsgs = useAdminStore((s) => s.messages.length);

  useEffect(() => {
    void useAdminStore.getState().loadAll();
    return () => useAdminStore.getState().stopWatchers();
  }, []);

  const badges: Partial<Record<ViewKey, number>> = {
    products: nProducts,
    categories: nCats,
    featured: nFeat,
    orders: nNewOrders,
    messages: nMsgs,
  };

  const ActiveView = VIEWS[view];

  return (
    <div>
      {/* backdrop that closes the mobile sidebar */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-10 hidden max-[860px]:block"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 bottom-0 right-0 z-20 flex w-[230px] flex-col border-l border-border bg-card transition-transform duration-250",
          menuOpen
            ? "max-[860px]:translate-x-0 max-[860px]:shadow-[-4px_0_30px_rgba(0,0,0,.5)]"
            : "max-[860px]:translate-x-full"
        )}
      >
        <div className="border-b border-border px-[1.4rem] py-6">
          <div className="bg-gradient-to-br from-[var(--rose)] to-[var(--gold)] bg-clip-text text-[1.15rem] font-black text-transparent">
            جمالكِ الخارجي
          </div>
          <div className="mt-0.5 text-[.62rem] uppercase tracking-[2px] text-[var(--ink-3)]">
            ADMIN PANEL
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map((n) => (
            <button
              key={n.key}
              type="button"
              onClick={() => {
                setView(n.key);
                setMenuOpen(false);
                setOrdersSearch("");
              }}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 border-r-[3px] px-[1.4rem] py-[.7rem] text-right text-[.9rem] transition-colors",
                view === n.key
                  ? "border-[var(--rose)] bg-[rgba(224,114,140,.1)] text-[var(--rose)]"
                  : "border-transparent text-[var(--ink-2)] hover:bg-[rgba(255,255,255,.03)] hover:text-foreground"
              )}
            >
              <span className="w-[22px] text-center text-[1.05rem]">{n.icon}</span>
              {n.label}
              {badges[n.key] != null && (
                <span
                  className={cn(
                    "mr-auto min-w-[20px] rounded-full px-2 py-px text-center text-[.7rem] font-extrabold",
                    n.key === "orders"
                      ? "bg-[rgba(224,114,140,.2)] text-[var(--rose-badge)]"
                      : "bg-[var(--card-2)] text-[var(--ink-2)]"
                  )}
                >
                  {badges[n.key]}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="border-t border-border px-[1.4rem] py-4">
          <a
            href="/"
            target="_blank"
            className="mb-2 block w-full rounded-[10px] border border-border bg-[var(--card-2)] py-[.55rem] text-center text-[.82rem] text-[var(--ink-2)]"
          >
            🌐 عرض المتجر
          </a>
          <button
            type="button"
            onClick={() => {
              setStaffFlag(false);
              void signOut(auth);
            }}
            className="block w-full cursor-pointer rounded-[10px] border border-border bg-[var(--card-2)] py-[.55rem] text-center text-[.82rem] text-[var(--ink-2)] transition-colors hover:border-destructive hover:text-destructive"
          >
            🔒 تسجيل الخروج
          </button>
        </div>
      </aside>

      <main className="mr-[230px] min-h-screen px-8 py-7 pt-0 max-[860px]:mr-0">
        {/* sticky topbar: title (+ the orders search box) stay visible
            while scrolling the list */}
        <div className="sticky top-0 z-10 -mx-8 mb-4 flex flex-wrap items-center justify-between gap-4 bg-background/95 px-8 py-4 backdrop-blur max-[860px]:ps-[calc(42px+.9rem)]">
          {/* stays fixed while scrolling on mobile, above the sidebar so it
              can close it too */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="hidden h-[42px] w-[42px] cursor-pointer rounded-xl border border-border bg-card text-[1.2rem] text-foreground max-[860px]:fixed max-[860px]:top-4 max-[860px]:start-4 max-[860px]:z-30 max-[860px]:block max-[860px]:shadow-[0_4px_14px_rgba(0,0,0,.45)]"
          >
            ☰
          </button>
          <h1 className="text-2xl font-black">{TITLES[view]}</h1>
          {view === "orders" ? (
            <input
              value={ordersSearch}
              onChange={(e) => setOrdersSearch(e.target.value)}
              placeholder="🔍 بحث: اسم، هاتف، رقم طلب..."
              className="min-w-[220px] flex-1 rounded-full border-[1.5px] border-input bg-[var(--card-2)] px-4 py-[.55rem] text-foreground outline-none placeholder:text-[var(--ink-3)] focus:border-[var(--rose)] max-w-[340px]"
            />
          ) : (
            <div />
          )}
        </div>
        {loaded ? (
          <ActiveView />
        ) : (
          <div className="py-20 text-center font-bold text-[var(--ink-3)]">
            ⏳ جاري تحميل البيانات...
          </div>
        )}
      </main>
    </div>
  );
}

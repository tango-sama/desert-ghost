"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Menu, Search, ShoppingCart, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartStore, cartCount } from "@/stores/cart-store";
import type { SiteSettings } from "@/lib/firebase";

// The header's second deck. Three zones, RTL-first: brand at the start,
// search in the middle, cart at the end. The search field is *visible* from
// md up rather than hidden behind a toggle — on a 15-category catalog it is
// the fastest path to a product, and a search box shoppers can see gets used.
// Below md there is no room for it, so the old icon-toggle panel is kept.
//
// `children` is the category strip (a server component, so it costs nothing
// in this bundle). It is rendered inside the same fixed stack so the whole
// header moves as one; `--header-h` in globals.css is its total height.
export function Nav({
  settings,
  children,
}: {
  settings: SiteSettings;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const items = useCartStore((s) => s.items);
  const openCart = useCartStore((s) => s.open);
  const count = cartCount(items);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/products?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
    setQuery("");
  }

  return (
    <header className="fixed inset-x-0 top-[var(--announce-h)] z-50">
      <div
        className={cn(
          "bg-[var(--cream)]/92 backdrop-blur-md transition-shadow duration-300",
          scrolled && "shadow-[0_6px_24px_rgba(224,114,140,.10)]"
        )}
      >
        <div className="mx-auto flex h-[var(--nav-h)] max-w-[1320px] items-center gap-4 px-5 md:gap-8 md:px-12">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <Image
              src="/assets/logo.webp"
              alt={settings.storeName || "Desert Shop"}
              width={46}
              height={46}
              priority
              className="h-10 w-auto object-contain md:h-12"
            />
            <span className="flex flex-col leading-tight">
              <span className="bg-gradient-to-br from-[var(--rose-deep)] to-[var(--gold)] bg-clip-text text-base font-extrabold text-transparent md:text-lg">
                جمالكِ الخارجي
              </span>
              <span className="mt-0.5 hidden text-[0.58rem] tracking-[3px] text-[var(--ink-3)] uppercase sm:block">
                {settings.storeName || "Desert Shop"}
              </span>
            </span>
          </Link>

          {/* md+: the search field itself, not a button that reveals one */}
          <form
            onSubmit={submitSearch}
            role="search"
            className="hidden min-w-0 flex-1 items-center gap-2.5 rounded-full border border-[var(--line)] bg-card px-5 py-2.5 shadow-[0_1px_3px_rgba(224,114,140,.06)] transition-colors focus-within:border-[var(--rose-soft)] md:flex"
          >
            <Search className="size-4.5 shrink-0 text-[var(--ink-3)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحثي عن أي منتج في الموقع..."
              aria-label="بحث"
              className="min-w-0 flex-1 bg-transparent text-[0.88rem] text-foreground outline-none placeholder:text-[var(--ink-3)]"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-gradient-to-br from-[var(--rose)] to-[var(--rose-deep)] px-5 py-1.5 text-[0.78rem] font-extrabold text-white transition-all hover:shadow-[0_6px_16px_rgba(224,114,140,.4)]"
            >
              بحث
            </button>
          </form>

          <div className="flex shrink-0 items-center gap-1 ms-auto md:ms-0">
            <button
              type="button"
              aria-label="بحث"
              aria-expanded={searchOpen}
              onClick={() => {
                setSearchOpen((v) => !v);
                setMenuOpen(false);
              }}
              className="flex p-2 text-foreground md:hidden"
            >
              {searchOpen ? <X className="size-5.5" /> : <Search className="size-5.5" />}
            </button>
            <button
              type="button"
              aria-label="السلة"
              onClick={openCart}
              className="relative flex p-2 text-foreground transition-colors hover:text-[var(--rose-deep)]"
            >
              <ShoppingCart className="size-5.5 md:size-6" />
              {count > 0 && (
                <span className="absolute top-0 end-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--rose)] px-1 text-[0.66rem] font-extrabold text-white">
                  <span className="num">{count}</span>
                </span>
              )}
            </button>
            <button
              type="button"
              aria-label="القائمة"
              aria-expanded={menuOpen}
              className="flex p-2 md:hidden"
              onClick={() => {
                setMenuOpen((v) => !v);
                setSearchOpen(false);
              }}
            >
              {menuOpen ? <X className="size-5.5" /> : <Menu className="size-5.5" />}
            </button>
          </div>
        </div>

        {children}
      </div>

      {searchOpen && (
        <form
          onSubmit={submitSearch}
          role="search"
          className="flex items-center gap-3 border-b border-border bg-[var(--cream)]/98 p-4 shadow-lg backdrop-blur-md md:hidden"
        >
          <Search className="size-4.5 shrink-0 text-[var(--ink-3)]" />
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحثي عن أي منتج في الموقع..."
            aria-label="بحث"
            className="min-w-0 flex-1 bg-transparent text-[0.92rem] text-foreground outline-none placeholder:text-[var(--ink-3)]"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-gradient-to-br from-[var(--rose)] to-[var(--rose-deep)] px-5 py-2 text-[0.82rem] font-extrabold text-white"
          >
            بحث
          </button>
        </form>
      )}

      {menuOpen && (
        <ul className="flex flex-col gap-5 border-b border-border bg-[var(--cream)]/98 p-6 text-center shadow-lg backdrop-blur-md md:hidden">
          {[
            { href: "/", label: "الرئيسية" },
            { href: "/products", label: "المنتجات" },
            { href: "/categories", label: "التصنيفات" },
            { href: "/#contact", label: "تواصلي معنا" },
          ].map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="text-sm font-semibold text-[var(--ink-2)]"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}

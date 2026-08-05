"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Menu, Search, ShoppingCart, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartStore, cartCount } from "@/stores/cart-store";
import type { SiteSettings } from "@/lib/firebase";

const NAV_LINKS = [
  { href: "/", label: "الرئيسية" },
  { href: "/products", label: "المنتجات" },
  { href: "/categories", label: "التصنيفات" },
  { href: "/#contact", label: "تواصلي معنا" },
];

export function Nav({ settings }: { settings: SiteSettings }) {
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
  }

  return (
    <nav
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-300",
        "flex items-center justify-between px-5 py-4 md:px-12",
        scrolled &&
          "bg-background/90 backdrop-blur-md border-b border-border shadow-sm py-3"
      )}
    >
      <Link href="/" className="flex items-center gap-3">
        <Image src="/assets/logo.webp" alt={settings.storeName || "Desert Shop"} width={46} height={46} className="h-11 w-auto object-contain" />
        <span className="flex flex-col leading-tight">
          <span className="bg-gradient-to-br from-[var(--rose-deep)] to-[var(--gold)] bg-clip-text text-lg font-extrabold text-transparent">
            جمالكِ الخارجي
          </span>
          <span className="mt-0.5 text-[0.58rem] tracking-[3px] text-[var(--ink-3)] uppercase">
            {settings.storeName || "Desert Shop"}
          </span>
        </span>
      </Link>

      <ul className="hidden items-center gap-9 md:flex">
        {NAV_LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="relative text-sm font-semibold text-[var(--ink-2)] transition-colors hover:text-[var(--rose-deep)]"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="بحث"
          onClick={() => {
            setSearchOpen((v) => !v);
            setMenuOpen(false);
          }}
          className="flex p-1.5 text-foreground"
        >
          {searchOpen ? <X className="size-6" /> : <Search className="size-6" />}
        </button>
        <button
          type="button"
          aria-label="السلة"
          onClick={openCart}
          className="relative flex p-1.5 text-foreground"
        >
          <ShoppingCart className="size-6" />
          {count > 0 && (
            <span className="absolute -top-1 -left-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--rose)] px-1 text-[0.66rem] font-extrabold text-white">
              {count}
            </span>
          )}
        </button>
        <button
          type="button"
          aria-label="القائمة"
          className="flex flex-col gap-1.5 p-1 md:hidden"
          onClick={() => {
            setMenuOpen((v) => !v);
            setSearchOpen(false);
          }}
        >
          {menuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {searchOpen && (
        <form
          onSubmit={submitSearch}
          className="fixed inset-x-0 top-[62px] z-40 flex items-center gap-3 border-b border-border bg-background/98 p-4 shadow-lg backdrop-blur-md md:px-12"
        >
          <Search className="size-4.5 shrink-0 text-[var(--ink-3)]" />
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحثي عن أي منتج في الموقع..."
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
        <ul className="fixed inset-x-0 top-[62px] z-40 flex flex-col gap-5 border-b border-border bg-background/98 p-6 text-center shadow-lg backdrop-blur-md md:hidden">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} onClick={() => setMenuOpen(false)} className="text-sm font-semibold text-[var(--ink-2)]">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

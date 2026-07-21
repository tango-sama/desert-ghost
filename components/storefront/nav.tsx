"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, ShoppingCart, X } from "lucide-react";
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
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const items = useCartStore((s) => s.items);
  const openCart = useCartStore((s) => s.open);
  const count = cartCount(items);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

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

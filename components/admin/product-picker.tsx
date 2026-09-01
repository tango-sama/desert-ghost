"use client";

// Shared "search a catalog product, add it to a cart" widget — used by both
// the new-order modal (components/admin/views/new-order-modal.tsx) and the
// edit-existing-order-items modal (components/admin/views/edit-items-modal.tsx)
// so the add/qty/remove behavior and markup can't drift between the two.
import { useState } from "react";
import { priceFmt, priceNum, productImages, type Product } from "@/lib/firebase";
import type { OrderItem } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { inp, transparent } from "@/components/admin/ui";

export type CartItem = { id: string | number; title: string; price: number; qty: number; image: string };

// Normalizes an existing order's items[] (old docs may carry `quantity`
// instead of `qty`, a string price, or no `image` at all) into the cart
// shape this picker edits — backfilling a missing image from the live
// catalog by id when one isn't stored on the order itself.
export function cartFromOrderItems(items: OrderItem[], products: Product[]): CartItem[] {
  return items.map((it) => {
    const p = products.find((x) => String(x.id) === String(it.id));
    return {
      id: it.id ?? "",
      title: it.title || p?.title || p?.name || "",
      price: priceNum(it.price),
      qty: it.qty ?? it.quantity ?? 1,
      image: it.image || (p ? productImages(p)[0] || "" : ""),
    };
  });
}

// Comparison key for product names: accent-, case- and punctuation-blind, so
// a parcel's own wording matches the catalog entry it came from.
function nameKey(s: string): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .trim();
}

// Whether `needle` occurs in `hay` on whole-word boundaries — both are
// nameKey() output, so words are single-space separated.
function wordContains(hay: string, needle: string): boolean {
  return (
    hay === needle ||
    hay.startsWith(`${needle} `) ||
    hay.endsWith(` ${needle}`) ||
    hay.includes(` ${needle} `)
  );
}

// The catalog products named by a parcel's own product list — used when an
// existing parcel is linked to a new order («ربط طلب»), so the products the
// courier is already carrying come across instead of being re-picked by hand.
//
// The format is the one every create*Parcel function writes for this store
// ("<title> x2, <title> x1" — see trinkl's functions/index.js), and it is what
// all three carriers hand back on lookup, so one parser serves Yalidine,
// Noest and ZR alike. Anything unrecognised — a hand-typed label, the 'cosm'
// placeholder, a product no longer in the catalog — is skipped rather than
// guessed at, leaving the admin to pick it as before.
export function cartFromParcelLabel(label: string, products: Product[]): CartItem[] {
  const out: CartItem[] = [];
  for (const part of String(label ?? "").split(/[,،+\n]/)) {
    const chunk = part.trim();
    if (!chunk) continue;
    // Trailing "x2" / "×2" / "*2" is the quantity, not part of the name.
    const m = chunk.match(/[x×*]\s*(\d{1,3})$/i);
    const qty = m ? Math.max(1, parseInt(m[1], 10)) : 1;
    const key = nameKey(m ? chunk.slice(0, m.index) : chunk);
    if (!key) continue;
    const hit =
      products.find((p) => nameKey(p.title || p.name || "") === key) ??
      // A carrier can truncate a long label (Yalidine caps product_list at
      // 250 chars), so fall back to containment — but only across whole
      // words, so a short catalog name can't be swallowed by an unrelated
      // one ("Kit" must not match "Kitchen towel").
      products.find((p) => {
        const t = nameKey(p.title || p.name || "");
        return t.length >= 3 && (wordContains(t, key) || wordContains(key, t));
      });
    if (!hit) continue;
    const at = out.findIndex((it) => String(it.id) === String(hit.id));
    if (at >= 0) out[at] = { ...out[at], qty: out[at].qty + qty };
    else out.push({
      id: hit.id,
      title: hit.title || hit.name || "",
      price: priceNum(hit.price),
      qty,
      image: productImages(hit)[0] || "",
    });
  }
  return out;
}

export function addToCart(items: CartItem[], p: Product): CartItem[] {
  const title = p.title || p.name || "";
  const idx = items.findIndex((it) => String(it.id) === String(p.id));
  if (idx >= 0) {
    const next = [...items];
    next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
    return next;
  }
  return [...items, { id: p.id, title, price: priceNum(p.price), qty: 1, image: productImages(p)[0] || "" }];
}

export function ProductPicker({
  products,
  items,
  setItems,
  hasError,
}: {
  products: Product[];
  items: CartItem[];
  setItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  hasError?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const matches =
    showSuggestions && query.trim().length >= 1
      ? products
          .filter((p) => (p.title || p.name || "").toLowerCase().includes(query.trim().toLowerCase()))
          .slice(0, 8)
      : [];

  function add(p: Product) {
    setItems((cur) => addToCart(cur, p));
    setQuery("");
    setShowSuggestions(false);
  }

  function setQty(id: string | number, qty: number) {
    setItems((cur) => cur.map((it) => (String(it.id) === String(id) ? { ...it, qty } : it)));
  }

  function removeItem(id: string | number) {
    setItems((cur) => cur.filter((it) => String(it.id) !== String(id)));
  }

  return (
    <>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setShowSuggestions(false);
              return;
            }
            if (e.key !== "Enter") return;
            // This box lives inside the order form. Enter here means "add
            // the product I just typed" — left to the browser it would
            // instead submit that form, saving the order mid-pick (or, with
            // nothing picked yet, just flashing the field red).
            e.preventDefault();
            if (matches.length) add(matches[0]);
          }}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
          placeholder="اكتبي اسم المنتج لإضافته..."
          autoComplete="off"
          className={cn(inp, hasError && items.length === 0 && "border-destructive")}
        />
        {matches.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-[11px] border border-border bg-card shadow-[var(--shadow-lg)]">
            {matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(p)}
                className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-right text-[.82rem] last:border-0 hover:bg-[var(--card-2)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={productImages(p)[0] || transparent()} alt="" className="size-8 rounded-md object-cover" />
                <span className="flex-1 font-bold">{p.title || p.name}</span>
                <span className="text-[var(--ink-3)]">{priceFmt(p.price)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-2 rounded-[11px] bg-[var(--card-2)] p-3">
          {items.map((it) => (
            <div key={String(it.id)} className="mb-2 flex items-center gap-2 text-[.84rem] last:mb-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.image || transparent()} alt="" className="size-8 rounded-md object-cover" />
              <span className="flex-1 truncate font-bold">{it.title}</span>
              <button
                type="button"
                onClick={() => setQty(it.id, Math.max(1, it.qty - 1))}
                className="size-6 cursor-pointer rounded-md border border-border text-[.8rem]"
              >
                −
              </button>
              <span className="w-5 text-center num">{it.qty}</span>
              <button
                type="button"
                onClick={() => setQty(it.id, it.qty + 1)}
                className="size-6 cursor-pointer rounded-md border border-border text-[.8rem]"
              >
                +
              </button>
              <span className="w-16 text-left num">{priceFmt(it.price * it.qty)}</span>
              <button
                type="button"
                onClick={() => removeItem(it.id)}
                className="text-[var(--ink-3)] hover:text-destructive"
                aria-label="حذف"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

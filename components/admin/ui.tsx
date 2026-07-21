"use client";

// Shared visual recipes for the /amelhadj admin panel — Tailwind ports of
// the old amelhadj.html style block (.inp, .btn-*, .card, table, pager...).
// All colors come from the .admin token set in app/globals.css.

import { cn } from "@/lib/utils";
import { uploadImage } from "@/lib/admin";

export const inp =
  "w-full rounded-[11px] border-[1.5px] border-input bg-[var(--card-2)] px-[.9rem] py-[.7rem] text-[.9rem] text-foreground outline-none transition-colors placeholder:text-[var(--ink-3)] focus:border-[var(--rose)]";
export const sel = cn(inp, "cursor-pointer");
export const txt = cn(inp, "min-h-[90px] resize-y");

export type BtnVariant = "green" | "rose" | "blue" | "gray" | "danger";

export function btn(variant: BtnVariant, sm = false) {
  return cn(
    "inline-flex cursor-pointer items-center gap-1.5 font-extrabold transition-all hover:-translate-y-px hover:brightness-110 disabled:pointer-events-none disabled:opacity-60",
    sm
      ? "rounded-lg px-[.8rem] py-[.4rem] text-[.78rem]"
      : "rounded-[11px] px-[1.3rem] py-[.7rem] text-[.88rem]",
    variant === "green" && "bg-[var(--green)] text-white",
    variant === "rose" &&
      "bg-gradient-to-br from-[var(--rose)] to-[var(--rose-deep)] text-white",
    variant === "blue" && "bg-[var(--blue)] text-white",
    variant === "danger" && "bg-destructive text-white",
    variant === "gray" && "border border-border bg-[var(--card-2)] text-[var(--ink-2)]"
  );
}

export const cardCls = "mb-6 rounded-[18px] border border-border bg-card p-6";
export const cardH3 =
  "mb-[1.1rem] border-b border-border pb-3 text-[1.05rem] font-extrabold";
export const lblCls =
  "mb-[.45rem] block text-[.78rem] font-bold text-[var(--ink-2)]";
export const grid2 = "grid grid-cols-2 gap-4 max-[860px]:grid-cols-1";
export const tagCls =
  "inline-block rounded-full border border-border bg-[var(--card-2)] px-[9px] py-[2px] text-[.72rem] text-[var(--ink-2)]";
export const tagOk =
  "inline-block rounded-full bg-[var(--ok-bg)] px-[9px] py-[2px] text-[.72rem] text-[var(--ok-ink)]";
export const tagInfo =
  "inline-block rounded-full bg-[var(--info-bg)] px-[9px] py-[2px] text-[.72rem] text-[var(--info-ink)]";
export const uploadLbl =
  "inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-dashed border-border bg-[var(--card-2)] px-4 py-[.55rem] text-[.82rem] font-bold text-[var(--ink-2)] transition-colors hover:border-[var(--rose)] hover:text-foreground";
export const thumbPrev =
  "h-16 w-16 rounded-[10px] border border-border bg-[var(--card-2)] object-cover";
export const rowActions = "flex flex-wrap gap-1.5";

export const tblWrap = "overflow-hidden rounded-[18px] border border-border bg-card";
export const thCls =
  "border-b border-border p-[.8rem] text-right text-[.75rem] font-bold uppercase tracking-[.5px] text-[var(--ink-3)]";
export const tdCls =
  "border-b border-border p-[.8rem] text-right align-middle text-[.85rem]";

export const orderCardCls =
  "mb-4 rounded-2xl border border-border bg-card p-5";
export const orderItemsCls =
  "my-2 rounded-[11px] bg-[var(--card-2)] px-4 py-3 text-[.84rem] text-[var(--ink-2)]";

export function Field({
  label,
  full,
  children,
}: {
  label: React.ReactNode;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mb-4", full && "col-span-full")}>
      <label className={lblCls}>{label}</label>
      {children}
    </div>
  );
}

export function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="px-4 py-14 text-center font-bold text-[var(--ink-3)]">
      <div className="mb-3 text-5xl">{icon}</div>
      {text}
    </div>
  );
}

export function Pager({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (n: number) => void;
}) {
  if (pages <= 1) return null;
  const items: (number | "gap")[] = [];
  for (let i = 1; i <= pages; i++) {
    if (pages > 7 && i > 2 && i < pages - 1 && Math.abs(i - page) > 1) {
      if (i === 3 || i === pages - 2) items.push("gap");
      continue;
    }
    items.push(i);
  }
  return (
    <div className="mt-5 flex justify-center gap-1.5">
      {items.map((it, idx) =>
        it === "gap" ? (
          <span key={`g${idx}`} className="self-center text-[var(--ink-3)]">
            …
          </span>
        ) : (
          <button
            key={it}
            type="button"
            onClick={() => onPage(it)}
            className={cn(
              "h-[38px] w-[38px] cursor-pointer rounded-[10px] border border-border bg-card font-bold text-[var(--ink-2)]",
              it === page && "border-transparent bg-[var(--rose)] text-white"
            )}
          >
            {it}
          </button>
        )
      )}
    </div>
  );
}

// 64px placeholder square matching the admin's elevated surface color.
export function transparent(): string {
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#2E222A"/><text x="50%" y="54%" font-size="28" text-anchor="middle">🖼️</text></svg>'
    )
  );
}

// Open a file picker, convert to WebP, upload to Storage, hand back the URL.
export function pickImage(
  folder: string,
  toast: (m: string) => void,
  cb: (url: string) => void
) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = () => {
    const f = input.files?.[0];
    if (!f) return;
    toast("جاري رفع الصورة...");
    uploadImage(f, folder)
      .then((url) => {
        cb(url);
        toast("تم رفع الصورة ✓");
      })
      .catch((e) => {
        console.error(e);
        toast("فشل رفع الصورة");
      });
  };
  input.click();
}

// 0XXXXXXXXX → 213XXXXXXXXX for wa.me links.
export function waIntl(phone: string | undefined | null): string {
  return String(phone ?? "").replace(/\s/g, "").replace(/^0/, "213");
}

export function fmtDate(d: Date | number | string | null | undefined): string {
  if (d == null || d === "") return "";
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleString("ar-DZ");
}

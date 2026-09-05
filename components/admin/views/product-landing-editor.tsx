"use client";

// Per-product content for the templated landing page at /offer.
//
// /offer renders for ANY catalog product without a line being written here —
// lib/landing-content.ts falls back to the product's own description, then to
// its category, then to what she answered in the quiz. This tab is what makes
// the page deep for the handful of products actually being advertised, and it
// is the ONLY way three of its sections ever appear at all:
//
//   • before/after photos — never generated, never illustrative
//   • per-product reviews — never generated
//   • ingredients — never generated
//
// (See the honesty rules at the top of lib/landing-content.ts.) Everything
// else here is an override: blank means "keep what the page generates".
//
// STORED ON THE PRODUCT DOCUMENT (`products/<id>.landing`), not under
// site_settings like the four hand-built funnels. site_settings is one
// document and 149 products of landing copy would run at the 1 MB limit; the
// product doc is already public-read/admin-write, so neither placement needs a
// rules change. Written with a merge so nothing else on the product is
// touched, and products-view.tsx saves edits with updateDoc, so an ordinary
// product edit leaves `landing` alone.
import { useMemo, useState } from "react";
import {
  priceFmt,
  productImages,
  type LandingBaItem,
  type Product,
  type ProductLanding,
} from "@/lib/firebase";
import { setDocIn } from "@/lib/admin";
import { useAdminStore } from "@/stores/admin-store";
import { cn } from "@/lib/utils";
import {
  Field,
  btn,
  cardCls,
  cardH3,
  inp,
  lblCls,
  rowActions,
  thumbPrev,
  transparent,
  txt,
  uploadLbl,
  pickImage,
} from "@/components/admin/ui";

const BA_SLOTS = 3;

type Row = Record<string, string>;
type ColumnSpec = { key: string; label: string; wide?: boolean; numeric?: boolean };

/**
 * A repeatable list of rows, each a handful of short text fields.
 *
 * One widget for benefits, ingredients, usage steps, questions and reviews —
 * they differ only in their columns, and five bespoke editors would drift.
 * Blank rows are dropped on save rather than rejected, so leaving a spare row
 * empty is never an error the owner has to understand.
 */
function RowList({
  title,
  hint,
  cols,
  rows,
  onChange,
  addLabel,
}: {
  title: string;
  hint: string;
  cols: ColumnSpec[];
  rows: Row[];
  onChange: (rows: Row[]) => void;
  addLabel: string;
}) {
  function set(i: number, key: string, v: string) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  }
  return (
    <div className={cardCls}>
      <h3 className={cardH3}>{title}</h3>
      <div className="mb-3 text-[.78rem] text-[var(--ink-3)]">{hint}</div>
      {rows.map((r, i) => (
        <div key={i} className="mb-3 rounded-[14px] border border-border bg-[var(--card-2)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[.75rem] font-bold text-[var(--ink-3)]">#{i + 1}</span>
            <button
              type="button"
              className={btn("danger", true)}
              onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
            >
              🗑 حذف
            </button>
          </div>
          {cols.map((c) => (
            <div key={c.key} className="mb-2 last:mb-0">
              <label className={lblCls}>{c.label}</label>
              {c.wide ? (
                <textarea
                  className={txt}
                  value={r[c.key] ?? ""}
                  onChange={(e) => set(i, c.key, e.target.value)}
                />
              ) : (
                <input
                  className={inp}
                  type={c.numeric ? "number" : "text"}
                  {...(c.numeric ? { min: 1, max: 5 } : {})}
                  value={r[c.key] ?? ""}
                  onChange={(e) => set(i, c.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      ))}
      <button type="button" className={btn("gray", true)} onClick={() => onChange([...rows, {}])}>
        ＋ {addLabel}
      </button>
    </div>
  );
}

type BaForm = { title: string; text: string; before: string; after: string };

function baFromSaved(saved: LandingBaItem[] | undefined): BaForm[] {
  return Array.from({ length: BA_SLOTS }, (_, i) => ({
    title: saved?.[i]?.title ?? "",
    text: saved?.[i]?.text ?? "",
    before: saved?.[i]?.before ?? "",
    after: saved?.[i]?.after ?? "",
  }));
}

/** Trim every field, then drop rows where the fields that matter are blank. */
function cleanRows(rows: Row[], required: string[]): Row[] {
  return rows
    .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? "").trim()])))
    .filter((r) => required.some((k) => r[k]));
}

// Keyed by product id in the parent, so picking a different product remounts
// this with fresh initial state instead of syncing props to state in an effect
// — the same reset-via-key pattern PageEditor uses in landing-pages-view.tsx.
function Editor({ product, toast }: { product: Product; toast: (m: string) => void }) {
  const saved: ProductLanding = product.landing ?? {};
  const [headline, setHeadline] = useState(saved.headline ?? "");
  const [subhead, setSubhead] = useState(saved.subhead ?? "");
  const [benefits, setBenefits] = useState<Row[]>(
    () => (saved.benefits ?? []).map((b) => ({ ic: b.ic ?? "", title: b.title ?? "", text: b.text ?? "" })),
  );
  const [ingredients, setIngredients] = useState<Row[]>(
    () => (saved.ingredients ?? []).map((x) => ({ name: x.name ?? "", text: x.text ?? "" })),
  );
  const [usage, setUsage] = useState<Row[]>(
    () => (saved.usage ?? []).map((u) => ({ ic: u.ic ?? "", p: u.p ?? "" })),
  );
  const [faq, setFaq] = useState<Row[]>(
    () => (saved.faq ?? []).map((f) => ({ q: f.q ?? "", a: f.a ?? "" })),
  );
  const [reviews, setReviews] = useState<Row[]>(
    () =>
      (saved.reviews ?? []).map((r) => ({
        stars: r.stars ? String(r.stars) : "5",
        text: r.text ?? "",
        name: r.name ?? "",
        where: r.where ?? "",
      })),
  );
  const [ba, setBa] = useState<BaForm[]>(() => baFromSaved(saved.beforeAfter));
  const [saving, setSaving] = useState(false);

  function setSlot(i: number, patch: Partial<BaForm>) {
    setBa((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function save() {
    const landing: ProductLanding = {
      headline: headline.trim(),
      subhead: subhead.trim(),
      benefits: cleanRows(benefits, ["title", "text"]).map((r) => ({
        ic: r.ic,
        title: r.title,
        text: r.text,
      })),
      ingredients: cleanRows(ingredients, ["name"]).map((r) => ({ name: r.name, text: r.text })),
      usage: cleanRows(usage, ["p"]).map((r) => ({ ic: r.ic, p: r.p })),
      faq: cleanRows(faq, ["q", "a"])
        .filter((r) => r.q && r.a)
        .map((r) => ({ q: r.q, a: r.a })),
      reviews: cleanRows(reviews, ["text"]).map((r) => ({
        // Clamped here as well as in the engine: a 9-star review typed by
        // accident must not reach the document, not just fail to render.
        stars: Math.min(5, Math.max(1, Math.round(Number(r.stars) || 5))),
        text: r.text,
        name: r.name,
        where: r.where,
      })),
      // A pair needs BOTH photos to count. One-sided slots are unfinished
      // entries, not half a comparison, and the page skips them either way.
      beforeAfter: ba
        .map((s) => ({
          title: s.title.trim(),
          text: s.text.trim(),
          before: s.before.trim(),
          after: s.after.trim(),
        }))
        .filter((s) => s.before && s.after),
    };
    setSaving(true);
    try {
      // Merge, not replace: this must never touch price, stock, images or
      // anything else on the product document.
      await setDocIn("products", product.id, { landing }, true);
      useAdminStore.setState((st) => ({
        products: st.products.map((p) =>
          String(p.id) === String(product.id) ? { ...p, landing } : p,
        ),
      }));
      toast("تم حفظ محتوى صفحة المنتج ✓");
    } catch (e) {
      console.error(e);
      toast("فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  const preview = `/offer?ids=${encodeURIComponent(String(product.id))}`;
  const photo = productImages(product)[0] || "";

  return (
    <div>
      <div className={cardCls}>
        <h3 className={cardH3}>🧾 المنتج</h3>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={thumbPrev} src={photo || transparent()} alt="" />
          <div className="min-w-0">
            <div className="text-[.95rem] font-extrabold">{product.title ?? product.name}</div>
            <div className="text-[.8rem] text-[var(--ink-3)]">{priceFmt(product.price)}</div>
            <a
              className="text-[.78rem] font-bold text-[var(--blue)] underline"
              href={preview}
              target="_blank"
              rel="noreferrer"
              dir="ltr"
            >
              {preview}
            </a>
          </div>
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={cardH3}>✍️ العنوان والمقدّمة</h3>
        <div className="mb-3 text-[.78rem] text-[var(--ink-3)]">
          اتركيهما فارغين وستكتبهما الصفحة تلقائياً من اسم المنتج وتصنيفه.
        </div>
        <Field label="العنوان الرئيسي">
          <input className={inp} value={headline} onChange={(e) => setHeadline(e.target.value)} />
        </Field>
        <Field label="السطر التعريفي">
          <textarea className={txt} value={subhead} onChange={(e) => setSubhead(e.target.value)} />
        </Field>
      </div>

      <RowList
        title="✨ الفوائد"
        hint="اتركيها فارغة وستُبنى من «الفوائد والمميزات» المكتوبة في تبويب المنتجات."
        cols={[
          { key: "ic", label: "أيقونة (إيموجي)" },
          { key: "title", label: "العنوان" },
          { key: "text", label: "الشرح", wide: true },
        ]}
        rows={benefits}
        onChange={setBenefits}
        addLabel="أضيفي فائدة"
      />

      <RowList
        title="🧪 المكوّنات"
        hint="لا تظهر هذه الفقرة في الصفحة إطلاقاً ما لم تكتبيها هنا — لا نخمّن مكوّنات منتج."
        cols={[
          { key: "name", label: "المكوّن" },
          { key: "text", label: "ماذا يفعل", wide: true },
        ]}
        rows={ingredients}
        onChange={setIngredients}
        addLabel="أضيفي مكوّناً"
      />

      <RowList
        title="📋 طريقة الاستعمال"
        hint="اتركيها فارغة وستستعمل الصفحة خطوات عامة مناسبة لشكل المنتج (كبسولات، كريم، زيت)."
        cols={[
          { key: "ic", label: "أيقونة (إيموجي)" },
          { key: "p", label: "الخطوة", wide: true },
        ]}
        rows={usage}
        onChange={setUsage}
        addLabel="أضيفي خطوة"
      />

      <RowList
        title="❓ أسئلة خاصة بهذا المنتج"
        hint="تُضاف قبل الأسئلة العامة عن الدفع والتوصيل."
        cols={[
          { key: "q", label: "السؤال" },
          { key: "a", label: "الجواب", wide: true },
        ]}
        rows={faq}
        onChange={setFaq}
        addLabel="أضيفي سؤالاً"
      />

      <RowList
        title="⭐ آراء عن هذا المنتج"
        hint="آراء حقيقية فقط. لا تظهر هذه الفقرة ما لم تكتبيها هنا — الصفحة لا تخترع آراء ولا تقييمات."
        cols={[
          { key: "stars", label: "عدد النجوم (1–5)", numeric: true },
          { key: "text", label: "الرأي", wide: true },
          { key: "name", label: "الاسم" },
          { key: "where", label: "الولاية" },
        ]}
        rows={reviews}
        onChange={setReviews}
        addLabel="أضيفي رأياً"
      />

      <div className={cardCls}>
        <h3 className={cardH3}>🖼️ صور قبل / بعد</h3>
        <div className="mb-3 text-[.78rem] text-[var(--ink-3)]">
          لا تظهر هذه الفقرة ما لم ترفعي الصورتين معاً (قبل وبعد) — صورة واحدة لا تكفي،
          والصفحة لا تستعمل صوراً توضيحية من عندها.
        </div>
        {ba.map((slot, i) => (
          <div key={i} className="mb-4 rounded-[14px] border border-border bg-[var(--card-2)] p-3">
            <div className="mb-2 text-[.75rem] font-bold text-[var(--ink-3)]">بطاقة {i + 1}</div>
            <Field label="العنوان">
              <input
                className={inp}
                value={slot.title}
                onChange={(e) => setSlot(i, { title: e.target.value })}
              />
            </Field>
            <Field label="الشرح">
              <textarea
                className={txt}
                value={slot.text}
                onChange={(e) => setSlot(i, { text: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4 max-[860px]:grid-cols-1">
              {(["before", "after"] as const).map((side) => (
                <Field key={side} label={side === "before" ? "صورة قبل" : "صورة بعد"}>
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className={thumbPrev} src={slot[side] || transparent()} alt="" />
                    <input
                      className={inp}
                      style={{ flex: 1 }}
                      dir="ltr"
                      value={slot[side]}
                      onChange={(e) => setSlot(i, { [side]: e.target.value })}
                      placeholder="رابط الصورة"
                    />
                    <button
                      type="button"
                      className={uploadLbl}
                      onClick={() =>
                        pickImage(`landing_product_${product.id}`, toast, (url) =>
                          setSlot(i, { [side]: url }),
                        )
                      }
                    >
                      ⬆ رفع
                    </button>
                  </div>
                </Field>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={rowActions}>
        <button type="button" className={btn("green")} onClick={save} disabled={saving}>
          💾 حفظ محتوى صفحة المنتج
        </button>
      </div>
    </div>
  );
}

export function ProductLandingEditor() {
  const products = useAdminStore((s) => s.products);
  const toast = useAdminStore((s) => s.toast);
  const [query, setQuery] = useState("");
  const [id, setId] = useState("");

  // Products that already have content float to the top: those are the ones
  // being advertised, and they are what she comes back to edit.
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => {
        if (!q) return true;
        return `${p.title ?? ""} ${p.name ?? ""} ${p.subtitle ?? ""}`.toLowerCase().includes(q);
      })
      .sort((a, b) => Number(Boolean(b.landing)) - Number(Boolean(a.landing)))
      .slice(0, 40);
  }, [products, query]);

  const selected = products.find((p) => String(p.id) === id);

  return (
    <div>
      <div className={cardCls}>
        <h3 className={cardH3}>🛍️ اختاري منتجاً</h3>
        <div className="mb-3 text-[.78rem] text-[var(--ink-3)]">
          كل منتجات المتجر لها صفحة هبوط جاهزة على <span dir="ltr">/offer</span> بدون أي إدخال هنا.
          هذه الصفحة تُعمّق محتوى المنتجات التي تعلنين عنها فعلاً.
        </div>
        <Field label="بحث">
          <input
            className={inp}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="اسم المنتج..."
          />
        </Field>
        <div className={rowActions}>
          {list.map((p) => (
            <button
              key={String(p.id)}
              type="button"
              onClick={() => setId(String(p.id))}
              className={cn(
                btn("gray", true),
                String(p.id) === id && "border-transparent bg-[var(--rose)] text-white",
              )}
            >
              {p.landing ? "✓ " : ""}
              {p.title ?? p.name}
            </button>
          ))}
          {!list.length && (
            <span className="text-[.8rem] text-[var(--ink-3)]">لا توجد نتائج</span>
          )}
        </div>
      </div>

      {selected && <Editor key={String(selected.id)} product={selected} toast={toast} />}
    </div>
  );
}

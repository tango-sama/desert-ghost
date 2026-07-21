"use client";

import { useMemo, useState } from "react";
import { priceFmt, productImages, type Product } from "@/lib/firebase";
import { setDocIn, updateDocIn, deleteDocIn } from "@/lib/admin";
import { useAdminStore } from "@/stores/admin-store";
import {
  inp,
  sel,
  txt,
  btn,
  cardCls,
  cardH3,
  grid2,
  tagCls,
  uploadLbl,
  thumbPrev,
  rowActions,
  tblWrap,
  thCls,
  tdCls,
  Field,
  EmptyState,
  Pager,
  transparent,
  pickImage,
} from "@/components/admin/ui";

type PForm = {
  id: string | number | null;
  title: string;
  subtitle: string;
  price: string;
  category: string;
  image: string;
  images: string[];
  description: string;
};

const EMPTY_FORM: PForm = {
  id: null,
  title: "",
  subtitle: "",
  price: "",
  category: "",
  image: "",
  images: [],
  description: "",
};

const PER_PAGE = 20;

export function ProductsView() {
  const products = useAdminStore((s) => s.products);
  const categories = useAdminStore((s) => s.categories);
  const toast = useAdminStore((s) => s.toast);

  const [form, setForm] = useState<PForm>(EMPTY_FORM);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selIds, setSelIds] = useState<Record<string, boolean>>({});

  const catMap = useMemo(() => {
    const m: Record<string, string> = {};
    categories.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [categories]);

  const list = useMemo(() => {
    let l = products.slice();
    if (filter !== "all") l = l.filter((p) => p.category === filter);
    if (search) {
      const q = search.toLowerCase();
      l = l.filter((p) => String(p.title ?? "").toLowerCase().includes(q));
    }
    return l.sort(
      (a, b) =>
        (Number(b.lastModified ?? b.id) || 0) - (Number(a.lastModified ?? a.id) || 0)
    );
  }, [products, filter, search]);

  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const curPage = Math.min(page, pages);
  const pageItems = list.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE);
  const selCount = Object.keys(selIds).filter((k) => selIds[k]).length;

  function patchProducts(fn: (ps: Product[]) => Product[]) {
    useAdminStore.setState((s) => ({ products: fn(s.products) }));
  }

  function editProduct(id: string | number) {
    const p = products.find((x) => String(x.id) === String(id));
    if (!p) return;
    setForm({
      id: p.id,
      title: p.title ?? p.name ?? "",
      subtitle: p.subtitle ?? "",
      price: String(p.price ?? ""),
      category: p.category ?? "",
      image: p.image ?? productImages(p)[0] ?? "",
      images: Array.isArray(p.images) ? p.images.slice(1) : [],
      description: Array.isArray(p.description)
        ? p.description.join("\n")
        : (p.description ?? ""),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveProduct() {
    if (!form.title || !form.price || !form.category) {
      toast("املئي الاسم والسعر والتصنيف");
      return;
    }
    const existing = form.id
      ? products.find((x) => String(x.id) === String(form.id))
      : undefined;
    const data: Record<string, unknown> = {
      title: form.title,
      subtitle: form.subtitle,
      price: form.price,
      category: form.category,
      image: form.image,
      description: form.description,
      lastModified: Date.now(),
    };
    const allImages = [form.image, ...form.images].filter(Boolean);
    // Write images[] when there are extras — and also when editing a product
    // that already had an images array, so removing extras actually clears
    // them (the old panel left stale arrays behind here).
    if (form.images.length || (existing && Array.isArray(existing.images)))
      data.images = allImages;
    try {
      if (form.id) {
        await updateDocIn("products", form.id, data);
        patchProducts((ps) =>
          ps.map((x) =>
            String(x.id) === String(form.id)
              ? ({ ...x, ...data, id: x.id } as Product)
              : x
          )
        );
      } else {
        const id = Date.now();
        await setDocIn("products", id, { ...data, id });
        patchProducts((ps) => [...ps, { ...data, id } as unknown as Product]);
      }
      toast("تم الحفظ ✓");
      setForm(EMPTY_FORM);
    } catch (e) {
      console.error(e);
      toast("فشل الحفظ");
    }
  }

  async function delProduct(id: string | number) {
    if (!confirm("حذف هذا المنتج؟")) return;
    try {
      await deleteDocIn("products", id);
      patchProducts((ps) => ps.filter((x) => String(x.id) !== String(id)));
      setSelIds((s) => ({ ...s, [String(id)]: false }));
      toast("تم الحذف");
    } catch (e) {
      console.error(e);
      toast("فشل الحذف");
    }
  }

  async function bulkDelete() {
    const ids = Object.keys(selIds).filter((k) => selIds[k]);
    if (!ids.length || !confirm(`حذف ${ids.length} منتج؟`)) return;
    try {
      await Promise.all(ids.map((id) => deleteDocIn("products", id)));
      patchProducts((ps) => ps.filter((x) => !ids.includes(String(x.id))));
      setSelIds({});
      toast("تم الحذف");
    } catch (e) {
      console.error(e);
      toast("فشل الحذف");
    }
  }

  return (
    <div>
      <div className={cardCls}>
        <h3 className={cardH3}>{form.id ? "تعديل منتج" : "إضافة منتج جديد"}</h3>
        <div className={grid2}>
          <Field label="اسم المنتج">
            <input
              className={inp}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="مثال: زيت الأرغان الأصلي"
            />
          </Field>
          <Field label="وصف مختصر (سطر واحد)">
            <input
              className={inp}
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              placeholder="مثال: لعلاج تساقط الشعر"
            />
          </Field>
          <Field label="السعر">
            <input
              className={inp}
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="مثال: 2500 DA"
            />
          </Field>
          <Field label="التصنيف">
            <select
              className={sel}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="">اختر التصنيف</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="الصورة الرئيسية" full>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={thumbPrev}
                src={form.image || transparent()}
                alt=""
              />
              <input
                className={inp}
                style={{ flex: 1 }}
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
                placeholder="رابط الصورة"
              />
              <button
                type="button"
                className={uploadLbl}
                onClick={() =>
                  pickImage("products", toast, (url) =>
                    setForm((f) => ({ ...f, image: url }))
                  )
                }
              >
                ⬆ رفع
              </button>
            </div>
            <div className="mt-3">
              <span className="text-[.78rem] text-[var(--ink-2)]">
                صور إضافية (اختياري)
              </span>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {form.images.map((u, i) => (
                  <div key={`${u}-${i}`} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={u}
                      alt=""
                      className="h-14 w-14 rounded-[9px] border border-border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          images: f.images.filter((_, j) => j !== i),
                        }))
                      }
                      className="absolute -top-1.5 -left-1.5 h-5 w-5 cursor-pointer rounded-full bg-destructive text-[.7rem] leading-none text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className={uploadLbl}
                  onClick={() =>
                    pickImage("products", toast, (url) =>
                      setForm((f) => ({ ...f, images: [...f.images, url] }))
                    )
                  }
                >
                  + صورة
                </button>
              </div>
            </div>
          </Field>
          <Field label="الفوائد والمميزات (كل فائدة في سطر)" full>
            <textarea
              className={txt}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={"الفائدة 1\nالفائدة 2"}
            />
          </Field>
        </div>
        <div className={`${rowActions} mt-2`}>
          <button
            type="button"
            className={btn(form.id ? "blue" : "green")}
            onClick={saveProduct}
          >
            {form.id ? "💾 حفظ التعديلات" : "➕ إضافة المنتج"}
          </button>
          {form.id && (
            <button
              type="button"
              className={btn("gray")}
              onClick={() => setForm(EMPTY_FORM)}
            >
              إلغاء
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className={rowActions}>
          {selCount > 0 && (
            <button type="button" className={btn("danger", true)} onClick={bulkDelete}>
              🗑 حذف ({selCount})
            </button>
          )}
        </div>
        <div className={rowActions}>
          <input
            className="min-w-[220px] rounded-full border-[1.5px] border-input bg-[var(--card-2)] px-4 py-[.55rem] text-foreground outline-none placeholder:text-[var(--ink-3)] focus:border-[var(--rose)]"
            placeholder="بحث..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value.trim());
              setPage(1);
            }}
          />
          <select
            className={sel}
            style={{ width: "auto" }}
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">كل التصنيفات</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={tblWrap}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls} style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={list.length > 0 && list.every((p) => selIds[String(p.id)])}
                    onChange={(e) => {
                      const on = e.target.checked;
                      const next: Record<string, boolean> = { ...selIds };
                      list.forEach((p) => (next[String(p.id)] = on));
                      setSelIds(next);
                    }}
                  />
                </th>
                <th className={thCls} style={{ width: 34 }}>
                  #
                </th>
                <th className={thCls}>المنتج</th>
                <th className={thCls}>السعر</th>
                <th className={thCls}>التصنيف</th>
                <th className={thCls}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length ? (
                pageItems.map((p, i) => (
                  <tr key={p.id}>
                    <td className={tdCls}>
                      <input
                        type="checkbox"
                        checked={!!selIds[String(p.id)]}
                        onChange={(e) =>
                          setSelIds((s) => ({
                            ...s,
                            [String(p.id)]: e.target.checked,
                          }))
                        }
                      />
                    </td>
                    <td className={`${tdCls} num`}>
                      {(curPage - 1) * PER_PAGE + i + 1}
                    </td>
                    <td className={tdCls}>
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={productImages(p)[0] || transparent()}
                          alt=""
                          onError={(e) => {
                            e.currentTarget.src = transparent();
                          }}
                          className="h-[42px] w-[42px] flex-shrink-0 rounded-[9px] bg-[var(--card-2)] object-cover"
                        />
                        <span>{p.title ?? p.name}</span>
                      </div>
                    </td>
                    <td className={tdCls}>{priceFmt(p.price)}</td>
                    <td className={tdCls}>
                      <span className={tagCls}>
                        {catMap[p.category ?? ""] ?? p.category ?? "—"}
                      </span>
                    </td>
                    <td className={tdCls}>
                      <div className={rowActions}>
                        <button
                          type="button"
                          className={btn("blue", true)}
                          onClick={() => editProduct(p.id)}
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          className={btn("danger", true)}
                          onClick={() => delProduct(p.id)}
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icon="🧴" text="لا توجد منتجات" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pager page={curPage} pages={pages} onPage={setPage} />
    </div>
  );
}

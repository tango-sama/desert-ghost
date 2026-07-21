"use client";

import { useMemo, useState } from "react";
import type { Category } from "@/lib/firebase";
import { setDocIn, updateDocIn, deleteDocIn } from "@/lib/admin";
import { useAdminStore } from "@/stores/admin-store";
import {
  inp,
  btn,
  cardCls,
  cardH3,
  grid2,
  tagCls,
  tagOk,
  uploadLbl,
  thumbPrev,
  rowActions,
  tblWrap,
  thCls,
  tdCls,
  Field,
  EmptyState,
  transparent,
  pickImage,
} from "@/components/admin/ui";

const CAT_PALETTE = [
  "#F2A65A",
  "#7FB77E",
  "#5AA9E6",
  "#E07A9E",
  "#C792EA",
  "#5FC9A8",
  "#E6B655",
  "#EF9C8B",
];

type CForm = {
  editId: string | null;
  name: string;
  id: string;
  image: string;
  visible: boolean;
  color: string;
};

export function CategoriesView() {
  const categories = useAdminStore((s) => s.categories);
  const toast = useAdminStore((s) => s.toast);

  const nextColor = CAT_PALETTE[categories.length % CAT_PALETTE.length];
  const [form, setForm] = useState<CForm>({
    editId: null,
    name: "",
    id: "",
    image: "",
    visible: true,
    color: nextColor,
  });
  // hex text field draft — only valid #rrggbb values commit to form.color
  // (the color picker input rejects anything else)
  const [hexDraft, setHexDraft] = useState<string | null>(null);

  const cats = useMemo(
    () =>
      categories
        .slice()
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [categories]
  );

  function patchCats(fn: (cs: Category[]) => Category[]) {
    useAdminStore.setState((s) => ({ categories: fn(s.categories) }));
  }

  function resetForm() {
    setHexDraft(null);
    setForm({
      editId: null,
      name: "",
      id: "",
      image: "",
      visible: true,
      color: CAT_PALETTE[categories.length % CAT_PALETTE.length],
    });
  }

  async function saveCategory() {
    if (!form.name || !form.id) {
      toast("املئي الاسم والمعرّف");
      return;
    }
    if (!form.editId && categories.find((c) => c.id === form.id)) {
      toast("هذا المعرّف موجود مسبقاً");
      return;
    }
    const data: Category = {
      id: form.id,
      name: form.name,
      image: form.image,
      visible: form.visible,
      color: form.color || CAT_PALETTE[0],
    };
    if (form.editId) {
      const ex = categories.find((c) => c.id === form.editId);
      if (ex?.sortOrder != null) data.sortOrder = ex.sortOrder;
    } else {
      data.sortOrder = categories.length;
    }
    try {
      await setDocIn("categories", form.id, data as Record<string, unknown>);
      patchCats((cs) => {
        const idx = cs.findIndex((c) => c.id === form.id);
        if (idx >= 0) return cs.map((c, i) => (i === idx ? data : c));
        return [...cs, data];
      });
      resetForm();
      toast("تم الحفظ ✓");
    } catch (e) {
      console.error(e);
      toast("فشل الحفظ");
    }
  }

  async function delCategory(id: string) {
    if (!confirm("حذف هذا التصنيف؟")) return;
    try {
      await deleteDocIn("categories", id);
      patchCats((cs) => cs.filter((c) => c.id !== id));
      toast("تم الحذف");
    } catch {
      toast("فشل الحذف");
    }
  }

  async function toggleVisible(id: string) {
    const c = categories.find((x) => x.id === id);
    if (!c) return;
    const v = c.visible === false;
    try {
      await updateDocIn("categories", id, { visible: v });
      patchCats((cs) => cs.map((x) => (x.id === id ? { ...x, visible: v } : x)));
    } catch {
      toast("فشل");
    }
  }

  async function moveCat(id: string, dir: -1 | 1) {
    const sorted = cats.slice();
    const i = sorted.findIndex((c) => c.id === id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    const reordered = sorted.map((c, k) => ({ ...c, sortOrder: k }));
    patchCats(() => reordered);
    try {
      await Promise.all(
        reordered.map((c) => updateDocIn("categories", c.id, { sortOrder: c.sortOrder }))
      );
    } catch {
      toast("فشل الترتيب");
    }
  }

  return (
    <div>
      <div className={cardCls}>
        <h3 className={cardH3}>{form.editId ? "تعديل تصنيف" : "إضافة تصنيف"}</h3>
        <div className={grid2}>
          <Field label="اسم التصنيف">
            <input
              className={inp}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="مثال: العناية بالشعر"
            />
          </Field>
          <Field label="المعرّف ID (إنجليزي)">
            <input
              className={inp}
              dir="ltr"
              value={form.id}
              disabled={!!form.editId}
              onChange={(e) => setForm({ ...form, id: e.target.value.trim() })}
              placeholder="hair_care"
            />
          </Field>
          <Field label="لون التصنيف">
            <div className="flex items-center gap-2.5">
              <input
                type="color"
                value={form.color || CAT_PALETTE[0]}
                onChange={(e) => {
                  setForm({ ...form, color: e.target.value });
                  setHexDraft(null);
                }}
                className="h-10 w-12 cursor-pointer rounded-[9px] border border-border bg-transparent p-0.5"
              />
              <input
                className={inp}
                dir="ltr"
                style={{ flex: 1, maxWidth: 140 }}
                value={hexDraft ?? form.color}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setHexDraft(v);
                  if (/^#[0-9a-fA-F]{6}$/.test(v))
                    setForm((f) => ({ ...f, color: v }));
                }}
                onBlur={() => setHexDraft(null)}
              />
              <span className="text-[.78rem] text-[var(--ink-3)]">
                لون زر هذا التصنيف في صفحة المنتجات
              </span>
            </div>
          </Field>
          <Field label="صورة التصنيف" full>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={thumbPrev} src={form.image || transparent()} alt="" />
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
                  pickImage("categories", toast, (url) =>
                    setForm((f) => ({ ...f, image: url }))
                  )
                }
              >
                ⬆ رفع
              </button>
            </div>
          </Field>
        </div>
        <div className={rowActions}>
          <button
            type="button"
            className={btn(form.editId ? "blue" : "green")}
            onClick={saveCategory}
          >
            {form.editId ? "💾 حفظ" : "➕ إضافة"}
          </button>
          {form.editId && (
            <button type="button" className={btn("gray")} onClick={resetForm}>
              إلغاء
            </button>
          )}
        </div>
      </div>

      <div className={tblWrap}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls}>الترتيب</th>
                <th className={thCls}>الصورة</th>
                <th className={thCls}>اللون</th>
                <th className={thCls}>الاسم</th>
                <th className={thCls}>المعرّف</th>
                <th className={thCls}>الظهور</th>
                <th className={thCls}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {cats.length ? (
                cats.map((c, i) => (
                  <tr key={c.id}>
                    <td className={tdCls}>
                      <div className={rowActions}>
                        <button
                          type="button"
                          className={btn("gray", true)}
                          disabled={i === 0}
                          onClick={() => moveCat(c.id, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className={btn("gray", true)}
                          disabled={i === cats.length - 1}
                          onClick={() => moveCat(c.id, 1)}
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td className={tdCls}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.image || transparent()}
                        alt=""
                        className="h-[42px] w-[42px] rounded-[9px] object-cover"
                      />
                    </td>
                    <td className={tdCls}>
                      <span
                        title={c.color ?? ""}
                        className="inline-block h-[26px] w-[26px] rounded-full border border-border"
                        style={{ background: c.color || CAT_PALETTE[0] }}
                      />
                    </td>
                    <td className={tdCls}>{c.name}</td>
                    <td className={tdCls}>
                      <span className={tagCls} dir="ltr">
                        {c.id}
                      </span>
                    </td>
                    <td className={tdCls}>
                      {c.visible === false ? (
                        <span className={tagCls}>مخفي</span>
                      ) : (
                        <span className={tagOk}>ظاهر</span>
                      )}
                    </td>
                    <td className={tdCls}>
                      <div className={rowActions}>
                        <button
                          type="button"
                          className={btn("gray", true)}
                          onClick={() => toggleVisible(c.id)}
                        >
                          {c.visible === false ? "إظهار" : "إخفاء"}
                        </button>
                        <button
                          type="button"
                          className={btn("blue", true)}
                          onClick={() => {
                            setHexDraft(null);
                            setForm({
                              editId: c.id,
                              name: c.name,
                              id: c.id,
                              image: c.image ?? "",
                              visible: c.visible !== false,
                              color: c.color ?? CAT_PALETTE[0],
                            });
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          className={btn("danger", true)}
                          onClick={() => delCategory(c.id)}
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyState icon="📁" text="لا توجد تصنيفات" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

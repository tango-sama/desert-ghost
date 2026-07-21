"use client";

import { useMemo, useState } from "react";
import type { Featured } from "@/lib/firebase";
import { setDocIn, updateDocIn, deleteDocIn } from "@/lib/admin";
import { useAdminStore } from "@/stores/admin-store";
import {
  inp,
  txt,
  btn,
  cardCls,
  cardH3,
  grid2,
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

type FForm = {
  editId: string | number | null;
  productName: string;
  rightText: string;
  leftText: string;
  ctaText: string;
  productLink: string;
  image: string;
};

const EMPTY_FORM: FForm = {
  editId: null,
  productName: "",
  rightText: "",
  leftText: "",
  ctaText: "",
  productLink: "",
  image: "",
};

export function FeaturedView() {
  const featured = useAdminStore((s) => s.featured);
  const toast = useAdminStore((s) => s.toast);
  const [form, setForm] = useState<FForm>(EMPTY_FORM);

  const list = useMemo(
    () => featured.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [featured]
  );

  function patchFeatured(fn: (fs: Featured[]) => Featured[]) {
    useAdminStore.setState((s) => ({ featured: fn(s.featured) }));
  }

  async function saveFeatured() {
    if (!form.productName || !form.image) {
      toast("املئي الاسم والصورة");
      return;
    }
    const data = {
      productName: form.productName,
      rightText: form.rightText,
      leftText: form.leftText,
      ctaText: form.ctaText,
      productLink: form.productLink,
      image: form.image,
    };
    try {
      if (form.editId) {
        const order =
          featured.find((f) => String(f.id) === String(form.editId))?.order ?? 0;
        const docData = { id: form.editId, ...data, order };
        await setDocIn("featured_products", form.editId, docData);
        patchFeatured((fs) =>
          fs.map((f) =>
            String(f.id) === String(form.editId) ? (docData as Featured) : f
          )
        );
        toast("تم الحفظ ✓");
      } else {
        const id = Date.now();
        const docData = { id, ...data, order: featured.length };
        await setDocIn("featured_products", id, docData);
        patchFeatured((fs) => [...fs, docData as unknown as Featured]);
        toast("تم الإضافة ✓");
      }
      setForm(EMPTY_FORM);
    } catch (e) {
      console.error(e);
      toast("فشل");
    }
  }

  async function delFeatured(id: string | number) {
    if (!confirm("حذف؟")) return;
    try {
      await deleteDocIn("featured_products", id);
      patchFeatured((fs) => fs.filter((f) => String(f.id) !== String(id)));
      toast("تم الحذف");
    } catch (e) {
      console.error(e);
      toast("فشل الحذف");
    }
  }

  async function moveFeatured(id: string | number, dir: -1 | 1) {
    const sorted = list.slice();
    const i = sorted.findIndex((f) => String(f.id) === String(id));
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    const reordered = sorted.map((f, k) => ({ ...f, order: k }));
    patchFeatured(() => reordered);
    try {
      await Promise.all(
        reordered.map((f) => updateDocIn("featured_products", f.id, { order: f.order }))
      );
    } catch (e) {
      console.error(e);
      toast("فشل الترتيب");
    }
  }

  return (
    <div>
      <div className={cardCls}>
        <h3 className={cardH3}>
          {form.editId ? "تعديل منتج مميز" : "إضافة منتج مميز"}
        </h3>
        <div className={grid2}>
          <Field label="اسم المنتج" full>
            <input
              className={inp}
              value={form.productName}
              onChange={(e) => setForm({ ...form, productName: e.target.value })}
            />
          </Field>
          <Field label="النص الأيمن">
            <textarea
              className={txt}
              value={form.rightText}
              onChange={(e) => setForm({ ...form, rightText: e.target.value })}
            />
          </Field>
          <Field label="النص الأيسر">
            <textarea
              className={txt}
              value={form.leftText}
              onChange={(e) => setForm({ ...form, leftText: e.target.value })}
            />
          </Field>
          <Field label="نص الزر">
            <input
              className={inp}
              value={form.ctaText}
              onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
              placeholder="تفاصيل أكثر"
            />
          </Field>
          <Field label="الرابط">
            <input
              className={inp}
              dir="ltr"
              value={form.productLink}
              onChange={(e) => setForm({ ...form, productLink: e.target.value })}
              placeholder="product.html?id=..."
            />
          </Field>
          <Field label="الصورة" full>
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
                  pickImage("featured_products", toast, (url) =>
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
            onClick={saveFeatured}
          >
            {form.editId ? "💾 حفظ" : "➕ إضافة"}
          </button>
          {form.editId && (
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

      <div className={tblWrap}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls}>الترتيب</th>
                <th className={thCls}>الصورة</th>
                <th className={thCls}>الاسم</th>
                <th className={thCls}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {list.length ? (
                list.map((f, i) => (
                  <tr key={f.id}>
                    <td className={tdCls}>
                      <div className={rowActions}>
                        <button
                          type="button"
                          className={btn("gray", true)}
                          disabled={i === 0}
                          onClick={() => moveFeatured(f.id, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className={btn("gray", true)}
                          disabled={i === list.length - 1}
                          onClick={() => moveFeatured(f.id, 1)}
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td className={tdCls}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={f.image || transparent()}
                        alt=""
                        className="h-[42px] w-[42px] rounded-[9px] object-cover"
                      />
                    </td>
                    <td className={tdCls}>{f.productName}</td>
                    <td className={tdCls}>
                      <div className={rowActions}>
                        <button
                          type="button"
                          className={btn("blue", true)}
                          onClick={() => {
                            setForm({
                              editId: f.id,
                              productName: f.productName ?? "",
                              rightText: f.rightText ?? "",
                              leftText: f.leftText ?? "",
                              ctaText: f.ctaText ?? "",
                              productLink: f.productLink ?? "",
                              image: f.image ?? "",
                            });
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          className={btn("danger", true)}
                          onClick={() => delFeatured(f.id)}
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>
                    <EmptyState icon="⭐" text="لا توجد منتجات مميزة" />
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

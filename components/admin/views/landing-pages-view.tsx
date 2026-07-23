"use client";

import { useState } from "react";
import {
  LANDING_RESERVED_SLUGS,
  type LandingPageContent,
  type LandingPageKey,
  type LandingProductOverride,
  type SiteSettings,
} from "@/lib/firebase";
import { setDocIn } from "@/lib/admin";
import { useAdminStore } from "@/stores/admin-store";
import { cn } from "@/lib/utils";
import { SUNGUARD_PRODUCT } from "@/components/storefront/sunguard/product";
import { COLLAGEN_PRODUCTS } from "@/components/storefront/collagen/products";
import {
  inp,
  txt,
  btn,
  cardCls,
  cardH3,
  uploadLbl,
  thumbPrev,
  rowActions,
  Field,
  transparent,
  pickImage,
} from "@/components/admin/ui";

// Editable copy for the two self-contained landing funnels (/sunguard,
// /collagen). Placeholders below mirror each page's hardcoded default copy
// (hero.tsx / before-after.tsx in each folder) purely for display — leaving
// a field blank keeps that built-in default, it is never written as text.
const PAGES: { key: LandingPageKey; label: string; folder: string }[] = [
  { key: "sunguard", label: "🍉 واقي الشمس", folder: "landing_sunguard" },
  { key: "collagen", label: "✨ الكولاجين", folder: "landing_collagen" },
];

const HERO_PLACEHOLDER: Record<LandingPageKey, { title: string; lead: string }> = {
  sunguard: {
    title: "بشرتكِ تستحق حماية قصوى من الشمس",
    lead: "واقي شمس بطعم البطيخ والبرتقال، SPF50+ PA++++، يحمي بشرتكِ من الأشعة فوق البنفسجية ويمنع التصبغات والحروق وعلامات الشيخوخة المبكرة — بملمس خفيف غير دهني.",
  },
  collagen: {
    title: "جمالكِ يبدأ من الداخل مع الكولاجين",
    lead: "أربع تركيبات كولاجين مختارة بعناية — بودرة وكبسولات — لبشرة أكثر نضارة، شعر أقوى وأقل تساقطاً، أظافر صحية، ومفاصل أكثر مرونة.",
  },
};

// The before/after grid is 3 fixed slots per page (not a free-form list —
// matches the storefront components, which merge overrides by position).
const BA_SLOTS: Record<LandingPageKey, { label: string; title: string; text: string }[]> = {
  sunguard: [
    { label: "بطاقة 1 — التصبغات", title: "بشرة موحّدة بلا تصبّغات", text: "الحماية اليومية تمنع تكوّن بقع داكنة جديدة وتساعد على توحيد لون البشرة مع الوقت." },
    { label: "بطاقة 2 — الحروق", title: "وداعاً لاحمرار وحروق الشمس", text: "SPF50+ يحجب الأشعة الحارقة ويبقي بشرتكِ هادئة حتى بعد ساعات طويلة في الشمس." },
    { label: "بطاقة 3 — علامات الشيخوخة", title: "بشرة أكثر شباباً لفترة أطول", text: "حجب أشعة UVA يبطئ من ظهور الخطوط الدقيقة الناتجة عن التقدّم في السن بسبب الشمس." },
  ],
  collagen: [
    { label: "بطاقة 1 — الأظافر", title: "أظافر صحية لا تتكسر", text: "بنية أقوى للظفر، نمو أسرع، وتقصف أقل من أول شهر." },
    { label: "بطاقة 2 — الشعر", title: "شعر أقوى وأقل تساقطاً", text: "تغذية للبصيلات من الجذور، تساقط أقل وكثافة ولمعان يزدادان مع الوقت." },
    { label: "بطاقة 3 — البشرة", title: "بشرة أكثر نضارة وإشراقاً", text: "خطوط أدق، ترطيب أعمق، وإشراقة تلاحظينها خلال 4–8 أسابيع من الانتظام." },
  ],
};

type SlotForm = { title: string; text: string; before: string; after: string };

function slotsFromSaved(saved: LandingPageContent | undefined): SlotForm[] {
  return [0, 1, 2].map((i) => ({
    title: saved?.beforeAfter?.[i]?.title ?? "",
    text: saved?.beforeAfter?.[i]?.text ?? "",
    before: saved?.beforeAfter?.[i]?.before ?? "",
    after: saved?.beforeAfter?.[i]?.after ?? "",
  }));
}

// Product fields are editable — title/image/price only, not brand, size, or
// collagen's headline/bullets/icons (those stay page-defined). Defaults come
// straight from each page's real product data, not duplicated text, so the
// placeholders never drift from what actually ships.
const PRODUCT_DEFAULTS: Record<
  LandingPageKey,
  { label: string; title: string; price: number; image: string }[]
> = {
  sunguard: [
    {
      label: "المنتج",
      title: SUNGUARD_PRODUCT.title,
      price: SUNGUARD_PRODUCT.price,
      image: SUNGUARD_PRODUCT.image,
    },
  ],
  collagen: COLLAGEN_PRODUCTS.map((p, i) => ({
    label: `المنتج ${i + 1} — ${p.brand}`,
    title: p.title,
    price: p.price,
    image: p.image,
  })),
};

type ProductForm = { title: string; price: string; image: string };

function productOverrideAt(
  saved: LandingPageContent | undefined,
  page: LandingPageKey,
  i: number
): LandingProductOverride | undefined {
  return page === "sunguard" ? saved?.product : saved?.products?.[i];
}

function productFormFromSaved(saved: LandingPageContent | undefined, page: LandingPageKey): ProductForm[] {
  return PRODUCT_DEFAULTS[page].map((_, i) => {
    const o = productOverrideAt(saved, page, i);
    return {
      title: o?.title ?? "",
      price: o?.price ? String(o.price) : "",
      image: o?.image ?? "",
    };
  });
}

// Keyed by `page` in the parent so switching pages remounts this with a
// fresh initial state (React's reset-via-key pattern) instead of syncing
// props to state in an effect.
function PageEditor({
  page,
  settings,
  toast,
}: {
  page: LandingPageKey;
  settings: SiteSettings;
  toast: (msg: string) => void;
}) {
  const saved = settings.landingPages?.[page];
  const [heroTitle, setHeroTitle] = useState(saved?.hero?.title ?? "");
  const [heroLead, setHeroLead] = useState(saved?.hero?.lead ?? "");
  const [slots, setSlots] = useState<SlotForm[]>(() => slotsFromSaved(saved));
  const [slug, setSlug] = useState(saved?.slug ?? "");
  const [products, setProducts] = useState<ProductForm[]>(() => productFormFromSaved(saved, page));

  function setSlot(i: number, patch: Partial<SlotForm>) {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function setProduct(i: number, patch: Partial<ProductForm>) {
    setProducts((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function slugError(s: string): string | null {
    if (!s) return null; // empty = keep the built-in /sunguard or /collagen route
    if (/[\s/]/.test(s)) return "الرابط يجب أن يكون كلمة واحدة بدون مسافات أو /";
    const other = page === "sunguard" ? "collagen" : "sunguard";
    if (LANDING_RESERVED_SLUGS.includes(s)) return "هذا الرابط محجوز — اختاري رابطاً آخر";
    if (settings.landingPages?.[other]?.slug?.trim() === s)
      return "هذا الرابط مستخدم من طرف الصفحة الأخرى";
    return null;
  }

  async function save() {
    const s = slug.trim();
    const err = slugError(s);
    if (err) {
      toast(err);
      return;
    }
    const current = useAdminStore.getState().settings;
    const docId = String((current as { id?: string }).id ?? "general");
    const productOverrides: LandingProductOverride[] = products.map((p) => ({
      title: p.title.trim(),
      image: p.image.trim(),
      price: p.price.trim() ? Number(p.price.trim()) : 0,
    }));
    const content: LandingPageContent = {
      hero: { title: heroTitle.trim(), lead: heroLead.trim() },
      beforeAfter: slots.map((s) => ({
        title: s.title.trim(),
        text: s.text.trim(),
        before: s.before.trim(),
        after: s.after.trim(),
      })),
      ...(page === "sunguard" ? { product: productOverrides[0] } : { products: productOverrides }),
      slug: s,
    };
    const data: SiteSettings = {
      ...current,
      landingPages: { ...current.landingPages, [page]: content },
      id: docId,
    };
    try {
      await setDocIn("site_settings", docId, data as Record<string, unknown>);
      useAdminStore.setState({ settings: data });
      toast("تم حفظ محتوى الصفحة ✓");
    } catch (e) {
      console.error(e);
      toast("فشل الحفظ");
    }
  }

  const heroPh = HERO_PLACEHOLDER[page];
  const baSlots = BA_SLOTS[page];
  const folder = PAGES.find((p) => p.key === page)!.folder;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const liveSlug = saved?.slug?.trim();
  const currentPath = liveSlug ? `/${liveSlug}` : `/${page}`;

  return (
    <div>
      <div className={cardCls}>
        <h3 className={cardH3}>🔗 رابط الصفحة</h3>
        <div className="mb-3 text-[.78rem] text-[var(--ink-3)]">
          اتركي الحقل فارغاً لإبقاء الرابط الافتراضي (/{page}). الرابط القديم يبقى يعمل دائماً
          ويُحوَّل تلقائياً إلى الرابط الجديد بعد الحفظ.
        </div>
        <Field label="الرابط المخصص">
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-[.85rem] text-[var(--ink-3)]" dir="ltr">
              {origin}/
            </span>
            <input
              className={inp}
              style={{ flex: 1 }}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={page}
            />
          </div>
        </Field>
        <div className="text-[.8rem] text-[var(--ink-2)]">
          الرابط الحالي:{" "}
          <a
            href={currentPath}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-[var(--rose)]"
            dir="ltr"
          >
            {origin}
            {currentPath}
          </a>
        </div>
      </div>

      <div className={cardCls}>
        <h3 className={cardH3}>🖼️ الواجهة (Hero)</h3>
        <div className="mb-3 text-[.78rem] text-[var(--ink-3)]">
          اتركي الحقل فارغاً للإبقاء على النص الافتراضي الحالي للصفحة.
        </div>
        <Field label="العنوان الرئيسي">
          <input
            className={inp}
            value={heroTitle}
            onChange={(e) => setHeroTitle(e.target.value)}
            placeholder={heroPh.title}
          />
        </Field>
        <Field label="الوصف (تحت العنوان)">
          <textarea
            className={txt}
            value={heroLead}
            onChange={(e) => setHeroLead(e.target.value)}
            placeholder={heroPh.lead}
          />
        </Field>
      </div>

      <div className={cardCls}>
        <h3 className={cardH3}>🧴 {page === "sunguard" ? "المنتج" : "المنتجات"}</h3>
        <div className="mb-4 text-[.78rem] text-[var(--ink-3)]">
          الاسم والسعر والصورة قابلون للتعديل — التفاصيل الأخرى (المكوّنات، النقاط، الألوان) تبقى كما هي. اتركي أي
          حقل فارغاً للإبقاء على قيمته الافتراضية.
        </div>
        {PRODUCT_DEFAULTS[page].map((slot, i) => (
          <div key={slot.label} className="mb-5 border-b border-border pb-5 last:mb-0 last:border-b-0 last:pb-0">
            <div className="mb-3 text-[.85rem] font-bold text-[var(--ink-2)]">{slot.label}</div>
            <div className={cn("grid grid-cols-2 gap-4 max-[860px]:grid-cols-1")}>
              <Field label="الاسم">
                <input
                  className={inp}
                  value={products[i]?.title ?? ""}
                  onChange={(e) => setProduct(i, { title: e.target.value })}
                  placeholder={slot.title}
                />
              </Field>
              <Field label="السعر (د.ج)">
                <input
                  className={inp}
                  type="number"
                  min={0}
                  dir="ltr"
                  value={products[i]?.price ?? ""}
                  onChange={(e) => setProduct(i, { price: e.target.value })}
                  placeholder={String(slot.price)}
                />
              </Field>
            </div>
            <Field label="الصورة">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={thumbPrev} src={products[i]?.image || slot.image} alt="" />
                <input
                  className={inp}
                  style={{ flex: 1 }}
                  dir="ltr"
                  value={products[i]?.image ?? ""}
                  onChange={(e) => setProduct(i, { image: e.target.value })}
                  placeholder={slot.image}
                />
                <button
                  type="button"
                  className={uploadLbl}
                  onClick={() => pickImage(folder, toast, (url) => setProduct(i, { image: url }))}
                >
                  ⬆ رفع
                </button>
              </div>
            </Field>
          </div>
        ))}
      </div>

      <div className={cardCls}>
        <h3 className={cardH3}>↔️ قبل / بعد</h3>
        <div className="mb-4 text-[.78rem] text-[var(--ink-3)]">
          {page === "sunguard"
            ? "العنوان والنص قابلان للتعديل دائماً. الصور اختيارية — إذا رفعتِ صورتَي «قبل» و«بعد» معاً تُستبدل الرسوم التوضيحية بصور حقيقية؛ اتركيهما فارغتين للإبقاء على الرسوم."
            : "العنوان والنص قابلان للتعديل دائماً. اتركي الصور فارغة للإبقاء على صور المنتج الافتراضية — يجب رفع صورتَي «قبل» و«بعد» معاً لتبديل الزوج."}
        </div>
        {baSlots.map((slot, i) => (
          <div key={slot.label} className="mb-5 border-b border-border pb-5 last:mb-0 last:border-b-0 last:pb-0">
            <div className="mb-3 text-[.85rem] font-bold text-[var(--ink-2)]">{slot.label}</div>
            <Field label="العنوان">
              <input
                className={inp}
                value={slots[i]?.title ?? ""}
                onChange={(e) => setSlot(i, { title: e.target.value })}
                placeholder={slot.title}
              />
            </Field>
            <Field label="النص">
              <textarea
                className={txt}
                value={slots[i]?.text ?? ""}
                onChange={(e) => setSlot(i, { text: e.target.value })}
                placeholder={slot.text}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4 max-[860px]:grid-cols-1">
              <Field label="صورة قبل">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={thumbPrev} src={slots[i]?.before || transparent()} alt="" />
                  <input
                    className={inp}
                    style={{ flex: 1 }}
                    dir="ltr"
                    value={slots[i]?.before ?? ""}
                    onChange={(e) => setSlot(i, { before: e.target.value })}
                    placeholder="رابط الصورة"
                  />
                  <button
                    type="button"
                    className={uploadLbl}
                    onClick={() => pickImage(folder, toast, (url) => setSlot(i, { before: url }))}
                  >
                    ⬆ رفع
                  </button>
                </div>
              </Field>
              <Field label="صورة بعد">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={thumbPrev} src={slots[i]?.after || transparent()} alt="" />
                  <input
                    className={inp}
                    style={{ flex: 1 }}
                    dir="ltr"
                    value={slots[i]?.after ?? ""}
                    onChange={(e) => setSlot(i, { after: e.target.value })}
                    placeholder="رابط الصورة"
                  />
                  <button
                    type="button"
                    className={uploadLbl}
                    onClick={() => pickImage(folder, toast, (url) => setSlot(i, { after: url }))}
                  >
                    ⬆ رفع
                  </button>
                </div>
              </Field>
            </div>
          </div>
        ))}
      </div>

      <div className={rowActions}>
        <button type="button" className={btn("green")} onClick={save}>
          💾 حفظ محتوى الصفحة
        </button>
      </div>
    </div>
  );
}

export function LandingPagesView() {
  const settings = useAdminStore((s) => s.settings);
  const toast = useAdminStore((s) => s.toast);
  const [page, setPage] = useState<LandingPageKey>("sunguard");

  return (
    <div>
      <div className={cn(rowActions, "mb-5")}>
        {PAGES.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPage(p.key)}
            className={cn(btn("gray"), page === p.key && "border-transparent bg-[var(--rose)] text-white")}
          >
            {p.label}
          </button>
        ))}
      </div>
      <PageEditor key={page} page={page} settings={settings} toast={toast} />
    </div>
  );
}

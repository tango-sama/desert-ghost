"use client";

import { useMemo, useState } from "react";
import { priceFmt, saveOrder, type Product } from "@/lib/firebase";
import type { Order } from "@/lib/admin";
import { generateOrderNumber } from "@/lib/order";
import { deriveExistingClients, searchClients, type ExistingClient } from "@/lib/clients";
import { cn } from "@/lib/utils";
import { CO } from "@/components/admin/carriers";
import { ProductPicker, type CartItem } from "@/components/admin/product-picker";
import {
  CARRIER_ORDER,
  carrierDataReady,
  centersForCarrier,
  communesForCarrier,
  feeForCarrier,
  isValidPhone,
  wilayaForCarrier,
  wilayasFor,
  type Carrier,
  type CarrierCache,
  type DeliveryType,
} from "@/lib/delivery";
import { inp, sel, btn, Field, rowActions } from "@/components/admin/ui";

const EMPTY: {
  name: string;
  phone: string;
  wilayaId: string;
  commune: string;
  address: string;
  deliveryType: DeliveryType;
  insurance: boolean;
} = {
  name: "",
  phone: "",
  wilayaId: "",
  commune: "",
  address: "",
  deliveryType: "home",
  insurance: false,
};

export function NewOrderModal({
  open,
  onClose,
  orders,
  products,
  cache,
  toast,
}: {
  open: boolean;
  onClose: () => void;
  orders: Order[];
  products: Product[];
  cache: CarrierCache;
  toast: (msg: string) => void;
}) {
  const [selectedCompany, setSelectedCompany] = useState<Carrier | null>(null);
  const company = selectedCompany ?? "noest";

  const [name, setName] = useState(EMPTY.name);
  const [phone, setPhone] = useState(EMPTY.phone);
  const [wilayaId, setWilayaId] = useState(EMPTY.wilayaId);
  const [commune, setCommune] = useState(EMPTY.commune);
  const [address, setAddress] = useState(EMPTY.address);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(EMPTY.deliveryType);
  const [insurance, setInsurance] = useState(EMPTY.insurance);
  const [items, setItems] = useState<CartItem[]>([]);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  // Derived only from orders already loaded in the admin store — no extra
  // Firestore reads. See lib/clients.ts for why this stays admin-only.
  const clients = useMemo(() => deriveExistingClients(orders), [orders]);
  const clientSuggestions =
    showClientSuggestions && name.trim().length >= 2 ? searchClients(clients, name) : [];

  function resetAndClose() {
    setSelectedCompany(null);
    setName(EMPTY.name);
    setPhone(EMPTY.phone);
    setWilayaId(EMPTY.wilayaId);
    setCommune(EMPTY.commune);
    setAddress(EMPTY.address);
    setDeliveryType(EMPTY.deliveryType);
    setInsurance(EMPTY.insurance);
    setItems([]);
    setErrors({});
    onClose();
  }

  // Picking a suggestion replaces the whole form snapshot atomically (name,
  // phone, carrier, wilaya, commune/desk, address) from that client's last
  // order — unlike selectCompany/selectWilaya below, which only clear
  // dependent fields for an in-progress MANUAL edit.
  function selectClient(c: ExistingClient) {
    setShowClientSuggestions(false);
    setName(c.customer);
    setPhone(c.phone);
    const co = (["yalidine", "noest", "zr"] as Carrier[]).includes(c.deliveryCompany as Carrier)
      ? (c.deliveryCompany as Carrier)
      : company;
    setSelectedCompany(co);
    setWilayaId(c.wilayaId != null ? String(c.wilayaId) : "");
    const isOfficeClient = c.deliveryType === "office";
    setDeliveryType(isOfficeClient ? "office" : "home");
    if (isOfficeClient && c.wilayaId != null) {
      // Stop-desk orders save the desk's own NAME as baladiya (see
      // handleSubmit's communeLabel), but the select below is keyed by the
      // desk's id — resolve the id from that name against this carrier's
      // live desk list instead of trusting the stored name as a value
      // directly (React state for the new carrier/wilaya isn't committed
      // yet at this point in the function, so this reads the cache prop
      // directly rather than the derived `deskOptions` in render scope).
      const desks = centersForCarrier(co, c.wilayaId, cache);
      const match = desks.find((d) => d.name === c.baladiya);
      setCommune(match ? String(match.id) : "");
    } else {
      setCommune(c.baladiya || "");
    }
    setAddress(c.address || "");
  }

  function selectCompany(c: Carrier) {
    setSelectedCompany(c);
    setWilayaId("");
    setDeliveryType("home");
    setCommune("");
  }

  function selectWilaya(id: string) {
    setWilayaId(id);
    setCommune("");
  }

  function selectDeliveryType(type: DeliveryType) {
    setDeliveryType(type);
    setCommune("");
  }

  const carrierReady = carrierDataReady(company, cache);
  const wilayaList = carrierReady ? wilayasFor(company, cache) : [];
  const selectedWilaya = carrierReady && wilayaId ? wilayaForCarrier(company, wilayaId, cache) : null;
  const communeOptions = selectedWilaya ? communesForCarrier(company, selectedWilaya.id, cache) : [];
  const deskOptions = selectedWilaya ? centersForCarrier(company, selectedWilaya.id, cache) : [];
  const isOffice = deliveryType === "office";
  const selectedDesk = isOffice ? deskOptions.find((d) => String(d.id) === commune) ?? null : null;
  const communeValue = isOffice ? (selectedDesk ? commune : "") : communeOptions.includes(commune) ? commune : "";
  const communeLabel = isOffice ? selectedDesk?.name ?? "" : communeValue;
  // Yalidine's Home fee varies by destination COMMUNE within the wilaya
  // (its own "Supplément commune") — Stop Desk has no commune of its own
  // (the customer picks a specific desk, not an address), so only the Home
  // lookup is ever sharpened to a commune.
  const homeCommune = isOffice ? undefined : communeValue || undefined;
  const feeHome = selectedWilaya ? feeForCarrier(company, selectedWilaya.id, "home", cache, homeCommune) : null;
  const feeOffice = selectedWilaya ? feeForCarrier(company, selectedWilaya.id, "office", cache) : null;
  const deliveryFee = selectedWilaya ? feeForCarrier(company, selectedWilaya.id, deliveryType, cache, homeCommune) : 0;

  const subtotal = items.reduce((n, it) => n + it.price * it.qty, 0);
  const total = subtotal + deliveryFee;

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const bad: Record<string, boolean> = {
      name: !name.trim(),
      phone: !phone.trim() || !isValidPhone(phone),
      wilaya: !wilayaId,
      commune: !communeValue,
      address: deliveryType === "home" && !address.trim(),
      items: items.length === 0,
    };
    setErrors(bad);
    if (Object.values(bad).some(Boolean)) return;

    setSubmitting(true);
    const num = generateOrderNumber();
    const order = {
      num,
      customer: name.trim(),
      phone: phone.trim(),
      wilaya: selectedWilaya?.ar || "",
      wilayaId: selectedWilaya?.id ?? null,
      wilayaFr: selectedWilaya?.fr || "",
      baladiya: communeLabel,
      address: deliveryType === "home" ? address.trim() : "",
      deliveryCompany: company,
      deliveryType,
      deliveryFee,
      insurance: company === "yalidine" && insurance,
      items: items.map((it) => ({ id: it.id, title: it.title, price: it.price, qty: it.qty, image: it.image })),
      subtotal,
      total,
      // Same tag the storefront checkout uses when staff enters an order on
      // a customer's behalf — orders-view.tsx already renders it as
      // "📞 أدخلتيه بنفسك" and excludes it from the customer-order neon halo.
      source: "admin_phone",
    };
    try {
      await saveOrder(order);
      toast(`تم إنشاء الطلب ${num} ✓`);
      resetAndClose();
    } catch (err) {
      console.error("[DS] saveOrder (admin new order)", err);
      toast("تعذّر إنشاء الطلب، حاولي مجدداً.");
    }
    setSubmitting(false);
  }

  function errCls(hasError?: boolean) {
    return cn(inp, hasError && "border-destructive");
  }

  return (
    <div
      className="fixed inset-0 z-[500] flex items-start justify-center overflow-y-auto bg-black/60 p-6"
      onClick={(e) => e.target === e.currentTarget && resetAndClose()}
    >
      <div className="my-auto w-full max-w-[560px] rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-lg)]">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-[1.05rem] font-extrabold">➕ إضافة طلب جديد</h3>
          <button type="button" onClick={resetAndClose} aria-label="إغلاق" className="text-[var(--ink-3)]">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3 max-[500px]:grid-cols-1">
            <Field label="اسم الزبون *">
              <div className="relative">
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setShowClientSuggestions(true);
                  }}
                  onFocus={() => setShowClientSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowClientSuggestions(false), 120)}
                  placeholder="اكتبي الاسم للبحث عن زبون سابق..."
                  autoComplete="off"
                  className={errCls(errors.name)}
                />
                {clientSuggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-[11px] border border-border bg-card shadow-[var(--shadow-lg)]">
                    {clientSuggestions.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectClient(c)}
                        className="flex w-full flex-col gap-0.5 border-b border-border px-3 py-2 text-right text-[.82rem] last:border-0 hover:bg-[var(--card-2)]"
                      >
                        <span className="font-extrabold">{c.customer}</span>
                        <span className="text-[.74rem] text-[var(--ink-3)]" dir="ltr">
                          {c.phone} {c.wilaya && `— ${c.wilaya}`} · {c.orderCount} طلب{c.orderCount > 1 ? "ات" : ""} سابق
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>
            <Field label="رقم الهاتف *">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                dir="ltr"
                placeholder="0X XX XX XX XX"
                className={cn(errCls(errors.phone), "text-right")}
              />
            </Field>
          </div>

          <Field label="شركة التوصيل">
            <div className="grid grid-cols-3 gap-2">
              {CARRIER_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectCompany(id)}
                  style={
                    company === id
                      ? { borderColor: CO[id].color, background: `${CO[id].color}18` }
                      : undefined
                  }
                  className="flex items-center gap-1.5 rounded-[11px] border-[1.5px] border-border px-3 py-2 text-[.8rem] font-extrabold"
                >
                  {CO[id].icon} {CO[id].name}
                </button>
              ))}
            </div>
            {company === "yalidine" && (
              <button
                type="button"
                onClick={() => setInsurance((v) => !v)}
                style={
                  insurance
                    ? { borderColor: "#E11900", background: "rgba(225,25,0,.1)" }
                    : undefined
                }
                className="mt-2 flex w-full items-center justify-between rounded-[11px] border-[1.5px] border-border px-3 py-2 text-[.8rem] font-extrabold"
              >
                <span>🛡️ التأمين على الطرد (Assurance)</span>
                <span className={cn("relative h-5 w-9 rounded-full", insurance ? "bg-[#E11900]" : "bg-[var(--card-2)]")}>
                  <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-all", insurance ? "right-0.5" : "right-4.5")} />
                </span>
              </button>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3 max-[500px]:grid-cols-1">
            <Field label="الولاية *">
              <select
                value={wilayaId}
                onChange={(e) => selectWilaya(e.target.value)}
                disabled={!carrierReady}
                className={cn(sel, errors.wilaya && "border-destructive")}
              >
                <option value="">{carrierReady ? "اختاري" : "⏳ جاري التحميل..."}</option>
                {wilayaList.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.id} - {w.ar}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={isOffice ? "المكتب (Stop Desk) *" : "البلدية *"}>
              <select
                value={communeValue}
                onChange={(e) => setCommune(e.target.value)}
                disabled={!selectedWilaya}
                className={cn(sel, errors.commune && "border-destructive")}
              >
                <option value="">
                  {!selectedWilaya
                    ? "اختاري الولاية أولاً"
                    : isOffice
                      ? deskOptions.length
                        ? "اختاري المكتب"
                        : "لا توجد مكاتب متاحة"
                      : "اختاري البلدية"}
                </option>
                {isOffice
                  ? deskOptions.map((d) => (
                      <option key={d.id} value={String(d.id)}>
                        {d.address ? `${d.name} — ${d.address}` : d.name}
                      </option>
                    ))
                  : communeOptions.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
              </select>
            </Field>
          </div>

          <Field label="نوع التوصيل">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => selectDeliveryType("home")}
                style={deliveryType === "home" ? { borderColor: "var(--rose)", background: "var(--rose-tint)" } : undefined}
                className="rounded-[11px] border-[1.5px] border-border p-2 text-center text-[.8rem] font-extrabold"
              >
                🏠 للمنزل
                <small className="mt-0.5 block">{feeHome != null ? priceFmt(feeHome) : "—"}</small>
              </button>
              <button
                type="button"
                onClick={() => selectDeliveryType("office")}
                style={deliveryType === "office" ? { borderColor: "var(--rose)", background: "var(--rose-tint)" } : undefined}
                className="rounded-[11px] border-[1.5px] border-border p-2 text-center text-[.8rem] font-extrabold"
              >
                🏢 المكتب (Stop Desk)
                <small className="mt-0.5 block">{feeOffice != null ? priceFmt(feeOffice) : "—"}</small>
              </button>
            </div>
          </Field>

          {deliveryType === "home" && (
            <Field label="عنوان المنزل *">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="الحي، الشارع، رقم المنزل..."
                className={errCls(errors.address)}
              />
            </Field>
          )}

          <Field label="المنتجات *">
            <ProductPicker products={products} items={items} setItems={setItems} hasError={errors.items} />
          </Field>

          <div className="mb-4 rounded-[11px] bg-[var(--card-2)] p-4 text-[.9rem]">
            <div className="mb-1.5 flex justify-between text-[var(--ink-2)]">
              <span>المنتجات</span>
              <span className="num">{priceFmt(subtotal)}</span>
            </div>
            <div className="mb-1.5 flex justify-between text-[var(--ink-2)]">
              <span>التوصيل</span>
              <span>{selectedWilaya ? priceFmt(deliveryFee) : "حسب الولاية"}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 text-base font-black">
              <span>الإجمالي</span>
              <span className="text-[var(--rose)]">{priceFmt(total)}</span>
            </div>
          </div>

          <div className={cn(rowActions, "justify-end")}>
            <button type="button" className={btn("gray")} onClick={resetAndClose}>
              إلغاء
            </button>
            <button type="submit" disabled={submitting} className={btn("rose")}>
              {submitting ? "⏳ جاري الحفظ..." : "✅ إنشاء الطلب"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

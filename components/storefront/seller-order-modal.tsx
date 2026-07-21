"use client";

import { useState } from "react";
import { Check, ShieldCheck, Store, X } from "lucide-react";
import type { Product, SiteSettings } from "@/lib/firebase";
import { priceFmt, priceNum, productImages, saveOrder } from "@/lib/firebase";
import { useIsStaff } from "@/hooks/use-staff";
import { useDeliveryData } from "@/hooks/use-delivery-data";
import { generateOrderNumber } from "@/lib/order";
import {
  CARRIER_ORDER,
  carrierDataReady,
  communesForCarrier,
  companyInfo,
  feeForCarrier,
  isValidPhone,
  wilayaForCarrier,
  wilayasFor,
  type Carrier,
  type DeliveryType,
} from "@/lib/delivery";

function carrierEnabled(settings: SiteSettings, staff: boolean) {
  const customer: Record<Carrier, boolean> = {
    yalidine: settings.yalidineEnabled !== false,
    noest: settings.noestEnabled !== false,
    zr: settings.zrEnabled === true,
  };
  if (!customer.yalidine && !customer.noest && !customer.zr) {
    customer.yalidine = true;
    customer.noest = true;
  }
  return staff ? { yalidine: true, noest: true, zr: true } : customer;
}

export function SellerOrderModal({
  product,
  qty,
  settings,
  open,
  onClose,
  onSuccess,
}: {
  product: Product;
  qty: number;
  settings: SiteSettings;
  open: boolean;
  onClose: () => void;
  onSuccess: (orderNum: string) => void;
}) {
  const staff = useIsStaff();
  const cache = useDeliveryData();
  const enabled = carrierEnabled(settings, staff);
  const customerEnabled = carrierEnabled(settings, false);
  // Noest first, like the live site — the default carrier is the first
  // enabled one in CARRIER_ORDER.
  const firstEnabled = CARRIER_ORDER.find((c) => enabled[c]) || "noest";

  const [selectedCompany, setSelectedCompany] = useState<Carrier | null>(null);
  const company = selectedCompany && enabled[selectedCompany] ? selectedCompany : firstEnabled;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [wilayaId, setWilayaId] = useState("");
  const [commune, setCommune] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("home");
  const [insurance, setInsurance] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  // Switching carrier swaps the wilaya list and fee grid to that carrier's;
  // a selection the new carrier doesn't serve is cleared so no stale
  // wilaya/commune (or its fee) survives the switch.
  function selectCompany(c: Carrier) {
    setSelectedCompany(c);
    if (!wilayaId) return;
    if (!carrierDataReady(c, cache)) {
      // That carrier's real list hasn't loaded yet — don't trust a match
      // resolved against another carrier's shape; clear and let the user
      // re-pick once the loading state below resolves.
      setWilayaId("");
      setCommune("");
      return;
    }
    const w = wilayaForCarrier(c, wilayaId, cache);
    if (!w) {
      setWilayaId("");
      setCommune("");
    } else if (commune && !communesForCarrier(c, w.id, cache).includes(commune)) {
      setCommune("");
    }
  }

  // Never show wilaya/commune options from another carrier's shape (or the
  // generic static list) while this carrier's own live list is still
  // loading — gate on carrierReady instead of falling back silently.
  const carrierReady = carrierDataReady(company, cache);
  const wilayaList = carrierReady ? wilayasFor(company, cache) : [];
  const selectedWilaya = carrierReady && wilayaId ? wilayaForCarrier(company, wilayaId, cache) : null;
  const communeOptions = selectedWilaya ? communesForCarrier(company, selectedWilaya.id, cache) : [];
  // The commune is only ever valid against the CURRENT carrier's commune
  // list — carriers serve different communes and their live lists load
  // async, so validity is derived instead of trusting stale state.
  const communeValue = communeOptions.includes(commune) ? commune : "";
  const feeHome = selectedWilaya ? feeForCarrier(company, selectedWilaya.id, "home", cache) : null;
  const feeOffice = selectedWilaya ? feeForCarrier(company, selectedWilaya.id, "office", cache) : null;
  const deliveryFee = selectedWilaya ? feeForCarrier(company, selectedWilaya.id, deliveryType, cache) : 0;

  const title = product.title || product.name || "";
  const subtotal = priceNum(product.price) * qty;
  const total = subtotal + deliveryFee;

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const bad: Record<string, boolean> = {
      name: !name.trim(),
      phone: !phone.trim(),
      wilaya: !wilayaId,
      commune: !communeValue,
      address: deliveryType === "home" && !address.trim(),
    };
    if (phone.trim() && !isValidPhone(phone)) bad.phone = true;
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
      baladiya: communeValue,
      address: deliveryType === "home" ? address.trim() : "",
      deliveryCompany: company,
      deliveryType,
      deliveryFee,
      insurance: company === "yalidine" && insurance,
      items: [{ id: product.id, title, price: product.price, qty, image: productImages(product)[0] || "" }],
      subtotal,
      total,
      source: "seller_direct",
    };
    try {
      await saveOrder(order);
      onSuccess(num);
    } catch (err) {
      console.error("[DS] saveOrder", err);
      window.alert("تعذّر إرسال الطلب، حاولي مجدداً.");
    }
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-[600] flex items-start justify-center overflow-y-auto bg-[rgba(58,42,48,.55)] p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="my-auto w-full max-w-[460px] rounded-3xl bg-card shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between border-b border-border px-6 py-4.5">
          <h3 className="text-lg font-black">اتركي طلبكِ لدى البائع</h3>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="text-[var(--ink-3)]">
            <X className="size-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <FormField label="الاسم الكامل" required>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم واللقب" className={inputClass(errors.name)} />
          </FormField>
          <FormField label="رقم الهاتف" required>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" dir="ltr" placeholder="0X XX XX XX XX" className={`${inputClass(errors.phone)} text-right`} />
          </FormField>

          {staff && (
            <FormField label="شركة التوصيل">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {CARRIER_ORDER.filter((id) => enabled[id]).map(companyInfo).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCompany(c.id)}
                    style={company === c.id ? { borderColor: c.color, background: `${c.color}12` } : undefined}
                    className="flex items-center gap-1.5 rounded-xl border-[1.5px] border-[var(--line)] px-3 py-2.5 text-xs font-extrabold"
                  >
                    <span className="size-3 shrink-0 rounded-full" style={{ background: c.color }} />
                    {c.fr}
                    {!customerEnabled[c.id] && <span className="mr-auto text-[0.6rem] font-bold text-[var(--ink-3)]">(مخفية)</span>}
                  </button>
                ))}
              </div>
              {company === "yalidine" && (
                <button
                  type="button"
                  onClick={() => setInsurance((v) => !v)}
                  style={insurance ? { borderColor: "#E11900", background: "rgba(225,25,0,.07)" } : undefined}
                  className="mt-2.5 flex w-full items-center justify-between gap-2 rounded-xl border-[1.5px] border-[var(--line)] px-3 py-2.5 text-xs font-extrabold"
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5" /> التأمين على الطرد (Assurance)
                  </span>
                  <span className={`relative h-5.5 w-10 rounded-full transition-colors ${insurance ? "bg-[#E11900]" : "bg-[var(--line)]"}`}>
                    <span className={`absolute top-0.5 size-4.5 rounded-full bg-white shadow transition-all ${insurance ? "right-0.5" : "right-5"}`} />
                  </span>
                </button>
              )}
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <FormField label="الولاية" required>
              <select
                value={wilayaId}
                onChange={(e) => { setWilayaId(e.target.value); setCommune(""); }}
                disabled={!carrierReady}
                className={inputClass(errors.wilaya)}
              >
                <option value="">{carrierReady ? "اختاري" : "⏳ جاري التحميل..."}</option>
                {wilayaList.map((w) => (
                  <option key={w.id} value={w.id}>{w.id} - {w.ar}</option>
                ))}
              </select>
            </FormField>
            <FormField label="البلدية" required>
              <select value={communeValue} onChange={(e) => setCommune(e.target.value)} disabled={!selectedWilaya} className={inputClass(errors.commune)}>
                <option value="">{selectedWilaya ? "اختاري البلدية" : "اختاري الولاية أولاً"}</option>
                {communeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </FormField>
          </div>

          <FormField label="نوع التوصيل">
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={() => setDeliveryType("home")} style={deliveryType === "home" ? { borderColor: "var(--rose)", background: "var(--rose-tint)", color: "var(--rose-deep)" } : undefined} className="rounded-xl border-[1.5px] border-[var(--line)] p-2.5 text-center text-[0.82rem] font-extrabold">
                🏠 للمنزل<small className="mt-0.5 block font-extrabold">{feeHome != null ? priceFmt(feeHome) : "—"}</small>
              </button>
              <button type="button" onClick={() => setDeliveryType("office")} style={deliveryType === "office" ? { borderColor: "var(--rose)", background: "var(--rose-tint)", color: "var(--rose-deep)" } : undefined} className="rounded-xl border-[1.5px] border-[var(--line)] p-2.5 text-center text-[0.82rem] font-extrabold">
                🏢 المكتب (Stop Desk)<small className="mt-0.5 block font-extrabold">{feeOffice != null ? priceFmt(feeOffice) : "—"}</small>
              </button>
            </div>
          </FormField>

          {deliveryType === "home" && (
            <FormField label="عنوان المنزل" required>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="الحي، الشارع، رقم المنزل..." className={inputClass(errors.address)} />
            </FormField>
          )}

          <div className="my-4 rounded-xl bg-muted p-4 text-sm">
            <div className="mb-1.5 flex justify-between text-[var(--ink-2)]">
              <span>{title} × {qty}</span>
              <span className="num">{priceFmt(subtotal)}</span>
            </div>
            <div className="mb-1.5 flex justify-between text-[var(--ink-2)]">
              <span>التوصيل</span>
              <span>{selectedWilaya ? priceFmt(deliveryFee) : "حسب الولاية"}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 text-base font-black">
              <span>الإجمالي</span>
              <span className="text-[var(--rose-deep)]">{priceFmt(total)}</span>
            </div>
          </div>

          <button type="submit" disabled={submitting} className="w-full rounded-full bg-gradient-to-br from-[var(--rose)] to-[var(--rose-deep)] py-3.5 font-extrabold text-white disabled:opacity-60">
            {submitting ? "جاري الإرسال..." : "تأكيد الطلب"}
          </button>
          <p className="mt-3 text-center text-[0.74rem] leading-relaxed text-[var(--ink-3)]">
            سنراجع طلبكِ ونتواصل معكِ لتأكيده. الدفع عند الاستلام 🌸
          </p>
        </form>
      </div>
    </div>
  );
}

export function SellerOrderBadge({ orderNum }: { orderNum: string }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-2 rounded-2xl bg-[#E6F8EC] px-4 py-3.5 text-sm font-extrabold text-[#1A7A34]">
      <Check className="size-4.5" /> تم استلام طلبكِ — رقم الطلب: <b>{orderNum}</b>
    </div>
  );
}

export function SellerOrderTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-light)] px-4 py-3.5 text-[0.95rem] font-extrabold text-[#5A3F2A] shadow-[var(--shadow)] transition-transform hover:-translate-y-0.5"
    >
      <Store className="size-4.5" /> اتركي طلبكِ لدى البائع مباشرة
    </button>
  );
}

function inputClass(error?: boolean) {
  return `w-full rounded-lg border-[1.5px] bg-background px-3.5 py-2.5 text-[0.9rem] outline-none transition-colors focus:border-[var(--rose)] ${
    error ? "border-[var(--rose)] bg-[#FFF0F3]" : "border-[var(--line)]"
  }`;
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-3.5">
      <label className="mb-1.5 block text-[0.76rem] font-extrabold text-[var(--ink-2)]">
        {label} {required && <span className="text-[var(--rose)]">*</span>}
      </label>
      {children}
    </div>
  );
}

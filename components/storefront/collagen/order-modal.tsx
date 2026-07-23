"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { SiteSettings } from "@/lib/firebase";
import { saveOrder } from "@/lib/firebase";
import { generateOrderNumber } from "@/lib/order";
import {
  carrierDataReady,
  communesForCarrier,
  feeForCarrier,
  isValidPhone,
  wilayaForCarrier,
  wilayasFor,
  type Carrier,
  type CarrierCache,
  type DeliveryType,
} from "@/lib/delivery";
import type { CollagenProduct } from "./products";
import { moneyFmt } from "./products";
import styles from "./collagen.module.css";

type Pending = { name: string; phone: string; wilaya: string; baladiya: string; address: string };
const EMPTY_PENDING: Pending = { name: "", phone: "", wilaya: "", baladiya: "", address: "" };

type SuccessInfo = { firstName: string; namesList: string; phone: string; count: number };

// This landing page only ever offers Noest or Yalidine — a faithful port
// of collagen.html's own rule, which never fetched ZR's delivery data.
function pickCompany(settings: SiteSettings): Carrier {
  const noestOn = settings.noestEnabled !== false;
  const yaliOn = settings.yalidineEnabled !== false;
  return noestOn || !yaliOn ? "noest" : "yalidine";
}

export function OrderModal({
  open,
  selected,
  setSelected,
  settings,
  cache,
  products,
  onClose,
}: {
  open: boolean;
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  settings: SiteSettings;
  cache: CarrierCache;
  products: CollagenProduct[];
  onClose: () => void;
}) {
  const company = pickCompany(settings);

  // delivery/pending/errors/submitting/success are local to the modal;
  // `selected` lives in the parent (CollagenPage) because adding a
  // preselected product is a direct effect of the click that opens the
  // modal, not something to derive reactively here. It still persists
  // across opens/closes within the page visit — matches the original's
  // page-level closures (a "shopping list" a customer builds up by
  // clicking multiple products' order buttons before checking out).
  const [delivery, setDelivery] = useState<DeliveryType>("home");
  const [pending, setPending] = useState<Pending>(EMPTY_PENDING);
  const [errors, setErrors] = useState<Partial<Record<keyof Pending, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const carrierReady = carrierDataReady(company, cache);
  const wilayaList = carrierReady ? wilayasFor(company, cache) : [];
  const selectedWilaya = carrierReady && pending.wilaya ? wilayaForCarrier(company, pending.wilaya, cache) : null;
  const communeOptions = selectedWilaya ? communesForCarrier(company, selectedWilaya.id, cache) : [];
  const communeValue = communeOptions.includes(pending.baladiya) ? pending.baladiya : "";
  const feeHome = selectedWilaya ? feeForCarrier(company, selectedWilaya.id, "home", cache) : null;
  const feeOffice = selectedWilaya ? feeForCarrier(company, selectedWilaya.id, "office", cache) : null;
  const fee = selectedWilaya ? feeForCarrier(company, selectedWilaya.id, delivery, cache) : 0;

  const picked = products.filter((p) => selected.includes(p.id));
  const subtotal = picked.reduce((n, p) => n + p.price, 0);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function selectWilaya(id: string) {
    setPending((p) => ({ ...p, wilaya: id, baladiya: "" }));
  }

  function resetAndClose() {
    setSelected([]);
    setDelivery("home");
    setPending(EMPTY_PENDING);
    setErrors({});
    setSuccess(null);
    onClose();
  }

  async function submit() {
    if (!picked.length) {
      alert("يرجى اختيار منتج واحد على الأقل");
      return;
    }
    const bad: Partial<Record<keyof Pending, boolean>> = {
      name: !pending.name.trim(),
      phone: !pending.phone.trim() || !isValidPhone(pending.phone),
      wilaya: !pending.wilaya,
      baladiya: !communeValue,
      address: delivery === "home" && !pending.address.trim(),
    };
    setErrors(bad);
    if (Object.values(bad).some(Boolean)) {
      alert(
        "يرجى ملء جميع الحقول المطلوبة: الاسم، هاتف صحيح يبدأ بـ 05/06/07، الولاية، البلدية" +
          (delivery === "home" ? "، وعنوان المنزل." : ".")
      );
      return;
    }

    setSubmitting(true);
    const num = generateOrderNumber();
    const order = {
      num,
      customer: pending.name.trim(),
      phone: pending.phone.trim(),
      wilaya: selectedWilaya?.ar ?? "",
      wilayaId: selectedWilaya?.id ?? null,
      wilayaFr: selectedWilaya?.fr ?? "",
      baladiya: communeValue,
      communeFr: communeValue,
      address: delivery === "home" ? pending.address.trim() : "",
      deliveryCompany: company,
      deliveryType: delivery,
      deliveryFee: fee,
      insurance: false,
      items: picked.map((p) => ({ id: p.id, title: p.title, price: p.price, qty: 1, image: p.image })),
      subtotal,
      total: subtotal + fee,
      source: "landing_collagen",
    };
    try {
      await saveOrder(order);
    } catch (err) {
      console.error("[DS] saveOrder", err);
    }
    setSubmitting(false);
    setSuccess({
      firstName: order.customer.split(" ")[0] ?? order.customer,
      namesList: picked.map((p) => p.title).join("، "),
      phone: order.phone,
      count: picked.length,
    });
  }

  return (
    <div className={styles.clOv} style={{ display: open ? "flex" : "none" }} onClick={(e) => e.target === e.currentTarget && resetAndClose()}>
      <div className={styles.clModal}>
        <div className={styles.clModalHead}>
          <h3>{success ? "تم استلام طلبكِ 🌸" : "اختاري منتجاتكِ"}</h3>
          <button type="button" className={styles.clModalClose} onClick={resetAndClose} aria-label="إغلاق">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className={styles.clModalBody}>
          {success ? (
            <div className={styles.clSuccess}>
              <div className={styles.ic}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h4>شكراً لثقتكِ، {success.firstName}!</h4>
              <p>
                استلمنا طلبكِ ل{success.count > 1 ? "منتجات" : "منتج"} «{success.namesList}». سنتصل بكِ قريباً على{" "}
                {success.phone} لتأكيد الطلب وترتيب التوصيل.
              </p>
              <button type="button" className={styles.clSubmit} onClick={resetAndClose}>
                تم
              </button>
            </div>
          ) : (
            <>
              <p className={styles.clHint}>يمكنكِ اختيار أكثر من منتج في نفس الطلب</p>
              {products.map((p) => {
                const on = selected.includes(p.id);
                return (
                  <div
                    key={p.id}
                    className={cn(styles.clOpt, on && styles.on, p.special && styles.clOptSpecial)}
                    onClick={() => toggle(p.id)}
                  >
                    <div className={styles.check}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image} alt="" />
                    <div className={styles.coInfo}>
                      {p.special && <span className={styles.coTag}>✨ عرض خاص</span>}
                      <div className={styles.coName}>{p.title}</div>
                      <div className={styles.coPrice}>{moneyFmt(p.price)}</div>
                    </div>
                  </div>
                );
              })}

              <div className={styles.clFields}>
                <div className={styles.clField}>
                  <label>
                    الاسم الكامل <span style={{ color: "var(--destructive)" }}>*</span>
                  </label>
                  <input
                    className={cn(styles.clInput, errors.name && styles.err)}
                    placeholder="الاسم واللقب"
                    value={pending.name}
                    onChange={(e) => setPending((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className={styles.clField}>
                  <label>
                    رقم الهاتف <span style={{ color: "var(--destructive)" }}>*</span>
                  </label>
                  <input
                    className={cn(styles.clInput, errors.phone && styles.err)}
                    type="tel"
                    placeholder="0X XX XX XX XX"
                    style={{ direction: "ltr", textAlign: "right" }}
                    value={pending.phone}
                    onChange={(e) => setPending((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
                <div className={styles.clField}>
                  <label>
                    الولاية <span style={{ color: "var(--destructive)" }}>*</span>
                  </label>
                  <select
                    className={cn(styles.clInput, errors.wilaya && styles.err)}
                    value={pending.wilaya}
                    disabled={!carrierReady}
                    onChange={(e) => selectWilaya(e.target.value)}
                  >
                    <option value="">{carrierReady ? "اختاري الولاية" : "⏳ جاري التحميل..."}</option>
                    {wilayaList.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.id} - {w.ar}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.clField}>
                  <label>
                    البلدية <span style={{ color: "var(--destructive)" }}>*</span>
                  </label>
                  <select
                    className={cn(styles.clInput, errors.baladiya && styles.err)}
                    value={communeValue}
                    disabled={!selectedWilaya}
                    onChange={(e) => setPending((p) => ({ ...p, baladiya: e.target.value }))}
                  >
                    <option value="">{selectedWilaya ? "اختاري البلدية" : "اختاري الولاية أولاً"}</option>
                    {communeOptions.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.clField}>
                  <label>نوع التوصيل</label>
                  <div className={styles.clDel}>
                    <div
                      className={cn(styles.clDopt, delivery === "home" && styles.on)}
                      onClick={() => setDelivery("home")}
                    >
                      🏠 توصيل للمنزل
                      <small>{selectedWilaya && feeHome != null ? moneyFmt(feeHome) : "—"}</small>
                    </div>
                    <div
                      className={cn(styles.clDopt, delivery === "office" && styles.on)}
                      onClick={() => setDelivery("office")}
                    >
                      🏢 مكتب التوصيل
                      <small>{selectedWilaya && feeOffice != null ? moneyFmt(feeOffice) : "—"}</small>
                    </div>
                  </div>
                </div>
                {delivery === "home" && (
                  <div className={styles.clField}>
                    <label>
                      عنوان المنزل <span style={{ color: "var(--destructive)" }}>*</span>
                    </label>
                    <input
                      className={cn(styles.clInput, errors.address && styles.err)}
                      placeholder="الحي، الشارع، رقم المنزل..."
                      value={pending.address}
                      onChange={(e) => setPending((p) => ({ ...p, address: e.target.value }))}
                    />
                  </div>
                )}

                {picked.length > 0 && (
                  <div className={styles.clTotals}>
                    <div className={styles.tl}>
                      <span>
                        المنتجات ({picked.length} {picked.length === 1 ? "منتج" : "منتجات"})
                      </span>
                      <span>{moneyFmt(subtotal)}</span>
                    </div>
                    <div className={styles.tl}>
                      <span>التوصيل</span>
                      <span>{selectedWilaya ? moneyFmt(fee) : "حسب الولاية"}</span>
                    </div>
                    <div className={cn(styles.tl, styles.grand)}>
                      <span>الإجمالي</span>
                      <span>{moneyFmt(subtotal + fee)}</span>
                    </div>
                  </div>
                )}

                <button type="button" className={styles.clSubmit} disabled={submitting} onClick={submit}>
                  {submitting ? "⏳ جاري الإرسال..." : "✅ تأكيد الطلب"}
                </button>
                <p className={styles.clNote}>سنتصل بكِ خلال وقت قصير لتأكيد الطلب وترتيب التوصيل. الدفع عند الاستلام.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

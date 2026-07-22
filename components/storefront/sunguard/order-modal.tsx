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
import { SUNGUARD_PRODUCT, moneyFmt } from "./product";
import styles from "./sunguard.module.css";

type Pending = { name: string; phone: string; wilaya: string; baladiya: string; address: string };
const EMPTY_PENDING: Pending = { name: "", phone: "", wilaya: "", baladiya: "", address: "" };

type SuccessInfo = { firstName: string; phone: string; qty: number };

// This landing page only ever offers Noest or Yalidine, same rule as
// the /collagen funnel (collagen/order-modal.tsx).
function pickCompany(settings: SiteSettings): Carrier {
  const noestOn = settings.noestEnabled !== false;
  const yaliOn = settings.yalidineEnabled !== false;
  return noestOn || !yaliOn ? "noest" : "yalidine";
}

export function OrderModal({
  open,
  settings,
  cache,
  onClose,
}: {
  open: boolean;
  settings: SiteSettings;
  cache: CarrierCache;
  onClose: () => void;
}) {
  const company = pickCompany(settings);

  const [qty, setQty] = useState(1);
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

  const subtotal = SUNGUARD_PRODUCT.price * qty;

  function selectWilaya(id: string) {
    setPending((p) => ({ ...p, wilaya: id, baladiya: "" }));
  }

  function resetAndClose() {
    setQty(1);
    setDelivery("home");
    setPending(EMPTY_PENDING);
    setErrors({});
    setSuccess(null);
    onClose();
  }

  async function submit() {
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
      items: [{ id: SUNGUARD_PRODUCT.id, title: SUNGUARD_PRODUCT.title, price: SUNGUARD_PRODUCT.price, qty }],
      subtotal,
      total: subtotal + fee,
      source: "landing_sunguard",
    };
    try {
      await saveOrder(order);
    } catch (err) {
      console.error("[DS] saveOrder", err);
    }
    setSubmitting(false);
    setSuccess({ firstName: order.customer.split(" ")[0] ?? order.customer, phone: order.phone, qty });
  }

  return (
    <div className={styles.sgOv} style={{ display: open ? "flex" : "none" }} onClick={(e) => e.target === e.currentTarget && resetAndClose()}>
      <div className={styles.sgModal}>
        <div className={styles.sgModalHead}>
          <h3>{success ? "تم استلام طلبكِ 🌸" : "أكملي طلبكِ"}</h3>
          <button type="button" className={styles.sgModalClose} onClick={resetAndClose} aria-label="إغلاق">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className={styles.sgModalBody}>
          {success ? (
            <div className={styles.sgSuccess}>
              <div className={styles.ic}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h4>شكراً لثقتكِ، {success.firstName}!</h4>
              <p>
                استلمنا طلبكِ لـ {success.qty} {success.qty > 1 ? "قطع من واقي الشمس" : "قطعة من واقي الشمس"}. سنتصل بكِ
                قريباً على {success.phone} لتأكيد الطلب وترتيب التوصيل.
              </p>
              <button type="button" className={styles.sgSubmit} onClick={resetAndClose}>
                تم
              </button>
            </div>
          ) : (
            <>
              <div className={styles.sgQty}>
                <span className={styles.sgQtyLabel}>{SUNGUARD_PRODUCT.title}</span>
                <div className={styles.sgQtyCtrl}>
                  <button type="button" className={styles.sgQtyBtn} onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="إنقاص الكمية">
                    −
                  </button>
                  <span className={styles.sgQtyNum}>{qty}</span>
                  <button type="button" className={styles.sgQtyBtn} onClick={() => setQty((q) => Math.min(10, q + 1))} aria-label="زيادة الكمية">
                    +
                  </button>
                </div>
              </div>

              <div className={styles.sgFields}>
                <div className={styles.sgField}>
                  <label>
                    الاسم الكامل <span style={{ color: "var(--destructive)" }}>*</span>
                  </label>
                  <input
                    className={cn(styles.sgInput, errors.name && styles.err)}
                    placeholder="الاسم واللقب"
                    value={pending.name}
                    onChange={(e) => setPending((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className={styles.sgField}>
                  <label>
                    رقم الهاتف <span style={{ color: "var(--destructive)" }}>*</span>
                  </label>
                  <input
                    className={cn(styles.sgInput, errors.phone && styles.err)}
                    type="tel"
                    placeholder="0X XX XX XX XX"
                    style={{ direction: "ltr", textAlign: "right" }}
                    value={pending.phone}
                    onChange={(e) => setPending((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
                <div className={styles.sgField}>
                  <label>
                    الولاية <span style={{ color: "var(--destructive)" }}>*</span>
                  </label>
                  <select
                    className={cn(styles.sgInput, errors.wilaya && styles.err)}
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
                <div className={styles.sgField}>
                  <label>
                    البلدية <span style={{ color: "var(--destructive)" }}>*</span>
                  </label>
                  <select
                    className={cn(styles.sgInput, errors.baladiya && styles.err)}
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
                <div className={styles.sgField}>
                  <label>نوع التوصيل</label>
                  <div className={styles.sgDel}>
                    <div
                      className={cn(styles.sgDopt, delivery === "home" && styles.on)}
                      onClick={() => setDelivery("home")}
                    >
                      🏠 توصيل للمنزل
                      <small>{selectedWilaya && feeHome != null ? moneyFmt(feeHome) : "—"}</small>
                    </div>
                    <div
                      className={cn(styles.sgDopt, delivery === "office" && styles.on)}
                      onClick={() => setDelivery("office")}
                    >
                      🏢 مكتب التوصيل
                      <small>{selectedWilaya && feeOffice != null ? moneyFmt(feeOffice) : "—"}</small>
                    </div>
                  </div>
                </div>
                {delivery === "home" && (
                  <div className={styles.sgField}>
                    <label>
                      عنوان المنزل <span style={{ color: "var(--destructive)" }}>*</span>
                    </label>
                    <input
                      className={cn(styles.sgInput, errors.address && styles.err)}
                      placeholder="الحي، الشارع، رقم المنزل..."
                      value={pending.address}
                      onChange={(e) => setPending((p) => ({ ...p, address: e.target.value }))}
                    />
                  </div>
                )}

                <div className={styles.sgTotals}>
                  <div className={styles.tl}>
                    <span>
                      {SUNGUARD_PRODUCT.title} ×{qty}
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

                <button type="button" className={styles.sgSubmit} disabled={submitting} onClick={submit}>
                  {submitting ? "⏳ جاري الإرسال..." : "✅ تأكيد الطلب"}
                </button>
                <p className={styles.sgNote}>سنتصل بكِ خلال وقت قصير لتأكيد الطلب وترتيب التوصيل. الدفع عند الاستلام.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

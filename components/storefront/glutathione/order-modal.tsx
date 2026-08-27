"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { SiteSettings } from "@/lib/firebase";
import { saveOrder } from "@/lib/firebase";
import { generateOrderNumber } from "@/lib/order";
import { trackPixelEvent, trackPurchase } from "@/lib/meta-pixel";
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
import type { GLUTATHIONE_PRODUCT, GIFT_SOAP } from "./product";
import { moneyFmt } from "./product";
import styles from "./glutathione.module.css";

type Pending = { name: string; phone: string; wilaya: string; baladiya: string; address: string };
const EMPTY_PENDING: Pending = { name: "", phone: "", wilaya: "", baladiya: "", address: "" };

type SuccessInfo = { firstName: string; phone: string; qty: number };

// This landing page only ever offers Noest or Yalidine, same rule as the
// /sunguard and /collagen funnels (see their order-modal.tsx).
function pickCompany(settings: SiteSettings): Carrier {
  const noestOn = settings.noestEnabled !== false;
  const yaliOn = settings.yalidineEnabled !== false;
  return noestOn || !yaliOn ? "noest" : "yalidine";
}

export function OrderModal({
  open,
  settings,
  cache,
  product,
  gift,
  onClose,
}: {
  open: boolean;
  settings: SiteSettings;
  cache: CarrierCache;
  product: typeof GLUTATHIONE_PRODUCT;
  gift: typeof GIFT_SOAP;
  onClose: () => void;
}) {
  const company = pickCompany(settings);

  const [qty, setQty] = useState(1);
  const [delivery, setDelivery] = useState<DeliveryType>("home");
  const [pending, setPending] = useState<Pending>(EMPTY_PENDING);
  const [errors, setErrors] = useState<Partial<Record<keyof Pending, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const [submitError, setSubmitError] = useState(false);

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

  // Fires once per real modal open (not once per page mount, since this
  // modal stays mounted the whole time and just toggles `display`) — the
  // ref resets on close so a customer who closes and reopens the modal
  // later in the same visit produces a fresh "started checkout" signal
  // instead of being silently suppressed. Real retargeting value: this was
  // previously the only funnel-start point with zero pixel signal at all —
  // every other landing page and the main /checkout both already had it.
  const initiateCheckoutFired = useRef(false);
  useEffect(() => {
    if (!open) {
      initiateCheckoutFired.current = false;
      return;
    }
    if (initiateCheckoutFired.current) return;
    initiateCheckoutFired.current = true;
    trackPixelEvent("InitiateCheckout", {
      content_ids: [product.id],
      content_type: "product",
      value: product.price,
      currency: "DZD",
    });
  }, [open, product.id, product.price]);

  const carrierReady = carrierDataReady(company, cache);
  const wilayaList = carrierReady ? wilayasFor(company, cache) : [];
  const selectedWilaya = carrierReady && pending.wilaya ? wilayaForCarrier(company, pending.wilaya, cache) : null;
  const communeOptions = selectedWilaya ? communesForCarrier(company, selectedWilaya.id, cache) : [];
  const communeValue = communeOptions.includes(pending.baladiya) ? pending.baladiya : "";
  // This page has no separate Stop Desk picker — the same commune select
  // drives both delivery types — so Yalidine's per-commune "Supplément
  // commune" applies to both Home and Office lookups here.
  const feeHome = selectedWilaya ? feeForCarrier(company, selectedWilaya.id, "home", cache, communeValue || undefined) : null;
  const feeOffice = selectedWilaya ? feeForCarrier(company, selectedWilaya.id, "office", cache, communeValue || undefined) : null;
  const fee = selectedWilaya ? feeForCarrier(company, selectedWilaya.id, delivery, cache, communeValue || undefined) : 0;

  const subtotal = product.price * qty;

  function selectWilaya(id: string) {
    setPending((p) => ({ ...p, wilaya: id, baladiya: "" }));
  }

  function resetAndClose() {
    setQty(1);
    setDelivery("home");
    setPending(EMPTY_PENDING);
    setErrors({});
    setSuccess(null);
    setSubmitError(false);
    onClose();
  }

  async function submit() {
    // Belt-and-suspenders alongside disabled={submitting} on the button
    // below: that prop only takes effect on the next render/commit, so a
    // second click landing in the gap before the DOM actually disables
    // could otherwise start a second saveOrder() for the same order.
    if (submitting) return;

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
    setSubmitError(false);
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
      items: [
        { id: product.id, title: product.title, price: product.price, qty },
        { id: gift.id, title: `🎁 هدية مجانية: ${gift.title}`, price: 0, qty: 1 },
      ],
      subtotal,
      total: subtotal + fee,
      source: "landing_glutathione",
    };
    // Purchase must only ever fire from this success path — never from the
    // click above, never from validation, never from the success UI
    // rendering. `orderRef.id` (the real Firestore order id) doubles as the
    // Pixel eventID so a future server-side CAPI Purchase for this same
    // order can dedupe against this one instead of counting twice.
    try {
      const orderRef = await saveOrder(order);
      // Fires BOTH the browser Pixel and the server-side CAPI copy with one
      // shared event id (`purchase_<firestoreOrderId>`), built inside
      // trackPurchase() so the two can never drift apart. Deliberately NOT
      // wrapped in a try/catch: trackPurchase never throws — the Pixel call
      // and the fire-and-forget CAPI post are each isolated internally — so
      // a blocked fbq or an unreachable network can't read as an order
      // failure to the customer. The server copy re-reads this order from
      // Firestore and sends nothing that isn't in the saved document.
      trackPurchase({
        orderId: orderRef.id,
        orderNumber: order.num,
        items: order.items,
        value: order.total,
        phone: order.phone,
        firstName: order.customer.split(" ")[0],
      });
      setSuccess({ firstName: order.customer.split(" ")[0] ?? order.customer, phone: order.phone, qty });
    } catch (err) {
      console.error("[DS] saveOrder", err);
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.glOv} style={{ display: open ? "flex" : "none" }} onClick={(e) => e.target === e.currentTarget && resetAndClose()}>
      <div className={styles.glModal}>
        <div className={styles.glModalHead}>
          <h3>{success ? "تم استلام طلبكِ 🌸" : "أكملي طلبكِ"}</h3>
          <button type="button" className={styles.glModalClose} onClick={resetAndClose} aria-label="إغلاق">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className={styles.glModalBody}>
          {success ? (
            <div className={styles.glSuccess}>
              <div className={styles.ic}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h4>شكراً لثقتكِ، {success.firstName}!</h4>
              <p>
                استلمنا طلبكِ لـ {success.qty} {success.qty > 1 ? "علب من جلوتاثيون Life Extension" : "علبة من جلوتاثيون Life Extension"}
                {" "}+ هدية {gift.title} مجاناً. سنتصل بكِ قريباً على {success.phone} لتأكيد الطلب وترتيب التوصيل.
              </p>
              <button type="button" className={styles.glSubmit} onClick={resetAndClose}>
                تم
              </button>
            </div>
          ) : (
            <>
              <div className={styles.glGiftNote}>
                <span>🎁</span>
                هديتكِ المجانية: {gift.title} — تُضاف تلقائياً لطلبكِ
              </div>
              <div className={styles.glQty}>
                <span className={styles.glQtyLabel}>{product.title}</span>
                <div className={styles.glQtyCtrl}>
                  <button type="button" className={styles.glQtyBtn} onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="إنقاص الكمية">
                    −
                  </button>
                  <span className={styles.glQtyNum}>{qty}</span>
                  <button type="button" className={styles.glQtyBtn} onClick={() => setQty((q) => Math.min(10, q + 1))} aria-label="زيادة الكمية">
                    +
                  </button>
                </div>
              </div>

              <div className={styles.glFields}>
                <div className={styles.glField}>
                  <label>
                    الاسم الكامل <span style={{ color: "var(--destructive)" }}>*</span>
                  </label>
                  <input
                    className={cn(styles.glInput, errors.name && styles.err)}
                    placeholder="الاسم واللقب"
                    value={pending.name}
                    onChange={(e) => setPending((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className={styles.glField}>
                  <label>
                    رقم الهاتف <span style={{ color: "var(--destructive)" }}>*</span>
                  </label>
                  <input
                    className={cn(styles.glInput, errors.phone && styles.err)}
                    type="tel"
                    placeholder="0X XX XX XX XX"
                    style={{ direction: "ltr", textAlign: "right" }}
                    value={pending.phone}
                    onChange={(e) => setPending((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
                <div className={styles.glField}>
                  <label>
                    الولاية <span style={{ color: "var(--destructive)" }}>*</span>
                  </label>
                  <select
                    className={cn(styles.glInput, errors.wilaya && styles.err)}
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
                <div className={styles.glField}>
                  <label>
                    البلدية <span style={{ color: "var(--destructive)" }}>*</span>
                  </label>
                  <select
                    className={cn(styles.glInput, errors.baladiya && styles.err)}
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
                <div className={styles.glField}>
                  <label>نوع التوصيل</label>
                  <div className={styles.glDel}>
                    <div
                      className={cn(styles.glDopt, delivery === "home" && styles.on)}
                      onClick={() => setDelivery("home")}
                    >
                      🏠 توصيل للمنزل
                      <small>{selectedWilaya && feeHome != null ? moneyFmt(feeHome) : "—"}</small>
                    </div>
                    <div
                      className={cn(styles.glDopt, delivery === "office" && styles.on)}
                      onClick={() => setDelivery("office")}
                    >
                      🏢 مكتب التوصيل
                      <small>{selectedWilaya && feeOffice != null ? moneyFmt(feeOffice) : "—"}</small>
                    </div>
                  </div>
                </div>
                {delivery === "home" && (
                  <div className={styles.glField}>
                    <label>
                      عنوان المنزل <span style={{ color: "var(--destructive)" }}>*</span>
                    </label>
                    <input
                      className={cn(styles.glInput, errors.address && styles.err)}
                      placeholder="الحي، الشارع، رقم المنزل..."
                      value={pending.address}
                      onChange={(e) => setPending((p) => ({ ...p, address: e.target.value }))}
                    />
                  </div>
                )}

                <div className={styles.glTotals}>
                  <div className={styles.tl}>
                    <span>
                      {product.title} ×{qty}
                    </span>
                    <span>{moneyFmt(subtotal)}</span>
                  </div>
                  <div className={styles.tl}>
                    <span>🎁 {gift.title}</span>
                    <span>مجاناً</span>
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

                {submitError && (
                  <p className={styles.glNote} style={{ color: "var(--destructive)" }}>
                    تعذّر إرسال الطلب، يرجى المحاولة مجدداً.
                  </p>
                )}
                <button type="button" className={styles.glSubmit} disabled={submitting} onClick={submit}>
                  {submitting ? "⏳ جاري الإرسال..." : "✅ تأكيد الطلب"}
                </button>
                <p className={styles.glNote}>سنتصل بكِ خلال وقت قصير لتأكيد الطلب وترتيب التوصيل. الدفع عند الاستلام.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

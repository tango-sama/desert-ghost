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

  const picked = products.filter((p) => selected.includes(p.id));
  const subtotal = picked.reduce((n, p) => n + p.price, 0);

  // Fires once per real modal open (not once per page mount, since this
  // modal stays mounted the whole time and just toggles `display`) — the
  // ref resets on close so reopening later in the same visit produces a
  // fresh "started checkout" signal. Uses whatever's selected at the
  // moment the modal opens (a specific product if opened via that
  // product's own "order" button — CollagenPage batches that selection
  // with the same state update that opens the modal — or every product
  // when opened generically from the hero/CTA with nothing pre-picked
  // yet), deliberately NOT kept in sync with later in-modal selection
  // changes (dep array is `[open]` only) since InitiateCheckout marks the
  // start of checkout, not every edit to the cart within it.
  const initiateCheckoutFired = useRef(false);
  useEffect(() => {
    if (!open) {
      initiateCheckoutFired.current = false;
      return;
    }
    if (initiateCheckoutFired.current) return;
    initiateCheckoutFired.current = true;
    const startIds = picked.length ? picked.map((p) => p.id) : products.map((p) => p.id);
    const startValue = picked.length ? subtotal : products.reduce((n, p) => n + p.price, 0);
    trackPixelEvent("InitiateCheckout", {
      content_ids: startIds,
      content_type: "product",
      value: startValue,
      currency: "DZD",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
    setSubmitError(false);
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
      items: picked.map((p) => ({ id: p.id, title: p.title, price: p.price, qty: 1, image: p.image })),
      subtotal,
      total: subtotal + fee,
      source: "landing_collagen",
    };
    // Purchase must only ever fire from this success path — never from the
    // click above, never from validation. `orderRef.id` doubles as the
    // Pixel eventID so a future server-side CAPI Purchase for this same
    // order can dedupe against this one. Same pattern as
    // glutathione/order-modal.tsx.
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
      setSuccess({
        firstName: order.customer.split(" ")[0] ?? order.customer,
        namesList: picked.map((p) => p.title).join("، "),
        phone: order.phone,
        count: picked.length,
      });
    } catch (err) {
      console.error("[DS] saveOrder", err);
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
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

                {submitError && (
                  <p className={styles.clNote} style={{ color: "var(--destructive)" }}>
                    تعذّر إرسال الطلب، يرجى المحاولة مجدداً.
                  </p>
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

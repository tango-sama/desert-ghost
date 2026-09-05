"use client";

import { useEffect, useRef, useState } from "react";
import { priceFmt, priceNum, saveOrder, type Product, type SiteSettings } from "@/lib/firebase";
import { generateOrderNumber } from "@/lib/order";
import { trackPixelEvent, trackPurchase } from "@/lib/meta-pixel";
import { trackFunnel } from "@/lib/funnel";
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
import type { Answers, Variant } from "@/lib/quiz";
import { answersSummary } from "@/lib/quiz";
import styles from "./quiz.module.css";

// COD order form for the quiz funnel. Deliberately the same shape as the
// collagen and glutathione modals — same carrier helpers, same order document,
// same Purchase-only-on-success rule — so a quiz order flows through the
// admin panel and the carrier integrations with nothing special about it.
//
// What IS special is the `source` plus the quiz answers and variant on the
// order. That is what lets the growth dashboard compare this funnel's
// delivered profit against the product pages', and one variant against the
// other, instead of just counting orders.
//
// SHARED WITH /offer. The quiz funnel's last step is the templated landing
// page (components/storefront/offer/), and it takes the order with this same
// component rather than a fifth copy of the COD form — the carrier helpers,
// the order document and the Purchase-on-success rule are identical, and a
// second copy would drift. `source` is what tells the two apart in the growth
// dashboard: "funnel_quiz" for an order taken on the result screen itself,
// "funnel_quiz_offer" for one taken on the landing page.

type Pending = { name: string; phone: string; wilaya: string; baladiya: string; address: string };
const EMPTY_PENDING: Pending = { name: "", phone: "", wilaya: "", baladiya: "", address: "" };

/** Mirrors the other funnels' rule: this page offers Noest or Yalidine. */
function pickCompany(settings: SiteSettings): Carrier {
  const noestOn = settings.noestEnabled !== false;
  const yaliOn = settings.yalidineEnabled !== false;
  return noestOn || !yaliOn ? "noest" : "yalidine";
}

export function QuizOrderModal({
  open,
  products,
  answers,
  variant,
  settings,
  cache,
  source = "funnel_quiz",
  onClose,
}: {
  open: boolean;
  products: Product[];
  answers: Answers;
  variant: Variant;
  settings: SiteSettings;
  cache: CarrierCache;
  /** Which step of the quiz funnel took the order. Defaults to the result
   *  screen; /offer passes "funnel_quiz_offer". */
  source?: string;
  onClose: () => void;
}) {
  const company = pickCompany(settings);
  const [delivery, setDelivery] = useState<DeliveryType>("home");
  const [pending, setPending] = useState<Pending>(EMPTY_PENDING);
  const [errors, setErrors] = useState<Partial<Record<keyof Pending, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [success, setSuccess] = useState<{ firstName: string; phone: string } | null>(null);

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
  const selectedWilaya =
    carrierReady && pending.wilaya ? wilayaForCarrier(company, pending.wilaya, cache) : null;
  const communeOptions = selectedWilaya ? communesForCarrier(company, selectedWilaya.id, cache) : [];
  const communeValue = communeOptions.includes(pending.baladiya) ? pending.baladiya : "";
  const fee = selectedWilaya
    ? feeForCarrier(company, selectedWilaya.id, delivery, cache, communeValue || undefined)
    : 0;

  const subtotal = products.reduce((n, p) => n + priceNum(p.price), 0);

  // One InitiateCheckout per real open, matching the other funnels. The ref
  // resets on close so reopening later in the visit is a fresh signal.
  const fired = useRef(false);
  useEffect(() => {
    if (!open) {
      fired.current = false;
      return;
    }
    if (fired.current) return;
    fired.current = true;
    trackPixelEvent("InitiateCheckout", {
      content_ids: products.map((p) => String(p.id)),
      content_type: "product",
      value: subtotal,
      currency: "DZD",
    });
    trackFunnel({
      step: "checkout",
      variant,
      answers: answers as Record<string, string | undefined>,
      productIds: products.map((p) => p.id),
      value: subtotal,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function resetAndClose() {
    setDelivery("home");
    setPending(EMPTY_PENDING);
    setErrors({});
    setSuccess(null);
    setSubmitError(false);
    onClose();
  }

  async function submit() {
    if (!products.length) return;
    const bad: Partial<Record<keyof Pending, boolean>> = {
      name: !pending.name.trim(),
      phone: !pending.phone.trim() || !isValidPhone(pending.phone),
      wilaya: !pending.wilaya,
      baladiya: !communeValue,
      address: delivery === "home" && !pending.address.trim(),
    };
    setErrors(bad);
    if (Object.values(bad).some(Boolean)) return;

    setSubmitting(true);
    setSubmitError(false);
    const order = {
      num: generateOrderNumber(),
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
      items: products.map((p) => ({
        id: p.id,
        title: p.title ?? p.name ?? "",
        price: priceNum(p.price),
        qty: 1,
        image: p.image ?? "",
      })),
      subtotal,
      total: subtotal + fee,
      source,
      // What the funnel learned about her, kept as short codes. This is what
      // makes the funnel answerable later: which goals convert, which ones
      // deliver, and which of the two result layouts sells better.
      quiz: { ...answers, variant, summary: answersSummary(answers) },
    };

    try {
      const orderRef = await saveOrder(order);
      // Purchase fires only here, after the order genuinely exists — never on
      // the click, never on validation. Same contract as the other funnels.
      trackPurchase({
        orderId: orderRef.id,
        orderNumber: order.num,
        items: order.items,
        value: order.total,
        phone: order.phone,
        firstName: order.customer.split(" ")[0],
      });
      trackFunnel({
        step: "order",
        variant,
        answers: answers as Record<string, string | undefined>,
        productIds: products.map((p) => p.id),
        value: order.total,
        orderId: orderRef.id,
      });
      setSuccess({ firstName: order.customer.split(" ")[0] ?? order.customer, phone: order.phone });
    } catch (err) {
      console.error("[DS] saveOrder", err);
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={styles.ov}
      style={{ display: open ? "flex" : "none" }}
      onClick={(e) => e.target === e.currentTarget && resetAndClose()}
    >
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <h3>{success ? "تم استلام طلبكِ 🌸" : "إتمام الطلب"}</h3>
          <button type="button" className={styles.modalClose} onClick={resetAndClose} aria-label="إغلاق">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className={styles.modalBody}>
          {success ? (
            <div className={styles.success}>
              <div className={styles.successIc}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h4>شكراً لثقتكِ، {success.firstName}!</h4>
              <p>
                استلمنا طلبكِ وسنتصل بكِ قريباً على{" "}
                <span className={styles.ltr}>{success.phone}</span> لتأكيد الطلب وترتيب التوصيل.
                الدفع عند الاستلام.
              </p>
              <button type="button" className={styles.cta} onClick={resetAndClose}>
                تم
              </button>
            </div>
          ) : (
            <>
              <div className={styles.summary}>
                {products.map((p) => (
                  <div key={String(p.id)} className={styles.summaryRow}>
                    <span>{p.title ?? p.name}</span>
                    <span className="num">{priceFmt(p.price)}</span>
                  </div>
                ))}
                <div className={styles.summaryRow}>
                  <span>التوصيل</span>
                  <span className="num">{selectedWilaya ? priceFmt(fee) : "—"}</span>
                </div>
                <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                  <span>المجموع</span>
                  <span className="num">{priceFmt(subtotal + fee)}</span>
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor="q-name">الاسم الكامل</label>
                <input
                  id="q-name"
                  className={`${styles.input} ${errors.name ? styles.inputErr : ""}`}
                  value={pending.name}
                  onChange={(e) => setPending((p) => ({ ...p, name: e.target.value }))}
                  placeholder="اسمكِ الكامل"
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="q-phone">رقم الهاتف</label>
                <input
                  id="q-phone"
                  className={`${styles.input} ${styles.ltr} ${errors.phone ? styles.inputErr : ""}`}
                  value={pending.phone}
                  onChange={(e) => setPending((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="05 / 06 / 07"
                  inputMode="tel"
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="q-wilaya">الولاية</label>
                <select
                  id="q-wilaya"
                  className={`${styles.select} ${errors.wilaya ? styles.inputErr : ""}`}
                  value={pending.wilaya}
                  onChange={(e) => setPending((p) => ({ ...p, wilaya: e.target.value, baladiya: "" }))}
                  disabled={!carrierReady}
                >
                  <option value="">{carrierReady ? "اختاري الولاية" : "جارٍ التحميل…"}</option>
                  {wilayaList.map((w) => (
                    <option key={w.id} value={String(w.id)}>
                      {w.ar}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="q-commune">البلدية</label>
                <select
                  id="q-commune"
                  className={`${styles.select} ${errors.baladiya ? styles.inputErr : ""}`}
                  value={communeValue}
                  onChange={(e) => setPending((p) => ({ ...p, baladiya: e.target.value }))}
                  disabled={!selectedWilaya}
                >
                  <option value="">{selectedWilaya ? "اختاري البلدية" : "اختاري الولاية أولاً"}</option>
                  {communeOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label>طريقة التوصيل</label>
                <div className={styles.segRow}>
                  <button
                    type="button"
                    className={`${styles.seg} ${delivery === "home" ? styles.segOn : ""}`}
                    onClick={() => setDelivery("home")}
                  >
                    إلى المنزل
                  </button>
                  <button
                    type="button"
                    className={`${styles.seg} ${delivery === "office" ? styles.segOn : ""}`}
                    onClick={() => setDelivery("office")}
                  >
                    إلى المكتب
                  </button>
                </div>
              </div>

              {delivery === "home" && (
                <div className={styles.field}>
                  <label htmlFor="q-address">العنوان</label>
                  <input
                    id="q-address"
                    className={`${styles.input} ${errors.address ? styles.inputErr : ""}`}
                    value={pending.address}
                    onChange={(e) => setPending((p) => ({ ...p, address: e.target.value }))}
                    placeholder="الحي، الشارع، رقم المنزل"
                  />
                </div>
              )}

              {Object.values(errors).some(Boolean) && (
                <div className={styles.err}>
                  يرجى ملء جميع الحقول المطلوبة، ورقم هاتف صحيح يبدأ بـ 05/06/07.
                </div>
              )}
              {submitError && (
                <div className={styles.err}>تعذّر إرسال الطلب، حاولي مجدداً.</div>
              )}

              <button type="button" className={styles.cta} onClick={submit} disabled={submitting}>
                {submitting ? "جارٍ الإرسال…" : "تأكيد الطلب — الدفع عند الاستلام"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

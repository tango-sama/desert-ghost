"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Minus, Plus, ShieldCheck, Trash2, Truck } from "lucide-react";
import { priceFmt, saveOrder, type SiteSettings } from "@/lib/firebase";
import { waLink } from "@/lib/whatsapp";
import { useCartStore, cartTotal } from "@/stores/cart-store";
import { useDeliveryData } from "@/hooks/use-delivery-data";
import { useIsStaff, setStaffFlag } from "@/hooks/use-staff";
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

const SELLER_PASSWORD = "tango88";

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

export function CheckoutForm({ settings }: { settings: SiteSettings }) {
  const items = useCartStore((s) => s.items);
  const setQty = useCartStore((s) => s.setQty);
  const remove = useCartStore((s) => s.remove);
  const cache = useDeliveryData();

  const staff = useIsStaff();

  const enabled = useMemo(() => carrierEnabled(settings, staff), [settings, staff]);
  const customerEnabled = useMemo(() => carrierEnabled(settings, false), [settings]);
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
  const [order, setOrder] = useState<{ num: string; message: string } | null>(null);

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

  const subtotal = cartTotal(items);
  const total = subtotal + deliveryFee;

  function selectWilaya(id: string) {
    setWilayaId(id);
    setCommune("");
  }

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

  function toggleStaff() {
    if (staff) {
      setStaffFlag(false);
      return;
    }
    const pw = window.prompt("كلمة مرور لوحة التحكم:");
    if (pw === null) return;
    if (pw === SELLER_PASSWORD) {
      setStaffFlag(true);
    } else {
      window.alert("كلمة المرور غير صحيحة");
    }
  }

  function buildMessage(o: {
    num: string;
    customer: string;
    phone: string;
    wilaya: string;
    baladiya: string;
    address: string;
    deliveryCompany: Carrier;
    deliveryType: DeliveryType;
    insurance: boolean;
    subtotal: number;
    deliveryFee: number;
    total: number;
    items: { title: string; qty: number }[];
  }) {
    const companyLabel = { noest: "Noest", yalidine: "Yalidine", zr: "ZR Express" }[o.deliveryCompany];
    return (
      `*طلب جديد من Desert Shop* 🌸\n---------------------------\n🛒 *المنتجات:*\n` +
      o.items.map((i) => `- ${i.title} (عدد: ${i.qty})`).join("\n") +
      `\n---------------------------\n` +
      `💰 *المجموع الفرعي:* ${o.subtotal.toLocaleString("en-US")} د.ج` +
      `\n🚚 *التوصيل:* ${o.deliveryFee.toLocaleString("en-US")} د.ج` +
      `\n🧾 *الإجمالي:* ${o.total.toLocaleString("en-US")} د.ج\n---------------------------\n` +
      `🔖 رقم الطلب: ${o.num}\n👤 الاسم: ${o.customer}\n📱 الهاتف: ${o.phone}` +
      `\n📍 العنوان: ${o.wilaya} - ${o.baladiya}` +
      (o.address ? `\n🏠 عنوان المنزل: ${o.address}` : "") +
      `\n🏷️ شركة التوصيل: ${companyLabel}` +
      (o.deliveryCompany === "yalidine" ? `\n🛡️ التأمين: ${o.insurance ? "مفعّل" : "غير مفعّل"}` : "") +
      `\n📦 نوع التوصيل: ${o.deliveryType === "home" ? "للمنزل (à domicile)" : "للمكتب (Stop Desk)"}` +
      `\n---------------------------\nيرجى تأكيد الطلب.`
    );
  }

  async function placeOrder(openWa: boolean) {
    const bad: Record<string, boolean> = {
      name: !name.trim(),
      phone: !phone.trim(),
      wilaya: !wilayaId,
      commune: !communeValue,
      address: deliveryType === "home" && !address.trim(),
    };
    if (phone.trim() && !isValidPhone(phone)) bad.phone = true;
    setErrors(bad);
    if (Object.values(bad).some(Boolean)) {
      window.alert(
        "يرجى ملء جميع الحقول المطلوبة بشكل صحيح (اسم، هاتف صحيح يبدأ بـ 05/06/07، ولاية، بلدية، وعنوان المنزل للتوصيل للمنزل)."
      );
      return;
    }

    setSubmitting(true);
    const num = generateOrderNumber();
    const orderItems = items.map((i) => ({ id: i.id, title: i.title, price: i.price, qty: i.qty, image: i.image }));
    const data = {
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
      items: orderItems,
      subtotal,
      total,
      ...(staff ? { source: "admin_phone" } : {}),
    };

    try {
      await saveOrder(data);
    } catch (e) {
      console.error("[DS] saveOrder", e);
    }

    const message = buildMessage({
      num,
      customer: data.customer,
      phone: data.phone,
      wilaya: data.wilaya,
      baladiya: data.baladiya,
      address: data.address,
      deliveryCompany: company,
      deliveryType,
      insurance: data.insurance,
      subtotal,
      deliveryFee,
      total,
      items: orderItems,
    });
    setOrder({ num, message });
    useCartStore.getState().clear();
    setSubmitting(false);
    if (openWa) window.open(waLink(settings, message), "_blank");
  }

  if (items.length === 0 && !order) {
    return (
      <div className="mx-auto max-w-[1100px] px-5 py-24 text-center md:px-12">
        <div className="mb-4 text-6xl">🛍️</div>
        <h1 className="mb-2 text-2xl font-black">سلتكِ فارغة</h1>
        <p className="mb-6 text-muted-foreground">لم تُضيفي أي منتجات بعد.</p>
        <Link
          href="/products"
          className="inline-flex rounded-full bg-gradient-to-br from-[var(--rose)] to-[var(--rose-deep)] px-9 py-4 font-extrabold text-white"
        >
          تصفّحي المنتجات
        </Link>
      </div>
    );
  }

  if (order) {
    return (
      <div className="fixed inset-0 z-[400] flex items-center justify-center bg-[rgba(58,42,48,.5)] p-6">
        <div className="w-full max-w-[420px] rounded-3xl bg-card p-10 text-center shadow-[var(--shadow-lg)]">
          <div className="mx-auto mb-5 flex size-19.5 items-center justify-center rounded-full bg-[#E6F8EC]">
            <Check className="size-9.5 text-[#22c55e]" />
          </div>
          <h2 className="mb-3 text-2xl font-black">تم استلام طلبكِ! 🌸</h2>
          <p className="mb-5 leading-relaxed text-muted-foreground">
            شكراً لثقتكِ. سنتواصل معكِ قريباً على هاتفكِ لتأكيد الطلب وموعد التوصيل.
          </p>
          <div className="mb-5 rounded-xl border border-dashed border-[var(--rose)] bg-background p-3 font-bold">
            رقم الطلب: <b className="text-[var(--rose-deep)]">{order.num}</b>
          </div>
          <Link
            href="/"
            className="mb-2.5 block rounded-full bg-gradient-to-br from-[var(--rose)] to-[var(--rose-deep)] py-3.5 font-extrabold text-white"
          >
            العودة للمتجر
          </Link>
          {settings.waEnabled !== false && (
            <button
              type="button"
              onClick={() => window.open(waLink(settings, order.message), "_blank")}
              className="w-full rounded-full bg-gradient-to-br from-[#1A7A34] to-[#25D366] py-3.5 font-extrabold text-white"
            >
              إرسال التفاصيل عبر واتساب
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-24 md:px-12">
      <h1 className="mb-1 text-center text-[clamp(1.6rem,3.5vw,2.2rem)] font-black">إتمام الطلب</h1>
      <p className="mb-9 text-center text-muted-foreground">
        أكملي بياناتكِ وسنتواصل معكِ لتأكيد الطلب — الدفع عند الاستلام
      </p>

      <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-[1.4fr_1fr]">
        <div>
          {staff && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-gradient-to-br from-[#7C5CBF] to-[#A78BFA] px-4 py-3 text-sm font-extrabold text-white">
              <span>📞 وضع البائعة — سيُسجَّل كطلب هاتفي بدون إشعارات</span>
              <button type="button" onClick={toggleStaff} className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-extrabold">
                خروج
              </button>
            </div>
          )}
          <div className="flex items-center justify-center gap-2 rounded-t-2xl bg-gradient-to-br from-[#1A7A34] to-[#25D366] py-3.5 text-center font-extrabold text-white">
            <Truck className="size-5" /> الدفع عند الاستلام — Cash on Delivery
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              placeOrder(false);
            }}
            className="rounded-b-2xl border border-[var(--line-2)] bg-card p-8 shadow-[var(--shadow)]"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="الاسم الكامل" required className="md:col-span-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="الاسم واللقب"
                  className={inputClass(errors.name)}
                />
              </Field>
              <Field label="رقم الهاتف" required className="md:col-span-2">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  type="tel"
                  dir="ltr"
                  placeholder="0X XX XX XX XX"
                  className={`${inputClass(errors.phone)} text-right`}
                />
              </Field>

              {staff && (
                <div className="md:col-span-2">
                  <Field label="شركة التوصيل">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {CARRIER_ORDER.filter((id) => enabled[id]).map(companyInfo).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectCompany(c.id)}
                          style={company === c.id ? { borderColor: c.color, background: `${c.color}12` } : undefined}
                          className="flex items-center gap-2 rounded-2xl border-[1.5px] border-[var(--line)] px-4 py-3 text-sm font-extrabold"
                        >
                          <span className="size-3.5 shrink-0 rounded-full" style={{ background: c.color }} />
                          {c.fr} — {c.ar}
                          {!customerEnabled[c.id] && (
                            <span className="mr-auto text-[0.66rem] font-bold text-[var(--ink-3)]">(مخفية عن الزبائن)</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </Field>
                  {company === "yalidine" && (
                    <button
                      type="button"
                      onClick={() => setInsurance((v) => !v)}
                      style={insurance ? { borderColor: "#E11900", background: "rgba(225,25,0,.07)" } : undefined}
                      className="mt-3 flex w-full items-center justify-between gap-2 rounded-2xl border-[1.5px] border-[var(--line)] px-4 py-3 text-sm font-extrabold"
                    >
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="size-4" /> التأمين على الطرد (Assurance)
                      </span>
                      <span
                        className={`relative h-6 w-11 rounded-full transition-colors ${insurance ? "bg-[#E11900]" : "bg-[var(--line)]"}`}
                      >
                        <span
                          className={`absolute top-0.75 size-4.5 rounded-full bg-white shadow transition-all ${insurance ? "right-0.75" : "right-6"}`}
                        />
                      </span>
                    </button>
                  )}
                </div>
              )}

              <Field label="الولاية" required>
                <select
                  value={wilayaId}
                  onChange={(e) => selectWilaya(e.target.value)}
                  disabled={!carrierReady}
                  className={inputClass(errors.wilaya)}
                >
                  <option value="">{carrierReady ? "اختاري الولاية" : "⏳ جاري تحميل قائمة الولايات..."}</option>
                  {wilayaList.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.id} - {w.ar}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="البلدية" required>
                <select
                  value={communeValue}
                  onChange={(e) => setCommune(e.target.value)}
                  disabled={!selectedWilaya}
                  className={inputClass(errors.commune)}
                >
                  <option value="">{selectedWilaya ? "اختاري البلدية" : "اختاري الولاية أولاً"}</option>
                  {communeOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="نوع التوصيل" className="mt-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DeliveryOption
                  active={deliveryType === "home"}
                  onClick={() => setDeliveryType("home")}
                  title="🏠 توصيل للمنزل"
                  sub="إلى باب منزلكِ"
                  price={feeHome}
                />
                <DeliveryOption
                  active={deliveryType === "office"}
                  onClick={() => setDeliveryType("office")}
                  title="🏢 مكتب التوصيل"
                  sub="Stop Desk"
                  price={feeOffice}
                />
              </div>
            </Field>

            {deliveryType === "home" && (
              <Field label="عنوان المنزل" required className="mt-4">
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="الحي، الشارع، رقم المنزل..."
                  className={inputClass(errors.address)}
                />
              </Field>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full rounded-full bg-gradient-to-br from-[var(--rose)] to-[var(--rose-deep)] py-4 font-extrabold text-white shadow-[0_8px_22px_rgba(224,114,140,.35)] disabled:opacity-60"
            >
              {submitting ? "جارٍ الإرسال..." : "✅ تأكيد الطلب"}
            </button>
            {settings.waEnabled !== false && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => placeOrder(true)}
                className="mt-3 w-full rounded-full bg-gradient-to-br from-[#1A7A34] to-[#25D366] py-4 font-extrabold text-white disabled:opacity-60"
              >
                تأكيد الطلب عبر واتساب
              </button>
            )}
            <p className="mt-4 text-center text-xs leading-relaxed text-[var(--ink-3)]">
              «تأكيد الطلب» يحفظ طلبكِ ونتصل بكِ لتأكيده. أو أرسلي التفاصيل عبر واتساب. الدفع عند الاستلام.
            </p>
            {!staff && (
              <p className="mt-1.5 text-center">
                <button type="button" onClick={toggleStaff} className="text-[0.72rem] text-[var(--ink-3)] underline">
                  دخول صاحبة المتجر
                </button>
              </p>
            )}
          </form>
        </div>

        <div className="rounded-3xl border border-[var(--line-2)] bg-card p-6 shadow-[var(--shadow)] md:sticky md:top-24">
          <h3 className="mb-4 border-b border-border pb-3.5 text-lg font-extrabold">
            ملخص الطلب ({items.length})
          </h3>
          <div className="flex flex-col gap-3.5">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3">
                <div className="size-15 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {item.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- admin-pasted URL, arbitrary host
                    <img src={item.image} alt={item.title} className="size-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-[0.84rem] font-bold">{item.title}</div>
                  <div className="mt-0.5 text-[0.82rem] font-extrabold text-[var(--rose-deep)]">{priceFmt(item.price)}</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <button type="button" onClick={() => setQty(item.id, item.qty - 1)} className="flex size-6.5 items-center justify-center rounded-md border border-border bg-muted">
                      <Minus className="size-3" />
                    </button>
                    <span className="min-w-5.5 text-center text-sm font-extrabold">{item.qty}</span>
                    <button type="button" onClick={() => setQty(item.id, item.qty + 1)} className="flex size-6.5 items-center justify-center rounded-md border border-border bg-muted">
                      <Plus className="size-3" />
                    </button>
                    <button type="button" onClick={() => remove(item.id)} className="mr-auto text-[var(--rose)]">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2.5 border-t border-border pt-4">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>المجموع الفرعي</span>
              <span className="num">{priceFmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>التوصيل</span>
              <span>{selectedWilaya ? priceFmt(deliveryFee) : "يُحدَّد حسب الولاية"}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-3 text-lg font-black">
              <span>الإجمالي</span>
              <span className="text-[var(--rose-deep)]">{priceFmt(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function inputClass(error?: boolean) {
  return `w-full rounded-xl border-[1.5px] bg-background px-4 py-3 text-[0.92rem] outline-none transition-colors focus:border-[var(--rose)] ${
    error ? "border-[var(--rose)] bg-[#FFF0F3]" : "border-[var(--line)]"
  }`;
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-[0.78rem] font-extrabold text-[var(--ink-2)]">
        {label} {required && <span className="text-[var(--rose)]">*</span>}
      </label>
      {children}
    </div>
  );
}

function DeliveryOption({
  active,
  onClick,
  title,
  sub,
  price,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
  price: number | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border-[1.5px] p-4 text-right transition-all ${
        active ? "border-[var(--rose)] bg-[var(--rose-tint)]" : "border-[var(--line)]"
      }`}
    >
      <span
        className={`flex size-5.5 shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-[var(--rose)]" : "border-[var(--line)]"}`}
      >
        {active && <span className="size-2.5 rounded-full bg-[var(--rose)]" />}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-extrabold">{title}</span>
        <span className="block text-xs text-[var(--ink-3)]">{sub}</span>
      </span>
      <span className="text-left text-sm font-black text-[var(--rose-deep)]">
        {price != null ? priceFmt(price) : "—"}
        <span className="block text-[0.6rem] font-bold text-[var(--ink-3)]">التوصيل</span>
      </span>
    </button>
  );
}

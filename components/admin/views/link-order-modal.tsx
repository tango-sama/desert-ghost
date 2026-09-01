"use client";

// The admin "🔗 ربط طلب" flow — for parcels that already exist at the carrier
// (created OUTSIDE this app, e.g. directly in the Yalidine/Noest/ZR dashboard).
// The admin types the tracking number, lookupParcel (an admin-gated callable,
// see trinkl/functions/index.js) returns the parcel's recipient/COD details so
// the admin can confirm it's the right parcel, then a new order is written that
// references that tracking number directly. NO create*Parcel call ever runs —
// the parcel is already live at the carrier, and this flow must not double-ship.
// All customer/address fields are READ-ONLY and come from the parcel — the
// admin's only input is the product list (plus the tracking + carrier used for
// the lookup). Missing/unmatched parcel data never blocks the save: the order
// is written with the best available values (flagged as warnings) since the
// admin can't edit carrier-side data.

import { useState } from "react";
import { priceFmt, saveOrder, type Product } from "@/lib/firebase";
import { lookupParcel, type ParcelLookupResult } from "@/lib/admin";
import { generateOrderNumber } from "@/lib/order";
import { cn } from "@/lib/utils";
import { CO } from "@/components/admin/carriers";
import {
  cartFromParcelLabel,
  ProductPicker,
  type CartItem,
} from "@/components/admin/product-picker";
import {
  CARRIER_ORDER,
  centersForCarrier,
  communeForCenter,
  communesForCarrier,
  feeForCarrier,
  wilayaForCarrier,
  wilayasFor,
  type Carrier,
  type CarrierCache,
  type DeliveryType,
} from "@/lib/delivery";
import { inp, btn, Field, rowActions, fmtDate } from "@/components/admin/ui";
import { nowMs } from "@/lib/time";

// Phone formats the carrier APIs actually return: local 0[567]XXXXXXXX
// (Noest), international +213XXXXXXXXX (ZR Express), or Yalidine's masked
// 0*****XXXX (their public API redacts PII — see lookupParcel). Accept all
// of them: the value is read-only, so format-strict validation would just
// dead-end the save on data the admin can't change.
function carrierPhoneOk(phone: string): boolean {
  const v = phone.replace(/\s+/g, "");
  if (/^\+213\d{9}$/.test(v)) return true;
  if (/^0[\d*]{8,9}$/.test(v)) return true;
  return false;
}

// ZR returns +213XXXXXXXXX; the rest of the store stores local 0XXXXXXXXX.
function normalizeCarrierPhone(phone: string): string {
  const v = phone.trim().replace(/\s+/g, "");
  return /^\+213\d{9}$/.test(v) ? "0" + v.slice(4) : v;
}

// Read-only field for a linked order — every customer/address value comes
// from the carrier's parcel, never typed by the admin. A missing/unmatched
// value never blocks the save (the admin can't fix it); it's flagged as a
// non-blocking warning so she knows the order was saved without it.
function ReadOnlyField({
  label,
  value,
  warn,
  warnMsg,
}: {
  label: string;
  value: React.ReactNode;
  warn?: boolean;
  warnMsg?: string | null;
}) {
  return (
    <Field label={label}>
      <div
        className={cn(
          "flex min-h-[42px] items-center rounded-[11px] border border-dashed bg-[var(--card-2)] px-3 text-[.85rem]",
          warn ? "border-[var(--warn-ink)] text-[var(--warn-ink)]" : "border-border text-[var(--ink-2)]"
        )}
      >
        {value}
      </div>
      {warn && warnMsg && (
        <p className="mt-1 text-[.72rem] font-bold leading-snug text-[var(--warn-ink)]">⚠️ {warnMsg}</p>
      )}
    </Field>
  );
}

export function LinkOrderModal({
  open,
  onClose,
  products,
  cache,
  toast,
}: {
  open: boolean;
  onClose: () => void;
  products: Product[];
  cache: CarrierCache;
  toast: (msg: string) => void;
}) {
  const [carrier, setCarrier] = useState<Carrier>("noest");
  const [tracking, setTracking] = useState("");
  const [busyLookup, setBusyLookup] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [result, setResult] = useState<ParcelLookupResult | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [wilayaId, setWilayaId] = useState("");
  const [commune, setCommune] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("home");
  const [items, setItems] = useState<CartItem[]>([]);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [warns, setWarns] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const carrierReady = !!cache[carrier];
  const pkg = result?.package ?? null;
  const selectedWilaya = carrierReady && wilayaId ? wilayaForCarrier(carrier, wilayaId, cache) : null;
  const communeOptions = selectedWilaya ? communesForCarrier(carrier, selectedWilaya.id, cache) : [];
  const deskOptions = selectedWilaya ? centersForCarrier(carrier, selectedWilaya.id, cache) : [];
  const isOffice = deliveryType === "office";
  const selectedDesk = isOffice ? deskOptions.find((d) => String(d.id) === commune) ?? null : null;
  // Read-only parcel values are never a hard block: when the desk name isn't
  // in this carrier's synced list (or the commune isn't an exact match), keep
  // the parcel's own value so the order still records it.
  const communeValue = isOffice
    ? selectedDesk
      ? commune
      : pkg?.commune || ""
    : communeOptions.includes(commune)
      ? commune
      : pkg?.commune || "";
  const communeLabel = isOffice ? selectedDesk?.name ?? pkg?.commune ?? "" : communeValue;
  // What the CARRIER is given as the destination, as opposed to what the
  // panel displays: every createXParcel function addresses the parcel by
  // commune name and rejects one it doesn't recognise, and a Stop Desk
  // order's `baladiya` is the DESK's own name, never a commune. See
  // lib/delivery.ts's commune helpers.
  const communeFr = selectedWilaya
    ? (isOffice
        ? selectedDesk
          ? communeForCenter(carrier, selectedWilaya.id, selectedDesk, cache)
          : null
        : communeValue) ?? ""
    : "";
  // Yalidine's Home fee varies by destination COMMUNE within the wilaya
  // (its own "Supplément commune") — Stop Desk has no commune of its own,
  // so only sharpen the lookup to a commune for Home.
  const deliveryFee = selectedWilaya
    ? feeForCarrier(carrier, selectedWilaya.id, deliveryType, cache, isOffice ? undefined : communeValue || undefined)
    : 0;

  const subtotal = items.reduce((n, it) => n + it.price * it.qty, 0);
  const total = subtotal + deliveryFee;

  function resetAndClose() {
    setCarrier("noest");
    setTracking("");
    setBusyLookup(false);
    setLookupError(null);
    setResult(null);
    setName("");
    setPhone("");
    setWilayaId("");
    setCommune("");
    setAddress("");
    setDeliveryType("home");
    setItems([]);
    setErrors({});
    setWarns({});
    onClose();
  }

  // Prefill the customer/address fields from the parcel's own data. The
  // wilaya/commune are matched against THIS carrier's live list (name lookup,
  // not numeric code — a package from an external dashboard only carries names).
  function prefillFromPackage(res: ParcelLookupResult) {
    const pkg = res.package;
    if (!pkg) return;
    // The parcel already names what it is carrying — match those against the
    // catalog so the order starts with the right products instead of the
    // admin retyping them. Same list format from all three carriers (it is
    // what create*Parcel wrote in the first place); an unrecognised label
    // just leaves the picker empty, exactly as before.
    setItems(cartFromParcelLabel(pkg.productLabel || "", products));
    setName(pkg.customer || "");
    setPhone(pkg.phone || "");
    setAddress(pkg.address || "");
    const dt: DeliveryType = pkg.deliveryType === "office" ? "office" : "home";
    setDeliveryType(dt);

    const wl = wilayasFor(res.carrier, cache);
    let wid = "";
    for (const cand of [pkg.wilaya, pkg.wilayaFr]) {
      if (!cand) continue;
      const c = String(cand).trim();
      if (!c) continue;
      // Some carriers send the numeric wilaya code rather than a name
      // (Noest's wilaya_id, ZR's cityTerritoryCode) — match by id first,
      // then by name for the carriers that send names (Yalidine).
      const byId = wl.find((w) => String(w.id) === c);
      const match =
        byId ??
        wl.find((w) => w.fr.toLowerCase() === c.toLowerCase()) ??
        wl.find((w) => w.ar.toLowerCase() === c.toLowerCase());
      if (match) {
        wid = String(match.id);
        break;
      }
    }
    setWilayaId(wid);

    const communeName = (pkg.commune || "").trim();
    if (wid && communeName) {
      if (dt === "office") {
        // Desk names can carry irregular whitespace (e.g. ZR hub names like
        // "Hub Menea 58  مكتب المنيعة") and slight wording differences from
        // the synced list — compare with collapsed spaces, exact first then
        // partial. If nothing matches the parcel's own desk name is kept as-is
        // (non-blocking, see communeValue/communeLabel).
        const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
        const centers = centersForCarrier(res.carrier, wid, cache);
        const desk =
          centers.find((d) => norm(String(d.name)) === norm(communeName)) ??
          centers.find((d) => {
            const a = norm(String(d.name));
            const b = norm(communeName);
            return b && (a.includes(b) || b.includes(a));
          });
        setCommune(desk ? String(desk.id) : "");
      } else {
        const cs = communesForCarrier(res.carrier, wid, cache);
        const c = cs.find((x) => x.toLowerCase() === communeName.toLowerCase());
        setCommune(c ?? "");
      }
    } else {
      setCommune("");
    }
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!tracking.trim()) {
      setLookupError("أدخلي رقم التتبع أولاً.");
      return;
    }
    setBusyLookup(true);
    setLookupError(null);
    setResult(null);
    try {
      const res = await lookupParcel(carrier, tracking.trim());
      setResult(res);
      prefillFromPackage(res);
    } catch (err) {
      console.error("[DS] lookupParcel", err);
      setLookupError((err as Error | null)?.message ?? "تعذّر البحث عن الطرد.");
      setResult(null);
    } finally {
      setBusyLookup(false);
    }
  }

  function selectCompany(c: Carrier) {
    if (c === carrier) return;
    setCarrier(c);
    setResult(null);
    setLookupError(null);
  }

  if (!open) return null;

  function errCls(hasError?: boolean) {
    return cn(inp, hasError && "border-destructive");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!result) return;
    // Missing/unmatched read-only parcel values never block the save — the
    // admin can't edit them — but they surface as warnings so she knows what
    // got saved empty or as-is. The only hard requirement is the product list.
    setWarns({
      name: !name.trim(),
      phone: !carrierPhoneOk(phone),
      wilaya: !wilayaId,
      commune: !communeValue,
      address: deliveryType === "home" && !address.trim(),
    });
    const bad: Record<string, boolean> = { items: items.length === 0 };
    setErrors(bad);
    if (bad.items) return;

    setSubmitting(true);
    const num = generateOrderNumber();
    const pkg = result.package;
    const storedPkg = JSON.parse(JSON.stringify({ ...pkg })) as Record<string, unknown>;
    delete storedPkg.raw;
    const order = {
      num,
      customer: name.trim(),
      phone: normalizeCarrierPhone(phone.trim()),
      wilaya: selectedWilaya?.ar || pkg?.wilaya || "",
      wilayaId: selectedWilaya?.id ?? null,
      wilayaFr: selectedWilaya?.fr || pkg?.wilayaFr || "",
      baladiya: communeLabel,
      ...(communeFr ? { communeFr } : {}),
      // The desk's own id in this carrier's list, so the parcel names the
      // exact desk that was picked rather than being re-derived from the
      // commune server-side. Paired with the carrier it belongs to — desk ids
      // mean nothing to another company.
      ...(selectedDesk ? { deskId: selectedDesk.id, deskCarrier: carrier } : {}),
      address: deliveryType === "home" ? address.trim() : "",
      deliveryCompany: carrier,
      deliveryType,
      deliveryFee,
      items: items.map((it) => ({ id: it.id, title: it.title, price: it.price, qty: it.qty, image: it.image })),
      subtotal,
      total,
      // The parcel's own COD amount (what the customer pays the courier) is
      // the record of truth for a linked order; the computed total above is
      // only the store's internal accounting for the items the admin picks.
      parcelPrice: pkg?.price != null ? pkg.price : total,
      deliveryLabel: pkg?.productLabel || "",
      source: "admin_linked",
      [carrier]: { tracking: result.tracking, createdAt: nowMs() },
      trackingStatus: result.status,
      linkedParcel: { carrier, tracking: result.tracking, linkedAt: nowMs(), package: storedPkg },
      fulfilled: true,
      status: "Confirmed",
    };
    try {
      await saveOrder(order);
      toast(`تم ربط الطلب ${num} بالطرد ✓`);
      resetAndClose();
    } catch (err) {
      console.error("[DS] saveOrder (admin linked order)", err);
      toast("تعذّر حفظ الطلب، حاولي مجدداً.");
    }
    setSubmitting(false);
  }

  return (
    <div
      className="fixed inset-0 z-[500] flex items-start justify-center overflow-y-auto bg-black/60 p-6"
      onClick={(e) => e.target === e.currentTarget && resetAndClose()}
    >
      <div className="my-auto w-full max-w-[560px] rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-lg)]">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-[1.05rem] font-extrabold">🔗 ربط طلب بطرد موجود</h3>
          <button type="button" onClick={resetAndClose} aria-label="إغلاق" className="text-[var(--ink-3)]">
            ✕
          </button>
        </div>

        <form onSubmit={handleLookup}>
          <Field label="شركة التوصيل">
            <div className="grid grid-cols-3 gap-2">
              {CARRIER_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectCompany(id)}
                  style={
                    carrier === id
                      ? { borderColor: CO[id].color, background: `${CO[id].color}18` }
                      : undefined
                  }
                  className="flex items-center justify-center gap-1.5 rounded-[11px] border-[1.5px] border-border px-3 py-2 text-[.8rem] font-extrabold"
                >
                  {CO[id].icon} {CO[id].name}
                </button>
              ))}
            </div>
          </Field>

          <Field label="رقم التتبع *">
            <div className="flex gap-2">
              <input
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="مثال: 0073512728"
                dir="ltr"
                autoComplete="off"
                className={cn(errCls(), "text-right num")}
              />
              <button
                type="submit"
                disabled={busyLookup}
                className={btn("blue")}
                style={{ background: CO[carrier].color }}
              >
                {busyLookup ? "⏳..." : "🔍 البحث"}
              </button>
            </div>
          </Field>

          {lookupError && (
            <div className="mb-4 rounded-[11px] bg-[var(--alert-bg)] px-4 py-3 text-[.8rem] font-bold text-[var(--alert-ink)]">
              ⚠️ {lookupError}
            </div>
          )}

          {result && pkg && (
            <div className="mb-4 rounded-[11px] border border-dashed border-border bg-[var(--card-2)] p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <b className="text-[.9rem]">
                  📦 الطرد الموجود لدى {CO[result.carrier].name}
                </b>
                <span className="num text-[.82rem] text-[var(--ink-3)]" dir="ltr">
                  {result.tracking}
                </span>
              </div>
              {result.status?.lastLabel && (
                <div className="mb-2 text-[.78rem] font-bold text-[var(--ok-ink)]">
                  ✅ {result.status.lastLabel}
                </div>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[.8rem] text-[var(--ink-2)]">
                {pkg.customer && <span>👤 {pkg.customer}</span>}
                {pkg.phone && <span className="num">📱 {pkg.phone}</span>}
                {(pkg.wilaya || pkg.commune) && (
                  <span>📍 {[pkg.commune, pkg.wilaya].filter(Boolean).join(" - ")}</span>
                )}
                {pkg.address && <span>🏠 {pkg.address}</span>}
                {pkg.productLabel && <span>📦 {pkg.productLabel}</span>}
                {pkg.price != null && <span>💰 {priceFmt(pkg.price)}</span>}
                {pkg.createdAt && <span>🗓️ {fmtDate(pkg.createdAt)}</span>}
                {pkg.deliveryType === "office" && <span>🏢 مكتب (Stop Desk)</span>}
              </div>
              <div className="mt-2 text-[.72rem] leading-relaxed text-[var(--ink-3)]">
                تحقّقي من أن هذا هو الطرد الصحيح — ستُنشأ الطلبية مربوطة به مباشرةً، دون إنشاء طرد جديد لدى شركة التوصيل.
              </div>
            </div>
          )}

          {!result && (
            <div className="mb-4 rounded-[11px] bg-[var(--card-2)] px-4 py-3 text-[.78rem] text-[var(--ink-3)]">
              يُستخدم هذا الزر للطلبات التي أُنشئ طردُها خارج المتجر (مباشرة من لوحة شركة التوصيل). أدخلي رقم التتبع للتحقق ثم أكملِ الطلبية.
            </div>
          )}
        </form>

        {result && (
          <form onSubmit={handleSubmit}>
            <>
              <div className="mb-4 rounded-[11px] bg-[var(--card-2)] px-4 py-3 text-[.78rem] leading-relaxed text-[var(--ink-3)]">
                معلومات الزبون والعنوان ونوع التوصيل مأخوذة من الطرد لدى شركة التوصيل (قراءة فقط) — اختاري المنتجات فقط. إن نقصت قيمة من الطرد أو لم تتطابق مع قوائم شركة التوصيل، ستُحفظ الطلبية بالقيمة المتوفرة وتظهر تنبيهات صفراء.
              </div>
              <div className="grid grid-cols-2 gap-3 max-[500px]:grid-cols-1">
                <ReadOnlyField label="اسم الزبون *" value={name || "—"} warn={warns.name} warnMsg="اسم الزبون غير موجود في الطرد — ستُحفظ الطلبية بدونه" />
                <ReadOnlyField label="رقم الهاتف *" value={phone || "—"} warn={warns.phone} warnMsg="رقم الهاتف غير موجود في الطرد — ستُحفظ الطلبية بدونه" />
              </div>

              <div className="grid grid-cols-2 gap-3 max-[500px]:grid-cols-1">
                <ReadOnlyField
                  label="الولاية *"
                  value={wilayaId && selectedWilaya ? `${selectedWilaya.id} - ${selectedWilaya.ar}` : pkg?.wilaya || pkg?.wilayaFr || "—"}
                  warn={warns.wilaya}
                  warnMsg="ولاية الطرد غير مطابقة لقائمة الولايات — ستُحفظ الطلبية دون تطابق الولاية"
                />
                <ReadOnlyField
                  label={isOffice ? "المكتب (Stop Desk) *" : "البلدية *"}
                  value={communeLabel || pkg?.commune || "—"}
                  warn={warns.commune}
                  warnMsg={isOffice ? "مكتب الطرد غير مطابق — ستُحفظ باسم المكتب كما ورد من شركة التوصيل" : "بلدية الطرد غير مطابقة — ستُحفظ باسمها كما ورد من شركة التوصيل"}
                />
              </div>

              <Field label="نوع التوصيل">
                <div className="grid grid-cols-2 gap-2">
                  <div
                    style={deliveryType === "home" ? { borderColor: "var(--rose)", background: "var(--rose-tint)" } : undefined}
                    className="rounded-[11px] border-[1.5px] border-border p-2 text-center text-[.8rem] font-extrabold"
                  >
                    🏠 للمنزل
                  </div>
                  <div
                    style={deliveryType === "office" ? { borderColor: "var(--rose)", background: "var(--rose-tint)" } : undefined}
                    className="rounded-[11px] border-[1.5px] border-border p-2 text-center text-[.8rem] font-extrabold"
                  >
                    🏢 المكتب (Stop Desk)
                  </div>
                </div>
              </Field>

              {deliveryType === "home" && (
                <ReadOnlyField label="عنوان المنزل *" value={address || "—"} warn={warns.address} warnMsg="عنوان المنزل غير موجود في الطرد — ستُحفظ الطلبية بدونه" />
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
                {result.package?.price != null && (
                  <div className="mt-1.5 text-[.72rem] text-[var(--ink-3)]">
                    💰 القيمة التي يجمعها الموزع (COD): <b className="num">{priceFmt(result.package.price)}</b>
                  </div>
                )}
              </div>

              <div className={cn(rowActions, "justify-end")}>
                <button type="button" className={btn("gray")} onClick={resetAndClose}>
                  إلغاء
                </button>
                <button type="submit" disabled={submitting} className={btn("rose")}>
                  {submitting ? "⏳ جاري الحفظ..." : "🔗 ربط الطلب بالطرد"}
                </button>
              </div>
            </>
          </form>
        )}
      </div>
    </div>
  );
}

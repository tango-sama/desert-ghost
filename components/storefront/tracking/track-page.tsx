"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, MapPin, Package, Search, Truck } from "lucide-react";

type TrackEvent = {
  label: string;
  date: string | number | null;
  location: string | null;
  badge: string | null;
};

type TrackedOrder = {
  orderNumber: string | null;
  createdAt: number | null;
  carrier: string | null;
  tracking: string | null;
  stage: number;
  stageLabels: string[];
  alert: string | null;
  lastLabel: string | null;
  lastDate: string | number | null;
  lastLocation: string | null;
  events: TrackEvent[];
};

function formatDate(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const date = typeof value === "number"
    ? new Date(value < 10_000_000_000 ? value * 1000 : value)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ar-DZ", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(date);
}

export function TrackPage() {
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<TrackedOrder[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setOrders(null);
    try {
      const response = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "تعذر البحث عن الطلبيات. يرجى المحاولة مجدداً.");
        return;
      }
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch {
      setError("تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت وحاول مجدداً.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section dir="rtl" className="relative overflow-hidden px-4 pb-20 pt-10 sm:pt-16">
      <div className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-[var(--rose)]/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full bg-[var(--gold)]/15 blur-3xl" />

      <div className="relative mx-auto max-w-3xl">
        <div className="mx-auto mb-9 max-w-xl text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-white text-[var(--rose-deep)] shadow-[var(--shadow)] ring-1 ring-[var(--line)]">
            <Package size={30} strokeWidth={1.7} />
          </div>
          <p className="mb-2 text-sm font-bold tracking-[.18em] text-[var(--rose-deep)]">DESERT SHOP</p>
          <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-5xl">تتبّعي طلبيتك</h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-8 text-[var(--ink-2)] sm:text-lg">
            أدخلي رقم الهاتف الذي استعملتِه عند الطلب، وسنعرض لكِ جميع الطلبيات التي لم يتم تسليمها بعد.
          </p>
        </div>

        <form onSubmit={submit} className="rounded-[28px] border border-[var(--line)] bg-white/90 p-5 shadow-[var(--shadow-lg)] backdrop-blur sm:p-7">
          <label htmlFor="tracking-phone" className="mb-3 block text-sm font-bold text-[var(--foreground)]">
            رقم الهاتف
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex min-h-14 flex-1 items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--cream)] px-4 transition focus-within:border-[var(--rose)] focus-within:ring-4 focus-within:ring-[var(--rose)]/10">
              <span className="text-xl text-[var(--rose-deep)]">☎</span>
              <input
                id="tracking-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05 XX XX XX XX"
                maxLength={20}
                required
                className="min-w-0 flex-1 bg-transparent text-left text-lg font-semibold tracking-wide text-[var(--foreground)] outline-none placeholder:font-normal placeholder:text-[var(--ink-3)]"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !phone.trim()}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[var(--rose-deep)] px-7 font-bold text-white shadow-md shadow-[var(--rose)]/20 transition hover:-translate-y-0.5 hover:bg-[var(--rose)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Search size={19} />}
              {loading ? "جارٍ البحث..." : "تتبّع طلبيتي"}
            </button>
          </div>
          <p className="mt-3 text-xs leading-6 text-[var(--ink-3)]">
            يمكنك إدخال الرقم بصيغة 05 أو +213. لا نعرض إلا الطلبيات المرتبطة بهذا الرقم وغير المسلّمة.
          </p>
          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
        </form>

        {orders !== null && (
          <div className="mt-8 space-y-5" aria-live="polite">
            {orders.length === 0 ? (
              <div className="rounded-[28px] border border-[var(--line)] bg-white p-8 text-center shadow-[var(--shadow)]">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--gold-soft)] text-[var(--gold)]">
                  <CheckCircle2 size={28} />
                </div>
                <h2 className="text-xl font-black text-[var(--foreground)]">لا توجد طلبيات قيد التوصيل</h2>
                <p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">
                  لم نعثر على طلبيات غير مسلّمة مرتبطة بهذا الرقم. إذا كانت طلبيتكِ حديثة، حاولي مجدداً بعد قليل.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-lg font-black text-[var(--foreground)]">طلبياتكِ النشطة</h2>
                  <span className="rounded-full bg-[var(--rose-tint)] px-3 py-1 text-sm font-bold text-[var(--rose-deep)]">{orders.length} طلبية</span>
                </div>
                {orders.map((order, index) => {
                  const labels = order.stageLabels?.length ? order.stageLabels : ["تم إنشاء الطلب", "تم التأكيد والشحن", "في مركز الفرز", "خرج للتوصيل", "تم الاستلام"];
                  const activeStage = Math.min(order.stage, labels.length - 1);
                  return (
                    <article key={order.orderNumber ?? index} className="overflow-hidden rounded-[26px] border border-[var(--line)] bg-white shadow-[var(--shadow)]">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--cream)]/80 px-5 py-4 sm:px-6">
                        <div>
                          <p className="text-xs font-medium text-[var(--ink-3)]">رقم الطلبية</p>
                          <p className="mt-1 text-lg font-black text-[var(--foreground)]">{order.orderNumber ? `#${order.orderNumber}` : `طلبية ${index + 1}`}</p>
                        </div>
                        <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-bold text-[var(--rose-deep)] ring-1 ring-[var(--line)]">
                          <Truck size={16} />
                          {order.carrier ?? "قيد التحضير"}
                        </div>
                      </div>

                      <div className="p-5 sm:p-6">
                        <div className="mb-5 flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs text-[var(--ink-3)]">الحالة الحالية</p>
                            <h3 className="mt-1 text-xl font-black text-[var(--foreground)]">{order.alert || order.lastLabel || labels[activeStage] || "قيد المعالجة"}</h3>
                            {order.lastLocation && <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--ink-2)]"><MapPin size={15} />{order.lastLocation}</p>}
                            {order.lastDate && <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--ink-3)]"><Clock3 size={13} />{formatDate(order.lastDate)}</p>}
                          </div>
                          {order.alert && <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">تنبيه</span>}
                        </div>

                        {order.tracking && (
                          <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--cream)] px-4 py-3">
                            <span className="text-xs font-semibold text-[var(--ink-2)]">رقم تتبع الشحنة</span>
                            <bdi dir="ltr" className="font-mono text-sm font-bold tracking-wider text-[var(--foreground)]">{order.tracking}</bdi>
                          </div>
                        )}

                        <div className="relative">
                          <div className="absolute right-[11px] top-3 bottom-3 w-px bg-[var(--line)]" />
                          <ol className="space-y-4">
                            {labels.map((label, step) => {
                              const done = step <= activeStage;
                              return (
                                <li key={step} className="relative flex items-center gap-3">
                                  <span className={`relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-[var(--rose-deep)] bg-[var(--rose-deep)] text-white" : "border-[var(--line)] bg-white text-[var(--ink-3)]"}`}>
                                    {done ? <CheckCircle2 size={14} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                                  </span>
                                  <span className={`text-sm ${done ? "font-bold text-[var(--foreground)]" : "text-[var(--ink-3)]"}`}>{label}</span>
                                  {step === activeStage && <span className="mr-auto rounded-full bg-[var(--rose-tint)] px-2.5 py-1 text-[10px] font-bold text-[var(--rose-deep)]">الحالة الحالية</span>}
                                </li>
                              );
                            })}
                          </ol>
                        </div>

                        {order.events.length > 0 && (
                          <details className="mt-6 border-t border-[var(--line)] pt-4">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold text-[var(--rose-deep)]">
                              تفاصيل حركة الشحنة <ArrowLeft size={16} />
                            </summary>
                            <div className="mt-4 space-y-4">
                              {order.events.map((item, eventIndex) => (
                                <div key={eventIndex} className="flex gap-3">
                                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--gold)]" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-[var(--foreground)]">{item.label}</p>
                                    {item.location && <p className="mt-1 text-xs text-[var(--ink-2)]">{item.location}</p>}
                                    {item.date && <p className="mt-1 text-xs text-[var(--ink-3)]">{formatDate(item.date)}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    </article>
                  );
                })}
              </>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-[var(--ink-3)]">
          <Package size={14} />
          <span>Desert Shop · خدمة تتبع الطلبيات</span>
        </div>
      </div>
    </section>
  );
}

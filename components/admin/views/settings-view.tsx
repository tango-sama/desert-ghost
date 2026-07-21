"use client";

import { useState } from "react";
import type { SiteSettings } from "@/lib/firebase";
import { callFn, setDocIn, updateDocIn } from "@/lib/admin";
import { useAdminStore } from "@/stores/admin-store";
import { useAdminTheme, setAdminTheme } from "@/hooks/use-admin-theme";
import { isBefore } from "@/lib/time";
import { WILAYAS } from "@/lib/delivery-data";
import { cn } from "@/lib/utils";
import {
  inp,
  sel,
  btn,
  cardCls,
  cardH3,
  grid2,
  uploadLbl,
  thumbPrev,
  rowActions,
  Field,
  transparent,
  pickImage,
} from "@/components/admin/ui";

function b64ToU8(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function ToggleBtn({
  on,
  onClick,
}: {
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        btn("gray", true),
        on && "border-transparent bg-[var(--green)] text-white"
      )}
    >
      {on ? "👁️ ظاهرة للزبائن — إخفاء" : "🚫 مخفية عن الزبائن — إظهار"}
    </button>
  );
}

function StatusBanner({ ok, okText, badText }: { ok: boolean; okText: string; badText: string }) {
  return (
    <div
      className={cn(
        "mb-4 rounded-[11px] px-4 py-3 text-[.85rem] font-bold",
        ok
          ? "bg-[var(--ok-bg)] text-[var(--ok-ink)]"
          : "bg-[rgba(229,72,77,.12)] text-[var(--alert-ink)]"
      )}
    >
      {ok ? okText : badText}
    </div>
  );
}

const cardNarrow = cn(cardCls, "max-w-[680px]");

export function SettingsView() {
  const settings = useAdminStore((s) => s.settings);
  const toast = useAdminStore((s) => s.toast);
  const theme = useAdminTheme();

  // general
  const [hero, setHero] = useState(String(settings.heroImage ?? ""));
  const [name, setName] = useState(String(settings.storeName ?? "جمالكِ الخارجي"));
  const [wa, setWa] = useState(String(settings.waNumber ?? "213662705830"));
  const [ig, setIg] = useState(String(settings.instagram ?? ""));
  const [fb, setFb] = useState(String(settings.facebook ?? ""));
  const [tt, setTt] = useState(String(settings.tiktok ?? ""));
  // notifications
  const [ntEmail, setNtEmail] = useState(String(settings.notifyEmail ?? ""));
  const [ntPass, setNtPass] = useState("");
  // carriers
  const [origin, setOrigin] = useState(String(settings.originWilaya ?? ""));
  const [yalId, setYalId] = useState("");
  const [yalToken, setYalToken] = useState("");
  const [noToken, setNoToken] = useState("");
  const [noGuid, setNoGuid] = useState("");
  const [zrTenant, setZrTenant] = useState("");
  const [zrKey, setZrKey] = useState("");
  // live
  const [liveHours, setLiveHours] = useState(Number(settings.tiktokLiveHours ?? 2));
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const yalEnabled = settings.yalidineEnabled !== false;
  const noEnabled = settings.noestEnabled !== false;
  const zrEnabled = settings.zrEnabled === true; // ZR is opt-in for customers
  const waOn = settings.waEnabled !== false;
  const carriersOn = (yalEnabled ? 1 : 0) + (noEnabled ? 1 : 0) + (zrEnabled ? 1 : 0);
  const liveUntil = settings.tiktokLive
    ? Number(settings.tiktokLiveAt ?? 0) +
      Number(settings.tiktokLiveHours ?? 2) * 3600000
    : 0;
  const liveActive = isBefore(liveUntil);

  function setBusyKey(k: string, on: boolean) {
    setBusy((b) => ({ ...b, [k]: on }));
  }

  async function persistSettings(
    extra: Record<string, unknown>,
    okMsg: string
  ): Promise<boolean> {
    const docId = String((settings as { id?: string }).id ?? "general");
    const data: SiteSettings = {
      ...settings,
      heroImage: hero.trim(),
      storeName: name.trim(),
      waNumber: wa.trim(),
      instagram: ig.trim(),
      facebook: fb.trim(),
      tiktok: tt.trim(),
      // origin wilaya persists through EVERY save button — the old panel
      // only saved it via "حفظ ربط Yalidine", so a change followed by the
      // general save silently reverted (felt like it was stuck).
      ...(origin ? { originWilaya: origin } : {}),
      ...extra,
      id: docId,
    };
    try {
      await setDocIn("site_settings", docId, data as Record<string, unknown>);
      useAdminStore.setState({ settings: data });
      toast(okMsg);
      return true;
    } catch (e) {
      console.error(e);
      toast("فشل الحفظ");
      return false;
    }
  }

  async function saveNotify() {
    const email = ntEmail.trim();
    const pass = ntPass.trim();
    if (!email) {
      toast("أدخلي بريد Gmail أولاً");
      return;
    }
    try {
      if (pass) await setDocIn("private", "notify", { gmail: email, appPass: pass });
      else if (settings.notifyReady)
        await updateDocIn("private", "notify", { gmail: email });
      else {
        toast("أدخلي App Password أولاً");
        return;
      }
      await persistSettings(
        { notifyEmail: email, notifyReady: true },
        "تم حفظ إعدادات البريد ✓"
      );
      setNtPass("");
    } catch (e) {
      console.error(e);
      toast("فشل الحفظ");
    }
  }

  async function sendTestEmail() {
    setBusyKey("ntTest", true);
    try {
      await callFn("sendTestEmail");
      toast("أُرسل البريد التجريبي ✓ تفقّدي صندوق الوارد");
    } catch (e) {
      console.error(e);
      toast((e as Error | null)?.message || "فشل الإرسال");
    } finally {
      setBusyKey("ntTest", false);
    }
  }

  // Web-push activation for this device: permission → register push-sw.js →
  // subscribe with the server VAPID key → store the subscription.
  async function enablePush() {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      toast(
        "هذا المتصفح لا يدعم الإشعارات — جرّبي Chrome، وعلى آيفون أضيفي الصفحة للشاشة الرئيسية أولاً"
      );
      return;
    }
    setBusyKey("ntPush", true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("perm-denied");
      const reg = await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;
      const res = await callFn<{ publicKey: string }>("getPushKey");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToU8(res.publicKey) as BufferSource,
      });
      const id = btoa(sub.endpoint).replace(/[^a-zA-Z0-9]/g, "").slice(-60);
      await setDocIn("push_subs", id, {
        sub: JSON.stringify(sub),
        ua: navigator.userAgent.slice(0, 160),
        at: Date.now(),
      });
      toast("تم تفعيل الإشعارات على هذا الجهاز ✓");
    } catch (e) {
      console.error(e);
      toast(
        (e as Error | null)?.message === "perm-denied"
          ? "رُفض إذن الإشعارات — فعّليه من إعدادات المتصفح"
          : "فشل تفعيل الإشعارات"
      );
    } finally {
      setBusyKey("ntPush", false);
    }
  }

  async function toggleLive() {
    const willLive = !liveActive;
    if (willLive && !(tt.trim() || settings.tiktok)) {
      toast("أضيفي رابط حساب تيك توك أولاً");
      return;
    }
    const now = Date.now();
    // tiktokLiveUntil is an additive field the Next.js storefront reads
    // directly; the old site keeps computing from tiktokLiveAt + hours.
    const extra = willLive
      ? {
          tiktokLive: true,
          tiktokLiveAt: now,
          tiktokLiveHours: liveHours,
          tiktokLiveUntil: now + liveHours * 3600000,
        }
      : { tiktokLive: false, tiktokLiveUntil: 0 };
    await persistSettings(
      extra,
      willLive
        ? `تم تفعيل زر البث (يُخفى بعد ${liveHours} ساعات) ✓`
        : "تم إيقاف زر البث"
    );
  }

  async function saveYalidine() {
    const apiId = yalId.trim();
    const token = yalToken.trim();
    const hasCreds = !!(apiId && token);
    const alreadyReady = !!settings.yalidineReady;
    if (!origin) {
      toast("اختاري ولاية الإرسال");
      return;
    }
    if ((apiId && !token) || (token && !apiId)) {
      toast("أدخلي API ID و Token معاً");
      return;
    }
    if (!hasCreds && !alreadyReady) {
      toast("أدخلي API ID و Token");
      return;
    }
    try {
      if (hasCreds)
        await setDocIn("private", "yalidine", {
          apiId,
          apiToken: token,
          updatedAt: Date.now(),
        });
      await persistSettings(
        { originWilaya: origin, yalidineReady: hasCreds || alreadyReady },
        "تم حفظ ربط Yalidine ✓"
      );
      setYalId("");
      setYalToken("");
    } catch (e) {
      console.error(e);
      toast("فشل حفظ المفاتيح");
    }
  }

  async function saveNoest() {
    const token = noToken.trim();
    const guid = noGuid.trim();
    const hasCreds = !!(token && guid);
    const alreadyReady = !!settings.noestReady;
    if ((token && !guid) || (guid && !token)) {
      toast("أدخلي API Token و user_guid معاً");
      return;
    }
    if (!hasCreds && !alreadyReady) {
      toast("أدخلي API Token و user_guid");
      return;
    }
    try {
      if (hasCreds)
        await setDocIn("private", "noest", {
          apiToken: token,
          userGuid: guid,
          updatedAt: Date.now(),
        });
      await persistSettings(
        { noestReady: hasCreds || alreadyReady },
        "تم حفظ ربط Noest ✓"
      );
      setNoToken("");
      setNoGuid("");
    } catch (e) {
      console.error(e);
      toast("فشل حفظ المفاتيح");
    }
  }

  async function saveZr() {
    const tenant = zrTenant.trim();
    const key = zrKey.trim();
    const hasCreds = !!(tenant && key);
    const alreadyReady = !!settings.zrReady;
    if ((tenant && !key) || (key && !tenant)) {
      toast("أدخلي Tenant ID و Secret Key معاً");
      return;
    }
    if (!hasCreds && !alreadyReady) {
      toast("أدخلي Tenant ID و Secret Key");
      return;
    }
    try {
      if (hasCreds)
        await setDocIn("private", "zrexpress", {
          tenantId: tenant,
          secretKey: key,
          updatedAt: Date.now(),
        });
      await persistSettings(
        { zrReady: hasCreds || alreadyReady },
        "تم حفظ ربط ZR Express ✓"
      );
      setZrTenant("");
      setZrKey("");
    } catch (e) {
      console.error(e);
      toast("فشل حفظ المفاتيح");
    }
  }

  async function syncCarriers() {
    setBusyKey("sync", true);
    try {
      const res = await callFn<{
        result?: Record<string, { wilayas?: number }>;
      }>("syncCarriers");
      const r = res?.result ?? {};
      toast(
        `تم التحديث ✓ — Yalidine ${r.yalidine?.wilayas ?? 0} ولاية، Noest ${r.noest?.wilayas ?? 0} ولاية، ZR ${r.zr?.wilayas ?? 0} ولاية`
      );
    } catch (e) {
      console.error("syncCarriers", e);
      alert("تعذّر التحديث:\n" + ((e as Error | null)?.message ?? "خطأ"));
    } finally {
      setBusyKey("sync", false);
    }
  }

  // One-click carrier webhook activation — the callable registers our
  // deployed endpoint with the carrier and stores the verification secret
  // server-side; the panel's live orders listener then moves trackers in
  // real time without the manual 🔄 refresh.
  async function enableZrWebhook() {
    setBusyKey("zrWh", true);
    try {
      await callFn("registerZrWebhook");
      await persistSettings(
        { zrWebhookReady: true },
        "تم تفعيل التتبع التلقائي (Webhook) ✓"
      );
    } catch (e) {
      console.error(e);
      toast((e as Error | null)?.message || "فشل تفعيل الـ Webhook");
    } finally {
      setBusyKey("zrWh", false);
    }
  }

  async function enableYalidineWebhook() {
    setBusyKey("yalWh", true);
    try {
      const r = await callFn<{
        ok: boolean;
        manual?: boolean;
        url?: string;
        secret?: string;
      }>("registerYalidineWebhook");
      if (r.ok) {
        await persistSettings(
          { yalidineWebhookReady: true },
          "تم تفعيل التتبع التلقائي (Webhook) ✓"
        );
      } else if (r.manual) {
        alert(
          "لم يقبل Yalidine التسجيل التلقائي — فعّليه يدوياً من لوحة Yalidine (قسم Webhooks):\n\n" +
            `الرابط (URL):\n${r.url}\n\n` +
            `السر (Secret):\n${r.secret}\n\n` +
            "اختاري حدث parcel_status_updated ثم احفظي."
        );
        toast("أكملي تسجيل الـ Webhook من لوحة Yalidine");
      }
    } catch (e) {
      console.error(e);
      toast((e as Error | null)?.message || "فشل تفعيل الـ Webhook");
    } finally {
      setBusyKey("yalWh", false);
    }
  }

  async function toggleCarrier(
    key: "yalidineEnabled" | "noestEnabled" | "zrEnabled",
    enabled: boolean,
    label: string
  ) {
    const willOn = !enabled;
    if (key === "zrEnabled" && willOn && !settings.zrReady) {
      toast("احفظي Tenant ID و Secret Key الخاصين بـ ZR أولاً");
      return;
    }
    if (!willOn && carriersOn <= 1) {
      toast("يجب إبقاء شركة توصيل واحدة على الأقل");
      return;
    }
    await persistSettings(
      { [key]: willOn },
      willOn ? `${label} ظاهرة للزبائن ✓` : `تم إخفاء ${label} عن الزبائن`
    );
  }

  const credPlaceholder = (ready: unknown, hint: string) =>
    ready ? "•••••• (محفوظ)" : hint;

  return (
    <div>
      <div className={cardNarrow}>
        <h3 className={cardH3}>🎨 مظهر لوحة التحكم</h3>
        <div className="mb-4 text-[.82rem] text-[var(--ink-2)]">
          التبديل بين الوضع الداكن والفاتح. يُحفظ الاختيار على هذا الجهاز فقط.
        </div>
        <div className={rowActions}>
          <button
            type="button"
            className={btn("gray", true)}
            onClick={() => setAdminTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light"
              ? "🌙 التبديل إلى الوضع الداكن"
              : "☀️ التبديل إلى الوضع الفاتح"}
          </button>
        </div>
      </div>

      <div className={cardNarrow}>
        <h3 className={cardH3}>🔔 التنبيهات (طلبات ورسائل جديدة)</h3>
        {!!settings.notifyReady && (
          <StatusBanner ok okText="✓ إشعارات البريد مفعّلة" badText="" />
        )}
        <div className={grid2}>
          <Field label="بريد Gmail للإشعارات">
            <input
              className={inp}
              dir="ltr"
              value={ntEmail}
              onChange={(e) => setNtEmail(e.target.value)}
              placeholder="you@gmail.com"
            />
          </Field>
          <Field label="App Password">
            <input
              className={inp}
              type="password"
              autoComplete="off"
              dir="ltr"
              value={ntPass}
              onChange={(e) => setNtPass(e.target.value)}
              placeholder={credPlaceholder(settings.notifyReady, "xxxx xxxx xxxx xxxx")}
            />
          </Field>
        </div>
        <div className="mb-3 mt-[-.3rem] text-[.75rem] text-[var(--ink-3)]">
          يصلكِ بريد إلكتروني عند كل طلب شراء أو رسالة جديدة. أنشئي App Password
          من إعدادات حساب Google (الأمان ← التحقق بخطوتين ← App passwords)
          والصقيه هنا — ليس كلمة سر حسابكِ العادية. يُخزَّن بشكل آمن ولا يظهر في
          الموقع.
        </div>
        <div className={rowActions}>
          <button type="button" className={btn("green")} onClick={saveNotify}>
            💾 حفظ إعدادات البريد
          </button>
          <button
            type="button"
            className={btn("gray")}
            disabled={!!busy.ntTest}
            onClick={sendTestEmail}
          >
            {busy.ntTest ? "⏳ جارٍ الإرسال..." : "✉️ إرسال بريد تجريبي"}
          </button>
          <button
            type="button"
            className={btn("blue")}
            disabled={!!busy.ntPush}
            onClick={enablePush}
          >
            {busy.ntPush ? "⏳ جارٍ التفعيل..." : "🔔 تفعيل إشعارات هذا الجهاز"}
          </button>
        </div>
        <div className="mt-3 text-[.75rem] text-[var(--ink-3)]">
          زر «تفعيل إشعارات هذا الجهاز» يجعل الإشعارات المنبثقة تصل للهاتف حتى
          والموقع مغلق. على آيفون: أضيفي لوحة التحكم إلى الشاشة الرئيسية أولاً ثم
          فعّلي الزر من داخلها.
        </div>
      </div>

      <div className={cardNarrow}>
        <h3 className={cardH3}>إعدادات عامة</h3>
        <Field label="صورة الواجهة (Hero)">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={thumbPrev} src={hero || transparent()} alt="" />
            <input
              className={inp}
              style={{ flex: 1 }}
              value={hero}
              onChange={(e) => setHero(e.target.value)}
              placeholder="رابط الصورة"
            />
            <button
              type="button"
              className={uploadLbl}
              onClick={() => pickImage("site_assets", toast, setHero)}
            >
              ⬆ رفع
            </button>
          </div>
        </Field>
        <div className={grid2}>
          <Field label="اسم المتجر">
            <input className={inp} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="رقم واتساب (دولي)">
            <input className={inp} dir="ltr" value={wa} onChange={(e) => setWa(e.target.value)} />
          </Field>
          <Field label="إنستغرام">
            <input
              className={inp}
              dir="ltr"
              value={ig}
              onChange={(e) => setIg(e.target.value)}
              placeholder="https://instagram.com/..."
            />
          </Field>
          <Field label="فيسبوك">
            <input
              className={inp}
              dir="ltr"
              value={fb}
              onChange={(e) => setFb(e.target.value)}
              placeholder="https://facebook.com/..."
            />
          </Field>
          <Field label="تيك توك">
            <input
              className={inp}
              dir="ltr"
              value={tt}
              onChange={(e) => setTt(e.target.value)}
              placeholder="https://tiktok.com/@..."
            />
          </Field>
        </div>
        <div className={`${rowActions} mb-2`}>
          <button
            type="button"
            className={cn(
              btn("gray", true),
              waOn && "border-transparent bg-[var(--green)] text-white"
            )}
            onClick={() =>
              persistSettings(
                { waEnabled: !waOn },
                !waOn ? "واتساب مفعّل في الموقع ✓" : "تم تعطيل واتساب في الموقع"
              )
            }
          >
            {waOn ? "💬 واتساب مفعّل في الموقع — تعطيل" : "🚫 واتساب معطّل في الموقع — تفعيل"}
          </button>
        </div>
        <div className="mb-3 text-[.75rem] text-[var(--ink-3)]">
          عند التعطيل تختفي كل أزرار وروابط واتساب من الموقع (الزر العائم، صفحة
          المنتج، تأكيد الطلب، الفوتر) ويبقى الطلب عبر الاستمارة فقط.
        </div>
        <div className={rowActions}>
          <button
            type="button"
            className={btn("green")}
            onClick={() => persistSettings({}, "تم حفظ الإعدادات ✓")}
          >
            💾 حفظ الإعدادات
          </button>
        </div>
      </div>

      <div className={cardNarrow}>
        <h3 className={cardH3}>🔴 البث المباشر (تيك توك)</h3>
        <div className="mb-4 text-[.82rem] leading-[1.7] text-[var(--ink-2)]">
          عند بدء بثكِ المباشر على تيك توك، فعّلي الزر فيظهر زرّ عائم متحرّك يدعو
          الزوار للانضمام. يُخفى تلقائياً بعد المدة المحددة (أو أطفئيه يدوياً).
          يستخدم رابط حساب تيك توك المحفوظ.
        </div>
        <Field label="يُخفى الزر تلقائياً بعد">
          <select
            className={sel}
            style={{ maxWidth: 240 }}
            value={liveHours}
            onChange={(e) => {
              const h = parseInt(e.target.value, 10) || 2;
              setLiveHours(h);
              if (liveActive)
                void persistSettings(
                  {
                    tiktokLiveHours: h,
                    tiktokLiveUntil: Number(settings.tiktokLiveAt ?? 0) + h * 3600000,
                  },
                  "تم تحديث المدة ✓"
                );
            }}
          >
            {[1, 2, 3, 4, 6].map((h) => (
              <option key={h} value={h}>
                {h} ساعات
              </option>
            ))}
          </select>
        </Field>
        <div className={rowActions}>
          <button
            type="button"
            onClick={toggleLive}
            className={cn(
              btn("gray"),
              liveActive && "border-transparent bg-[#FE2C55] text-white"
            )}
          >
            {liveActive ? "🔴 البث مباشر الآن — إيقاف الزر" : "⚫ غير مباشر — تشغيل الزر"}
          </button>
        </div>
      </div>

      <div className={cardNarrow}>
        <h3 className={cardH3}>🚚 ربط Yalidine API</h3>
        <StatusBanner
          ok={!!settings.yalidineReady}
          okText="✓ مربوط بحساب Yalidine"
          badText="● غير مربوط بعد"
        />
        <Field label="ولاية الإرسال (المتجر)">
          <select className={sel} value={origin} onChange={(e) => setOrigin(e.target.value)}>
            <option value="">اختاري ولاية الإرسال</option>
            {WILAYAS.map((w) => (
              <option key={w.id} value={w.fr}>
                {w.id} - {w.ar} ({w.fr})
              </option>
            ))}
          </select>
        </Field>
        <div className={grid2}>
          <Field label="API ID">
            <input
              className={inp}
              type="password"
              autoComplete="off"
              dir="ltr"
              value={yalId}
              onChange={(e) => setYalId(e.target.value)}
              placeholder={credPlaceholder(settings.yalidineReady, "أدخلي API ID")}
            />
          </Field>
          <Field label="API Token">
            <input
              className={inp}
              type="password"
              autoComplete="off"
              dir="ltr"
              value={yalToken}
              onChange={(e) => setYalToken(e.target.value)}
              placeholder={credPlaceholder(settings.yalidineReady, "أدخلي API Token")}
            />
          </Field>
        </div>
        <div className="mb-3 mt-[-.3rem] text-[.75rem] text-[var(--ink-3)]">
          احصلي على API ID و Token من حسابكِ في Yalidine (قسم API / المطوّرين).
          تُخزَّن بشكل آمن ولا تظهر في الموقع. اتركي الحقول فارغة للإبقاء على
          القيم المحفوظة.
        </div>
        <div className={rowActions}>
          <button type="button" className={btn("green")} onClick={saveYalidine}>
            💾 حفظ ربط Yalidine
          </button>
          <button
            type="button"
            className={btn("gray")}
            disabled={!!busy.yalWh}
            onClick={enableYalidineWebhook}
          >
            {busy.yalWh
              ? "⏳ جاري التفعيل..."
              : settings.yalidineWebhookReady
                ? "🔔 Webhook مفعّل ✓ — إعادة التسجيل"
                : "🔔 تفعيل التتبع التلقائي (Webhook)"}
          </button>
          <ToggleBtn
            on={yalEnabled}
            onClick={() => toggleCarrier("yalidineEnabled", yalEnabled, "Yalidine")}
          />
        </div>
      </div>

      <div className={cardNarrow} style={{ borderColor: "var(--blue)" }}>
        <h3 className={cn(cardH3, "text-[var(--info-ink)]")}>🔵 ربط Noest API</h3>
        <StatusBanner
          ok={!!settings.noestReady}
          okText="✓ مربوط بحساب Noest"
          badText="● غير مربوط بعد"
        />
        <div className={grid2}>
          <Field label="API Token">
            <input
              className={inp}
              type="password"
              autoComplete="off"
              dir="ltr"
              value={noToken}
              onChange={(e) => setNoToken(e.target.value)}
              placeholder={credPlaceholder(settings.noestReady, "أدخلي API Token")}
            />
          </Field>
          <Field label="user_guid">
            <input
              className={inp}
              type="password"
              autoComplete="off"
              dir="ltr"
              value={noGuid}
              onChange={(e) => setNoGuid(e.target.value)}
              placeholder={credPlaceholder(settings.noestReady, "أدخلي user_guid")}
            />
          </Field>
        </div>
        <div className="mb-3 mt-[-.3rem] text-[.75rem] text-[var(--ink-3)]">
          احصلي على api_token و user_guid من NOEST عند إنشاء حسابكِ. تُخزَّن بشكل
          آمن ولا تظهر في الموقع. اتركي الحقول فارغة للإبقاء على القيم المحفوظة.
        </div>
        <div className={rowActions}>
          <button type="button" className={btn("blue")} onClick={saveNoest}>
            💾 حفظ ربط Noest
          </button>
          <button
            type="button"
            className={btn("gray")}
            disabled={!!busy.sync}
            onClick={syncCarriers}
          >
            {busy.sync
              ? "⏳ جاري التحديث... (قد يستغرق دقيقة)"
              : "🔄 تحديث قوائم التوصيل (ولايات/بلديات/أسعار)"}
          </button>
          <ToggleBtn
            on={noEnabled}
            onClick={() => toggleCarrier("noestEnabled", noEnabled, "Noest")}
          />
        </div>
      </div>

      <div className={cardNarrow} style={{ borderColor: "#E8A413" }}>
        <h3 className={cn(cardH3, "text-[var(--warn-ink)]")}>🟡 ربط ZR Express API</h3>
        <StatusBanner
          ok={!!settings.zrReady}
          okText="✓ مربوط بحساب ZR Express"
          badText="● غير مربوط بعد"
        />
        <div className={grid2}>
          <Field label="Tenant ID (X-Tenant)">
            <input
              className={inp}
              type="password"
              autoComplete="off"
              dir="ltr"
              value={zrTenant}
              onChange={(e) => setZrTenant(e.target.value)}
              placeholder={credPlaceholder(settings.zrReady, "أدخلي Tenant ID")}
            />
          </Field>
          <Field label="Secret Key">
            <input
              className={inp}
              type="password"
              autoComplete="off"
              dir="ltr"
              value={zrKey}
              onChange={(e) => setZrKey(e.target.value)}
              placeholder={credPlaceholder(settings.zrReady, "أدخلي Secret Key")}
            />
          </Field>
        </div>
        <div className="mb-3 mt-[-.3rem] text-[.75rem] text-[var(--ink-3)]">
          احصلي على Tenant ID و Secret Key من بوابة ZR Express (API Rest ← Token
          API — يظهر مرة واحدة فقط). تُخزَّن بشكل آمن ولا تظهر في الموقع. اتركي
          الحقول فارغة للإبقاء على القيم المحفوظة.
        </div>
        <div className={rowActions}>
          <button
            type="button"
            className={btn("blue")}
            style={{ background: "#E8A413" }}
            onClick={saveZr}
          >
            💾 حفظ ربط ZR Express
          </button>
          <button
            type="button"
            className={btn("gray")}
            disabled={!!busy.zrWh}
            onClick={enableZrWebhook}
          >
            {busy.zrWh
              ? "⏳ جاري التفعيل..."
              : settings.zrWebhookReady
                ? "🔔 Webhook مفعّل ✓ — إعادة التسجيل"
                : "🔔 تفعيل التتبع التلقائي (Webhook)"}
          </button>
          <button
            type="button"
            className={btn("gray")}
            disabled={!!busy.sync}
            onClick={syncCarriers}
          >
            {busy.sync
              ? "⏳ جاري التحديث... (قد يستغرق دقيقة)"
              : "🔄 تحديث قوائم التوصيل (ولايات/بلديات)"}
          </button>
          <ToggleBtn
            on={zrEnabled}
            onClick={() => toggleCarrier("zrEnabled", zrEnabled, "ZR Express")}
          />
        </div>
      </div>
    </div>
  );
}

import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 8;
const attempts = new Map<string, { count: number; resetAt: number }>();
const FALLBACK_STAGES = ["تم إنشاء الطلب", "تم التأكيد والشحن", "في مركز الفرز", "خرج للتوصيل", "تم الاستلام"];

function normalizePhone(value: unknown): string {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("00213")) digits = digits.slice(5);
  else if (digits.startsWith("213")) digits = digits.slice(3);
  if (digits.length === 9) digits = "0" + digits;
  return /^0[567]\d{8}$/.test(digits) ? digits : "";
}

function rateLimitKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = req.headers.get("x-real-ip")?.trim() || forwarded || "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

function allowed(req: NextRequest): boolean {
  const now = Date.now();
  const key = rateLimitKey(req);
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_REQUESTS) return false;
  current.count += 1;
  if (attempts.size > 5000) {
    for (const [k, v] of attempts) if (v.resetAt <= now) attempts.delete(k);
  }
  return true;
}

function text(value: unknown, max = 180): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim().slice(0, max);
  return clean || undefined;
}

function isDelivered(order: Record<string, unknown>): boolean {
  if (String(order.outcome ?? "").toLowerCase() === "delivered") return true;
  const ts = order.trackingStatus as { stage?: unknown; stageLabels?: unknown; alert?: unknown } | null;
  if (!ts || typeof ts.stage !== "number" || ts.alert) return false;
  const labels = Array.isArray(ts.stageLabels) && ts.stageLabels.length
    ? ts.stageLabels
    : FALLBACK_STAGES;
  return ts.stage >= labels.length - 1;
}

function publicTracking(order: Record<string, unknown>) {
  const ts = (order.trackingStatus ?? {}) as Record<string, unknown>;
  const rawEvents = Array.isArray(ts.events) ? ts.events : [];

  // Customer-facing history starts only when the parcel first reaches a
  // sorting/distribution centre. Earlier pickup, registration, and preparation
  // events remain private. Carrier event arrays are stored oldest-first.
  const firstCentreIndex = rawEvents.findIndex((raw) => {
    const event = (raw ?? {}) as Record<string, unknown>;
    const description = [event.label, event.location, event.badge]
      .filter((value): value is string => typeof value === "string")
      .join(" ")
      .toLowerCase();
    return /مركز|فرز|centre|hub|sorting cent(?:er|re)|centre de tri/.test(description);
  });

  const visibleEvents = firstCentreIndex >= 0
    ? rawEvents.slice(firstCentreIndex).slice(-12).reverse()
    : [];

  const events = visibleEvents.map((raw) => {
    const event = (raw ?? {}) as Record<string, unknown>;
    return {
      label: text(event.label, 120) ?? "تحديث الشحنة",
      date: typeof event.date === "string" || typeof event.date === "number" ? event.date : null,
      location: text(event.location, 100) ?? null,
      badge: text(event.badge, 30) ?? null,
    };
  });

  const stageLabels = Array.isArray(ts.stageLabels)
    ? ts.stageLabels.filter((v): v is string => typeof v === "string").slice(0, 8)
    : FALLBACK_STAGES;
  const stage = typeof ts.stage === "number"
    ? Math.max(0, Math.min(stageLabels.length - 1, ts.stage))
    : 0;
  const carrier = String(ts.carrier ?? (order.yalidine ? "yalidine" : order.noest ? "noest" : order.zr ? "zr" : ""));
  const parcel = carrier === "noest" ? order.noest : carrier === "zr" ? order.zr : order.yalidine;
  const parcelData = (parcel ?? {}) as Record<string, unknown>;

  return {
    orderNumber: order.num === undefined || order.num === null ? null : String(order.num).slice(0, 32),
    createdAt: typeof order.createdAt === "number" ? order.createdAt : null,
    carrier: carrier === "yalidine" ? "Yalidine" : carrier === "noest" ? "Noest" : carrier === "zr" ? "ZR Express" : null,
    tracking: text(ts.tracking, 80) ?? text(parcelData.tracking, 80) ?? null,
    stage,
    stageLabels: stageLabels.length ? stageLabels : FALLBACK_STAGES,
    alert: text(ts.alert, 180) ?? null,
    lastLabel: text(ts.lastLabel, 120) ?? null,
    lastDate: typeof ts.lastDate === "string" || typeof ts.lastDate === "number" ? ts.lastDate : null,
    lastLocation: text(ts.lastLocation, 100) ?? null,
    events,
  };
}

export async function POST(req: NextRequest) {
  if (!allowed(req)) {
    return NextResponse.json(
      { error: "rate_limited", message: "محاولات كثيرة. يرجى الانتظار قليلاً ثم إعادة المحاولة." },
      { status: 429, headers: { "Cache-Control": "no-store" } }
    );
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > 1024) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  let body: { phone?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const phone = normalizePhone(body.phone);
  if (!phone) {
    return NextResponse.json(
      { error: "invalid_phone", message: "يرجى إدخال رقم هاتف جزائري صحيح." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json(
      { error: "unavailable", message: "خدمة التتبع غير متاحة حالياً. يرجى المحاولة لاحقاً." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    // Orders are admin-only in Firestore. The Admin SDK performs the lookup
    // server-side; raw order documents never leave this route.
    const snapshot = await db.collection("orders").get();
    const matches = snapshot.docs
      .map((doc) => doc.data() as Record<string, unknown>)
      .filter((order) => normalizePhone(order.phone) === phone && !isDelivered(order))
      .map(publicTracking)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

    return NextResponse.json(
      { orders: matches },
      { headers: { "Cache-Control": "no-store, max-age=0", Vary: "X-Forwarded-For" } }
    );
  } catch (error) {
    console.error("[DS] /api/track", error);
    return NextResponse.json(
      { error: "unavailable", message: "تعذر جلب معلومات الشحن حالياً. يرجى المحاولة لاحقاً." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

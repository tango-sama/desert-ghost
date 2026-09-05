// Funnel event sink. The quiz posts each step here and this writes it to
// Firestore with the Admin SDK.
//
// WHY A ROUTE AND NOT A DIRECT CLIENT WRITE
// -----------------------------------------
// `funnels/**` is `allow write: if false` in firestore.rules — deliberately
// closed, not create-only like `orders`. Funnel counts are what campaign
// decisions get made from, so a client that could write them could forge them,
// and unlike an order there is no human on the other end who would notice.
// Everything reaching Firestore therefore goes through this route, which
// accepts only a fixed vocabulary of steps and a bounded payload.
//
// It always answers 200. This is called fire-and-forget from a conversion path;
// an analytics failure must never surface to a customer mid-quiz, and a 4xx
// would just produce console noise on the page that matters most.
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// The funnel, in order. Anything not on this list is rejected — an open
// `step` field would let a bad actor (or a typo) invent stages that quietly
// break every conversion rate computed downstream.
const STEPS = [
  "view",      // landed on /quiz
  "start",     // tapped through to the first question
  "answer",    // answered one question (carries `step_index`)
  "result",    // saw a recommendation
  "offer",     // tapped through to the /offer landing page
  "checkout",  // opened the order form
  "order",     // order saved
] as const;
type Step = (typeof STEPS)[number];

const MAX_STR = 200;

function str(v: unknown, max = MAX_STR): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false });
  }

  const step = str(body.step, 32) as Step | undefined;
  const sessionId = str(body.sessionId, 64);
  if (!step || !STEPS.includes(step) || !sessionId) {
    return NextResponse.json({ ok: false });
  }

  const adb = getAdminDb();
  // No Admin credentials configured — same degrade as the storage endpoint.
  if (!adb) return NextResponse.json({ ok: true, skipped: true });

  const funnel = str(body.funnel, 32) ?? "quiz";
  const doc: Record<string, unknown> = {
    funnel,
    step,
    sessionId,
    ts: Date.now(),
    // Which arm of the A/B test this visitor is in. Stamped on every event so
    // a variant's whole path can be reconstructed, not just its orders.
    variant: str(body.variant, 32) ?? null,
    stepIndex: Number.isFinite(Number(body.stepIndex)) ? Number(body.stepIndex) : null,
    // Answers so far, as short opaque codes ("skin", "a35") — never free text,
    // so no customer-typed content can reach this collection.
    answers: sanitizeAnswers(body.answers),
    productIds: sanitizeIds(body.productIds),
    value: Number.isFinite(Number(body.value)) ? Number(body.value) : null,
    orderId: str(body.orderId, 64) ?? null,
    // The campaign that produced this visitor, so funnel performance can be
    // read per ad rather than only in aggregate (lib/attribution.ts).
    campaignId: str(body.campaignId, 64) ?? null,
    adId: str(body.adId, 64) ?? null,
    channel: str(body.channel, 32) ?? null,
  };

  try {
    await adb.collection("funnels").doc(funnel).collection("events").add(doc);
  } catch (e) {
    console.error("[DS] funnel event", e);
  }
  return NextResponse.json({ ok: true });
}

/** Answers are a small fixed vocabulary; anything else is dropped. */
function sanitizeAnswers(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val !== "string") continue;
    // Codes only: letters/digits/underscore, short. Never prose.
    if (!/^[a-z0-9_]{1,24}$/i.test(val)) continue;
    if (!/^[a-z][a-z0-9_]{0,24}$/i.test(k)) continue;
    out[k] = val;
  }
  return Object.keys(out).length ? out : null;
}

function sanitizeIds(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const ids = v
    .filter((x): x is string | number => typeof x === "string" || typeof x === "number")
    .map((x) => String(x).slice(0, 64))
    .slice(0, 10);
  return ids.length ? ids : null;
}

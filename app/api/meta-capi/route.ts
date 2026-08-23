// Server-side Meta Conversions API (CAPI) for `Purchase` — recovers
// conversions the client-side Pixel call for the same order never got to
// send at all (ad-blockers, Safari ITP, iOS all strip client-side tracking
// calls before Meta ever sees them; no client-side fix can close that gap).
// Called fire-and-forget from `lib/meta-pixel.ts`'s `sendCapiPurchase()`
// right alongside each `trackPixelEvent("Purchase", ...)` call — never
// instead of it, and never awaited by the caller.
//
// Needs `META_CAPI_ACCESS_TOKEN` (Business Manager → System Users →
// generate a token with pixel/ads_management access) — same "a missing
// credential degrades gracefully instead of throwing" rule as
// lib/firebase-admin.ts's `FIREBASE_SERVICE_ACCOUNT_KEY`. Until that env
// var is set, this route is a documented no-op (`{ skipped: true }`) —
// every call site fires-and-forgets it, so a missing token must never
// surface as an error to the customer.
import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { normalizeDzPhone } from "@/lib/meta-pixel";

export const dynamic = "force-dynamic";

const GRAPH_VERSION = "v21.0";

// Graph API expects PRE-hashed em/ph (unlike the client JS SDK, which
// hashes for you) — SHA-256 of the trimmed, lowercased value, same
// normalization Meta's own docs specify.
function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

type CapiBody = {
  eventId?: unknown;
  contentIds?: unknown;
  value?: unknown;
  currency?: unknown;
  eventSourceUrl?: unknown;
  phone?: unknown;
  firstName?: unknown;
  fbp?: unknown;
  fbc?: unknown;
};

export async function POST(req: NextRequest) {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  // Not configured yet — degrade silently. This must never be able to
  // break a real checkout just because CAPI credentials aren't set up.
  if (!token || !pixelId) return NextResponse.json({ skipped: true });

  let body: CapiBody;
  try {
    body = (await req.json()) as CapiBody;
  } catch {
    return NextResponse.json({ skipped: true });
  }
  if (
    typeof body.eventId !== "string" ||
    !body.eventId ||
    !Array.isArray(body.contentIds) ||
    typeof body.value !== "number" ||
    typeof body.currency !== "string" ||
    typeof body.eventSourceUrl !== "string"
  ) {
    return NextResponse.json({ skipped: true });
  }

  const userData: Record<string, unknown> = {
    client_ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    client_user_agent: req.headers.get("user-agent") ?? undefined,
  };
  if (typeof body.phone === "string" && body.phone) {
    userData.ph = [sha256(normalizeDzPhone(body.phone))];
  }
  if (typeof body.firstName === "string" && body.firstName) {
    userData.fn = [sha256(body.firstName)];
  }
  if (typeof body.fbp === "string" && body.fbp) userData.fbp = body.fbp;
  if (typeof body.fbc === "string" && body.fbc) userData.fbc = body.fbc;

  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: body.eventId,
        event_source_url: body.eventSourceUrl,
        action_source: "website",
        user_data: userData,
        custom_data: {
          currency: body.currency,
          value: body.value,
          content_ids: body.contentIds,
          content_type: "product",
        },
      },
    ],
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      console.error("[DS] meta-capi", res.status, await res.text());
    }
  } catch (err) {
    console.error("[DS] meta-capi", err);
  }
  // Always 200 — this endpoint's own failures must never surface to the
  // customer-facing order flow that calls it fire-and-forget.
  return NextResponse.json({ ok: true });
}

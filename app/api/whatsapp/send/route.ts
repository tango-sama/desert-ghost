// Outbound WhatsApp send, from the admin panel only.
//
// This is the first route in this repo that must NOT be open. The other two
// (`meta-capi`, `storage-closet`) are safe unauthenticated — they either
// verify their input against Firestore or return derived integers. An
// unauthenticated send endpoint is a different thing entirely: it would let
// anyone on the internet send WhatsApp messages from the shop's own number.
//
// So every request must carry the signed-in admin's Firebase ID token, and
// `isAdminRequest` fails closed — a missing, expired, forged or unverifiable
// token is a 401, including when Admin credentials are not configured at all.
import type { NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/firebase-admin-auth";
import { sendText, waWindowOpen } from "@/lib/whatsapp-cloud";
import { getThreadMeta, saveOutbound } from "@/lib/wa-store";

export const dynamic = "force-dynamic";

const MAX_LEN = 4096; // WhatsApp's own text-body limit

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req.headers.get("authorization")))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { waId?: unknown; text?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  // Digits only — this goes straight into the Graph API path/payload.
  const waId = String(body.waId ?? "").replace(/[^0-9]/g, "");
  const text = String(body.text ?? "").trim();
  if (!waId || !text) return Response.json({ error: "bad_request" }, { status: 400 });
  if (text.length > MAX_LEN) return Response.json({ error: "too_long" }, { status: 400 });

  // Refuse a send WhatsApp would reject anyway, so the panel gets a clear
  // reason instead of an opaque Graph error.
  const meta = await getThreadMeta(waId);
  if (!waWindowOpen(meta?.lastInboundAt)) {
    return Response.json({ error: "window_closed" }, { status: 409 });
  }

  const result = await sendText(waId, text);
  if (!result.sent) {
    return Response.json({ error: result.reason ?? "send_failed" }, { status: 502 });
  }

  // Only recorded after Meta accepted it — the thread must never show a
  // message the customer did not receive.
  await saveOutbound(waId, text, result.wamid);
  return Response.json({ ok: true });
}

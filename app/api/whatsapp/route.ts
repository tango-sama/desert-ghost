// Meta WhatsApp Cloud API webhook — the only entry point for inbound
// customer messages.
//
//   GET   Meta's one-time verification handshake when the callback URL is
//         saved in the app dashboard.
//   POST  Message delivery. Signature-verified, stored, acknowledged, and
//         only then handed to the model.
//
// Two rules govern the POST path:
//   1. The signature is checked against the RAW body, before any parsing.
//   2. The 200 goes out first. Meta retries with backoff and eventually
//      disables a webhook that is slow or failing, so drafting — a
//      multi-second model call — happens in after(), never inline.
import { after, type NextRequest } from "next/server";
import { describePayload, parseInbound, verifyChallenge, verifySignature } from "@/lib/whatsapp-cloud";
import { recentMessages, saveDraft, saveInbound } from "@/lib/wa-store";
import { draftReply } from "@/lib/whatsapp-ai";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const challenge = verifyChallenge(req.nextUrl.searchParams);
  // Plain text, not JSON — Meta compares the body byte for byte.
  if (challenge) {
    console.log("[DS] whatsapp webhook verified");
    return new Response(challenge, { status: 200 });
  }
  console.error(
    "[DS] whatsapp webhook verify failed",
    process.env.WHATSAPP_VERIFY_TOKEN ? "token mismatch" : "WHATSAPP_VERIFY_TOKEN unset"
  );
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  // Raw bytes: re-serializing parsed JSON changes key order and whitespace,
  // and the HMAC would never match.
  const raw = await req.text();

  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    // Distinguish the two causes: an unset secret rejects everything, which
    // otherwise looks exactly like a wrong one.
    console.error(
      "[DS] whatsapp webhook bad signature",
      process.env.WHATSAPP_APP_SECRET ? "(check WHATSAPP_APP_SECRET matches the app)" : "(WHATSAPP_APP_SECRET unset)"
    );
    return new Response("forbidden", { status: 403 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Malformed but signed — acknowledge so Meta stops retrying it.
    return Response.json({ ok: true });
  }

  const messages = parseInbound(payload);

  // Store inbound synchronously: it is a single small write, and the thread
  // must exist before any draft can attach to it. `saveInbound` returns
  // false for a message already stored, which is how a webhook retry stops
  // here instead of drafting a second reply.
  const fresh: string[] = [];
  for (const m of messages) {
    if (await saveInbound(m)) fresh.push(m.waId);
  }

  // One line per delivery, shape only — no message text, no phone numbers.
  // "Nothing showed up in the inbox" has several indistinguishable causes,
  // and this is what tells them apart: absent entirely means Meta never
  // called; `parsed:0` means it called with something this feature skips;
  // `parsed:1 stored:0` means the write failed (usually Firebase Admin
  // credentials) rather than the delivery.
  console.log(
    `[DS] whatsapp webhook parsed:${messages.length} stored:${fresh.length} — ${describePayload(payload)}`
  );

  // One draft per conversation even when Meta batches several messages from
  // the same customer — the model sees the whole thread anyway.
  const waIds = [...new Set(fresh)];
  if (waIds.length) {
    after(async () => {
      for (const waId of waIds) {
        try {
          const history = await recentMessages(waId);
          if (!history.length) continue;
          const draft = await draftReply(history);
          // No draft (model unconfigured, rate-limited, refused) is a valid
          // outcome: the message sits in the inbox to be answered by hand.
          if (!draft) continue;
          await saveDraft(waId, {
            text: draft.text,
            status: "pending",
            createdAt: Date.now(),
            model: draft.model,
            handoff: draft.handoff,
          });
        } catch (e) {
          console.error("[DS] whatsapp draft", e instanceof Error ? e.message : e);
        }
      }
    });
  }

  return Response.json({ ok: true });
}

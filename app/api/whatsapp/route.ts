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
import { parseInbound, verifyChallenge, verifySignature } from "@/lib/whatsapp-cloud";
import { recentMessages, saveDraft, saveInbound } from "@/lib/wa-store";
import { draftReply } from "@/lib/whatsapp-ai";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const challenge = verifyChallenge(req.nextUrl.searchParams);
  // Plain text, not JSON — Meta compares the body byte for byte.
  if (challenge) return new Response(challenge, { status: 200 });
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  // Raw bytes: re-serializing parsed JSON changes key order and whitespace,
  // and the HMAC would never match.
  const raw = await req.text();

  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    console.error("[DS] whatsapp webhook bad signature");
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

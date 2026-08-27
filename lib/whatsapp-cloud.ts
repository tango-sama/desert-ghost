// Server-only transport for the Meta WhatsApp Cloud API — the counterpart
// to lib/meta-capi.ts, and held to the same rules: WHATSAPP_ACCESS_TOKEN
// and WHATSAPP_APP_SECRET are read from the environment here and nowhere
// else, they travel in a request header/HMAC and never in a URL, and no
// log line in this file ever prints either one.
//
// NEVER import this from a "use client" file. The admin panel reaches the
// send path through app/api/whatsapp/send instead, so no token has a path
// into a browser bundle.
//
// Note the deliberate split from lib/whatsapp.ts: that file builds public
// `wa.me` deep links for the storefront and is client-safe. This one talks
// to the Graph API as the business and is not.
import crypto from "node:crypto";

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";

export type InboundMessage = {
  /** Meta's own message id (`wamid.…`) — stable across webhook retries. */
  wamid: string;
  /** Customer phone in international digits, no `+` (e.g. `213662705830`). */
  waId: string;
  profileName?: string;
  text: string;
  /** Epoch ms. Meta sends seconds; we normalize once, here. */
  ts: number;
};

// --- Webhook signature ----------------------------------------------------

/**
 * Verify Meta's `X-Hub-Signature-256` header against the RAW request body.
 *
 * `raw` must be the exact bytes Meta sent (`await req.text()`), not a
 * re-serialization of the parsed JSON — key order and whitespace differ and
 * the HMAC would never match. Uses a constant-time compare so the check
 * cannot be probed byte by byte.
 *
 * Returns false when the app secret is unset: an unverifiable request is
 * treated as untrusted rather than waved through.
 */
export function verifySignature(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;

  const expected = crypto.createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  const got = header.slice("sha256=".length);
  // timingSafeEqual throws on a length mismatch, so guard first.
  if (got.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(got, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/** The GET handshake Meta performs once when the webhook URL is saved. */
export function verifyChallenge(params: URLSearchParams): string | null {
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!token) return null;
  if (params.get("hub.mode") !== "subscribe") return null;
  if (params.get("hub.verify_token") !== token) return null;
  return params.get("hub.challenge");
}

// --- Inbound parsing ------------------------------------------------------

type WebhookValue = {
  contacts?: { wa_id?: string; profile?: { name?: string } }[];
  messages?: {
    id?: string;
    from?: string;
    timestamp?: string;
    type?: string;
    text?: { body?: string };
  }[];
};

/**
 * Pull the text messages out of a webhook payload.
 *
 * Meta batches: one POST can carry several entries, each with several
 * changes, each with several messages. Non-text messages (images, audio,
 * stickers, reactions) and status callbacks (`delivered`, `read`) are
 * skipped — this feature only drafts replies to text, and a status callback
 * carries no `messages` array at all.
 */
export function parseInbound(payload: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return out;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const value = (change as { value?: WebhookValue })?.value;
      if (!value?.messages?.length) continue;

      // `contacts` is a sibling array keyed by wa_id, not per message.
      const names = new Map<string, string>();
      for (const c of value.contacts ?? []) {
        if (c?.wa_id && c.profile?.name) names.set(c.wa_id, c.profile.name);
      }

      for (const m of value.messages) {
        const text = m?.text?.body?.trim();
        if (m?.type !== "text" || !text || !m.id || !m.from) continue;
        const secs = Number(m.timestamp);
        out.push({
          wamid: m.id,
          waId: m.from,
          profileName: names.get(m.from),
          text,
          ts: Number.isFinite(secs) && secs > 0 ? secs * 1000 : Date.now(),
        });
      }
    }
  }
  return out;
}

// --- Outbound -------------------------------------------------------------

export type SendResult = { sent: boolean; wamid?: string; reason?: string };

/**
 * Send a free-form text message. Resolves with `{ sent: false, reason }`
 * rather than throwing — every caller is either a background job or an
 * admin action that must report a failure, not crash on one.
 *
 * Free-form text only reaches a customer inside WhatsApp's 24-hour
 * customer-service window (see waWindowOpen); outside it Meta rejects the
 * send and the reason surfaces to the panel.
 */
export async function sendText(waId: string, text: string): Promise<SendResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return { sent: false, reason: "not_configured" };

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        // Token in a header, never the query string — it cannot leak into
        // a proxy or access log this way.
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: waId,
        type: "text",
        text: { preview_url: false, body: text },
      }),
    });

    const json = (await res.json().catch(() => null)) as {
      messages?: { id?: string }[];
      error?: { message?: string; code?: number };
    } | null;

    if (!res.ok || json?.error) {
      // Meta's own error text is safe to log and is the only useful clue
      // when a send fails; the token is never part of it.
      const reason = json?.error?.message || `http_${res.status}`;
      console.error("[DS] whatsapp sendText", reason);
      return { sent: false, reason };
    }
    return { sent: true, wamid: json?.messages?.[0]?.id };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "network_error";
    console.error("[DS] whatsapp sendText", reason);
    return { sent: false, reason };
  }
}

// --- The 24-hour customer-service window ----------------------------------

export const WA_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * WhatsApp only allows free-form business replies within 24h of the
 * customer's last inbound message; after that only pre-approved templates
 * go through. Both the panel (to disable the composer) and the send route
 * (to refuse before spending a Graph call) decide from this one function.
 */
export function waWindowOpen(lastInboundAt: number | undefined, now = Date.now()): boolean {
  return !!lastInboundAt && now - lastInboundAt < WA_WINDOW_MS;
}

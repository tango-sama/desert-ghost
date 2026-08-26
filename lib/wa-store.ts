// Server-only persistence for WhatsApp conversations (Admin SDK, bypasses
// firestore.rules). NEVER import from a "use client" file — the admin panel
// reads these documents itself with the signed-in admin's own credentials
// (see watchWaThreads in lib/admin.ts); this module is the write side.
//
// SHAPE
//   wa_threads/{waId}                      one document per customer phone
//     { waId, profileName, lastInboundAt, lastMessageAt, preview, unread,
//       draft?: { text, status, createdAt, model, handoff } }
//   wa_threads/{waId}/messages/{wamid}     one per message, either direction
//     { direction: "in" | "out", text, ts, wamid, status? }
//
// The message doc id is Meta's own `wamid`, which makes webhook retries —
// and Meta does retry — idempotent by construction, the same way carrier
// parcel creation is idempotent per order (architecture invariant 5).
//
// This collection holds customer phone numbers and message bodies, so it
// sits in the same admin-only class as `orders` and `messages`:
// firestore.rules must grant it `allow read, write: if isAdmin()` and
// nothing to anonymous clients.
import { getAdminDb } from "@/lib/firebase-admin";

export const WA_THREADS = "wa_threads";

export type WaDraft = {
  text: string;
  status: "pending" | "dismissed";
  createdAt: number;
  model?: string;
  /** The model judged this out of scope and drafted a handoff to a human. */
  handoff?: boolean;
};

/** A single inbound message persisted; false when it was already stored. */
export async function saveInbound(msg: {
  wamid: string;
  waId: string;
  profileName?: string;
  text: string;
  ts: number;
}): Promise<boolean> {
  const adb = getAdminDb();
  if (!adb) return false;

  const thread = adb.collection(WA_THREADS).doc(msg.waId);
  const message = thread.collection("messages").doc(msg.wamid);

  try {
    // A transaction rather than a plain `create()`: the existence check and
    // the thread-summary update have to agree, otherwise a retried webhook
    // would bump `unread` a second time for a message already stored.
    return await adb.runTransaction(async (tx) => {
      const existing = await tx.get(message);
      if (existing.exists) return false;

      tx.set(message, {
        direction: "in",
        wamid: msg.wamid,
        text: msg.text,
        ts: msg.ts,
      });
      tx.set(
        thread,
        {
          waId: msg.waId,
          ...(msg.profileName ? { profileName: msg.profileName } : {}),
          lastInboundAt: msg.ts,
          lastMessageAt: msg.ts,
          preview: msg.text.slice(0, 140),
          unread: true,
        },
        { merge: true }
      );
      return true;
    });
  } catch (e) {
    console.error("[DS] wa saveInbound", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Record a message this shop sent, after the Graph API accepted it. */
export async function saveOutbound(waId: string, text: string, wamid?: string): Promise<void> {
  const adb = getAdminDb();
  if (!adb) return;
  const ts = Date.now();
  const thread = adb.collection(WA_THREADS).doc(waId);
  try {
    await thread
      .collection("messages")
      // No wamid when Meta accepted the send but returned no id — fall back
      // to a time-based id so the message still shows in the thread.
      .doc(wamid || `out_${ts}`)
      .set({ direction: "out", wamid: wamid ?? null, text, ts });
    await thread.set(
      { lastMessageAt: ts, preview: text.slice(0, 140), unread: false, draft: null },
      { merge: true }
    );
  } catch (e) {
    console.error("[DS] wa saveOutbound", e instanceof Error ? e.message : e);
  }
}

/** The last `limit` messages of a thread, oldest first — the model's context. */
export async function recentMessages(
  waId: string,
  limit = 20
): Promise<{ direction: "in" | "out"; text: string; ts: number }[]> {
  const adb = getAdminDb();
  if (!adb) return [];
  try {
    const snap = await adb
      .collection(WA_THREADS)
      .doc(waId)
      .collection("messages")
      .orderBy("ts", "desc")
      .limit(limit)
      .get();
    return snap.docs
      .map((d) => d.data() as { direction: "in" | "out"; text: string; ts: number })
      .reverse();
  } catch (e) {
    console.error("[DS] wa recentMessages", e instanceof Error ? e.message : e);
    return [];
  }
}

export async function saveDraft(waId: string, draft: WaDraft): Promise<void> {
  const adb = getAdminDb();
  if (!adb) return;
  try {
    await adb.collection(WA_THREADS).doc(waId).set({ draft }, { merge: true });
  } catch (e) {
    console.error("[DS] wa saveDraft", e instanceof Error ? e.message : e);
  }
}

/** Thread fields the send route needs before spending a Graph call. */
export async function getThreadMeta(
  waId: string
): Promise<{ lastInboundAt?: number } | null> {
  const adb = getAdminDb();
  if (!adb) return null;
  try {
    const snap = await adb.collection(WA_THREADS).doc(waId).get();
    if (!snap.exists) return null;
    const d = snap.data() as Record<string, unknown>;
    return { lastInboundAt: typeof d.lastInboundAt === "number" ? d.lastInboundAt : undefined };
  } catch (e) {
    console.error("[DS] wa getThreadMeta", e instanceof Error ? e.message : e);
    return null;
  }
}

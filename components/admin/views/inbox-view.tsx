"use client";

// WhatsApp inbox — conversations arrive from the Cloud API webhook, each new
// customer message already carrying an AI-suggested reply.
//
// Nothing is ever sent automatically. A draft is a suggestion in an editable
// box; it reaches the customer only when the owner taps إرسال. Sending goes
// through /api/whatsapp/send (see lib/admin.ts `sendWaReply`) so the access
// token stays server-side.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  sendWaReply,
  updateWaThread,
  watchWaMessages,
  type WaMessage,
  type WaThread,
} from "@/lib/admin";
import { useAdminStore } from "@/stores/admin-store";
import { cn } from "@/lib/utils";
import { btn, txt, EmptyState, fmtDate } from "@/components/admin/ui";

const WINDOW_MS = 24 * 60 * 60 * 1000;

// Mirrors waWindowOpen in lib/whatsapp-cloud.ts — WhatsApp only accepts a
// free-form business reply within 24h of the customer's last message. Shown
// here so the composer explains itself instead of failing at the Graph API.
function windowLeft(lastInboundAt: number | undefined): number {
  if (!lastInboundAt) return 0;
  return Math.max(0, lastInboundAt + WINDOW_MS - Date.now());
}

function fmtLeft(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h} سا ${m} د` : `${m} د`;
}

function threadName(t: WaThread): string {
  return t.profileName?.trim() || t.waId || t.id;
}

export function InboxView() {
  const threads = useAdminStore((s) => s.waThreads);
  const toast = useAdminStore((s) => s.toast);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Keep a selection as threads stream in, but never override the owner's.
  const active = useMemo(
    () => threads.find((t) => t.id === activeId) ?? null,
    [threads, activeId]
  );

  if (!threads.length) {
    return <EmptyState icon="💬" text="لا توجد محادثات واتساب بعد" />;
  }

  return (
    <div className="grid grid-cols-[320px_1fr] gap-4 max-[860px]:grid-cols-1">
      <div className="max-h-[70vh] overflow-y-auto rounded-[18px] border border-border bg-card">
        {threads.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setActiveId(t.id);
              if (t.unread) void updateWaThread(t.id, { unread: false }).catch(() => {});
            }}
            className={cn(
              "block w-full cursor-pointer border-b border-border px-4 py-3 text-right transition-colors",
              active?.id === t.id
                ? "bg-[rgba(224,114,140,.1)]"
                : "hover:bg-[rgba(255,255,255,.03)]"
            )}
          >
            <div className="flex items-center gap-2">
              <b className="truncate">{threadName(t)}</b>
              {t.unread && (
                <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--rose)]" />
              )}
              {t.draft?.status === "pending" && (
                <span className="mr-auto shrink-0 text-[.72rem]" title="يوجد رد مقترح">
                  🤖
                </span>
              )}
            </div>
            <div className="mt-1 truncate text-[.78rem] text-[var(--ink-3)]">
              {t.preview || "—"}
            </div>
            <div className="mt-0.5 text-[.7rem] text-[var(--ink-3)]">
              {t.lastMessageAt ? fmtDate(t.lastMessageAt) : ""}
            </div>
          </button>
        ))}
      </div>

      {active ? (
        <Thread key={active.id} thread={active} toast={toast} />
      ) : (
        <div className="rounded-[18px] border border-border bg-card">
          <EmptyState icon="👉" text="اختاري محادثة" />
        </div>
      )}
    </div>
  );
}

function Thread({ thread, toast }: { thread: WaThread; toast: (m: string) => void }) {
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  // The window badge and the composer's enabled state are both derived from
  // the clock, so a thread left open on screen would otherwise keep claiming
  // the window is open long after it shut. Re-render once a minute — the
  // badge is rendered in hours and minutes, so that is the finest granularity
  // that shows.
  const [, setTick] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const waId = thread.waId || thread.id;

  useEffect(() => watchWaMessages(waId, setMessages), [waId]);

  // Load the pending draft into the composer, and reload it if a newer one
  // arrives — but never clobber text the owner has started editing.
  const draftText = thread.draft?.status === "pending" ? thread.draft.text : "";
  const loadedDraft = useRef<string | null>(null);
  useEffect(() => {
    if (draftText && loadedDraft.current !== draftText && !text.trim()) {
      loadedDraft.current = draftText;
      setText(draftText);
    }
    // `text` is deliberately not a dependency: this effect reacts to a new
    // draft arriving, not to the owner typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftText]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const left = windowLeft(thread.lastInboundAt);
  const open = left > 0;

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const res = await sendWaReply(waId, body);
    setSending(false);
    if (res.ok) {
      setText("");
      loadedDraft.current = null;
      toast("تم الإرسال");
      return;
    }
    toast(
      res.error === "window_closed"
        ? "انتهت مهلة 24 ساعة — لا يمكن الرد الآن"
        : res.error === "not_configured"
          ? "واتساب غير مُعد بعد"
          : "فشل الإرسال"
    );
  }

  async function dismissDraft() {
    try {
      await updateWaThread(waId, { "draft.status": "dismissed" });
      loadedDraft.current = null;
      setText("");
    } catch {
      toast("فشل");
    }
  }

  return (
    <div className="flex max-h-[70vh] flex-col rounded-[18px] border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <b>{threadName(thread)}</b>
          <div className="num mt-0.5 text-[.75rem] text-[var(--ink-3)]">📱 {waId}</div>
        </div>
        <span
          className={cn(
            "rounded-full px-[9px] py-[2px] text-[.72rem]",
            open
              ? "bg-[var(--ok-bg)] text-[var(--ok-ink)]"
              : "border border-border bg-[var(--card-2)] text-[var(--ink-3)]"
          )}
        >
          {open ? `يمكن الرد: ${fmtLeft(left)}` : "انتهت مهلة 24 سا"}
        </span>
      </div>

      <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[80%] rounded-[14px] px-3 py-2 text-[.85rem] whitespace-pre-wrap",
              m.direction === "out"
                ? "ms-auto bg-[var(--rose)] text-white"
                : "me-auto bg-[var(--card-2)] text-foreground"
            )}
          >
            {m.text}
            <div className="mt-1 text-[.65rem] opacity-70">
              {m.ts ? fmtDate(m.ts) : ""}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-4 py-3">
        {thread.draft?.status === "pending" && (
          <div className="mb-2 flex items-center gap-2 text-[.75rem] text-[var(--ink-3)]">
            <span>🤖 رد مقترح — راجعيه قبل الإرسال</span>
            {thread.draft.handoff && (
              <span className="rounded-full bg-[var(--card-2)] px-[9px] py-[2px] text-[var(--ink-2)]">
                يحتاج ردّاً منكِ
              </span>
            )}
            <button
              type="button"
              onClick={() => void dismissDraft()}
              className="mr-auto cursor-pointer underline"
            >
              تجاهل
            </button>
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!open}
          placeholder={open ? "اكتبي ردّاً..." : "انتهت مهلة الـ24 ساعة للرد المجاني"}
          className={cn(txt, "min-h-[70px] w-full")}
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            className={btn("green")}
            disabled={!open || sending || !text.trim()}
            onClick={() => void send()}
          >
            {sending ? "..." : "إرسال"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { deleteDocIn } from "@/lib/admin";
import { useAdminStore } from "@/stores/admin-store";
import {
  btn,
  rowActions,
  orderCardCls,
  orderItemsCls,
  EmptyState,
  fmtDate,
  waIntl,
} from "@/components/admin/ui";

export function MessagesView() {
  const messages = useAdminStore((s) => s.messages);
  const toast = useAdminStore((s) => s.toast);

  async function delMessage(id: string) {
    if (!confirm("حذف الرسالة؟")) return;
    try {
      await deleteDocIn("messages", id);
      useAdminStore.setState((s) => ({
        messages: s.messages.filter((m) => String(m.id) !== String(id)),
      }));
      toast("تم الحذف");
    } catch (e) {
      console.error(e);
      toast("فشل الحذف");
    }
  }

  if (!messages.length) return <EmptyState icon="💬" text="لا توجد رسائل" />;

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id} className={orderCardCls}>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <b>{m.name}</b>
              <div className="mt-1 text-[.78rem] text-[var(--ink-3)]">
                <span className="num">📱 {m.phone || "—"}</span>
                {m.timestamp ? ` · ${fmtDate(m.timestamp)}` : ""}
              </div>
            </div>
            <div className={rowActions}>
              {m.phone && (
                <a
                  className={btn("green", true)}
                  href={`https://wa.me/${waIntl(m.phone)}`}
                  target="_blank"
                >
                  رد
                </a>
              )}
              <button
                type="button"
                className={btn("danger", true)}
                onClick={() => delMessage(m.id)}
              >
                حذف
              </button>
            </div>
          </div>
          <div className={orderItemsCls}>{m.message}</div>
        </div>
      ))}
    </div>
  );
}

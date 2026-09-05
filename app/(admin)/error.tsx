"use client";

// The admin segment's error boundary.
//
// WHY THIS EXISTS
// ---------------
// The app had no boundary of any kind, so a single throw inside any one admin
// view escaped the React tree and Next.js replaced the WHOLE panel — sidebar,
// tabs and all — with its built-in "This page couldn't load" page
// (next/dist/client/components/builtin/global-error.js). That page names no
// cause, so a broken tab was both fatal and undiagnosable. This is what the
// owner hit on «النمو».
//
// The single most important thing here is that it PRINTS THE ERROR. React
// strips messages from production builds down to a `digest` in some paths, so
// both are shown, selectable, next to a copy button — the point is that the
// owner can send the text rather than a screenshot of a blank page.
//
// components/admin/admin-shell.tsx has a second, narrower boundary around the
// active view, which keeps the sidebar alive and catches most of these before
// they reach this one. This is the backstop for everything outside that — the
// shell itself, the auth gate, the store.
import { useEffect, useState } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  // Same `[DS]` prefix the data layer logs under, so a browser console for this
  // app reads consistently.
  useEffect(() => {
    console.error("[DS] admin segment error", error);
  }, [error]);

  const detail = [error.message, error.digest && `digest: ${error.digest}`]
    .filter(Boolean)
    .join("\n");

  function copy() {
    void navigator.clipboard
      ?.writeText(detail)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background px-4 py-16 text-foreground">
      <div className="mx-auto max-w-[560px] rounded-[18px] border border-border bg-card p-6">
        <h1 className="mb-2 text-xl font-black">تعذّر فتح لوحة التحكم</h1>
        <p className="mb-5 text-[.86rem] leading-7 text-[var(--ink-2)]">
          حدث خطأ غير متوقّع. بياناتكِ سليمة ولم يتغيّر شيء — جرّبي إعادة
          المحاولة، وإن تكرّر الخطأ أرسلي النص التالي كما هو.
        </p>

        <pre
          dir="ltr"
          className="mb-4 max-h-56 overflow-auto rounded-[12px] border border-border bg-[var(--card-2)] p-3 text-left text-[.76rem] leading-6 whitespace-pre-wrap break-words text-[var(--ink-2)] select-all"
        >
          {detail || "(no error message available)"}
        </pre>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="cursor-pointer rounded-[11px] bg-[var(--green)] px-[1.3rem] py-[.7rem] text-[.88rem] font-extrabold text-white transition-all hover:-translate-y-px hover:brightness-110"
          >
            ↻ إعادة المحاولة
          </button>
          <button
            type="button"
            onClick={copy}
            className="cursor-pointer rounded-[11px] border border-border bg-[var(--card-2)] px-[1.3rem] py-[.7rem] text-[.88rem] font-extrabold text-[var(--ink-2)] transition-all hover:-translate-y-px hover:text-foreground"
          >
            {copied ? "✓ تم النسخ" : "📋 نسخ الخطأ"}
          </button>
          {/* A hard navigation on purpose, not next/link: this is the escape
              hatch from a broken tree, and a client-side transition would
              re-render the same broken state. A full reload rebuilds it. */}
          <button
            type="button"
            onClick={() => window.location.assign("/amelhadj")}
            className="cursor-pointer rounded-[11px] border border-border bg-[var(--card-2)] px-[1.3rem] py-[.7rem] text-[.88rem] font-extrabold text-[var(--ink-2)] transition-all hover:-translate-y-px hover:text-foreground"
          >
            ↻ إعادة تحميل اللوحة
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/admin";
import { useAdminStore } from "@/stores/admin-store";
import { inp } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

const EMAIL_KEY = "ds_admin_email";

export function LoginCard() {
  const toast = useAdminStore((s) => s.toast);
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  // Prefill the last-used admin email (uncontrolled input, imperative
  // prefill — mirrors the old panel and keeps render pure).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(EMAIL_KEY);
      if (saved && emailRef.current && !emailRef.current.value)
        emailRef.current.value = saved;
    } catch {}
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const em = emailRef.current?.value.trim() ?? "";
    const pw = passRef.current?.value ?? "";
    if (!em || !pw) return;
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, em, pw);
      try {
        localStorage.setItem(EMAIL_KEY, em);
      } catch {}
      // success: onAuthStateChanged unmounts this card
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      console.error("[DS] login", code);
      toast(
        code === "auth/too-many-requests"
          ? "محاولات كثيرة، حاول بعد قليل"
          : "البريد الإلكتروني أو كلمة المرور غير صحيحة"
      );
      if (passRef.current) passRef.current.value = "";
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6 [background:var(--login-glow)]">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[380px] rounded-[22px] border border-border bg-card p-10 text-center [box-shadow:var(--shadow)]"
      >
        <div className="mb-1.5 bg-gradient-to-br from-[var(--rose)] to-[var(--gold)] bg-clip-text text-[1.6rem] font-black text-transparent">
          Desert Shop
        </div>
        <div className="mb-8 text-[.82rem] uppercase tracking-[2px] text-[var(--ink-3)]">
          لوحة التحكم
        </div>
        <input
          ref={emailRef}
          type="email"
          dir="ltr"
          required
          autoComplete="username"
          placeholder="البريد الإلكتروني"
          className={cn(inp, "mb-4 rounded-xl py-[.85rem] text-center text-base")}
        />
        <input
          ref={passRef}
          type="password"
          required
          autoComplete="current-password"
          placeholder="كلمة المرور"
          className={cn(inp, "mb-4 rounded-xl py-[.85rem] text-center text-base")}
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full cursor-pointer rounded-xl bg-gradient-to-br from-[var(--rose)] to-[var(--rose-deep)] py-[.9rem] text-[.95rem] font-extrabold text-white disabled:opacity-60"
        >
          {busy ? "⏳ جاري الدخول..." : "دخول"}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useAdminStore } from "@/stores/admin-store";
import { cn } from "@/lib/utils";
import type { AdminTheme } from "@/hooks/use-admin-theme";

export function AdminToast({ theme }: { theme: AdminTheme }) {
  const toastMsg = useAdminStore((s) => s.toastMsg);
  const toastKey = useAdminStore((s) => s.toastKey);
  // shown is derived: a toast is visible until its key gets marked hidden
  const [hiddenKey, setHiddenKey] = useState(0);

  useEffect(() => {
    if (!toastKey) return;
    const t = setTimeout(() => setHiddenKey(toastKey), 2200);
    return () => clearTimeout(t);
  }, [toastKey]);

  const shown = toastKey > 0 && hiddenKey < toastKey;

  return (
    <div
      className={cn(
        "fixed bottom-6 left-6 z-[200] rounded-xl border px-5 py-3 font-bold transition-all duration-300",
        theme === "light"
          ? "border-[#B5E6C8] bg-[#E9F9EF] text-[#15803D]"
          : "border-[#1f5137] bg-[#13201A] text-[#7CE5A0]",
        shown ? "translate-y-0 opacity-100" : "translate-y-[120%] opacity-0"
      )}
    >
      {toastMsg}
    </div>
  );
}

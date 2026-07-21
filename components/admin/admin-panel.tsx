"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/admin";
import { setStaffFlag } from "@/hooks/use-staff";
import { useAdminTheme } from "@/hooks/use-admin-theme";
import { cn } from "@/lib/utils";
import { LoginCard } from "@/components/admin/login-card";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminToast } from "@/components/admin/admin-toast";

// Auth gate for the whole panel: Firebase email/password only — the
// Firestore rules' isAdmin() is the real boundary; this decides what to
// render. Signing in also sets the ds_staff flag the storefront uses for
// its staff-only conveniences (same behavior as the old panel).
export function AdminPanel() {
  const theme = useAdminTheme();
  // undefined = auth state unknown (first paint), null = signed out.
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        if (u) setStaffFlag(true);
        setUser(u);
      }),
    []
  );

  return (
    <div
      suppressHydrationWarning
      className={cn(
        "admin min-h-screen w-full bg-background text-sm leading-[1.6] text-foreground",
        theme === "light" && "light"
      )}
    >
      {user ? (
        <AdminShell />
      ) : user === null ? (
        <LoginCard />
      ) : (
        <div className="flex min-h-screen items-center justify-center font-bold text-[var(--ink-3)]">
          ...
        </div>
      )}
      <AdminToast theme={theme} />
    </div>
  );
}

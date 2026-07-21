"use client";

import { useSyncExternalStore } from "react";

const STAFF_KEY = "ds_staff";
const STAFF_EVENT = "ds-staff-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(STAFF_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STAFF_EVENT, callback);
  };
}

function getSnapshot() {
  try {
    return localStorage.getItem(STAFF_KEY) === "1";
  } catch {
    return false;
  }
}

function getServerSnapshot() {
  return false;
}

export function useIsStaff(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setStaffFlag(on: boolean) {
  try {
    if (on) localStorage.setItem(STAFF_KEY, "1");
    else localStorage.removeItem(STAFF_KEY);
  } catch {}
  window.dispatchEvent(new Event(STAFF_EVENT));
}

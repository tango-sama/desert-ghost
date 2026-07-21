"use client";

import { useSyncExternalStore } from "react";

// Same localStorage key as the old amelhadj.html so the owner's saved
// per-device theme choice carries over to the rebuilt panel.
const THEME_KEY = "ds_theme";
const THEME_EVENT = "ds-theme-change";

export type AdminTheme = "dark" | "light";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_EVENT, callback);
  };
}

function getSnapshot(): AdminTheme {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function getServerSnapshot(): AdminTheme {
  return "dark";
}

export function useAdminTheme(): AdminTheme {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setAdminTheme(theme: AdminTheme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
  window.dispatchEvent(new Event(THEME_EVENT));
}

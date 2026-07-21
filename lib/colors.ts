import type { Category } from "@/lib/firebase";

// Stable fallback palette for categories without an explicit color, matching
// the 8-color cycle the admin panel assigns new categories from.
const PALETTE = [
  "#E0728C",
  "#D9A86C",
  "#C8546F",
  "#A18C92",
  "#E8C79A",
  "#6E5B61",
  "#F3B4C2",
  "#3A2A30",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function catColor(c: Category): string {
  if (c.color) return c.color;
  return PALETTE[hash(c.id || c.name) % PALETTE.length];
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const bigint = parseInt(
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean,
    16
  );
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

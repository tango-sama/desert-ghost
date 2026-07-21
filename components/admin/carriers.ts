// Shared carrier/order helpers for the admin views (ported from
// amelhadj.html's CO map, confirmStamp and orderCarrier).
import type { Order, CarrierKey } from "@/lib/admin";

// Carrier display metadata; the hex colors are the carriers' own brand marks.
export const CO: Record<
  CarrierKey,
  { name: string; color: string; icon: string; bg: string; ink: string }
> = {
  yalidine: {
    name: "Yalidine",
    color: "#E11900",
    icon: "🔴",
    bg: "var(--yal-bg)",
    ink: "var(--yal-ink)",
  },
  noest: {
    name: "Noest",
    color: "#1E73E8",
    icon: "🔵",
    bg: "var(--info-bg)",
    ink: "var(--info-ink)",
  },
  zr: {
    name: "ZR Express",
    color: "#E8A413",
    icon: "🟡",
    bg: "var(--warn-bg)",
    ink: "var(--warn-ink)",
  },
};

export const CREATE_FN: Record<CarrierKey, string> = {
  yalidine: "createYalidineParcel",
  noest: "createNoestParcel",
  zr: "createZrParcel",
};

// Pending orders sort before confirmed ones; confirmed sort by most
// recently created parcel.
export function confirmStamp(o: Order): number {
  if (o.noest?.tracking) return Number(o.noest.createdAt) || 1;
  if (o.yalidine?.tracking) return Number(o.yalidine.createdAt) || 1;
  if (o.zr?.tracking) return Number(o.zr.createdAt) || 1;
  return 0;
}

export function orderCarrier(o: Order): CarrierKey | null {
  if (o.noest?.tracking) return "noest";
  if (o.yalidine?.tracking) return "yalidine";
  if (o.zr?.tracking) return "zr";
  return null;
}

export function orderDate(o: Order): Date | null {
  if (o.placedAt?.seconds) return new Date(o.placedAt.seconds * 1000);
  if (o.createdAt) return new Date(o.createdAt);
  return null;
}

// Delivered = the tracker reached the last step with no active alert,
// based on the same freshness check the stepper itself uses.
export function isDelivered(o: Order): boolean {
  const carrier = orderCarrier(o);
  const ts = o.trackingStatus;
  if (!carrier || !ts || ts.carrier !== carrier || ts.tracking !== o[carrier]?.tracking)
    return false;
  const labels = ts.stageLabels ?? [];
  return (
    !ts.alert && ts.stage != null && labels.length > 0 && ts.stage >= labels.length - 1
  );
}

// A card starts folded when the order is old news: placed over 7 days ago
// or already delivered.
export function startsFolded(o: Order): boolean {
  const when = orderDate(o);
  return (
    (when !== null && Date.now() - when.getTime() > 7 * 24 * 60 * 60 * 1000) ||
    isDelivered(o)
  );
}

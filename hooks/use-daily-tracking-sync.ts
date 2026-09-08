"use client";

import { useEffect, useRef } from "react";
import { callFn, type Order, type TrackingStatus } from "@/lib/admin";
import { useAdminStore } from "@/stores/admin-store";
import {
  applyTrackingResult,
  isDelivered,
  orderCarrier,
} from "@/components/admin/carriers";

// Which calendar day the panel last ran the daily refresh on, per device —
// so reopening the panel later the same day does not refresh everything
// again, and so a panel that was closed at 00:00 still catches up on the
// day's refresh the next time it is opened.
const DAY_KEY = "ds_track_sync_day";
// Carrier APIs are rate-limited, so parcels are refreshed one at a time
// with this gap between calls.
const GAP_MS = 350;
// The day rollover is watched by polling the clock rather than by a single
// setTimeout to midnight — a laptop that sleeps through 00:00 still runs
// the refresh on the next tick after it wakes.
const TICK_MS = 60_000;

// Local calendar day (the owner's own midnight, not UTC).
function dayKey(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function readLastDay(): string | null {
  try {
    return localStorage.getItem(DAY_KEY);
  } catch {
    return null;
  }
}

function writeLastDay(day: string) {
  try {
    localStorage.setItem(DAY_KEY, day);
  } catch {
    /* private mode / storage disabled — the run just repeats next session */
  }
}

// Refreshes every parcel that is still moving, once per day at 00:00.
// Delivered orders are skipped: their tracking is final, so re-asking the
// carrier about them only burns rate limit. Mounted by the admin shell, so
// it keeps running whichever tab the panel is on.
export function useDailyTrackingSync() {
  const loaded = useAdminStore((s) => s.loaded);
  // A run is long (one call per parcel); this keeps the minute tick from
  // starting a second one on top of it.
  const running = useRef(false);

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;

    async function runIfDue() {
      if (running.current || cancelled) return;
      const today = dayKey();
      if (readLastDay() === today) return;

      running.current = true;
      // Stamped before the run, not after: a carrier outage must not turn
      // into a retry every minute for the rest of the day.
      writeLastDay(today);
      try {
        const { orders, toast } = useAdminStore.getState();
        const targets = orders.filter((o) => orderCarrier(o) && !isDelivered(o));
        if (!targets.length) return;

        let ok = 0;
        let fail = 0;
        for (const o of targets) {
          if (cancelled) return;
          try {
            const status = await callFn<TrackingStatus>("getParcelStatus", {
              orderId: o.id,
            });
            // Re-read rather than patch onto the snapshot taken when the
            // batch started — a long run can outlive its own list.
            const cur = useAdminStore
              .getState()
              .orders.find((x) => String(x.id) === String(o.id));
            if (cur) patchOrder(String(o.id), applyTrackingResult(cur, status));
            ok++;
          } catch (err) {
            console.error("getParcelStatus", o.id, err);
            fail++;
          }
          await new Promise((r) => setTimeout(r, GAP_MS));
        }
        if (cancelled) return;
        toast(
          `التحديث اليومي: تم تحديث ${ok} طرد` +
            (fail ? ` — تعذّر تحديث ${fail}` : "")
        );
      } finally {
        running.current = false;
      }
    }

    void runIfDue();
    const id = setInterval(runIfDue, TICK_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [loaded]);
}

// getParcelStatus persists the fresh status server-side; this mirrors it
// into the open panel without waiting for the Firestore watcher.
function patchOrder(id: string, patch: Partial<Order>) {
  useAdminStore.setState((s) => ({
    orders: s.orders.map((o) =>
      String(o.id) === String(id) ? { ...o, ...patch } : o
    ),
  }));
}

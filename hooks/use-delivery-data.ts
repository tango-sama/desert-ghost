"use client";

import { useEffect, useState } from "react";
import { getDeliveryData } from "@/lib/firebase";
import type { Carrier, CarrierCache } from "@/lib/delivery";

const CARRIERS: Carrier[] = ["yalidine", "noest", "zr"];

// Loads each carrier's live wilaya/commune/fee list (synced from Firestore
// by the syncCarriers Cloud Function) — falls back to the static defaults
// in delivery-data.ts until each one resolves.
export function useDeliveryData(): CarrierCache {
  const [cache, setCache] = useState<CarrierCache>({});

  useEffect(() => {
    let cancelled = false;
    CARRIERS.forEach((carrier) => {
      getDeliveryData(carrier).then((data) => {
        if (!cancelled && data) {
          setCache((prev) => ({ ...prev, [carrier]: data }));
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return cache;
}

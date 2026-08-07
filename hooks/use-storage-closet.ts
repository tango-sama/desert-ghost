"use client";

import { useEffect, useState } from "react";

// Fetches live "في المحل" (in-closet) counts for a set of product ids from
// /api/storage-closet — seller-mode-only UI, so callers should pass
// `enabled: false` (or an empty id list) outside staff mode to avoid the
// request entirely. Products with no admin-entered stock number are simply
// absent from the returned map (see the route's own comment) — treat a
// missing id as "don't show a badge", never as 0.
export function useStorageCloset(ids: string[], enabled: boolean): Record<string, number> {
  const key = ids.join(",");
  const [closet, setCloset] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!enabled || !key) return; // nothing to fetch — the return below already yields {}
    let cancelled = false;
    fetch("/api/storage-closet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: key.split(",") }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setCloset(data?.closet ?? {});
      })
      .catch((e) => console.error("[DS] useStorageCloset", e));
    return () => {
      cancelled = true;
    };
  }, [key, enabled]);

  return enabled && key ? closet : EMPTY_CLOSET;
}

const EMPTY_CLOSET: Record<string, number> = {};

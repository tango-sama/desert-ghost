// Deployment health probe — added while diagnosing FUNCTION_INVOCATION_FAILED
// on the home page, where the failure was invisible: the page 500'd with no
// usable stack, and there was no way to test the privileged layer on its own.
//
// It exercises each layer separately so a failure names itself instead of
// taking a page down anonymously. Each step is independently guarded, so this
// route itself can never 500 — a step that throws is reported, not fatal.
//
// DISCLOSURE: the response body is deliberately dull — booleans and short
// step names, never a credential, never a value, never customer data. The
// details (stack traces, Firebase's own error text) go to the server log,
// where only someone with deployment access can read them. Presence booleans
// for configuration are the most it reveals, which is what makes it safe to
// leave in place rather than a temporary hack to be ripped out later.
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Step = { step: string; ok: boolean; detail?: string };

/** Run one probe, converting any throw or rejection into a reported result. */
async function probe(step: string, fn: () => Promise<string | null>): Promise<Step> {
  try {
    const detail = await fn();
    return { step, ok: true, ...(detail ? { detail } : {}) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Full stack to the log — this is the thing that was missing when the
    // home page failed at import time with nothing to go on.
    console.error(`[DS] health: ${step} FAILED`, e);
    return { step, ok: false, detail: message.slice(0, 200) };
  }
}

export async function GET(_req: NextRequest) {
  const steps: Step[] = [];

  // 1. Which credentials the runtime believes it has. Presence only.
  steps.push(
    await probe("env", async () => {
      const present = [
        ["FIREBASE_SERVICE_ACCOUNT_KEY", !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY],
        ["ANTHROPIC_API_KEY", !!process.env.ANTHROPIC_API_KEY],
        ["WHATSAPP_ACCESS_TOKEN", !!process.env.WHATSAPP_ACCESS_TOKEN],
        ["WHATSAPP_PHONE_NUMBER_ID", !!process.env.WHATSAPP_PHONE_NUMBER_ID],
        ["WHATSAPP_APP_SECRET", !!process.env.WHATSAPP_APP_SECRET],
        ["WHATSAPP_VERIFY_TOKEN", !!process.env.WHATSAPP_VERIFY_TOKEN],
      ]
        .filter(([, v]) => v)
        .map(([k]) => k);
      return `${present.length}/6 set: ${present.join(",") || "none"}`;
    })
  );

  // 2. Does the service-account JSON even parse? A key mangled by a paste
  //    fails here, and this is the one check that says so out loud.
  steps.push(
    await probe("service-account-json", async () => {
      const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      if (!key) return "absent";
      const parsed = JSON.parse(key) as { type?: string; project_id?: string };
      if (parsed.type !== "service_account") throw new Error(`type is "${parsed.type}", expected "service_account"`);
      if (!parsed.project_id) throw new Error("no project_id");
      return `ok for project ${parsed.project_id}`;
    })
  );

  // 3. Can lib/firebase-admin be LOADED at all? This is the step that a
  //    static import on the home page could not survive.
  steps.push(
    await probe("import-firebase-admin", async () => {
      await import("@/lib/firebase-admin");
      return "module loaded";
    })
  );

  // 4. Does the Admin app actually initialise with those credentials?
  steps.push(
    await probe("admin-init", async () => {
      const { getAdminDb } = await import("@/lib/firebase-admin");
      return getAdminDb() ? "firestore handle created" : "no handle (credentials unusable)";
    })
  );

  // 5. A real privileged read — the exact call the home page makes.
  steps.push(
    await probe("firestore-read", async () => {
      const { getOrderStats } = await import("@/lib/firebase-admin");
      const stats = await getOrderStats();
      return stats ? `read ok (${Object.keys(stats).length} products with order history)` : "returned null";
    })
  );

  // 6. The home page's OWN data path — the four client-SDK reads
  //    app/(storefront)/page.tsx makes before rendering. These run the
  //    browser Firebase SDK on the server, a different stack from the Admin
  //    SDK above, and nothing else probed here would catch a failure in it.
  //    Each is timed and reported separately so a single slow or hanging
  //    collection is visible rather than averaged away.
  steps.push(
    await probe("storefront-reads", async () => {
      const { getProducts, getCategories, getFeatured, getSettings } = await import("@/lib/firebase");
      const timed = async (name: string, fn: () => Promise<unknown>) => {
        const t = Date.now();
        const v = await fn();
        const n = Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : 0;
        return `${name}:${n}/${Date.now() - t}ms`;
      };
      return (
        await Promise.all([
          timed("products", getProducts),
          timed("categories", getCategories),
          timed("featured", getFeatured),
          timed("settings", getSettings),
        ])
      ).join(" ");
    })
  );

  const ok = steps.every((s) => s.ok);
  return Response.json({ ok, steps }, { status: 200 });
}

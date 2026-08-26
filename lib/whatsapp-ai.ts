// Server-only: drafts a reply to a customer's WhatsApp message with Claude.
//
// GROUNDING — the whole point of this file
// ----------------------------------------
// The model is never asked to recall anything about the shop. Every product,
// price and delivery fee it is allowed to mention is assembled from Firestore
// into a "shop facts" block and put in front of it on each call, so a price it
// has not been handed is a price it cannot quote. That is why there is no tool
// loop here: at this catalog's size the facts fit in the prompt, and inlining
// them removes both the latency of a round trip and the possibility of the
// model answering from its own head when a lookup fails. If the catalog ever
// reaches a few hundred products, buildShopFacts() is the seam where a
// `lookup_products` tool would replace the inlined list.
//
// SCOPE BOUNDARY: this path never reads the `orders` collection. Order-status
// lookups are deliberately out of scope, which keeps customer order data out
// of the model context entirely. Preserve that if the feature grows.
//
// Every failure here is non-fatal: no ANTHROPIC_API_KEY, a rate limit, or a
// malformed response leaves the message in the inbox with no draft for the
// owner to answer by hand — the same degrade-gracefully contract getAdminDb()
// and the Meta CAPI route already follow.
import Anthropic from "@anthropic-ai/sdk";
import { HANDOFF_MARK, stripHandoff, toTurns } from "@/lib/wa-draft-text";
import { getAdminDb } from "@/lib/firebase-admin";
import { priceFmt, benefits, type Product, type SiteSettings } from "@/lib/firebase";
import {
  CARRIER_ORDER,
  baseFeeForCarrier,
  companyInfo,
  type Carrier,
  type CarrierCache,
  type CarrierData,
} from "@/lib/delivery";

export const DRAFT_MODEL = "claude-opus-5";

const FACTS_TTL_MS = 60_000;
let factsCache: { text: string; at: number } | null = null;

// ---------------------------------------------------------------------------
// Shop facts
// ---------------------------------------------------------------------------

/** Which carrier's fee grid to quote: the shop's own enabled+synced one. */
function pickCarrier(settings: SiteSettings, cache: CarrierCache): Carrier | null {
  for (const c of CARRIER_ORDER) {
    if (settings[`${c}Enabled`] === true && cache[c]) return c;
  }
  return CARRIER_ORDER.find((c) => cache[c]) ?? null;
}

function productLines(products: Product[]): string {
  const lines = products.map((p) => {
    const name = String(p.title || p.name || "").trim();
    if (!name) return "";
    const parts = [`- ${name} — ${priceFmt(p.price)}`];
    if (p.subtitle) parts.push(`  (${String(p.subtitle).trim()})`);
    const bs = benefits(p.description).slice(0, 4);
    if (bs.length) parts.push(`  ${bs.join(" · ")}`);
    return parts.join("\n");
  });
  return lines.filter(Boolean).join("\n");
}

function feeLines(carrier: Carrier, data: CarrierData): string {
  const cache: CarrierCache = { [carrier]: data };
  return data.wilayas
    .map((w) => {
      const home = baseFeeForCarrier(carrier, w.id, "home", cache);
      const desk = baseFeeForCarrier(carrier, w.id, "desk", cache);
      return `- ${w.ar} (${w.fr}): ${priceFmt(home)} | ${priceFmt(desk)}`;
    })
    .join("\n");
}

/**
 * Build the facts block from Firestore. Memoised briefly so a burst of
 * messages does not re-read the whole catalog per message; the TTL is short
 * enough that a price edit in the panel shows up in the next minute's drafts.
 */
export async function buildShopFacts(force = false): Promise<string | null> {
  if (!force && factsCache && Date.now() - factsCache.at < FACTS_TTL_MS) {
    return factsCache.text;
  }

  const adb = getAdminDb();
  if (!adb) return null;

  try {
    const [prodSnap, setSnap] = await Promise.all([
      adb.collection("products").get(),
      adb.collection("site_settings").get(),
    ]);

    const products = prodSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product);
    const settings = (setSnap.docs[0]?.data() ?? {}) as SiteSettings;

    const cache: CarrierCache = {};
    const carrierSnaps = await Promise.all(
      CARRIER_ORDER.map((c) => adb.collection("delivery_data").doc(c).get())
    );
    CARRIER_ORDER.forEach((c, i) => {
      if (carrierSnaps[i].exists) cache[c] = carrierSnaps[i].data() as CarrierData;
    });

    const carrier = pickCarrier(settings, cache);
    const storeName = String(settings.storeName || "المتجر").trim();

    const sections = [
      `# ${storeName} — معلومات المتجر`,
      "",
      "## المنتجات والأسعار",
      productLines(products) || "(لا توجد منتجات في الكتالوج حالياً)",
      "",
      "## التوصيل",
      "الدفع عند الاستلام. التوصيل لكل ولايات الجزائر عبر شركة توصيل.",
    ];

    if (carrier && cache[carrier]) {
      sections.push(
        `الأسعار أدناه بشركة ${companyInfo(carrier).ar} — الصيغة: الولاية: التوصيل للمنزل | التوصيل للمكتب.`,
        feeLines(carrier, cache[carrier]!)
      );
    } else {
      sections.push("(جدول أسعار التوصيل غير متوفر حالياً — لا تذكر أي سعر توصيل.)");
    }

    const text = sections.join("\n");
    factsCache = { text, at: Date.now() };
    return text;
  } catch (e) {
    console.error("[DS] wa buildShopFacts", e instanceof Error ? e.message : e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// The draft
// ---------------------------------------------------------------------------

const PERSONA = `أنتِ مساعدة خدمة زبائن لمتجر جزائري يبيع منتجات التجميل والعناية، وتردّين على رسائل واتساب.

الأسلوب:
- ردّي بنفس لغة الزبون: الدارجة الجزائرية أو العربية افتراضياً، والفرنسية أو الإنجليزية إذا كتب بها.
- ردّ قصير وطبيعي، جملتان أو ثلاث. بدون قوائم طويلة ولا تنسيق ماركداون — هذه رسالة واتساب.
- ودودة ومباشرة، بدون مبالغة تسويقية.

القواعد الصارمة:
- لا تذكري أي منتج أو سعر أو سعر توصيل غير موجود حرفياً في معلومات المتجر أسفله. إذا سُئلتِ عن شيء ليس فيها، قولي إنكِ ستتأكدين وتردّين.
- لا تعدي بتاريخ أو مدة توصيل محددة.
- لا تؤكدي توفر المخزون؛ معلومات المتجر لا تحتوي على كميات.
- أسعار التوصيل تقديرية وتُؤكَّد عند الطلب.
- لا تطلبي معلومات دفع ولا أي بيانات بنكية.

خارج نطاقك: حالة طلب معيّن، تتبّع طرد، شكوى، إرجاع أو استرجاع مال، أو أي طلب يحتاج قراراً من صاحب المتجر. في هذه الحالات لا تخمّني — اكتبي ردّاً قصيراً ولطيفاً يطمئن الزبون أن صاحبة المتجر ستتواصل معه، ثم أنهي رسالتك بسطر أخير منفصل يحتوي فقط على:
${HANDOFF_MARK}

اكتبي نص الرد فقط، بدون مقدمات ولا شرح.`;

export type Draft = { text: string; handoff: boolean; model: string };

export async function draftReply(
  history: { direction: "in" | "out"; text: string }[]
): Promise<Draft | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const facts = await buildShopFacts();
  if (!facts) return null;

  const turns = toTurns(history);
  if (!turns.length) return null;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: DRAFT_MODEL,
      max_tokens: 4000,
      // Short conversational replies — low effort keeps latency and cost
      // down. Adaptive thinking stays on (the default on this model);
      // disabling it invites tool-call and tag leakage into the text.
      output_config: { effort: "low" },
      system: [
        { type: "text", text: PERSONA },
        // One breakpoint after the facts: persona + catalog is the stable
        // prefix reused across every message until the catalog changes,
        // while the conversation itself varies below it.
        { type: "text", text: facts, cache_control: { type: "ephemeral" } },
      ],
      messages: turns,
    });

    if (response.stop_reason === "refusal") {
      console.error("[DS] wa draftReply refused", response.stop_details?.category);
      return null;
    }

    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!raw) return null;

    const { text, handoff } = stripHandoff(raw);
    if (!text) return null;

    return { text, handoff, model: DRAFT_MODEL };
  } catch (e) {
    // Typed SDK errors: a rate limit is worth distinguishing in the log
    // because it is the one failure that is expected to resolve on its own.
    if (e instanceof Anthropic.RateLimitError) {
      console.error("[DS] wa draftReply rate limited");
    } else if (e instanceof Anthropic.APIError) {
      console.error("[DS] wa draftReply", e.status, e.message);
    } else {
      console.error("[DS] wa draftReply", e instanceof Error ? e.message : e);
    }
    return null;
  }
}

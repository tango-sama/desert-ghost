// Writes the one personalised sentence on the quiz result screen.
//
// WHAT THIS IS AND IS NOT
// -----------------------
// It does NOT choose the products. That is deterministic scoring in
// lib/quiz.ts, which runs instantly on the client and is already on screen
// before this is called. This only phrases *why* those products were chosen,
// so a model outage or a slow response costs a nicer sentence and nothing
// else. Putting the choice itself behind a model call would have meant a
// multi-second wait, and an outage would have taken the funnel down.
//
// PROMPT INJECTION: the client sends product IDS ONLY, never titles. Titles
// are looked up server-side from Firestore. If the browser could supply the
// text that goes into the prompt, anyone could put instructions in it; this
// way the only client-controlled input is a set of ids and five answer codes
// matched against a fixed vocabulary.
//
// COST: this sits on a public page, so it is capped three ways — a tiny
// output budget, a per-instance cache keyed on the answers (the whole answer
// space is about a thousand combinations, so a warm instance serves most
// traffic from memory), and a per-instance rate limit. Every failure path
// returns 200 with no text, and the client keeps its own fallback sentence.
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAdminDb } from "@/lib/firebase-admin";
import { QUESTIONS, type Answers } from "@/lib/quiz";

export const dynamic = "force-dynamic";

const MODEL = "claude-opus-5";
const MAX_PRODUCTS = 3;
const CACHE_MAX = 500;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// Per-instance token bucket. Serverless means several instances and therefore
// no global ceiling — this is a cost guard against a single instance being
// hammered, not a security control. The real protection is that a failure here
// is invisible to the customer.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 40;
let windowStart = 0;
let windowCount = 0;

const cache = new Map<string, { text: string; at: number }>();

/** Answers are validated against the question definitions, so only the exact
 *  option codes the quiz can produce ever reach the prompt. */
function cleanAnswers(v: unknown): Answers | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const src = v as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const q of QUESTIONS) {
    const val = src[q.key];
    if (typeof val !== "string") continue;
    if (q.options.some((o) => o.value === val)) out[q.key] = val;
  }
  return Object.keys(out).length ? (out as Answers) : null;
}

function ids(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string | number => typeof x === "string" || typeof x === "number")
    .map((x) => String(x))
    .filter((s) => /^[A-Za-z0-9_-]{1,64}$/.test(s))
    .slice(0, MAX_PRODUCTS);
}

/** The answers in words, built from our own question definitions. */
function describe(a: Answers): string {
  return QUESTIONS.map((q) => {
    const val = a[q.key];
    const opt = q.options.find((o) => o.value === val);
    return opt ? `- ${q.title} ${opt.label}${opt.hint ? ` (${opt.hint})` : ""}` : null;
  })
    .filter(Boolean)
    .join("\n");
}

const SYSTEM = `أنتِ مستشارة في متجر Desert Shop الجزائري لمنتجات الجمال والصحة النسائية.

مهمتكِ: كتابة جملتين قصيرتين فقط تشرحان للزبونة لماذا اخترنا لها هذه المنتجات بالذات، انطلاقاً من إجاباتها.

القواعد:
- بالدارجة الجزائرية المهذّبة الموجّهة لامرأة (صيغة المؤنث دائماً).
- جملتان كحد أقصى. لا عناوين، لا نقاط، لا رموز تعبيرية.
- اذكري سبب الاختيار المرتبط بإجاباتها (هدفها، المدة، عمرها، ميزانيتها).
- لا تذكري أي سعر، ولا أي رقم، ولا أي وعد طبي أو علاجي.
- لا تعدي بنتائج ولا بمدة زمنية للنتيجة.
- لا تخترعي منتجات غير المذكورة، ولا تصفي مكوّنات لم تُعطَ لكِ.
- اكتبي النص فقط، دون أي مقدمة أو تعليق.`;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ text: null });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ text: null });
  }

  const answers = cleanAnswers(body.answers);
  const productIds = ids(
    Array.isArray(body.products)
      ? (body.products as { id?: unknown }[]).map((p) => p?.id)
      : body.productIds,
  );
  if (!answers || !productIds.length) return NextResponse.json({ text: null });

  const key = `${JSON.stringify(answers)}|${productIds.join(",")}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ text: hit.text, cached: true });
  }

  const now = Date.now();
  if (now - windowStart > RATE_WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  if (++windowCount > RATE_MAX) return NextResponse.json({ text: null });

  // Titles come from Firestore, never from the request.
  const adb = getAdminDb();
  if (!adb) return NextResponse.json({ text: null });
  let titles: string[] = [];
  try {
    const docs = await Promise.all(
      productIds.map((id) => adb.collection("products").doc(id).get()),
    );
    titles = docs
      .filter((d) => d.exists)
      .map((d) => {
        const p = d.data() as { title?: string; name?: string };
        return String(p.title ?? p.name ?? "").trim().slice(0, 120);
      })
      .filter(Boolean);
  } catch (e) {
    console.error("[DS] quiz-blurb products", e);
    return NextResponse.json({ text: null });
  }
  if (!titles.length) return NextResponse.json({ text: null });

  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      // Two sentences of copy — the cheapest setting is the right one, and
      // keeps this off the critical path in latency terms too.
      output_config: { effort: "low" },
      system: [{ type: "text", text: SYSTEM }],
      messages: [
        {
          role: "user",
          content:
            `إجابات الزبونة:\n${describe(answers)}\n\n` +
            `المنتجات المختارة لها:\n${titles.map((t) => `- ${t}`).join("\n")}\n\n` +
            `اكتبي الجملتين.`,
        },
      ],
    });

    if (res.stop_reason === "refusal") {
      console.error("[DS] quiz-blurb refused", res.stop_details?.category);
      return NextResponse.json({ text: null });
    }

    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim()
      .slice(0, 400);
    if (!text) return NextResponse.json({ text: null });

    if (cache.size >= CACHE_MAX) {
      // Cheap eviction: drop the oldest inserted key. Map preserves insertion
      // order, and this cache exists to blunt cost, not to be optimal.
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(key, { text, at: Date.now() });
    return NextResponse.json({ text });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) console.error("[DS] quiz-blurb rate limited");
    else console.error("[DS] quiz-blurb", e);
    return NextResponse.json({ text: null });
  }
}

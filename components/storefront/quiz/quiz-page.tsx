"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { priceFmt, type Product } from "@/lib/firebase";
import { trackPixelEvent } from "@/lib/meta-pixel";
import { trackFunnel, funnelSessionId } from "@/lib/funnel";
import {
  QUESTIONS,
  bundleTotal,
  isComplete,
  recommend,
  variantBundleSize,
  variantFor,
  type Answers,
  type Variant,
} from "@/lib/quiz";
import styles from "./quiz.module.css";

// The quiz funnel: five questions, then a personalised recommendation and a
// cash-on-delivery order form.
//
// Instrumented from the first render rather than as an afterthought — every
// stage posts a funnel event, and each carries the A/B variant and the
// campaign that produced the visitor. The whole reason to build a second
// funnel is to learn which one earns more per dinar of ad spend, and that is
// only answerable if the drop-off between questions is recorded as it happens.

// THE RESULT IS NO LONGER THE LAST STEP. Its CTA hands off to /offer — a full
// landing page built from whatever she chose (see components/storefront/offer/
// and lib/landing-content.ts), which is where the order is actually taken.
// Asking for the sale off a list of product cards, with no benefits, no usage
// and no proof on the page, is exactly the ask every other funnel in this repo
// deliberately does not make.

type Stage = "intro" | "questions" | "thinking" | "result";

// The variant never changes for a visitor, so there is nothing to subscribe
// to. getVariant must return a referentially stable value or React re-renders
// forever — it does, because funnelSessionId() persists the id on first call
// and variantFor() is a pure function of it returning one of two strings.
const subscribeNever = () => () => {};
const getVariant = (): Variant => variantFor(funnelSessionId());
const getServerVariant = (): Variant | null => null;

// A deliberate pause on the result. Scoring is instant, but a recommendation
// that appears in zero milliseconds reads as a lookup rather than as
// consideration, and people trust (and follow) it less. Short enough not to
// feel like waiting.
const THINKING_MS = 1100;

// How long a card takes to leave one list before it lands in the other. Must
// match the animation duration of .leaveUp/.leaveDown in quiz.module.css —
// the class plays the exit, this timer decides when the state actually flips.
const MOVE_MS = 260;

// Which way a ticked card travels: "up" into the chosen list, "down" out of it.
type MoveDir = "up" | "down";
type Move = { id: string; dir: MoveDir };

// Someone who asked their system for less motion gets the move instantly
// instead. Read at click time, not at mount, so a preference changed mid-visit
// is honoured without a reload.
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

// `settings` is deliberately no longer a prop: it was here only to feed the COD
// order modal, and the order is now taken on /offer, which fetches its own.
export function QuizPage({ products }: { products: Product[] }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [chosen, setChosen] = useState<string[]>([]);
  const [blurb, setBlurb] = useState<string | null>(null);
  // The card currently playing its exit, and the one that just landed.
  const [leaving, setLeaving] = useState<Move | null>(null);
  const [arriving, setArriving] = useState<Move | null>(null);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arriveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Both timers touch state, so neither may outlive the component.
  useEffect(
    () => () => {
      if (moveTimer.current) clearTimeout(moveTimer.current);
      if (arriveTimer.current) clearTimeout(arriveTimer.current);
    },
    [],
  );

  // The variant is derived from the session id, so it is stable across
  // questions and across a reload without being stored separately.
  //
  // Read through useSyncExternalStore rather than an effect: the session id
  // lives in localStorage, which does not exist during the server render, and
  // this is exactly the "browser-only external value" that hook is for. The
  // server snapshot is null, so the first client render matches the server and
  // the variant resolves without a hydration mismatch or a second render pass.
  const variant = useSyncExternalStore(subscribeNever, getVariant, getServerVariant);

  // One view event per mount.
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current || !variant) return;
    viewed.current = true;
    trackFunnel({ step: "view", variant });
    trackPixelEvent("ViewContent", { content_name: "quiz", content_type: "product_group" });
  }, [variant]);

  const question = QUESTIONS[index];
  const answered = question ? answers[question.key] : undefined;

  const rec = useMemo(() => {
    if (!variant) return null;
    return recommend(products, answers, variantBundleSize(variant));
  }, [products, answers, variant]);

  // Every product the result screen can show, recommendation first. Which of
  // the two lists a product appears in is decided by nothing but whether it is
  // ticked, so a product is never in both and never in neither.
  const pool = useMemo(
    () => (rec ? [...rec.bundle, ...rec.alternates] : []),
    [rec],
  );

  // What is actually being ordered: whatever she has left ticked. Starts as
  // the recommendation and stays hers to change — a recommendation she cannot
  // edit is a demand, and converts worse.
  //
  // Drawn from the whole pool, not just the recommended bundle: ticking one of
  // the "قد يناسبكِ أيضاً" products has to actually add it to the order. While
  // this filtered `rec.bundle`, such a product looked ticked but was silently
  // left out of the total and out of the order form.
  const selected = useMemo(
    () => pool.filter((p) => chosen.includes(String(p.id))),
    [pool, chosen],
  );
  const alternates = useMemo(
    () => pool.filter((p) => !chosen.includes(String(p.id))),
    [pool, chosen],
  );

  // The hero keeps its badge wherever it goes, and only while it is ticked.
  const heroId = rec?.bundle.length ? String(rec.bundle[0].id) : null;

  function answer(value: string) {
    if (!question) return;
    const next = { ...answers, [question.key]: value } as Answers;
    setAnswers(next);
    trackFunnel({
      step: "answer",
      variant: variant ?? undefined,
      stepIndex: index,
      answers: next as Record<string, string | undefined>,
    });

    if (index + 1 < QUESTIONS.length) {
      setIndex(index + 1);
      return;
    }
    setStage("thinking");
  }

  // Reveal the result after the pause, and only once the answers are actually
  // complete — a back-navigation mid-quiz must not drop someone onto a result
  // built from half the answers.
  useEffect(() => {
    if (stage !== "thinking") return;
    const t = setTimeout(() => {
      setStage(isComplete(answers) ? "result" : "questions");
    }, THINKING_MS);
    return () => clearTimeout(t);
  }, [stage, answers]);

  // Preselect the recommendation when the result first appears, and log it.
  const resultLogged = useRef(false);
  useEffect(() => {
    if (stage !== "result" || !rec || !variant || resultLogged.current) return;
    resultLogged.current = true;
    setChosen(rec.bundle.map((p) => String(p.id)));
    trackFunnel({
      step: "result",
      variant,
      answers: answers as Record<string, string | undefined>,
      productIds: rec.bundle.map((p) => p.id),
      value: bundleTotal(rec.bundle),
    });
    trackPixelEvent("ViewContent", {
      content_ids: rec.bundle.map((p) => String(p.id)),
      content_type: "product",
      value: bundleTotal(rec.bundle),
      currency: "DZD",
    });
  }, [stage, rec, variant, answers]);

  // Personalised wording for the result, written by Claude on the server.
  // Strictly cosmetic and strictly non-blocking: the result is already on
  // screen from the deterministic scoring above, and if this never arrives the
  // fallback sentence below stands. It must never gate the offer.
  useEffect(() => {
    if (stage !== "result" || !rec || !rec.bundle.length) return;
    let alive = true;
    fetch("/api/quiz-blurb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers,
        products: rec.bundle.map((p) => ({ id: p.id, title: p.title ?? p.name })),
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (alive && typeof d?.text === "string" && d.text.trim()) setBlurb(d.text.trim());
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [stage, rec, answers]);

  function retake() {
    if (moveTimer.current) clearTimeout(moveTimer.current);
    if (arriveTimer.current) clearTimeout(arriveTimer.current);
    moveTimer.current = null;
    arriveTimer.current = null;
    setLeaving(null);
    setArriving(null);
    setAnswers({});
    setChosen([]);
    setIndex(0);
    setBlurb(null);
    resultLogged.current = false;
    setStage("questions");
  }

  // Ticking a card moves it between the two lists, and the move is animated:
  // the card first plays its exit where it stands, and only when that is done
  // does `chosen` change and the card reappear in the other list. Committing
  // on the timer rather than on the click is what keeps a product from being
  // drawn in both lists at once mid-flight.
  function flip(id: string) {
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  function toggle(id: string) {
    // "up" is the travel from the alternates list into the chosen one.
    const dir: MoveDir = chosen.includes(id) ? "down" : "up";

    // A tap that lands while another card is still animating out commits that
    // one immediately instead of dropping it — a fast tapper never loses a
    // selection to the animation.
    if (moveTimer.current) {
      clearTimeout(moveTimer.current);
      moveTimer.current = null;
      const pending = leaving;
      setLeaving(null);
      if (pending) {
        flip(pending.id);
        // That pending move was this same card's: it is now done, and
        // toggling again here would undo it under her finger.
        if (pending.id === id) return;
      }
    }

    if (prefersReducedMotion()) {
      flip(id);
      return;
    }

    setLeaving({ id, dir });
    moveTimer.current = setTimeout(() => {
      moveTimer.current = null;
      setLeaving(null);
      flip(id);
      setArriving({ id, dir });
      if (arriveTimer.current) clearTimeout(arriveTimer.current);
      arriveTimer.current = setTimeout(() => {
        arriveTimer.current = null;
        setArriving(null);
      }, MOVE_MS);
    }, MOVE_MS);
  }

  // The class that plays a card's half of the move, if it is the one moving.
  function moveCls(id: string): string {
    if (leaving?.id === id)
      return `${styles.moving} ${leaving.dir === "up" ? styles.leaveUp : styles.leaveDown}`;
    if (arriving?.id === id)
      return arriving.dir === "up" ? styles.arriveUp : styles.arriveDown;
    return "";
  }

  // One renderer for both lists — a card is the same card wherever it sits,
  // and only its badge and its move animation differ.
  function productCard(p: Product) {
    const id = String(p.id);
    const on = chosen.includes(id);
    return (
      <button
        key={id}
        type="button"
        className={`${styles.card} ${on ? styles.cardOn : ""} ${moveCls(id)}`}
        onClick={() => toggle(id)}
      >
        {p.image ? (
          <Image
            className={styles.cardImg}
            src={p.image}
            alt=""
            width={76}
            height={76}
            unoptimized
          />
        ) : (
          <span className={styles.cardImg} />
        )}
        <span className={styles.cardBody}>
          {on && id === heroId && <span className={styles.cardTag}>الأنسب لكِ</span>}
          <span className={styles.cardTitle}>{p.title ?? p.name}</span>
          <span className={styles.cardPrice}>{priceFmt(p.price)}</span>
        </span>
        <span className={styles.cardCheck} />
      </button>
    );
  }

  const total = bundleTotal(selected);

  return (
    <div className={styles.quiz}>
      <div className={styles.wrap}>
        {stage === "intro" && (
          <div className={styles.intro}>
            <span className={styles.introKicker}>خاص بكِ</span>
            <h1 className={styles.introTitle}>
              ما المنتج المناسب
              <br />
              <em className={styles.introEm}>لكِ أنتِ؟</em>
            </h1>
            <p className={styles.introLead}>
              {products.length} منتجاً على الرف، وواحد أو اثنان فقط يناسبان
              حالتكِ. أخبرينا عن هدفكِ ونتكفّل بالباقي.
            </p>
            <button
              type="button"
              className={styles.ctaBig}
              onClick={() => {
                setStage("questions");
                trackFunnel({ step: "start", variant: variant ?? undefined });
              }}
            >
              اكتشفي منتجكِ
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>
            </button>
            <div className={styles.introMeta}>
              {QUESTIONS.length} أسئلة · أقل من دقيقة · بدون تسجيل
            </div>
          </div>
        )}

        {stage === "questions" && question && (
          <>
            <div className={styles.progress} aria-hidden>
              {QUESTIONS.map((q, i) => (
                <span key={q.key} className={`${styles.bar} ${i <= index ? styles.barOn : ""}`}>
                  <span className={styles.barFill} />
                </span>
              ))}
            </div>
            <div className={styles.stepCount}>
              السؤال {index + 1} من {QUESTIONS.length}
            </div>
            <h2 className={styles.qTitle}>{question.title}</h2>
            <div className={styles.options}>
              {question.options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`${styles.option} ${answered === o.value ? styles.optionOn : ""}`}
                  onClick={() => answer(o.value)}
                >
                  <span className={styles.optionDot} />
                  <span>
                    <span className={styles.optionLabel}>{o.label}</span>
                    {o.hint && <span className={styles.optionHint}>{o.hint}</span>}
                  </span>
                </button>
              ))}
            </div>
            {index > 0 && (
              <div className={styles.navRow}>
                <button type="button" className={styles.back} onClick={() => setIndex(index - 1)}>
                  ← السؤال السابق
                </button>
              </div>
            )}
          </>
        )}

        {stage === "thinking" && (
          <div className={styles.thinking}>
            <div className={styles.spinner} />
            <div className={styles.thinkingText}>نختار لكِ الأنسب…</div>
          </div>
        )}

        {stage === "result" && rec && (
          <>
            <div className={styles.resultHead}>
              <div className={styles.resultKicker}>اختيارنا لكِ</div>
              <h1 className={styles.resultTitle}>
                {variant === "single" ? "هذا ما نرشّحه لكِ" : "روتين متكامل يناسب حالتكِ"}
              </h1>
              <p className={`${styles.resultWhy} ${blurb ? "" : styles.resultWhySkeleton}`}>
                {blurb ?? fallbackWhy(answers, rec.bundle.length)}
              </p>
            </div>

            {selected.length > 0 && (
              <div className={styles.cards}>{selected.map(productCard)}</div>
            )}

            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>
                {selected.length} {selected.length === 1 ? "منتج" : "منتجات"} — المجموع
              </span>
              <span className={`${styles.totalValue} num`}>{priceFmt(total)}</span>
            </div>

            <button
              type="button"
              className={styles.cta}
              disabled={!selected.length}
              onClick={() => router.push(offerHref(selected, answers))}
            >
              {selected.length ? "تابعي — التفاصيل والطلب" : "اختاري منتجاً واحداً على الأقل"}
            </button>

            <div className={styles.trust}>
              <span>✓ الدفع عند الاستلام</span>
              <span>✓ توصيل 58 ولاية</span>
              <span>✓ منتجات أصلية</span>
            </div>

            {alternates.length > 0 && (
              <>
                <div className={styles.altsHead}>قد يناسبكِ أيضاً</div>
                <div className={styles.cards}>{alternates.map(productCard)}</div>
              </>
            )}

            <button type="button" className={styles.retake} onClick={retake}>
              إعادة الأسئلة
            </button>
          </>
        )}
      </div>

    </div>
  );
}

/**
 * The /offer URL for a selection.
 *
 * Everything the landing page needs travels in the query string rather than in
 * sessionStorage, so the page server-renders, survives a refresh and a share,
 * and can be verified by loading an address.
 *
 * The A/B variant is deliberately NOT in the URL. /offer derives it from the
 * funnel session id in localStorage, exactly as this page does, so it matches
 * by construction; putting it in the link as well would give a shared or
 * hand-edited URL the power to report a visitor into the wrong arm.
 */
function offerHref(products: Product[], a: Answers): string {
  const q = new URLSearchParams();
  q.set("ids", products.map((p) => String(p.id)).join(","));
  for (const [k, v] of Object.entries(a)) if (v) q.set(k, v);
  return `/offer?${q.toString()}`;
}

/* Shown immediately, and kept if the personalised wording never arrives. It
   has to stand on its own as a real sentence, not read like a placeholder
   waiting to be replaced.

   Questions are looked up BY KEY. This used to index into QUESTIONS by
   position, which meant removing a question left it reading past the end of
   the array and throwing on `.options` — taking the whole result screen down
   with it. Nothing here should care where a question sits in the list. */
function labelFor(key: keyof Answers, value: string | undefined): string | undefined {
  if (!value) return undefined;
  return QUESTIONS.find((q) => q.key === key)?.options.find((o) => o.value === value)?.label;
}

function fallbackWhy(a: Answers, count: number): string {
  const goal = labelFor("goal", a.goal) ?? "هدفكِ";
  const intensity = labelFor("intensity", a.intensity);
  const many = count > 1;
  return (
    `اخترنا لكِ ${many ? "هذه المنتجات" : "هذا المنتج"} بناءً على ${goal}` +
    (intensity ? ` وتفضيلكِ «${intensity}»` : "") +
    `${many ? "، وهي تعمل معاً لا كبدائل عن بعضها" : ""}. الدفع عند الاستلام، ويمكنكِ تعديل اختياركِ قبل الطلب.`
  );
}


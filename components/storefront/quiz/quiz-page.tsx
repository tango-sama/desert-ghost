"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { priceFmt, type Product, type SiteSettings } from "@/lib/firebase";
import { useDeliveryData } from "@/hooks/use-delivery-data";
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
import { QuizOrderModal } from "./order-modal";
import styles from "./quiz.module.css";

// The quiz funnel: five questions, then a personalised recommendation and a
// cash-on-delivery order form.
//
// Instrumented from the first render rather than as an afterthought — every
// stage posts a funnel event, and each carries the A/B variant and the
// campaign that produced the visitor. The whole reason to build a second
// funnel is to learn which one earns more per dinar of ad spend, and that is
// only answerable if the drop-off between questions is recorded as it happens.

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

export function QuizPage({
  settings,
  products,
}: {
  settings: SiteSettings;
  products: Product[];
}) {
  const cache = useDeliveryData();
  const [stage, setStage] = useState<Stage>("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [chosen, setChosen] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [blurb, setBlurb] = useState<string | null>(null);

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

  // What is actually being ordered: whatever she has left ticked. Starts as
  // the recommendation and stays hers to change — a recommendation she cannot
  // edit is a demand, and converts worse.
  const selected = useMemo(
    () => (rec ? rec.bundle.filter((p) => chosen.includes(String(p.id))) : []),
    [rec, chosen],
  );

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
    setAnswers({});
    setChosen([]);
    setIndex(0);
    setBlurb(null);
    resultLogged.current = false;
    setStage("questions");
  }

  function toggle(id: string) {
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  const total = bundleTotal(selected);

  return (
    <div className={styles.quiz}>
      <div className={styles.wrap}>
        {stage === "intro" && (
          <div className={styles.intro}>
            <span className={styles.introKicker}>خاص بكِ</span>
            <h1 className={styles.introTitle}>
              أجيبي على ٥ أسئلة،
              <br />
              ونقترح عليكِ ما يناسبكِ فعلاً
            </h1>
            <p className={styles.introLead}>
              بدل التنقّل بين ١٤٩ منتجاً، أخبرينا عن هدفكِ وسنختار لكِ ما يناسب
              حالتكِ وميزانيتكِ — في أقل من دقيقة.
            </p>
            <div className={styles.introPoints}>
              <div className={styles.point}>
                <span className={styles.pointIc}>🎯</span> اقتراح مبني على إجاباتكِ أنتِ
              </div>
              <div className={styles.point}>
                <span className={styles.pointIc}>💳</span> الدفع عند الاستلام
              </div>
              <div className={styles.point}>
                <span className={styles.pointIc}>🚚</span> توصيل لكل ولايات الوطن
              </div>
            </div>
            <button
              type="button"
              className={styles.cta}
              onClick={() => {
                setStage("questions");
                trackFunnel({ step: "start", variant: variant ?? undefined });
              }}
            >
              ابدئي الآن
            </button>
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

            <div className={styles.cards}>
              {rec.bundle.map((p, i) => {
                const id = String(p.id);
                const on = chosen.includes(id);
                const img = p.image ?? "";
                return (
                  <button
                    key={id}
                    type="button"
                    className={`${styles.card} ${on ? styles.cardOn : ""}`}
                    onClick={() => toggle(id)}
                  >
                    {img ? (
                      <Image
                        className={styles.cardImg}
                        src={img}
                        alt=""
                        width={76}
                        height={76}
                        unoptimized
                      />
                    ) : (
                      <span className={styles.cardImg} />
                    )}
                    <span className={styles.cardBody}>
                      {i === 0 && <span className={styles.cardTag}>الأنسب لكِ</span>}
                      <span className={styles.cardTitle}>{p.title ?? p.name}</span>
                      <span className={styles.cardPrice}>{priceFmt(p.price)}</span>
                    </span>
                    <span className={styles.cardCheck} />
                  </button>
                );
              })}
            </div>

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
              onClick={() => setModalOpen(true)}
            >
              {selected.length ? "اطلبيه الآن — الدفع عند الاستلام" : "اختاري منتجاً واحداً على الأقل"}
            </button>

            <div className={styles.trust}>
              <span>✓ الدفع عند الاستلام</span>
              <span>✓ توصيل ٥٨ ولاية</span>
              <span>✓ منتجات أصلية</span>
            </div>

            {rec.alternates.length > 0 && (
              <>
                <div className={styles.altsHead}>قد يناسبكِ أيضاً</div>
                <div className={styles.cards}>
                  {rec.alternates.map((p) => {
                    const id = String(p.id);
                    const on = chosen.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`${styles.card} ${on ? styles.cardOn : ""}`}
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
                          <span className={styles.cardTitle}>{p.title ?? p.name}</span>
                          <span className={styles.cardPrice}>{priceFmt(p.price)}</span>
                        </span>
                        <span className={styles.cardCheck} />
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <button type="button" className={styles.retake} onClick={retake}>
              إعادة الأسئلة
            </button>
          </>
        )}
      </div>

      {variant && (
        <QuizOrderModal
          open={modalOpen}
          products={selected}
          answers={answers}
          variant={variant}
          settings={settings}
          cache={cache}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

/* Shown immediately, and kept if the personalised wording never arrives. It
   has to stand on its own as a real sentence, not read like a placeholder
   waiting to be replaced. */
function fallbackWhy(a: Answers, count: number): string {
  const goal = QUESTIONS[0].options.find((o) => o.value === a.goal)?.label ?? "هدفكِ";
  const budget = QUESTIONS[4].options.find((o) => o.value === a.budget)?.label;
  const many = count > 1;
  return (
    `اخترنا لكِ ${many ? "هذه المنتجات" : "هذا المنتج"} بناءً على ${goal}` +
    (budget ? ` وميزانية ${budget}` : "") +
    `${many ? "، وهي تعمل معاً لا كبدائل عن بعضها" : ""}. الدفع عند الاستلام، ويمكنكِ تعديل اختياركِ قبل الطلب.`
  );
}

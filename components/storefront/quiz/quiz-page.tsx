"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { priceFmt, type Product } from "@/lib/firebase";
import { trackPixelEvent } from "@/lib/meta-pixel";
import { trackFunnel, funnelSessionId } from "@/lib/funnel";
import {
  QUESTIONS,
  answerLabel,
  bundleTotal,
  isComplete,
  recommend,
  variantBundleSize,
  variantFor,
  type Answers,
  type Recommendation,
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

// The pace of the guided intro, as a multiplier on the video's own timeline.
// The clip is 10s: at 1x the whole reveal would be over before either line of
// Arabic copy can be read, so the video runs in slow motion and the page
// travels with it. This one number is the speed of the entire intro — the
// scroll position is derived from currentTime, never the other way round while
// the tour is driving.
const TOUR_RATE = 0.55;

// After she scrolls herself, how long the page stays hers before the tour
// picks up again — from wherever she left it, not from where it would have
// been had she not touched it. Long enough that a two-flick scroll is not
// fought halfway through, short enough that letting go feels like handing the
// wheel back rather than ending the ride.
const TOUR_RESUME_MS = 900;

// How long the tour takes when the video cannot be its clock — the clip failed
// to decode, or its metadata has not arrived yet. Deliberately the same pace
// (10s of footage at TOUR_RATE), so the copy still gets the same time on
// screen; only the picture behind it is missing. Without this the button is
// dead on exactly the connections where scrolling for a minute is least
// appealing, and it hands over to the video mid-tour the moment one shows up.
const TOUR_FALLBACK_MS = 18000;

// How far the real scroll position may drift from the one the tour last asked
// for before we call it her doing. Well above the tour's own per-frame step
// (a few px) and well below any real gesture — one wheel notch is ~100px — so
// it catches the inputs that fire no wheel/touch event of their own: a
// scrollbar drag, momentum after a flick, a browser find-on-page jump.
const TOUR_DRIFT_PX = 24;

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
  const introRef = useRef<HTMLElement>(null);
  const introVideoRef = useRef<HTMLVideoElement>(null);
  // Gates the final CTA's interactivity, not just its opacity: without this,
  // the button sits pointer-events:auto and focusable the whole time the
  // headline is on screen, so a mouse click or a stray Tab could "press" a
  // button that reads as invisible. Flips once scroll crosses the same 0.78
  // threshold that starts its visual reveal (or immediately under reduced
  // motion, where it is shown from the first paint).
  const [ctaReady, setCtaReady] = useState(false);
  // The guided tour: pressing the intro's own button hands the scrolling over
  // to the video's clock. `tourOn` is what mounts the drive loop; the refs are
  // what the two effects use to stay out of each other's way without either
  // having to re-run.
  const [tourOn, setTourOn] = useState(false);
  const [startReady, setStartReady] = useState(true);
  // Mirrors `tourOn` for the scrub effect, which is registered once per stage
  // and would otherwise close over a stale value.
  const tourRef = useRef(false);
  // performance.now() of her last scroll input. 0 = she has not touched it.
  const lastUserRef = useRef(0);
  // The scroll offset the tour last asked for, so drift from it can be read as
  // an input the listeners below never saw.
  const tourTargetRef = useRef<number | null>(null);

  // Both timers touch state, so neither may outlive the component.
  useEffect(
    () => () => {
      if (moveTimer.current) clearTimeout(moveTimer.current);
      if (arriveTimer.current) clearTimeout(arriveTimer.current);
    },
    [],
  );

  // The intro video is scrubbed by the visitor's scroll rather than played on
  // a timeline. This makes the first quiz step feel like a guided beauty scan,
  // while the quiz itself still starts only when she taps the final button.
  //
  // Two directions, never both at once. Normally scroll is the input and the
  // video's currentTime the output: she drags the clip frame by frame. While
  // the tour is driving (see the effect below) it is the exact reverse — the
  // video plays and the page is scrolled to match it — so the seek here is
  // skipped, or the two would spend every frame overwriting each other.
  useEffect(() => {
    if (stage !== "intro") return;
    const section = introRef.current;
    const video = introVideoRef.current;
    if (!section || !video) return;

    let frame = 0;
    const clamp = (n: number) => Math.max(0, Math.min(1, n));

    function paint() {
      frame = 0;
      const rect = section!.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight);
      const progress = clamp(-rect.top / travel);
      section!.style.setProperty("--intro-progress", progress.toFixed(4));

      // A scroll the tour did not ask for is hers — pick it up here so inputs
      // that fire no event of their own (scrollbar drag, touch momentum after
      // the finger is gone) still take the wheel.
      if (tourRef.current && tourTargetRef.current !== null) {
        if (Math.abs(window.scrollY - tourTargetRef.current) > TOUR_DRIFT_PX) {
          lastUserRef.current = performance.now();
        }
      }

      const duration = video!.duration;
      const reduced = prefersReducedMotion();
      const driving =
        tourRef.current && performance.now() - lastUserRef.current > TOUR_RESUME_MS;
      // Never queue a seek on top of one already in flight — the browser
      // decodes seeks asynchronously, and stacking a second one before the
      // first resolves is what makes scroll-scrubbed video look choppy,
      // regardless of how tight the threshold below is. Skipping this frame
      // just means the next one (a few ms later) catches up instead.
      if (!reduced && !driving && !video!.seeking && Number.isFinite(duration) && duration > 0) {
        const nextTime = duration * progress;
        if (Math.abs(video!.currentTime - nextTime) > 0.02) video!.currentTime = nextTime;
      }

      const ready = reduced || progress >= 0.78;
      setCtaReady((prev) => (prev === ready ? prev : ready));
      // The start button belongs to the first screen only: it is gone once the
      // tour is running, once she has scrolled past the headline, and entirely
      // under reduced motion, where there is no scrub to hand over.
      const canStart = !reduced && !tourRef.current && progress <= 0.24;
      setStartReady((prev) => (prev === canStart ? prev : canStart));
    }

    function schedule() {
      if (frame) return;
      frame = requestAnimationFrame(paint);
    }

    // Her own scrolling, caught at the input rather than at the result, so it
    // is never confused with the tour's own scrollTo. Marking the moment is
    // all this does; the drive loop reads the timestamp and yields.
    function onUserInput() {
      if (!tourRef.current) return;
      lastUserRef.current = performance.now();
    }
    // Space, arrows, Page Up/Down, Home/End — the keys that scroll a page.
    function onKey(e: KeyboardEvent) {
      if (e.key.startsWith("Arrow") || e.key === " " || e.key.startsWith("Page") ||
          e.key === "Home" || e.key === "End") {
        onUserInput();
      }
    }

    const onLoaded = () => schedule();
    if (!tourRef.current) video.pause();
    video.addEventListener("loadedmetadata", onLoaded);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("wheel", onUserInput, { passive: true });
    window.addEventListener("touchmove", onUserInput, { passive: true });
    window.addEventListener("keydown", onKey);
    schedule();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      video.removeEventListener("loadedmetadata", onLoaded);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("wheel", onUserInput);
      window.removeEventListener("touchmove", onUserInput);
      window.removeEventListener("keydown", onKey);
    };
  }, [stage]);

  // The guided tour. With it running the video is the clock: it plays at
  // TOUR_RATE and every frame the page is scrolled to wherever that moment of
  // the clip sits in the intro's travel, so the reveal unfolds on its own and
  // she never has to scroll at all.
  //
  // Her scroll is not an interruption to recover from, it is the volume knob:
  // scrolling seeks the video (the effect above), the tour holds off while she
  // is moving, and TOUR_RESUME_MS later it carries on from the frame she
  // chose. Nothing snaps back to where the tour would otherwise have been.
  useEffect(() => {
    if (stage !== "intro" || !tourOn) return;
    const section = introRef.current;
    const video = introVideoRef.current;
    if (!section || !video) return;

    tourRef.current = true;
    video.playbackRate = TOUR_RATE;

    // Where the tour is measuring from. It re-anchors on every handover — when
    // she gives the page back, and when a video that was not ready at the
    // press finally is — so the tour always continues from the frame on
    // screen rather than snapping to where its own clock had got to.
    let onVideoClock = false;
    let anchorAt = 0;
    let anchorProgress = 0;
    let loop = requestAnimationFrame(tick);

    function geometry() {
      const rect = section!.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight);
      return { travel, top: rect.top + window.scrollY };
    }

    function tick() {
      loop = requestAnimationFrame(tick);

      if (performance.now() - lastUserRef.current <= TOUR_RESUME_MS) {
        // Hers for the moment: the clip must not advance under her, or the
        // frame she scrolled to would slide away while she reads it. Dropping
        // the anchor here is what makes the resume pick up from her position.
        if (!video!.paused) video!.pause();
        tourTargetRef.current = null;
        anchorAt = 0;
        return;
      }

      const { travel, top } = geometry();
      const here = Math.max(0, Math.min(1, (window.scrollY - top) / travel));
      const duration = video!.duration;
      const hasClip = Number.isFinite(duration) && duration > 0;

      if (anchorAt === 0) {
        anchorAt = performance.now();
        anchorProgress = here;
        // Taking over from the wall clock, or from her: put the clip on the
        // frame that is actually on screen before letting it lead again.
        if (hasClip) video!.currentTime = here * duration;
        onVideoClock = false;
      }
      // Only once the seek above has landed does the video become the clock;
      // reading currentTime mid-seek would jump the page to the old frame.
      if (hasClip && !onVideoClock && !video!.seeking) onVideoClock = true;

      let progress: number;
      if (onVideoClock) {
        if (video!.paused) void video!.play().catch(() => {});
        progress = Math.min(1, video!.currentTime / duration);
      } else {
        progress = Math.min(
          1,
          anchorProgress + (performance.now() - anchorAt) / TOUR_FALLBACK_MS,
        );
      }

      // Forward only. The tour's own clock never runs backwards, so a target
      // behind the page means she is ahead of it — scrolled past the end, or
      // a frame further on than the seek that just landed — and yanking her
      // back is the one thing a tour that yields to her must never do.
      const target = Math.max(Math.round(top + progress * travel), Math.round(window.scrollY));
      tourTargetRef.current = target;
      // `instant`, because globals.css sets `scroll-behavior: smooth` on
      // <html> — a smooth scroll re-animating from every frame's scrollTo
      // would never arrive anywhere.
      if (target > window.scrollY) window.scrollTo({ top: target, behavior: "instant" });

      // Last frame: the CTA is up, and the page is hers again.
      if (progress >= 0.999) setTourOn(false);
    }

    return () => {
      cancelAnimationFrame(loop);
      tourRef.current = false;
      tourTargetRef.current = null;
      video.pause();
    };
  }, [stage, tourOn]);

  // Play must be called straight out of the click, not from inside the drive
  // loop — a muted video started a frame later is no longer obviously the
  // result of a gesture, and Safari refuses it.
  function startTour() {
    const video = introVideoRef.current;
    if (video) {
      video.playbackRate = TOUR_RATE;
      void video.play().catch(() => {});
    }
    lastUserRef.current = 0;
    setStartReady(false);
    setTourOn(true);
  }

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

  // The anchor keeps its badge wherever it goes, and only while it is ticked.
  // It is the product the winning category exists to sell, so it is labelled
  // as such rather than as "first in the list".
  const anchorId = rec?.anchorProducts.length ? String(rec.anchorProducts[0].id) : null;

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
      // The winning category rides along inside `answers` rather than as a new
      // top-level field: /api/funnel accepts a fixed set of keys and would
      // drop anything else, and this is the number the whole rewrite exists to
      // make answerable — which of the six categories the traffic sorts into,
      // and which of them actually orders.
      answers: { ...answers, result: rec.goal } as Record<string, string | undefined>,
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
          {on && id === anchorId && (
            <span className={styles.cardTag}>{rec?.anchor.tag ?? "الأنسب لكِ"}</span>
          )}
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
          <section className={styles.intro} ref={introRef} aria-label="مقدمة الاستبيان">
            <div className={styles.introSticky}>
              <div className={styles.introFrame}>
                <video
                  ref={introVideoRef}
                  className={styles.introVideo}
                  src="/assets/quiz/intro-background.mp4"
                  muted
                  playsInline
                  preload="auto"
                  aria-hidden="true"
                />
                <div className={styles.introShade} />
                <div className={`${styles.scrollCue} ${styles.scrollCueStart}`} aria-hidden="true">
                  <span />
                  <i />
                  <i />
                </div>
                <div className={`${styles.scrollCue} ${styles.scrollCueEnd}`} aria-hidden="true">
                  <span />
                  <i />
                  <i />
                </div>
                <div className={styles.introTitleCard}>
                  <h1 className={styles.introTitle}>ما المنتجات المناسبة لكِ؟</h1>
                  {/* The one thing on the first screen worth pressing. It does
                      not skip the intro — it plays it: the page scrolls itself
                      at the video's pace so the reveal can simply be watched.
                      Scrolling still works throughout and takes over the
                      moment it is used, so the button is an offer, not a mode
                      she has to get back out of. Rides the headline card's own
                      fade, and is gone under reduced motion. */}
                  <div className={`${styles.startWrap} ${tourOn ? styles.startWrapOff : ""}`}>
                    <button
                      type="button"
                      className={styles.startBtn}
                      style={{ pointerEvents: startReady ? "auto" : "none" }}
                      tabIndex={startReady ? 0 : -1}
                      aria-hidden={!startReady}
                      onClick={startTour}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        {/* Points left, like the final CTA's arrow: forward is
                            leftward in RTL, and a play triangle aimed the
                            other way reads as "back". */}
                        <path d="M16 5.6v12.8a1 1 0 0 1-1.53.85L4.42 12.85a1 1 0 0 1 0-1.7l10.05-6.4A1 1 0 0 1 16 5.6Z" />
                      </svg>
                      اكتشفي المنتج المناسب لكِ
                    </button>
                  </div>
                </div>
                {/* Rises in only once the headline above has fully faded (it
                    holds through 0.30-0.66, well clear of the headline's own
                    0-0.30 window and the CTA's 0.78-0.94), so the two never
                    compete for the same moment of the scroll. A long, slow
                    rise (0.30-0.60, eased) per feedback that it moved too
                    fast. */}
                <div className={styles.introSubCard}>
                  <p className={styles.introSubText}>
                    149 منتجاً على الرف، وواحد أو اثنان فقط يناسبان حالتكِ. أجيبي
                    على خمسة أسئلة قصيرة، ونختار لكِ ما يناسب هدفكِ وروتينكِ.
                  </p>
                </div>
                <div className={styles.introFinal}>
                  <button
                    type="button"
                    className={styles.ctaBig}
                    style={{ pointerEvents: ctaReady ? "auto" : "none" }}
                    tabIndex={ctaReady ? 0 : -1}
                    aria-hidden={!ctaReady}
                    onClick={() => {
                      setStage("questions");
                      trackFunnel({ step: "start", variant: variant ?? undefined });
                    }}
                  >
                    اكتشفي منتجكِ
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M19 12H5" />
                      <path d="m12 19-7-7 7-7" />
                    </svg>
                  </button>
                  {/* Rides the same --cta-start reveal as the button right
                      above it, so it appears together with the CTA instead
                      of asking for extra scroll past the sticky section — it
                      sits over the video's own last frame, not a separate
                      page-background band below it. */}
                  <p className={styles.introReassure}>
                    5 أسئلة · أقل من دقيقة · بدون تسجيل ولا رقم هاتف
                  </p>
                </div>
              </div>
            </div>
          </section>
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
            {question.lead && <p className={styles.qLead}>{question.lead}</p>}
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
            <div className={styles.thinkingText}>نحسب إجاباتكِ ونختار لكِ الأنسب…</div>
          </div>
        )}

        {stage === "result" && rec && (
          <>
            <div className={styles.resultHead}>
              <div className={styles.resultKicker}>{rec.anchor.kicker}</div>
              {/* The winning category, named. She answered five questions and
                  the first thing she should read is what they added up to —
                  a result screen that jumps straight to a product card reads
                  as a shop window, not as an answer. */}
              <div className={styles.resultCat}>
                <span className={styles.resultCatDot} />
                {rec.anchor.label}
              </div>
              <h1 className={styles.resultTitle}>{rec.anchor.headline}</h1>
              <p className={`${styles.resultWhy} ${blurb ? "" : styles.resultWhySkeleton}`}>
                {blurb ?? fallbackWhy(rec, answers)}
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
              {selected.length ? "اكتشفي التفاصيل واطلبي" : "اختاري منتجاً واحداً على الأقل"}
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

/* Shown immediately, and kept if the personalised wording never arrives.
   It has to stand on its own as a real explanation, not read like a
   placeholder waiting to be replaced — which is why the category's own
   supportive message (lib/quiz.ts, ANCHORS) is the body of it and the answers
   only add a closing line.

   Answer labels are looked up BY KEY, never by position: indexing into
   QUESTIONS by index meant that removing a question left this reading past the
   end of the array and throwing on `.options`, taking the whole result screen
   down with it. */
function fallbackWhy(rec: Recommendation, a: Answers): string {
  const concern = answerLabel("concern", a.concern);
  return (
    rec.anchor.message +
    (concern ? ` وأخذنا في الحسبان ما ذكرتِه عن «${concern}».` : "") +
    " الدفع عند الاستلام، ويمكنكِ تعديل اختياركِ قبل الطلب."
  );
}


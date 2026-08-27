// The one piece of draft handling that decides what text can reach a
// customer, kept pure and dependency-free so it can be exercised directly.
//
// The model marks an out-of-scope question (a specific order, a complaint, a
// refund) by ending its reply with a marker line. The marker is an internal
// signal for the panel's badge — it must never survive into the message body,
// so it is stripped wherever it landed, not just where it was asked for.
export const HANDOFF_MARK = "---HANDOFF---";

export type StrippedDraft = { text: string; handoff: boolean };

const MARK_RE = /---HANDOFF---/g;
// The marker occupying a whole line, with the line break that follows it (or
// precedes it, at end of text) — removed as a unit so deleting it does not
// leave a stray blank line in the middle of the reply.
const MARK_LINE_RE = /^[ \t]*---HANDOFF---[ \t]*(?:\r?\n|$)/gm;

export function stripHandoff(raw: string): StrippedDraft {
  const handoff = raw.includes(HANDOFF_MARK);
  const text = raw
    // Whole-line occurrences first (the instructed shape) …
    .replace(MARK_LINE_RE, "")
    // … then any inline remnant, wherever the model put it.
    .replace(MARK_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, handoff };
}

/**
 * Map a stored thread to Claude turns.
 *
 * The Messages API requires the first turn to be `user`, so any leading
 * outbound messages — a thread that opens with a shop broadcast — are
 * dropped rather than sent and rejected.
 */
export function toTurns(
  history: { direction: "in" | "out"; text: string }[]
): { role: "user" | "assistant"; content: string }[] {
  const turns = history
    .filter((m) => m.text?.trim())
    .map((m) => ({
      role: m.direction === "in" ? ("user" as const) : ("assistant" as const),
      content: m.text,
    }));
  while (turns.length && turns[0].role === "assistant") turns.shift();
  return turns;
}

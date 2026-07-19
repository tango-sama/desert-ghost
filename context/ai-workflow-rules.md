# Development Workflow

## Approach

Build this project incrementally using a spec-driven workflow. The context files define what to build, how to build it, and what the current state of progress is:

- `CLAUDE.md` (repo root) — code standards and conventions.
- `context/architecture-context.md` — stack, boundaries, data model, invariants.
- `context/ui-context.md` — theme tokens, typography, component and motion patterns.
- `context/progress-tracker.md` — what is done, in progress, and undecided.

Always implement against these files — do not infer or invent behavior from scratch. The store owner decides product behavior; the context files record those decisions.

## Scoping Rules

- Work on one feature or one page at a time.
- Prefer small, verifiable increments over large speculative changes.
- Do not combine unrelated system boundaries in a single implementation step.
- A change is correctly scoped when it can be verified end to end in the browser in one sitting.

## When To Split Work

Split an implementation step if it combines:

- Storefront changes and admin panel (`amelhadj.html`) changes, unless one feature genuinely spans both (e.g. a setting and the UI it controls).
- Browser code and Cloud Functions changes.
- `firestore.rules` changes and anything else — rules changes are always their own step, verified with anonymous REST checks (catalog readable, orders create-only, customer data denied) before and after deploy.
- More than one delivery carrier (Yalidine, Noest, ZR Express) — their APIs differ; port changes carrier by carrier.
- Behavior that is not clearly defined in the context files.

## Handling Missing Requirements

- Do not invent product behavior (pricing, delivery flow, order lifecycle, Arabic copy) that is not defined in the context files.
- If a requirement is ambiguous, ask the store owner and record the answer in the relevant context file before implementing.
- If a requirement is missing and the owner is unavailable, add it as an open question in `context/progress-tracker.md` and stop rather than guess.

## Protected Foundation Components

Do not modify these unless explicitly instructed:

- `sw.js` — the kill-switch service worker. It must never cache again; it exists to destroy old caches on visitors' devices.
- The Firebase config object in `js/firebase.js` and the project IDs in `.firebaserc` / `firebase.json`.
- The existing Firestore document shapes — the schema is append-only; new code tolerates old docs and never migrates them.
- The `isAdmin()` boundary in `firestore.rules` — never widen what anonymous clients can read or write.
- `functions/node_modules` and `.claude/worktrees/*` — generated/scratch copies, never hand-edited.

Feature work goes in the page files, `js/`, `css/theme.css`, and `functions/index.js`.

## Verification

There is no test suite. Every unit is verified by exercising it:

1. Serve locally (`npm run dev`, port 8000) and drive the affected page in a browser — including RTL layout and Arabic text.
2. For rules or data changes: anonymous Firestore REST checks against the expectations in `architecture-context.md`.
3. For carrier/function changes: deploy functions and run the real callable from the admin panel (parcel creation is idempotent, so re-runs are safe).
4. Deploy hosting/rules/functions only after local verification, and only the pieces that changed.

## Keeping Docs In Sync

Update the relevant context file in the same step whenever implementation changes:

- Architecture, boundaries, or the data model → `context/architecture-context.md`.
- Conventions or standards → `CLAUDE.md`.
- Feature scope or state → `context/progress-tracker.md`.

Progress state must reflect the actual, deployed state of the site — not the intended state.

## Before Moving To The Next Unit

1. The current unit works end to end in the browser within its defined scope.
2. No invariant in `context/architecture-context.md` was violated (run the rules REST checks if rules or auth were touched).
3. Changed pieces are deployed, and `context/progress-tracker.md` reflects the completed work.
4. Anything that should carry to the Bazar Merabet clone (`mrabet-fb38c`) is noted in the tracker.

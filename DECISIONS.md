# Decisions

A brief tour of the notable design decisions, organized by area. The guiding principle throughout: **the server is the security and correctness boundary** — every rule is enforced in server code (and, where it matters, in a database transaction), never only in the UI.

## Stack

- **Next.js (App Router) + Server Components / Server Actions.** One codebase for the UI and the server-enforced mutations, with no separate API tier to keep in sync. Mutations are Server Actions guarded on the server.
- **Postgres on Neon, via the `@neondatabase/serverless` WebSocket `Pool` driver — not the HTTP driver.** This is the load-bearing infra choice. The claim rules need an *interactive* transaction (`SELECT … FOR UPDATE` → app-side checks → conditional `INSERT` in one session). Neon's HTTP driver is a single round-trip and can't hold one; the WebSocket Pool can. Everything about concurrency below depends on this.
- **Drizzle ORM** for a typed schema, typed queries, and SQL-first migrations.
- **Zod** for input validation and for fail-fast environment-variable validation (`src/env.ts`, wired into `next.config.ts`) so a missing/malformed var fails the build instead of surfacing as a runtime crash.

## Data model

- **Shift times are stored as absolute, resolved `starts_at` / `ends_at` instants, timezone-naive.** The CSV has overnight shifts (`22:00→06:00`), midnight ends (`16:00→00:00`), and explicit `+1` next-day notation. Resolving these at write time (rolling the end into the next day when needed) guarantees `ends_at > starts_at` always holds, which turns overlap detection into a plain range comparison — `a.start < b.end AND b.start < a.end` — instead of clock arithmetic. Naive (not `timestamptz`) because this is a single clinic in a single timezone; that avoids UTC-conversion display bugs. It would need revisiting for a multi-timezone chain.
- **Role requirements are rows in `shift_requirements` (one per profession), not a JSON blob.** This keeps coverage counting and the "which roles are missing" query in plain SQL, and gives a unique `(shift, profession)` guarantee. A JSON column would push that logic into app code.
- **CHECK constraints as a safety net** (`ends_at > starts_at`, positive requirement counts, manager-has-no-profession / staff-has-one) — defense in depth even if application validation is ever bypassed.

## Authentication & roles

- **Auth.js v5, Credentials provider, JWT sessions.** The Credentials provider only supports the JWT session strategy (database sessions aren't available with it), so `id` / `role` / `profession` ride in the token. A useful consequence: I **skipped the database adapter and its `accounts` / `sessions` / `verificationTokens` tables** entirely — with credentials-only auth they'd be dead schema. If OAuth is added later, the adapter and those tables come with it. The schema stays honest about what's actually used.
- **Split config: an edge-safe base (`auth/config.ts`, zero Node deps) plus the Node layer (`auth/index.ts`) that adds the Credentials provider (DB + bcrypt).** This is the standard v5 pattern that lets edge middleware do route protection without pulling the Postgres driver into the edge bundle.
- **`bcryptjs`** (pure-JS, no native build step on the host) at 12 rounds.
- **Generic auth errors** — login never reveals whether an email exists.

## Shift management — editing a claimed shift

The brief explicitly leaves this to the implementer. The decision is a distinction between *suboptimal-but-valid* and *physically-impossible*:

- **Reducing a requirement below the current number of claims → keep the claims.** The shift is simply over-staffed (surfaced in the UI). A manager trimming headcount shouldn't automatically un-assign people who've already arranged their day around the shift.
- **Changing the time so a claimant now overlaps another shift they hold → release that claim,** and tell the manager (a "N claims released" banner). An overlap is physically impossible, unlike over-staffing which is merely suboptimal, so it's the one case that must auto-resolve. This runs inside the same transaction as the shift update.
- **Deleting a shift** cascades its requirements and claims via FK `onDelete`.

Other choices: the update **replaces the whole requirement set** rather than diffing it (the set is ≤ 3 rows — trivially cheap and obviously correct); overlap uses **half-open intervals** so back-to-back shifts (one ends exactly as the next starts) don't count as overlapping.

## Claiming, with concurrency safety

This is the heart of the brief. The race: two staff try to claim the last slot of their profession at the same instant; a naive read-then-write lets both succeed and the shift goes over capacity.

**The fix:** every claim runs in a transaction that takes row locks with `SELECT … FOR UPDATE` on the **user row, then the shift row — always in that order.**

- Locking the **shift** row serializes all claims to that shift, so the per-profession capacity count can't be read stale.
- Locking the **user** row serializes that user's claims, so they can't win two overlapping shifts concurrently.
- The fixed **user-before-shift** ordering means no lock-ordering cycle, hence no deadlock.

The same engine backs **all three** paths the rules must cover: staff self-claims, manager assignments (only `assigned_by_id` differs), and shift-edit re-validation. Expected rule violations return a **typed outcome** (`{ ok: false, code, message }`) rather than throwing, so actions can surface the exact "clear error message" the brief asks for. Staff can only ever act on their own session's user id; only managers pass an explicit target user.

This is verified by an integration test that fires two claims at a one-slot shift with `Promise.all` and asserts exactly one wins and exactly one claim row exists.

## The dirty import

- **One shared, pure pipeline** (`buildImportPlan`) produces cleaned rows plus a list of reportable issues, with no DB access. Both the auto-seed and the manager upload feed it, satisfying the brief's "same import logic" requirement; execution/persistence is a separate transactional step.
- **Cleaning rules:** profession synonyms mapped (e.g. `physician`/`md` → doctor, `rn`/`registered nurse` → nurse); three date formats disambiguated by separator (ISO `YYYY-MM-DD`, `DD/MM/YYYY` for slashes, `MM-DD-YYYY` for dashes — confirmed against the data); times supporting overnight and `+1`; strict `nurses=N;doctors=N;receptionists=N` requirements; `(at)` → `@` email repair. Impossible dates (`2026-02-30`), zero-length times, free-text requirements, and unrecoverable rows are **rejected with a reason** rather than guessed at.
- **Idempotent execution.** Staff upsert by email, shifts upsert by a nullable-unique `external_id` (the source `shift_id`), so re-running the seed or re-importing a file updates in place instead of duplicating. Re-running keeps a stable 34 staff / 112 shifts.
- **Full accountability.** Each run persists an `import_batches` row plus one `import_issues` row per non-cleanly-accepted row (the raw text, what was wrong, what was done), which powers the manager-only **Import Report** page.

## Coverage dashboard

- **Reuses the exact `computeStaffing` helper the claiming UI uses,** so the two views can't drift — the dashboard's notion of empty/partial/full is guaranteed identical to what claiming enforces.
- **Week logic is pure and timezone-neutral** (`buildWeek`, `formatWeekRange`, `groupShiftsByDay`, `resolveWeekStart`), all unit-tested. Shifts are bucketed by their **start** day, so an overnight shift shows on the day it begins. Data comes from a single half-open range query served by an index on `starts_at`.
- **Default week clamps into the data range.** The seeded shifts all fall in one period, but "today" (in production) can be anywhere. Rather than open on an empty grid, the dashboard clamps today into the `[earliest, latest]` shift range so the first load always lands on real data. An explicit `?week=` param always wins, and the date-picker "jump to any week" plus prev/next/today drive that param.
- **Responsive** by design: a one-column stack on mobile that expands to a full seven-column week grid on desktop; each shift card carries a status dot, per-profession `filled/required` chips, and an explicit "Missing …" line.

## Testing

Unit tests are pure and DB-free (`npm test`) so they're CI-friendly; a separate integration suite (`npm run test:integration`) exercises the claim and import services — including the concurrency race — against a real database.

## What I'd do differently with more time

The one I'd prioritize: **add a Postgres exclusion constraint (`btree_gist`) as a belt-and-suspenders guard against overlapping/over-capacity claims at the database layer**, so correctness doesn't rest solely on the application transaction. Beyond that: a token-version check so a deleted user's still-valid JWT is rejected immediately (stateless JWTs currently authenticate until expiry); streaming very large CSV uploads instead of parsing the whole file in memory; and building out the optional stretch goals (recurring shifts and live "shift just filled" updates).

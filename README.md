# Clinic Shift Scheduler

A small web app for a clinic to manage staff shifts. A **manager** creates shifts and assigns staff; **staff** (doctors, nurses, receptionists) claim the shifts they're eligible for. The clinic's messy spreadsheet exports are cleaned and imported through a shared, tested pipeline.

Built for the fullstack take-home brief ([`Project/PROJECT_BRIEF.md`](Project/PROJECT_BRIEF.md)).

## Live demo

**URL:** <https://clinic-shift-scheduler-ebon.vercel.app/>

- Log in with the manager credentials below to see everything (shift management, assignment, the coverage dashboard, and the import report). The database is pre-seeded via the importer.
- **Cold starts:** the Neon free-tier database scales to zero when idle, so the very first request after a period of inactivity may take a few extra seconds while the database wakes. Subsequent requests are fast.

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 16** (App Router, Server Components, Server Actions) | One codebase for UI + server-enforced mutations; no separate API layer. |
| Language | **TypeScript** | End-to-end type safety, shared types from DB to UI. |
| Database | **Postgres** on **[Neon](https://neon.tech)** | Serverless Postgres; the WebSocket `Pool` driver supports the interactive transactions the claim rules need. |
| ORM | **Drizzle** | Typed schema + queries and lightweight SQL-first migrations. |
| Auth | **Auth.js v5** (Credentials + JWT) | Role/profession travel in the session JWT; server-side guards enforce access. |
| Validation | **Zod v4** | Input validation and fail-fast env-var checks (`src/env.ts`). |
| CSV | **PapaParse** | Robust parsing of arbitrary uploaded files. |
| Tests | **Vitest** | Fast unit tests (pure logic) + a separate integration suite (against a real DB). |

The full reasoning behind these and other decisions is in [`DECISIONS.md`](DECISIONS.md).

## Local setup

**Prerequisites:** Node 22+ and a Postgres connection string from a [Neon](https://neon.tech) project (free tier is fine).

```bash
# 1. Install dependencies
npm ci

# 2. Configure environment
cp .env.example .env
#    then edit .env: set DATABASE_URL (Neon) and AUTH_SECRET (`openssl rand -base64 33`)

# 3. Apply migrations, seed the database, and start the app
npm run db:migrate && npm run db:seed && npm run dev
```

Open <http://localhost:3000> and log in.

> **Why Neon and not `docker compose up`?** The claim logic relies on interactive transactions (`SELECT … FOR UPDATE` → app checks → conditional `INSERT`), which this app runs through Neon's serverless WebSocket driver. Pointing at a hosted Neon database (or a free dev branch) is the one reliable path; a plain local Postgres container won't speak that driver's protocol without an extra proxy. Set `DATABASE_URL` and the three commands above are the whole setup.

### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon Postgres connection string. |
| `AUTH_SECRET` | yes | Signs the session JWT. Generate with `openssl rand -base64 33`. |

Both are validated at startup by `src/env.ts` — a missing or malformed value fails the build/boot with a clear message instead of a runtime crash.

## The seed / importer

`npm run db:seed` is idempotent and does two things:

1. Seeds the manager account (managers are **not** in the CSV).
2. Runs the clinic's real `Project/staff.csv` and `Project/shifts.csv` through the **same** import pipeline the manager upload uses — cleaning profession synonyms, three date formats, overnight/`+1` times, `(at)` emails, duplicates and junk rows.

Result: **1 manager + 34 staff + 112 shifts**. Every rejected/merged/repaired row is recorded and visible on the manager-only **Import Report** page (`/import`), which can also import a custom uploaded CSV.

## Seeded login credentials

All seeded accounts share one password for easy grading:

**Password (everyone):** `Clinic123!`

| Role | Email |
| --- | --- |
| Manager | `manager@clinic.test` |
| Staff — doctor | `marcus.whitfield@clinicmail.test` |
| Staff — nurse | `anya.haddad@clinicmail.test` |
| Staff — receptionist | `ben.marchand@clinicmail.test` |

There are 34 staff in total; `npm run db:seed` prints a few example staff emails on completion. Any staff email from `Project/staff.csv` that imported cleanly works with the same password.

## Features

- **Auth & roles** — manager vs. staff (with a profession); server-side guards on every protected route and action.
- **Shift management** — managers create / edit / delete shifts with per-profession requirements. Editing a claimed shift keeps valid claims and releases only those the new time makes physically impossible (documented in `DECISIONS.md`).
- **Claiming** — staff self-claim and managers assign, both enforcing "enough of this profession already" and "no overlapping shift" **on the server**, safe under concurrent access.
- **Dirty import** — shared clean/import pipeline used by both the seed and the manager upload, with a full Import Report.
- **Coverage dashboard** (`/coverage`) — manager week-at-a-glance: every shift by day, staffing status (empty / partial / full), which roles are still missing, jump to any week, responsive.

## Tests

Unit tests are DB-free and run with a single command:

```bash
npm test
```

There's also an integration suite that exercises the claim/import services against a real database (it uses `DATABASE_URL`; run it against a disposable/dev database):

```bash
npm run test:integration
```

## Useful scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server. |
| `npm run build` | Production build. |
| `npm test` | Unit tests (Vitest). |
| `npm run test:integration` | Integration tests (needs `DATABASE_URL`). |
| `npm run db:generate` | Generate a migration from schema changes. |
| `npm run db:migrate` | Apply migrations. |
| `npm run db:seed` | Seed manager + import the CSVs (idempotent). |
| `npm run db:studio` | Open Drizzle Studio. |

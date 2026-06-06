# Implementation Plan: Full Audit & Repair of Core App

**Branch**: `005-audit-repair-core` | **Date**: 2026-06-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-audit-repair-core/spec.md`

**Note**: This plan is the output of `/speckit-plan` for a *repair* feature. The
spec assumes the most recent product direction (server-rendered SPA + managed
Postgres + Telegram-only sign-in) is the target. If the intent is to pivot
back to the static-only GitHub Pages attempt that was reverted, run
`/speckit.clarify` first to re-scope.

## Summary

Restore the BasmatLibya web app to a deployable, end-to-end working state. The
two user-visible failures (login does not survive redirect/refresh; search does
not progress) are the surface of a wider drift across auth, routing, realtime,
and the deployment target. This repair lands four user stories in priority
order — (P1) session persistence, (P1) anonymous + signed-in search end-to-end,
(P2) repeatable single-target deploy, (P3) codebase hygiene to stop the
breakage recurring — by fixing root causes (cookie posture, principal
resolution, routing mode vs. deploy target, realtime replay, env validation)
and pruning artefacts left from prior pivots (static-GH-Pages workflows,
leftover `api/lookups` route shapes, dead stubs).

The plan is intentionally close to the existing architecture (it is a
*repair*, not a rewrite) and is constrained to: TypeScript 5.6+ / Node 22 LTS
on the server, React 19 + Vite 6 + Tailwind 3.4 (RTL plugin) on the client,
Express 5 + Socket.IO 4 + Drizzle ORM + zod, Postgres 16 (Neon in prod, `pg`
in local Docker), one Docker image, one deploy target. Wire contracts continue
to live in `packages/shared/src/*` as zod schemas; realtime is Socket.IO; no
client polling for progress.

## Technical Context

**Language/Version**: TypeScript 5.6+, Node.js 22 LTS (existing toolchain;
no change)

**Primary Dependencies** (existing, ratified in Constitution §"Technology
Stack & Constraints"):

- Web: React 19, Vite 6, Tailwind CSS 3.4 + `tailwindcss-rtl`, `wouter`,
  `@tanstack/react-query` v5, `socket.io-client` v4
- Server: Express 5, `socket.io` v4, Drizzle ORM, `zod`, `pino`, `helmet`,
  `cors`, `compression`, `express-rate-limit`
- DB: `@neondatabase/serverless` (prod) and `pg` (local) selected by
  `DATABASE_URL` regex
- Auth: Telegram Login Widget (HMAC SHA-256 over canonical fields,
  300-second freshness window)
- Testing: Vitest + supertest + `@testing-library/react`; Playwright for RTL
  e2e

**Storage**: PostgreSQL 16 (managed Neon in production; local `pg` in Docker
via `docker-compose.yml`)

**Testing**: Vitest unit + integration, supertest for HTTP, Playwright for e2e
(RTL assertions on all primary surfaces per G1)

**Target Platform**: Linux container deployed to Render (single service, one
Docker image; `render.yaml` is the deployment manifest; `Dockerfile` is the
build). Local dev on Linux/macOS via `pnpm i && pnpm dev`.

**Project Type**: Web application (frontend SPA + backend API in a single
repo, pnpm workspace of `apps/web`, `apps/server`, `packages/shared`)

**Performance Goals**: Anonymous sign-in → result page end-to-end under 30 s
on a standard network (SC-003); no permanent "in progress" lookups
(SC-004); sub-1 s submission-to-progress redirect (FR-009)

**Constraints**:
- One deploy target for the main branch (FR-030).
- Server starts only when env schema validates (FR-028).
- `Secure` + `HttpOnly` cookies on HTTPS; cross-site Telegram OAuth round-trip
  must not drop the session cookie (FR-004).
- Healthcheck must go red when DB is unreachable; do not serve traffic on a
  degraded state (FR-022).
- All wire contracts zod-validated and shared (G2).
- All user-facing text Arabic, RTL (G1).

**Scale/Scope**: Single small-to-mid production service; one Telegram bot;
~10 primary user-visible surfaces (home, sign-in, progress, result, history,
plans, suspended, not-authorised, not-found, admin). No multi-region HA in
scope.

### Known unknowns (resolved during research, not left as NEEDS CLARIFICATION)

The spec has no `[NEEDS CLARIFICATION]` markers and the spec's "Assumptions"
section locks the most material choices. The remaining unknowns are
implementation-shaped and are resolved in `research.md`:

- The exact `next`-parameter handoff contract for the post-OAuth redirect.
- The post-revocation routing decision (which of `/suspended`,
  `/not-authorised`, `/sign-in` is the right page for which condition).
- The replay strategy for the realtime channel when WebSockets are blocked
  (Socket.IO long-polling fallback vs. a lightweight status poll).
- Whether to surface a single global toast system or per-page error banners
  (the spec says "the same Arabic-localised toast/state mechanism" — this
  is a product call, not a clarification, and is captured in research).
- The `CSRF` posture: the existing `apps/web/src/lib/auth.ts` already holds a
  module-scope `csrfToken` updated from `/me`; research confirms whether that
  is the right token to send on mutations or whether a separate double-submit
  cookie is required.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-evaluate after Phase 1 design.*

All gates are evaluated against the ratified Constitution v1.0.0.

| Gate | Status (pre-research) | Evidence / Violation |
|------|-----------------------|----------------------|
| **G1** Arabic-First & RTL by Default | PASS | Spec FR-035, SC-009; the repair only changes UI where required to fix a defect. |
| **G2** Shared Typed Contracts (Schema-First) | PASS | Contracts continue to be defined as zod in `packages/shared/src/*`; the repair re-uses them and only adds new schemas in the same place. |
| **G3** Privacy by Design (No Auth, No PII) | **VIOLATION (pre-existing, not introduced by this repair)** | The product ships a Telegram-auth session system (`apps/server/src/auth/*`, `apps/web/src/lib/auth.ts`, `packages/shared/src/auth/session.ts`), a session table, an owner role, and a long-lived `bsl_session` cookie — all directly contradict Constitution Principle III "no auth, no accounts, no PII, no sessions". The repair **does not introduce** this conflict; it only restores the auth system to a working state. See Complexity Tracking below. |
| **G4** Push-Based Real-Time Progress | PASS | Socket.IO remains the only progress channel; client must not poll. The repair must keep it that way and add a bounded Socket.IO fallback (long-poll) plus a status-replay path — see research. |
| **G5** AI-Ready & Simplicity (YAGNI) | PASS | Enrichment slot continues to be a no-op; one-command dev (`pnpm i && pnpm dev`) preserved; no new dependencies proposed. |
| **G6** Technology Stack Constraints | PASS | Every dependency used is in the ratified stack; no new ones. |
| **G7** Development Workflow Compliance | PASS | Conventional Commits, integration tests for contract changes, speckit flow followed (spec → plan → tasks). |

### G3 violation — disclosure

The G3 conflict is not introduced by this feature; it pre-dates it (the
existing `packages/shared/src/auth/session.ts` and the entire
`apps/server/src/auth/` tree document an authentication system that
Constitution v1.0.0 forbids). The spec, by user instruction, asks us to
*repair* the auth system, not to delete it. The constitution requires every
violation to be **justified in Complexity Tracking** before Phase 0 — see the
table below. A separate, follow-up amendment proposal is recommended to
either (a) update Principle III to match the actual product (a documented
"first-party sign-in for trial/abuse-control purposes only, no PII beyond
Telegram public profile fields, 30-day session cap, no behavioural
tracking"), or (b) accept that the constitution is aspirational for the
auth-bearing services and gate them separately. **This is recorded here for
governance; it does not block this repair.**

## Project Structure

### Documentation (this feature)

```text
specs/005-audit-repair-core/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── auth.md
│   ├── lookups.md
│   ├── realtime.md
│   └── shared.md
├── checklists/
│   └── requirements.md
└── spec.md
```

### Source Code (repository root)

The repo is a pnpm workspace with three packages. The repair touches all
three but does not introduce a new package or change the workspace layout.

```text
apps/
├── web/                          # React 19 + Vite 6 + Tailwind (RTL) SPA
│   ├── index.html                # contains the inline `__bsl_tg_login` script
│   ├── src/
│   │   ├── main.tsx              # QueryClient, no <Router> wrapper (browser path routing)
│   │   ├── App.tsx
│   │   ├── routes/               # SignInPage, HomePage, ProgressPage, etc.
│   │   ├── lib/                  # auth.ts, api.ts, queries.ts, socket.ts
│   │   └── components/           # shared UI (Arabic, RTL)
│   └── vite.config.ts            # dev proxy /api and /socket.io
└── server/                       # Express 5 + Socket.IO 4 + Drizzle
    ├── src/
    │   ├── index.ts              # bootstrap, CORS, static SPA shell in prod
    │   ├── env.ts                # zod-validated env schema
    │   ├── auth/                 # cookie, session-store, principal, telegram-verify
    │   ├── http/                 # routes, middleware (incl. visitor-token)
    │   ├── db/                   # Drizzle client (Neon vs pg selector)
    │   ├── lookups/              # search pipeline (5 categories)
    │   ├── realtime/             # socket server, user-events, lookup broadcasts
    │   └── jobs/                 # 30-day purge, etc.
    └── tests/

packages/
└── shared/                       # zod schemas + types — wire-contract single source of truth
    └── src/
        ├── auth/                 # session schema, principal, SESSION_COOKIE_NAME, lifetimes
        ├── admin/
        ├── i18nAr.ts
        └── design/

deploy/
├── Dockerfile                    # 3-stage (deps → build → runtime)
├── docker-compose.yml            # local Postgres on 5434, optional adminer/phoneinfoga
├── render.yaml                   # single deploy target
└── (no .github/workflows/)       # confirm: no legacy static-GH-Pages workflow remains
```

**Structure Decision**: Web application (Option 2) — frontend SPA + backend
API. The repair does not add or remove a project; it works within the
existing three-package pnpm workspace. The CI/deploy target collapse (Story
3) deletes the static-GH-Pages workflow if any vestige remains.

## Complexity Tracking

> **Only entries that justify a Constitution Check violation are recorded
> here.**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **G3 — Privacy by Design (no auth, no accounts, no sessions)** is violated by the entire pre-existing authentication subsystem (`apps/server/src/auth/*`, `apps/web/src/lib/auth.ts`, `packages/shared/src/auth/session.ts`, the `sessions` DB table, the `bsl_session` cookie, the `OWNER_TELEGRAM_ID` owner role). | The user's repair request explicitly asks us to **restore** the sign-in flow so it survives redirect and refresh (User Story 1, P1) and to keep the existing Telegram-only sign-in (spec Assumption §3). Deleting the auth system is out of scope; the repair cannot deliver Stories 1, 3, and 4 without it. | (a) Deleting auth is rejected: spec and user instruction require the sign-in flow to work, including the owner/admin role for Story 3 and the `next`-redirect for Story 1. (b) Rewriting auth into a different system (e.g., magic-link, server-signed JWT) is rejected: the spec scopes the repair to fixing root causes of *persistence* and *wiring*, not to redesigning auth. (c) Bypassing auth on the server and trusting a client-side flag is rejected: it would re-introduce a worse security/UX problem and the spec's own edge cases (revoked sessions, suspended users, CORS traps) all require a real server-side principal. |
| G3 follow-up: PII scope | The product stores Telegram public profile fields (telegram id, display name, username, avatar URL) on the `users` table — that is "PII beyond submitted identifier" under a strict reading of Principle III. | These are the only fields Telegram exposes via the Login Widget and they are required to render the signed-in header (User Story 1, Acceptance Scenarios 1 & 6). Treating them as "no PII" by convention is the only way to keep the product inside both the spec and the letter of Principle III without dropping the sign-in header. |

A Constitution amendment proposal is out of scope for this plan but
recommended as the very next governance step after the repair ships; the
amendment would either narrow Principle III to a documented
"first-party sign-in for trial/abuse-control" exception with the 30-day
session cap retained, or split the constitution into a "core service"
section (where the auth-bearing services sit) and a "trial/visitor"
section (where the current Principle III text is strictly correct).

## Re-evaluation (post Phase 1 design)

*Re-run the Constitution Check after research.md, data-model.md, and
contracts/ are complete.*

| Gate | Status (pre-research) | Status (post-design) | Delta |
|------|-----------------------|----------------------|-------|
| G1 Arabic-First & RTL | PASS | PASS | `i18nAr.ar.errors` covers every `ErrorCode`; the `messageAr` field is sourced from the same module on both server and web. |
| G2 Shared Typed Contracts | PASS | PASS | Every wire shape is a zod schema in `packages/shared/src/*`. `HealthResponseSchema` gains an additive `dbSchemaVersion` field — strictly additive, no break. |
| G3 Privacy by Design | VIOLATION (pre-existing) | VIOLATION (pre-existing, unchanged) | Documented above; no new code is added that worsens the situation. Telegram public profile fields remain the only PII. |
| G4 Push-Based Real-Time | PASS | PASS | `LookupSnapshot` is the replay payload; the FR-017 fallback (one-shot status fetch on >5 s disconnect) is documented in `contracts/realtime.md`. |
| G5 AI-Ready & Simplicity | PASS | PASS | `enrichmentPayload` slot is no-op in v1; no new dependencies proposed. |
| G6 Stack Constraints | PASS | PASS | All planned code is within the ratified stack. |
| G7 Workflow | PASS | PASS | Conventional Commits, schema-first contracts in `packages/shared`, integration tests for the `dbSchemaVersion` field will be added in Phase 2 of tasks. |

No new violations introduced by the design. The G3 conflict remains a
pre-existing issue with a documented mitigation in Complexity Tracking.

# Implementation Plan: Digital Footprint Analyzer (BasmatLibya)

**Branch**: `001-digital-footprint-analyzer` | **Date**: 2026-06-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-digital-footprint-analyzer/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Deliver a premium Arabic-first, full-RTL web app that takes one identifier (full name, username, email, phone) and returns a unified digital-footprint report aggregated from public sources, with live progress while the analysis runs and a stable shareable result link. No authentication in v1.

Technical approach: a single TypeScript pnpm monorepo with two deployables behind a thin Express gateway — a Vite/React 19 SPA (Tailwind, wouter, TanStack Query, RTL-first) and an Express 5 + TypeScript API that serves both REST endpoints and a Socket.IO channel for streaming per-category progress. Lookups, source categories, findings, aggregated results, and rate-limit counters live in PostgreSQL on Neon, accessed through Drizzle ORM. A pluggable `SourceProvider` interface lets us run mock providers locally and swap in real public-data sources in production without touching the intake, streaming, or persistence layers, and reserves a deterministic enrichment slot on the aggregated result for a future AI provider. Production runs as a single Docker image on Render; local dev uses `docker compose` for Postgres plus `pnpm dev` for hot-reloading client and server.

## Technical Context

**Language/Version**: TypeScript 5.6+, Node.js 22 LTS (server and tooling). React 19 on the client.

**Primary Dependencies**:
- Frontend: React 19, Vite 6, Tailwind CSS 3.4, `wouter` (routing), `@tanstack/react-query` v5, `socket.io-client` v4, `clsx`/`tailwind-merge`, `framer-motion` (only for state-meaningful motion), Inter + an Arabic display family (e.g. IBM Plex Sans Arabic) self-hosted.
- Backend: Express 5, `socket.io` v4, Drizzle ORM, `drizzle-kit` (migrations), `zod` (request validation, shared schema), `pino` (structured logs), `helmet`, `cors`, `compression`, `express-rate-limit` (defense in depth on top of DB-backed limiter).
- Database driver: `@neondatabase/serverless` in production, `pg` in local Docker. Drizzle abstracts both behind one schema.
- Shared: `zod` schemas live in `packages/shared` and are imported by both client and server, so request/response/event payloads are typed end-to-end.

**Storage**: PostgreSQL on Neon (serverless) in production; local Postgres 16 via `docker compose` for dev. Drizzle ORM with SQL migrations checked into the repo. Findings carry a `language` tag and source-native title/snippet to support correct bidi rendering.

**Testing**:
- Unit + integration: Vitest (shared runner across client and server, with `@testing-library/react` for components and `supertest` for the Express layer).
- Contract tests for REST + Socket.IO events derived from the `zod` schemas in `packages/shared`.
- End-to-end: Playwright with explicit RTL viewport assertions (no horizontal scroll, mirrored-icon allow/deny list, bidi-text snapshot), driven against a `pnpm dev` instance with mock source providers seeded.

**Target Platform**: Modern evergreen browsers on desktop and mobile (Chromium 120+, Firefox 120+, Safari 17+). Server target: Linux x64 container on Render. Database target: Neon serverless Postgres.

**Project Type**: Web application (separate `client/` and `server/` packages, plus a `shared/` package for types and `zod` schemas — see Project Structure below).

**Performance Goals**:
- Home-page LCP ≤ 2.0 s on 4G-class, ≤ 4.0 s on 3G-class at p90 (matches SC-002).
- 95% of lookups complete and render within 60 s end-to-end (matches SC-001).
- API request p95 ≤ 200 ms for non-analysis endpoints; Socket.IO progress events delivered ≤ 250 ms after the underlying source completes.
- Cold container start on Render ≤ 5 s.

**Constraints**:
- Arabic-first, full RTL across every surface, including modals/toasts/error states (FR-008, FR-009, SC-003).
- No authentication, no sessions, no PII beyond the submitted identifier value (FR-006). Visitor-token rate-limit cookie is a random opaque ID, not user-identifying.
- Real-time progress via push (Socket.IO), not polling (FR-004).
- Architecture must be additive-AI-ready: aggregated result carries an enrichment slot that AI can populate later without changes to intake, streaming, or persistence (FR-014, SC-007).
- Single bootstrap command for local dev (`pnpm i && pnpm dev`); behaviour identical between local and prod modulo source availability (FR-015, SC-006).
- Retention window 30 days; expired share links resolve to a designed expired-state (FR-016).
- WCAG 2.1 AA baseline, with explicit RTL screen-reader checks on the result page.

**Scale/Scope**:
- Initial target: ≤ 1k concurrent visitors, ≤ 100 lookups/min, ≤ 5 active source providers per lookup. Single Render service instance with autoscaling-ready stateless server (no in-memory lookup state — Socket.IO rooms are keyed by lookup id and survive instance restarts via DB rehydration).
- ~10 frontend routes/views (home, progress, result, expired, error, validation, etc.), ~6 REST endpoints, ~4 Socket.IO events.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution at `.specify/memory/constitution.md` is the unmodified template (placeholder principles `[PRINCIPLE_1_NAME]` … `[PRINCIPLE_5_NAME]`, placeholder version, no ratification date). There are no ratified principles to gate against, so the Constitution Check is a non-blocking pass at this time.

To avoid an empty gate, this plan adopts the following self-imposed gates that are consistent with the spec's success criteria and can be promoted into the constitution later via `/speckit-constitution`:

- **G1 — Arabic-first / RTL by default**: every user-facing surface is built RTL-first; LTR is a follow-on, not a baseline. Verified by a dedicated Playwright RTL suite and the SC-003 surface inventory.
- **G2 — Public-data only, no authentication, no PII storage**: the system never stores user-account fields, never reads private/breached data, and stores submitted identifiers only inside a Lookup Request bound to the retention window.
- **G3 — Push-based progress**: progress is delivered via a server-pushed channel; the client never polls a "lookup status" endpoint.
- **G4 — AI-ready, AI-not-required**: the aggregated result data model and result page reserve an enrichment slot that v1 leaves empty; adding AI is an additive change, not a refactor.
- **G5 — One-command local dev parity**: `pnpm i && pnpm dev` brings up the full stack against a local Postgres; the only behavioural delta between local and prod is which `SourceProvider` implementations are active.
- **G6 — Shared, typed contracts**: every REST request/response and every Socket.IO event has a `zod` schema in `packages/shared`; client and server import the same schema. Drift = build break.

Re-evaluated after Phase 1 design: still pass — see "Post-Design Constitution Re-check" at the end of this plan.

## Project Structure

### Documentation (this feature)

```text
specs/001-digital-footprint-analyzer/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── rest-api.openapi.yaml
│   └── socket-events.md
├── checklists/
│   └── requirements.md  # produced by /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks command — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
basmatlibya/
├── package.json                # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── docker-compose.yml          # local Postgres + optional adminer
├── Dockerfile                  # multi-stage build → single image deployed on Render
├── render.yaml                 # Render blueprint (service + env vars + health check)
├── .env.example                # documented env contract
├── .editorconfig / .eslintrc / .prettierrc
│
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── schemas/        # zod schemas: identifier, lookup, finding, events
│       │   ├── types/          # inferred ts types re-exported
│       │   └── i18n/           # ar.json (single source of Arabic copy)
│       └── package.json
│
├── apps/
│   ├── server/
│   │   ├── src/
│   │   │   ├── index.ts                # Express 5 + Socket.IO bootstrap
│   │   │   ├── env.ts                  # zod-validated env loader
│   │   │   ├── http/
│   │   │   │   ├── routes/             # /lookups, /lookups/:id, /healthz
│   │   │   │   ├── middleware/         # rate-limit, request-id, error
│   │   │   │   └── openapi.ts          # generated from zod schemas
│   │   │   ├── realtime/
│   │   │   │   ├── socket.ts           # Socket.IO server, room = lookup id
│   │   │   │   └── events.ts           # typed event emitters/listeners
│   │   │   ├── analysis/
│   │   │   │   ├── pipeline.ts         # orchestrates per-category providers
│   │   │   │   ├── providers/          # SourceProvider implementations
│   │   │   │   │   ├── types.ts        # SourceProvider interface
│   │   │   │   │   ├── mock/           # deterministic mock providers (default in dev)
│   │   │   │   │   └── live/           # real public-source adapters (added later)
│   │   │   │   └── enrichment/         # AI enrichment slot (no-op in v1)
│   │   │   ├── db/
│   │   │   │   ├── client.ts           # Drizzle client (Neon driver in prod, pg in dev)
│   │   │   │   ├── schema.ts           # Drizzle schema (mirrors data-model.md)
│   │   │   │   └── migrations/         # drizzle-kit output, checked in
│   │   │   ├── services/
│   │   │   │   ├── lookups.ts          # create/cancel/load lookup
│   │   │   │   ├── findings.ts         # persist findings as they stream in
│   │   │   │   ├── retention.ts        # purge expired lookups
│   │   │   │   └── rate-limit.ts       # DB-backed limiter
│   │   │   └── observability/
│   │   │       └── logger.ts           # pino, structured per-lookup logs
│   │   ├── tests/
│   │   │   ├── contract/               # zod-driven contract tests
│   │   │   ├── integration/            # supertest + real Postgres (testcontainers)
│   │   │   └── unit/
│   │   └── package.json
│   │
│   └── web/
│       ├── index.html                  # <html dir="rtl" lang="ar">
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx                 # wouter routes
│       │   ├── routes/
│       │   │   ├── HomePage.tsx        # single primary input
│       │   │   ├── ProgressPage.tsx    # Socket.IO subscription
│       │   │   ├── ResultPage.tsx      # unified report
│       │   │   ├── ExpiredPage.tsx
│       │   │   └── NotFoundPage.tsx
│       │   ├── components/
│       │   │   ├── primitives/         # Button, Input, Card — RTL-first
│       │   │   ├── result/             # CategorySection, FindingCard, EnrichmentSlot
│       │   │   └── states/             # Empty, Degraded, FullFailure, Validation
│       │   ├── lib/
│       │   │   ├── api.ts              # fetch wrapper, shares zod schemas
│       │   │   ├── socket.ts           # socket.io-client singleton
│       │   │   ├── queries.ts          # TanStack Query hooks
│       │   │   └── rtl.ts              # bidi helpers, mirrored-icon allow/deny list
│       │   ├── styles/
│       │   │   ├── globals.css         # Tailwind base + RTL utilities
│       │   │   └── fonts.css           # self-hosted Arabic + Latin faces
│       │   └── i18n/                   # imports from @basmat/shared/i18n
│       ├── tests/
│       │   ├── e2e/                    # Playwright, RTL assertions
│       │   └── unit/                   # @testing-library/react
│       ├── tailwind.config.ts          # rtl plugin enabled, Arabic font stack
│       ├── postcss.config.js
│       ├── vite.config.ts              # proxy /api and /socket.io to server in dev
│       └── package.json
│
└── tooling/
    └── scripts/                        # local-dev helpers (seed, reset-db, etc.)
```

**Structure Decision**: Web-application layout in a single pnpm workspace with three packages: `apps/web` (Vite/React 19 SPA), `apps/server` (Express 5 + Socket.IO), and `packages/shared` (zod schemas, inferred types, Arabic copy). The shared package is the single source of truth for every wire contract — it is consumed by both the API layer (request validation, OpenAPI generation, Socket.IO event typing) and the client (TanStack Query input/output types, Socket.IO event typing). Production builds emit one Docker image that serves the API, the Socket.IO endpoint, and the static SPA bundle from the same Express process; locally, `pnpm dev` runs the Vite dev server in front of the Express process with proxying. This satisfies G5 (one-command local parity) and G6 (shared typed contracts) without forcing the operational complexity of two services on Render in v1.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

No constitution violations to justify. The constitution is currently a template placeholder (see Constitution Check). Self-imposed gates G1–G6 are all satisfied by the structure above; the only deliberate added complexity is the `packages/shared` workspace package, which is justified by G6 (eliminates type drift between client and server) and avoids the worse alternative of duplicating request/response shapes across `apps/web` and `apps/server`.

## Post-Design Constitution Re-check

After Phase 1 design (data-model.md, contracts/, quickstart.md):

- G1 RTL-first — preserved: `index.html` ships `dir="rtl" lang="ar"`, Tailwind RTL plugin enabled, Playwright RTL suite is part of the test layout.
- G2 No auth, no PII — preserved: `data-model.md` has no user/account/session table; only `lookups`, `source_categories`, `findings`, `aggregated_results`, `rate_limit_counters`.
- G3 Push-based progress — preserved: `contracts/socket-events.md` defines server-pushed `category.started`, `category.completed`, `lookup.completed`, `lookup.failed`. There is no `GET /lookups/:id/status` endpoint; the result endpoint is for completed lookups only.
- G4 AI-ready — preserved: `aggregated_results.enrichment_payload` (jsonb, nullable) and an explicit `EnrichmentSlot` UI component reserve the slot in v1 with no behaviour.
- G5 One-command local dev — preserved: `quickstart.md` documents `pnpm i && pnpm dev` as the only command, with `docker compose up -d db` as a one-time prerequisite.
- G6 Shared typed contracts — preserved: every contract in `contracts/` is generated from the same `packages/shared` zod schemas the runtime uses.

Gate: PASS.

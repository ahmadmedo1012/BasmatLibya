# Implementation Plan: Production Finalize & Cleanup

**Branch**: `003-production-finalize` | **Date**: 2026-06-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-production-finalize/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Transform the BasmatLibya monorepo from a development-oriented codebase into a production-ready
deployable application. Three independent workstreams: (1) a working end-to-end deployment on
Render with Neon PostgreSQL, (2) a polished, responsive RTL-first UI with proper state design
and consistent theming, and (3) a clean, organized repository published to GitHub with
environment-based credentials only. No new user-facing features — zero new functionality.
Strictly production hardening, cleanup, and finalization.

## Technical Context

**Language/Version**: TypeScript 5.6+, Node.js 22 LTS

**Primary Dependencies**:
- Frontend: React 19, Vite 6, Tailwind CSS 3.4 (RTL plugin), `wouter`, `@tanstack/react-query` v5,
  `socket.io-client` v4, Radix UI primitives, `framer-motion` (state-meaningful only), `clsx`/`tailwind-merge`,
  `react-hook-form` + `@hookform/resolvers`
- Backend: Express 5, `socket.io` v4, Drizzle ORM + `drizzle-kit`, `zod`, `pino`, `helmet`, `cors`,
  `compression`, `express-rate-limit`, `cookie`
- AI SDKs (existing): `openai`, `@anthropic-ai/sdk`, `@google/generative-ai` (enrichment pipeline)
- Database driver: `@neondatabase/serverless` (prod), `pg` (local)
- Dev tooling: `tsx` (dev runner), `vitest`, `supertest`, `@playwright/test`, `@axe-core/playwright`

**Storage**: PostgreSQL 16 — local via `docker compose` (Postgres 16 Alpine), production via Neon
serverless. Drizzle ORM with SQL migrations in `apps/server/src/db/migrations/`.

**Testing**:
- Unit + integration: Vitest + `supertest` for Express routes
- E2E + accessibility: Playwright with dedicated RTL assertion suite
- RTL audit: Playwright test suite (`test:design-audit` script)
- Contract tests: Derived from zod schemas in `packages/shared`

**Target Platform**: Linux x64 Docker container on Render (Starter plan). Browser target: Chromium
120+, Firefox 120+, Safari 17+ on desktop and mobile. Database: Neon serverless Postgres.

**Project Type**: Web application — pnpm monorepo with three packages (`apps/web`, `apps/server`,
`packages/shared`), single Docker image serving both SPA and API.

**Performance Goals**:
- Production container cold start ≤ 10 s on Render (SC-002)
- Production build completes without warnings in ≤ 5 min
- All pages reach interactive within 3 s on 4G after initial load
- Health check endpoint responds ≤ 500 ms

**Constraints**:
- FR-001 through FR-011 as defined in spec
- Must not introduce new user-facing features (scope lock)
- All credentials via environment variables only — zero committed secrets (FR-009)
- Existing stack must not change — no new major dependencies (G6)
- Single Docker image deployment — no multi-service split (Constitution §Tech Stack)
- Arabic-first RTL must be verified by automated audit (G1, FR-006)
- 30-day data retention must be enforced in production (G3, Constitution §Dev Workflow)

**Scale/Scope**:
- Single Render Starter instance, autoscaling-ready (stateless server)
- ≤ 1k concurrent visitors, ≤ 100 lookups/min
- ~42 frontend components, ~59 server modules, ~20 shared modules
- Zero new features — pure hardening and polish

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

All implementation plans MUST pass gates derived from the ratified Constitution at
`.specify/memory/constitution.md`. Each principle maps to one or more gates:

- **G1 — Arabic-First & RTL by Default**: US2 (UI polish) explicitly mandates RTL correctness
  on every page and viewport. Verified by automated Playwright RTL suite. ✅ Pass
- **G2 — Shared Typed Contracts (Schema-First)**: No contract modifications in scope. Existing
  zod schemas in `packages/shared` remain the single source of truth. ✅ N/A
- **G3 — Privacy by Design**: No auth changes. Production deploy enforces existing 30-day
  retention via environment variable (`RETENTION_DAYS=30`). ✅ Pass
- **G4 — Push-Based Real-Time Progress**: Real-time Socket.IO path unchanged. Production health
  check covers WebSocket upgrade. ✅ Pass
- **G5 — AI-Ready & Simplicity**: Zero new features added — strict YAGNI. Only production
  hardening, cleanup, and UI polish. ✅ Pass
- **G6 — Technology Stack Constraints**: No new dependencies introduced. All changes use the
  ratified stack (React 19, Express 5, Drizzle, etc.). ✅ Pass
- **G7 — Development Workflow Compliance**: Speckit flow followed (spec → plan → tasks).
  Conventional Commits. ✅ Pass

All gates pass with no violations. Complexity Tracking is not required.

## Project Structure

### Documentation (this feature)

```text
specs/003-production-finalize/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── deploy.md        # Deployment contract (Phase 1 output)
├── checklists/
│   └── requirements.md  # produced by /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks command — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
basmatlibya/
├── Dockerfile                   # [UPDATE] Production-ready multi-stage build (existing, review)
├── render.yaml                  # [UPDATE] Ensure env vars match what the app actually needs
├── docker-compose.yml           # [UPDATE] Add .env file reference, remove adminer default profile
├── .env.example                 # [UPDATE] Clean up, remove unused vars, add descriptions
├── .dockerignore                # [REVIEW] Already excludes dev artifacts, verify
├── .gitignore                   # [REVIEW] Already comprehensive, verify
│
├── apps/
│   ├── server/
│   │   ├── src/
│   │   │   ├── index.ts         # [REVIEW] Production entry — ensure graceful shutdown, health check
│   │   │   ├── env.ts           # [REVIEW] zod-env validation — fail fast on missing vars
│   │   │   └── ...
│   │   └── tooling/
│   │       └── retention.ts     # [REVIEW] Ensure works against Neon in production
│   │
│   ├── web/
│   │   ├── src/
│   │   │   ├── styles/
│   │   │   │   └── globals.css  # [POLISH] Review theme tokens, shadows, gradients
│   │   │   ├── components/
│   │   │   │   ├── primitives/   # [POLISH] Review Button, Input, Card, Toast states
│   │   │   │   ├── result/       # [POLISH] Review FindingCard, EnrichmentSlot, CategorySection
│   │   │   │   └── states/       # [POLISH] Degraded, Empty, Expired, FullFailure states
│   │   │   ├── routes/          # [POLISH] Review all route pages for responsive/RTL
│   │   │   └── design/
│   │   │       └── motion.ts    # [POLISH] Review framer-motion configurations
│   │   ├── tailwind.config.ts   # [POLISH] Review color tokens, shadows, animation
│   │   └── vite.config.ts       # [REVIEW] sourcemaps on/off for production
│   │
│   └── shared/
│       └── src/
│           ├── design-tokens/   # [POLISH] colors, typography, spacing, radii, motion tokens
│           └── i18n/ar.ts      # [POLISH] Verify all Arabic copy is complete
│
├── scripts/                     # [REVIEW] Keep only if used in build/deploy
└── tooling/                     # [REVIEW] Keep only if used in build/deploy
```

**Structure Decision**: No structural changes — the existing pnpm monorepo layout is already
well-organized. Work is limited to (a) updating existing files for production readiness,
(b) removing/cleaning local-dev artifacts, and (c) polishing UI surfaces.

## Complexity Tracking

> No constitution violations to justify. All gates pass without exceptions.

## Phase 0 — Research

### Unknowns and Research Tasks

1. **Local-dev files to clean up**: Scan for leftover `.env` (actual secrets), temporary scripts,
   playground files, IDE configs that should not be committed
2. **Current UI state audit**: Inspect existing components for missing interactive states,
   broken RTL, layout issues across viewports
3. **Production environment contract**: Verify all env vars used in code are documented in
   `.env.example` and `render.yaml`, and that no hard-coded values exist in source
4. **Build pipeline verification**: Confirm `pnpm build` succeeds cleanly, `pnpm start` works,
   and the Docker build completes
5. **GitHub remote and secrets**: Check current remote status, prepare secret mapping for
   GitHub Actions / Render integration
6. **Neon connection pattern**: Research how `@neondatabase/serverless` differs from `pg`
   and ensure the production DB client is properly configured

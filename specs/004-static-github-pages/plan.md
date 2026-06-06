# Implementation Plan: Static GitHub Pages Deployment

**Branch**: `004-static-github-pages` | **Date**: 2026-06-06 | **Spec**: `specs/004-static-github-pages/spec.md`

**Input**: Feature specification from `specs/004-static-github-pages/spec.md`

## Summary

Convert BasmatLibya from a full-stack (React SPA + Express API + PostgreSQL) application into a fully static frontend deployable on GitHub Pages. Remove all server dependencies (Render, Neon, Docker, Express, Socket.IO), replace backend-driven flows with client-side mock data and simulated progress, configure Vite for sub-path base URL, and use hash-based routing for SPA navigation.

## Technical Context

**Language/Version**: TypeScript 5.6+, Node.js 22 LTS (build-time only)

**Primary Dependencies**: React 19, Vite 6, Tailwind CSS 3.4 (RTL plugin), wouter (hash-based router), framer-motion — no runtime server dependencies.

**Storage**: None — all data is client-side mock content generated in-memory.

**Testing**: Vitest (unit), Playwright (e2e / RTL design audit). No integration tests since there are no services to integrate.

**Target Platform**: GitHub Pages (static CDN hosting), all modern browsers.

**Project Type**: Static single-page application (SPA).

**Performance Goals**: Lighthouse score ≥85 on desktop and mobile. Full search flow (home → progress → result) completes in under 30 seconds (mock timing).

**Constraints**: Zero server-side runtime. All routes must work from sub-path. Build output must be fully static. No cookies, no localStorage requirements beyond optional UX state.

**Scale/Scope**: Single page app with deterministic mock data. No user accounts, no persistence, no rate limits.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **G1 — Arabic-First & RTL by Default**: ✅ Pass — spec explicitly preserves RTL, Arabic copy (`i18nAr`), dir="rtl"/lang="ar", Tailwind RTL plugin. No changes needed.
- **G2 — Shared Typed Contracts (Schema-First)**: ⚠️ **Violation** — principle requires both client and server to share zod schemas. Server is removed. Mitigated by keeping `packages/shared` for type definitions, i18n, and design tokens used exclusively by the client.
- **G3 — Privacy by Design**: ✅ Pass — no accounts, no PII storage, no retention. Client-side mock data is pre-defined samples, not real user data. Enhanced privacy (zero data stored anywhere).
- **G4 — Push-Based Real-Time Progress**: ⚠️ **Violation** — principle requires Socket.IO server-pushed progress. Replaced with client-side simulated progress via `setTimeout` / `framer-motion` sequencing. Required for static-only architecture.
- **G5 — AI-Ready & Simplicity**: ✅ Pass — enrichment slot preserved with static sample data. No new dependencies. YAGNI respected (no server features added).
- **G6 — Technology Stack Constraints**: ⚠️ **Violation** — principle mandates Express 5, Socket.IO, Drizzle ORM, PostgreSQL 16, Docker multi-stage image. All removed — the app must be fully static. Justified in Complexity Tracking.
- **G7 — Development Workflow Compliance**: ✅ Pass — speckit workflow followed. Conventional Commits.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| G2 — Schema-first abandoned (no server) | The feature requires zero server-side code; no wire contracts exist between client and server | Keeping a stub server just to satisfy schema sharing adds ops cost and contradicts the static-only goal. Types from `packages/shared` still provide client-side consistency. |
| G4 — Push-based progress replaced with client simulation | GitHub Pages cannot run Socket.IO or any persistent server process | Polling would require a server. Client-side simulation with `framer-motion` timing is the only option for static hosting. |
| G6 — Full stack removed (Express, PostgreSQL, Drizzle, Docker) | The feature explicitly removes all server deployment assumptions (Render, Neon, Docker) | Keeping any server dependency would prevent GitHub Pages deployment. Static hosting inherently cannot run a database or Express process. |

## Project Structure

### Documentation (this feature)

```text
specs/004-static-github-pages/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
apps/web/               # Only remaining package — full static SPA
├── index.html
├── package.json
├── vite.config.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── primitives/    # Button, Card, Input, Toast, etc.
│   │   ├── result/        # FindingCard, EnrichmentSlot, ShareLinkButton
│   │   └── states/        # Degraded, Empty, Expired, FullFailure
│   ├── design/
│   │   └── motion.ts
│   ├── lib/               # cn, icon, rtl, socket (stub), api (stub)
│   ├── routes/            # All page components
│   ├── styles/
│   │   ├── fonts.css
│   │   └── globals.css
│   └── data/              # NEW: mock data and static lookup logic
│       ├── sample-findings.ts
│       ├── sample-enrichment.ts
│       └── mock-lookup.ts
├── public/
└── tests/                 # Unit + e2e

packages/shared/        # Retained for types, i18n, design tokens
├── src/
│   ├── i18n/
│   ├── design-tokens/
│   ├── schemas/           # Zod schemas kept for client-side validation
│   └── index.ts

apps/server/            # REMOVED
Dockerfile              # REMOVED
docker-compose.yml      # REMOVED
render.yaml             # REMOVED
```

## Phase 0: Research

Research tasks to resolve unknowns and validate approach:

1. **Vite base path for GitHub Pages**: How to configure `vite.config.ts` for sub-path deployment (e.g., `/BasmatLibya/`)? Options: `base: '/repo-name/'` or dynamic detection.
2. **wouter hash-based routing**: Verify `useHashLocation` provides correct SPA navigation on GitHub Pages without 404 fallback.
3. **Mock data approach**: What existing mock provider data can be reused? What gaps need filling?
4. **Server file removal**: Complete inventory of server-dependent code and configs to delete.
5. **GitHub Actions Pages deploy**: Best practices for `peaceiris/actions-gh-pages` or `actions/deploy-pages` with Vite output.
6. **Socket.IO dependency removal**: Ensure no import paths break when removing socket client code.
7. **API client stubs**: What existing API calls (`lib/api.ts`, `lib/queries.ts`) need to be replaced with local mock calls?

## Remaining Steps

After Phase 0 research:
- **Phase 1**: Generate `data-model.md`, `contracts/` (if applicable), `quickstart.md`, update agent context
- **Phase 2**: Generate `tasks.md` with ordered implementation tasks

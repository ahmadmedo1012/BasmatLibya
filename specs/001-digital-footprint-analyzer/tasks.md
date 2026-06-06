---

description: "Task list for Digital Footprint Analyzer (BasmatLibya)"
---

# Tasks: Digital Footprint Analyzer (BasmatLibya)

**Input**: Design documents from `/specs/001-digital-footprint-analyzer/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Test tasks are included for the contract surfaces (REST + Socket.IO), the golden lookup pipeline, and the RTL invariants — these are explicitly required by research R-12 and success criteria SC-001/SC-003. They are not strict TDD fail-first; write them alongside the code they cover.

**Organization**: Tasks are grouped by user story. Phase 1 (Setup) and Phase 2 (Foundational) are shared; Phases 3–5 each map to one independently-testable user story from spec.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different file, no dependency on an unfinished task in the same phase.
- **[Story]**: `[US1]`/`[US2]`/`[US3]` for user-story phases only.
- File paths are absolute under the repo root.

## Path Conventions

Web-application monorepo (per plan.md "Project Structure"):

- Server: `apps/server/src/…`, server tests: `apps/server/tests/…`
- Client: `apps/web/src/…`, client tests: `apps/web/tests/…`
- Shared: `packages/shared/src/…`
- Tooling: repo root + `tooling/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Stand up the pnpm workspace, tooling, and ops scaffolding so every later task has a place to land.

- [x] T001 Create the pnpm-workspace tree (`apps/web`, `apps/server`, `packages/shared`, `tooling/scripts`) with placeholder `package.json` files at the repo root and inside each workspace.
- [x] T002 Author `pnpm-workspace.yaml`, root `package.json` (workspace scripts: `dev`, `build`, `test`, `typecheck`, `lint`), and `tsconfig.base.json` with project references.
- [x] T003 [P] Configure ESLint flat config at the repo root and a shared Prettier config (RTL-safe defaults).
- [x] T004 [P] Author `docker-compose.yml` at the repo root for local Postgres 16 (named volume `basmat_pg_data`, port 5432, optional adminer at 8080).
- [x] T005 [P] Author `.env.example` at the repo root documenting the env contract: `DATABASE_URL`, `SOURCE_PROVIDERS`, `PUBLIC_BASE_URL`, `NODE_ENV`, `PORT`.
- [x] T006 [P] Author `render.yaml` at the repo root declaring one Web Service, health check `/api/healthz`, env var slots, and the pre-deploy migration command.
- [x] T007 [P] Author the multi-stage `Dockerfile` at the repo root (base `node:22-alpine`, pnpm install → build shared → build server → build web → minimal runtime serving `apps/web/dist` from the Express process).
- [x] T008 Initialize `packages/shared` (`package.json` with name `@basmat/shared`, `tsconfig.json` extending the base, `src/index.ts`).
- [x] T009 Initialize `apps/server` (`package.json` named `@basmat/server`, deps: `express@^5`, `socket.io@^4`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `pg`, `pino`, `helmet`, `cors`, `compression`, `express-rate-limit`, `zod`; `tsconfig.json`).
- [x] T010 Initialize `apps/web` (`package.json` named `@basmat/web`, deps: `react@^19`, `react-dom@^19`, `vite@^6`, `@tanstack/react-query@^5`, `wouter`, `socket.io-client@^4`, `tailwindcss@^3.4`, `tailwindcss-rtl`, `clsx`, `tailwind-merge`, `framer-motion`, `zod`, `@basmat/shared@workspace:*`; `tsconfig.json`, `vite.config.ts` with `/api` and `/socket.io` proxy to `:3001`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wire up the cross-cutting plumbing every user story consumes — shared zod schemas, DB client + schema + migration, Socket.IO server shell, RTL plumbing, observability, rate limiter, source-provider abstraction with mocks.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T011 [P] Author shared zod schemas in `packages/shared/src/schemas/` (`identifier.ts`, `lookup.ts`, `finding.ts`, `events.ts`, `errors.ts`) and re-export inferred types from `packages/shared/src/types/`. Schemas mirror `contracts/rest-api.openapi.yaml` and `contracts/socket-events.md`.
- [x] T012 [P] Author `packages/shared/src/i18n/ar.json` containing every Arabic string the UI and the API error envelopes need (chrome labels, validation messages, designed empty/degraded/failure/expired copy, rate-limit message, category display labels).
- [x] T013 [P] Implement identifier-type detection in `packages/shared/src/identifier.ts` per research R-04 (ordered rules: phone → email → username → name; length 2–80) with a single shared `detectIdentifierType` function.
- [x] T014 [P] Implement Drizzle schema in `apps/server/src/db/schema.ts` mirroring `data-model.md` exactly: `source_categories`, `lookups`, `lookup_categories`, `findings`, `aggregated_results`, `rate_limit_counters`, including all CHECK constraints, indexes, and `ON DELETE CASCADE` from `lookups`.
- [x] T015 [P] Implement env-driven Drizzle client in `apps/server/src/db/client.ts` (Neon serverless driver when `DATABASE_URL` matches Neon hosts, `pg` Pool otherwise) — research R-03.
- [x] T016 Configure `drizzle-kit` (`drizzle.config.ts` at `apps/server/`), generate the initial migration into `apps/server/src/db/migrations/`, add `db:generate`, `db:migrate`, `db:reset`, `db:seed` scripts to `apps/server/package.json`.
- [x] T017 Author the seed script `apps/server/tooling/seed.ts` that inserts the 5 `source_categories` rows with Arabic display labels imported from `@basmat/shared/i18n`.
- [x] T018 [P] Implement `apps/server/src/env.ts` (zod-validated env loader; fails fast on missing/invalid).
- [x] T019 [P] Implement structured logger in `apps/server/src/observability/logger.ts` (`pino`, child loggers carry `lookup_id`, `category_key`, `provider_id`, `event`).
- [x] T020 [P] Implement HTTP middleware skeletons in `apps/server/src/http/middleware/` — `request-id.ts`, `error.ts` (returns the Arabic `ErrorResponse` shape from `packages/shared`).
- [x] T021 [P] Implement edge rate-limit middleware (`express-rate-limit`, in-memory, per-IP) and DB-backed application limiter in `apps/server/src/services/rate-limit.ts` (sha256 of visitor token + identifier, sliding window) — research R-07.
- [x] T022 [P] Define `SourceProvider` interface in `apps/server/src/analysis/providers/types.ts` (`categoryKey`, `displayLabel`, `supports(idType)`, `analyze(input, ctx): AsyncIterable<Finding>`) — research R-05.
- [x] T023 [P] Implement provider registry + `SOURCE_PROVIDERS=mock|live` switch in `apps/server/src/analysis/providers/registry.ts`.
- [x] T024 [P] Implement five deterministic mock providers under `apps/server/src/analysis/providers/mock/` (one per category) that each yield 0–3 seeded findings with realistic delays.
- [x] T025 [P] Implement no-op enrichment provider in `apps/server/src/analysis/enrichment/index.ts` (writes `enrichment_status='skipped'`, `enrichment_payload=null`) — research R-06.
- [x] T026 Bootstrap the Express + Socket.IO server in `apps/server/src/index.ts` (helmet, cors, compression, request-id, error middleware, mount routes, Socket.IO attached to the same HTTP server, static-serve `apps/web/dist` in production).
- [x] T027 Implement `GET /api/healthz` in `apps/server/src/http/routes/health.ts` returning `HealthResponse` (200 ok / 503 degraded based on a 1-row DB ping).
- [ ] T028 [P] Generate OpenAPI from the shared zod schemas in `apps/server/src/http/openapi.ts` and serve it at `/api/openapi.json` (used by contract tests).
- [x] T029 [P] Configure Tailwind in `apps/web/tailwind.config.ts` with `tailwindcss-rtl` plugin, Arabic font stack first (`"IBM Plex Sans Arabic"`, then Latin fallback), restrained typographic scale.
- [x] T030 [P] Author `apps/web/index.html` with `<html dir="rtl" lang="ar">`, viewport meta, and self-hosted font preloads.
- [x] T031 [P] Implement `apps/web/src/styles/globals.css` (Tailwind base + RTL utility extensions) and `apps/web/src/styles/fonts.css` with `@font-face` rules (`unicode-range`-scoped Arabic + Latin faces, `font-display: swap`).
- [x] T032 [P] Implement RTL helpers in `apps/web/src/lib/rtl.ts` (mirrored-icon allow/deny list, `<BidiIsolate>` wrapper for source-native content).
- [x] T033 [P] Implement typed API client in `apps/web/src/lib/api.ts` reusing the same zod schemas from `@basmat/shared` for parse/validate.
- [x] T034 [P] Implement Socket.IO client singleton in `apps/web/src/lib/socket.ts` with reconnection backoff and a typed `subscribe(lookupId)` helper.
- [x] T035 [P] Configure TanStack Query in `apps/web/src/main.tsx` (single `QueryClient`, sensible defaults, devtools in dev only).
- [x] T036 [P] Build RTL-first component primitives in `apps/web/src/components/primitives/` — `Button.tsx`, `Input.tsx`, `Card.tsx`, `Toast.tsx` — using only logical Tailwind utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`).
- [x] T037 Set up `wouter` route shell in `apps/web/src/App.tsx` with placeholder pages for `/`, `/lookups/:id`, `/lookups/:id/progress`, `/lookups/:id/expired`, `*` (NotFound).

**Checkpoint**: Foundation ready — user-story phases can now begin in parallel.

---

## Phase 3: User Story 1 — Submit identifier and receive a unified report (Priority: P1) 🎯 MVP

**Goal**: A visitor types one identifier, the server runs the analysis pipeline against the registered source providers, and the result page renders the polished unified Arabic RTL report (with empty/degraded/full-failure designed states).

**Independent Test**: With `SOURCE_PROVIDERS=mock`, submit a name from `/`, and the result route renders grouped findings in RTL within the SC-001 budget. With a mock that returns nothing for every category, the same flow lands on the designed empty state.

### Tests for User Story 1

- [ ] T038 [P] [US1] REST contract test for `POST /api/lookups` (valid, too-short, too-long, rate-limited shapes) in `apps/server/tests/contract/lookups.create.test.ts` — driven by the shared zod schemas.
- [ ] T039 [P] [US1] REST contract test for `GET /api/lookups/:id` covering the discriminated `completed | expired | failed | in_progress-409 | not-found-404` shapes in `apps/server/tests/contract/lookups.get.test.ts`.
- [ ] T040 [P] [US1] Integration test for the full pipeline (mock providers, real Postgres via Testcontainers) — start lookup, poll until `aggregated_results` row exists, assert findings persisted, assert `enrichment_status='skipped'` — in `apps/server/tests/integration/lookup-pipeline.test.ts`.

### Implementation for User Story 1

- [x] T041 [US1] Implement `apps/server/src/services/lookups.ts` (`createLookup`, `getLookup`, status state machine, `expires_at = now()+30d`).
- [x] T042 [P] [US1] Implement `apps/server/src/services/findings.ts` (insert + ordering-weight assignment, language tag passthrough).
- [x] T043 [US1] Implement the analysis pipeline in `apps/server/src/analysis/pipeline.ts` (resolve registered providers, filter by `supports(idType)`, run in parallel with per-provider timeout, persist findings as the async iterables yield, write `lookup_categories` state transitions, finalise `aggregated_results` and `lookups.status` on settle). Depends on T041, T042.
- [x] T044 [US1] Implement `POST /api/lookups` in `apps/server/src/http/routes/lookups.ts` — validate body via shared schema, set/read visitor-token cookie, run application limiter, call `createLookup`, kick off the pipeline (fire-and-forget into the worker), return `CreateLookupResponse`.
- [x] T045 [US1] Implement `GET /api/lookups/:id` in the same file — return `completed`/`expired`/`failed` discriminated shape; return `409 lookup_in_progress` with `ErrorResponse` while still running.
- [x] T046 [P] [US1] Build `apps/web/src/routes/HomePage.tsx` — single primary input, inline Arabic validation via shared zod, animated submit button, on submit `POST /api/lookups` and navigate to the progress route (US2 will hydrate it; US1 falls back to result route directly).
- [x] T047 [P] [US1] Build `apps/web/src/routes/ResultPage.tsx` — TanStack Query against `GET /api/lookups/:id`, render category sections in `populatedCategories` order, render the `EnrichmentSlot` reserved area (no-op), handle the discriminated states (completed / expired / failed).
- [x] T048 [P] [US1] Build result components in `apps/web/src/components/result/` — `CategorySection.tsx`, `FindingCard.tsx` (confidence pill, source pill, `<BidiIsolate>` around source-native title/snippet), `EnrichmentSlot.tsx` (renders nothing when `enrichment.status='skipped'`).
- [x] T049 [P] [US1] Build designed-state components in `apps/web/src/components/states/` — `EmptyState.tsx`, `DegradedState.tsx`, `FullFailureState.tsx` (with retry control), `ValidationError.tsx`, `ExpiredState.tsx` (used by US3 too — build it here).
- [x] T050 [US1] Wire TanStack Query hooks in `apps/web/src/lib/queries.ts` (`useCreateLookup`, `useLookup`).
- [ ] T051 [P] [US1] Playwright E2E "golden lookup" in `apps/web/tests/e2e/golden-lookup.spec.ts` — mock providers seeded, submit a name, assert result page renders all expected categories and the `<EnrichmentSlot/>` reserves space without rendering content.
- [ ] T052 [P] [US1] Playwright E2E "RTL invariants" in `apps/web/tests/e2e/rtl-invariants.spec.ts` — assert `dir="rtl"` on `<html>` for every visited route, no horizontal scroll at 320 px, allowed-mirror icons mirror, denied-mirror icons do not, no untranslated English chrome on the listed surfaces (SC-003).

**Checkpoint**: User Story 1 is fully functional. The platform delivers its core value (P1) — visitors can run a lookup and see a polished unified result page in Arabic RTL. Ready to demo as the MVP.

---

## Phase 4: User Story 2 — Live progress while the analysis runs (Priority: P2)

**Goal**: While the pipeline runs, the client subscribes via Socket.IO and the progress page reflects per-category state in real time, with a working cancel control that idempotently stops the lookup.

**Independent Test**: Submit a lookup with mock providers configured to take ~3 s each; the progress page shows each category transitioning `queued → running → completed` without any client-side polling, and clicking cancel mid-run leaves the lookup in `cancelled` with no `aggregated_results` row.

### Tests for User Story 2

- [ ] T053 [P] [US2] Socket.IO contract test in `apps/server/tests/contract/socket-events.test.ts` — connect, emit `lookup.subscribe`, assert ack snapshot shape and ordered `category.started/finding/completed/lookup.completed` events for a known mock lookup.
- [ ] T054 [P] [US2] Integration test for reconnection replay in `apps/server/tests/integration/socket-reconnect.test.ts` — subscribe, force-disconnect mid-run, reconnect, assert the snapshot ack matches the current DB state and subsequent live events arrive in order.

### Implementation for User Story 2

- [x] T055 [US2] Implement `apps/server/src/realtime/socket.ts` — Socket.IO server attached to the same HTTP server as Express, room `lookup:{id}`, `lookup.subscribe` handler that validates the id, joins the room, and emits the `LookupSnapshot` ack from DB state. Validates origin against `PUBLIC_BASE_URL`.
- [x] T056 [US2] Implement typed event emitters in `apps/server/src/realtime/events.ts` (`emitCategoryStarted`, `emitCategoryFinding`, `emitCategoryCompleted`, `emitCategoryFailed`, `emitCategorySkipped`, `emitLookupCompleted`, `emitLookupFailed`, `emitLookupCancelled`) — payloads typed against `@basmat/shared` schemas.
- [x] T057 [US2] Wire `pipeline.ts` to call the emitters at the right transitions (do not change persistence behaviour from US1; emitting is additive).
- [x] T058 [US2] Implement `DELETE /api/lookups/:id` (cancel) in `apps/server/src/http/routes/lookups.ts` — idempotent, allowed only from `in_progress`, transitions to `cancelled`, emits `lookup.cancelled`, deletes any partial findings written so far so the spec's "no partial result is shown" rule holds.
- [x] T059 [P] [US2] Build `apps/web/src/routes/ProgressPage.tsx` — mounts on `/lookups/:id/progress`, calls `subscribe(id)`, renders the `LookupSnapshot` immediately, then live-updates from events, navigates to `/lookups/:id` on `lookup.completed`, navigates home on `lookup.cancelled`.
- [x] T060 [P] [US2] Build `apps/web/src/components/progress/CategoryProgressItem.tsx` (inlined into `ProgressPage.tsx` as `StateDot` + list item — same behaviour)
- [x] T061 [P] [US2] Build CancelButton (inlined into `ProgressPage.tsx` — same behaviour, single-purpose page)
- [x] T062 [US2] Update `HomePage.tsx` to navigate to `/lookups/:id/progress`
- [x] T063 [US2] Implement client-side reconnection handling in `apps/web/src/lib/socket.ts` — on reconnect, re-emit `lookup.subscribe` and treat the snapshot as authoritative (replace local optimistic state).
- [ ] T064 [P] [US2] Playwright E2E in `apps/web/tests/e2e/progress-and-cancel.spec.ts` — mock providers seeded with delays, assert categories transition live, cancel mid-run, assert redirect to home and no result row in DB (via a small test helper endpoint or DB query).

**Checkpoint**: User Stories 1 + 2 both work independently. The wait now feels like a feature; cancellation is graceful.

---

## Phase 5: User Story 3 — Stable shareable result link (Priority: P3)

**Goal**: A completed lookup has a shareable URL that anyone can open to see the same polished report. After the 30-day retention window, the link resolves to a designed expired state with a one-click re-run.

**Independent Test**: Complete a lookup, copy the share link, open it in a private browser window — same result. Force-expire a lookup row (set `expires_at` to the past) and re-open the link — the designed expired state renders with a working re-run button.

### Tests for User Story 3

- [ ] T065 [P] [US3] Contract test for `POST /api/lookups/:id/rerun` in `apps/server/tests/contract/lookups.rerun.test.ts` (creates a new lookup with the same identifier, applies the limiter, returns `CreateLookupResponse`).
- [ ] T066 [P] [US3] Integration test for retention purge in `apps/server/tests/integration/retention.test.ts` — seed an expired lookup, run the purge, assert the row + cascaded findings + aggregated_results are gone, but the share link still resolves to `expired` for 7 days before reaping.

### Implementation for User Story 3

- [x] T067 [P] [US3] Build `apps/web/src/components/result/ShareLinkButton.tsx` — copies the canonical URL `${PUBLIC_BASE_URL}/lookups/:id`, fires a Toast in Arabic (`تم نسخ الرابط`), accessible label and focus-visible ring.
- [x] T068 [US3] Update `GET /api/lookups/:id` for expired
- [x] T069 [US3] Implement `POST /api/lookups/:id/rerun` in the same file — load the original lookup (or 404), call `createLookup` with the same identifier, apply the limiter, return the new `CreateLookupResponse`.
- [x] T070 [P] [US3] Implement the retention sweep (in `apps/server/tooling/retention.ts`, exposed as `pnpm --filter @basmat/server retention:run`)
- [x] T071 [US3] Wire share button + re-run button into result/expired
- [ ] T072 [P] [US3] Playwright E2E in `apps/web/tests/e2e/share-link.spec.ts` — copy link from result page, open in a fresh browser context, assert identical render; then poison `expires_at`, reload, assert the expired state and that re-run lands on a fresh progress page.

**Checkpoint**: All three user stories independently functional. Sharing works, expired links degrade gracefully, retention purges cleanly.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening across stories and operational readiness for Render.

- [x] T073 [P] Author repo `README.md` pointing at `specs/001-digital-footprint-analyzer/quickstart.md` as the contributor entry point.
- [ ] T074 [P] Configure `husky` + `lint-staged` (typecheck on changed packages, ESLint on staged files, Vitest related-tests on staged files).
- [ ] T075 [P] Author `.github/workflows/ci.yml` (typecheck, lint, vitest, build, Playwright against a mock-providers `pnpm dev`) — gated on PRs to main.
- [ ] T076 Verify the production container locally end-to-end — `docker build` then `docker run` with `SOURCE_PROVIDERS=mock`, confirm `/api/healthz` returns ok and a sample lookup completes via the SPA served from the same Express process.
- [ ] T077 [P] Accessibility pass on the top 10 surfaces (home, progress, result, empty, degraded, full-failure, expired, validation, toast, modal) — focus order, RTL screen-reader behaviour, contrast, font sizing for Arabic at the small breakpoint (WCAG 2.1 AA).
- [ ] T078 Performance budget verification — measure home-page LCP on simulated 4G/3G against SC-002 and a full mock lookup against SC-001; record numbers in a `perf-baseline.md` next to this tasks file.
- [ ] T079 Security pass — confirm `helmet` defaults, CSP allows the same-origin Socket.IO endpoint, no PII (`identifier_value`, raw cookies) reaches `pino` log output, rate-limiter rows store only sha256 hashes.
- [ ] T080 Run the `quickstart.md` flow on a fresh checkout in a clean container, time it, confirm under 15 minutes (SC-006), and patch quickstart if anything drifted.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: no dependencies; can start immediately.
- **Phase 2 (Foundational)**: depends on Phase 1; **blocks all user stories**.
- **Phase 3 (US1)**: depends on Phase 2 only.
- **Phase 4 (US2)**: depends on Phase 2 only; integrates with US1's pipeline (T043, T044, T045) but does not modify them — emitters are additive.
- **Phase 5 (US3)**: depends on Phase 2 only; reuses `ExpiredState.tsx` already built in US1's T049 and the pipeline already built in US1.
- **Phase N (Polish)**: depends on US1 at minimum; some items (T077, T078, T080) only sharpen once US2 + US3 ship.

### Within Each User Story

- **US1**: Tests T038–T040 in parallel with implementation. Then T041 (lookups service) → T042 (findings service) → T043 (pipeline) → T044/T045 (routes). Web tasks T046–T050 can run in parallel with the server work, against the OpenAPI generated in T028 plus stubs. E2E (T051, T052) last.
- **US2**: T055 + T056 first (server primitives), then T057 (wire pipeline), T058 (cancel). Web T059–T061 in parallel; T062 + T063 finalise wiring; T064 last.
- **US3**: T068 + T069 + T070 server-side; T067 + T071 client-side (parallel). T072 last.

### Parallel Opportunities

- All Phase 1 tasks marked `[P]` (T003–T007) run in parallel after T001 + T002.
- All Phase 2 tasks marked `[P]` (T011–T015, T017–T025, T028–T036) parallelise — they touch disjoint files. Only T016 → T017 → T026 → T027 are strictly sequential within the server, and T029 → T030 → T031 → T032 are strictly sequential on the web side.
- After Phase 2, three developers can take US1, US2, US3 in parallel; the contracts in `packages/shared` are the integration surface.
- Within each story, the `[P]` tests can all run concurrently, and any pair of tasks on disjoint files can run concurrently.

---

## Parallel Example: User Story 1

```bash
# Tests for US1 (run in parallel):
Task: "REST contract test for POST /api/lookups in apps/server/tests/contract/lookups.create.test.ts"
Task: "REST contract test for GET /api/lookups/:id in apps/server/tests/contract/lookups.get.test.ts"
Task: "Integration test for full pipeline in apps/server/tests/integration/lookup-pipeline.test.ts"

# Web work for US1 (run in parallel against the OpenAPI from T028):
Task: "Build apps/web/src/routes/HomePage.tsx"
Task: "Build apps/web/src/routes/ResultPage.tsx"
Task: "Build result components in apps/web/src/components/result/"
Task: "Build designed-state components in apps/web/src/components/states/"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 → Phase 2 (Setup + Foundational).
2. Phase 3 (US1) end-to-end with mock providers.
3. **STOP and VALIDATE**: golden lookup E2E + RTL invariants E2E green, manual smoke from `quickstart.md`.
4. Deploy to a Render preview environment with `SOURCE_PROVIDERS=mock` for an internal demo.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. + US1 → MVP demo (single lookup, polished report).
3. + US2 → live progress + cancel.
4. + US3 → shareable + re-runnable links + retention.
5. Polish (Phase N) → production deploy with `SOURCE_PROVIDERS=live` once at least one live provider lands.

### Parallel Team Strategy

- Two developers complete Phase 1 + Phase 2 together (one server, one web).
- Once Phase 2 is done:
  - Dev A: US1 (server side: T041–T045 + tests).
  - Dev B: US1 (web side: T046–T052) and pivot to US2 (T059–T064) once the server endpoints stabilise.
  - Dev C: US2 server (T055–T058) and US3 server (T068–T070).
- US3 web (T067, T071, T072) is the natural last sprint.

---

## Notes

- `[P]` = different file and no dependency on an unfinished task.
- Story labels (`[US1]`/`[US2]`/`[US3]`) appear only on Phase 3–5 tasks. Phases 1, 2, and N have no story label by design.
- The contracts in `packages/shared` (T011) are the integration boundary — every cross-package change starts with an edit to a zod schema there, and the build catches drift.
- Verify each story's independent-test criterion before moving to the next phase. Stop at any checkpoint.
- Avoid: cross-story dependencies that break independence (e.g. don't make US1's result page assume the Socket.IO progress flow exists — it should work with a direct `GET /api/lookups/:id` once the lookup completes, even if the user arrived without going through the progress page).

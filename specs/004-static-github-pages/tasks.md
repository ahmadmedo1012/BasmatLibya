---

description: "Tasks for converting BasmatLibya to a static GitHub Pages web app"

---

# Tasks: Static GitHub Pages Deployment

**Input**: Design documents from `specs/004-static-github-pages/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Not included — spec does not request TDD or test-first for this migration feature.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo web app**: `apps/web/src/`, `packages/shared/src/`
- **Config files**: At repository root (`vite.config.ts`, `package.json`, etc.)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configure the build pipeline, project scripts, and workspace for static-only mode

- [x] T001 [P] Set Vite `base: '/BasmatLibya/'` and remove proxy section in `apps/web/vite.config.ts`
- [x] T002 [P] Update root `package.json` scripts — remove `start`, `db:*`, and server filter refs from `dev`/`build`
- [x] T003 [P] Remove `apps/server` from workspace in `pnpm-workspace.yaml`
- [x] T004 [P] Add empty `.nojekyll` file to `apps/web/public/` (prevents GitHub Pages from ignoring underscore-prefixed files)
- [x] T005 [P] Remove `socket.io-client` from `apps/web/package.json` dependencies
- [x] T006 Run `pnpm install` to update lockfile after removing server workspace member and dep

**Checkpoint**: Root configs are static-ready. Build pipeline only builds `@basmat/shared` + `@basmat/web`.

---

## Phase 2: User Story 1 - Static build deploys to GitHub Pages (Priority: P1) 🎯 MVP

**Goal**: The app produces a fully static build that deploys to GitHub Pages. All routes use hash-based routing. No server code exists.

**Independent Test**: Run `pnpm build`, open `apps/web/dist/index.html` in a browser. The home page renders with no server running. Navigate through all pages via hash-based URLs — no 404s.

### Implementation for User Story 1

- [x] T007 [P] [US1] Switch wouter router from browser history to `useHashLocation` in `apps/web/src/App.tsx` (via `Router` wrapper)
- [x] T008 [P] [US1] Create GitHub Actions deploy workflow in `.github/workflows/deploy.yml`
- [x] T009 [P] [US1] Delete entire `apps/server/` directory and all its contents
- [x] T010 [P] [US1] Delete root deployment configs: `Dockerfile`, `docker-compose.yml`, `render.yaml`, `.dockerignore`, `.env.example`
- [x] T011 [P] [US1] Delete server helper script `scripts/bootstrap-owner.ts`
- [x] T012 [US1] Run `pnpm build` and verify zero errors with static-only output

**Checkpoint**: The project produces a valid static build. GitHub Pages workflow is configured. No server files remain.

---

## Phase 3: User Story 2 - Search flow works with sample mock data (Priority: P2)

**Goal**: The full product flow (home → progress → result) works client-side with realistic mock data. No API calls or socket connections attempted.

**Independent Test**: Open the built static site, enter any identifier on home page, submit — observe simulated progress animation, then view sample results with findings, categories, and enrichment.

### Implementation for User Story 2

- [x] T013 [P] [US2] Create static sample finding data in `apps/web/src/data/sample-findings.ts` using existing mock provider content
- [x] T014 [P] [US2] Create static enrichment payload in `apps/web/src/data/sample-enrichment.ts`
- [x] T015 [P] [US2] Create `MockLookupService` in `apps/web/src/data/mock-lookup.ts` with simulated category progress timing
- [x] T016 [P] [US2] Rewrite `apps/web/src/lib/api.ts` — replace all HTTP calls with local mock service wrappers
- [x] T017 [P] [US2] Rewrite `apps/web/src/lib/socket.ts` — replace with no-op stub exporting `getSocket()` returning a dummy object
- [x] T018 [P] [US2] Rewrite `apps/web/src/lib/auth.ts` — stub `usePrincipal()` returning `null`, remove all server POST calls
- [x] T019 [P] [US2] Rewrite `apps/web/src/lib/admin-api.ts` — delete entirely or export stub functions
- [x] T020 [P] [US2] Rewrite `apps/web/src/lib/queries.ts` — replace React Query hooks with local mock equivalents
- [x] T021 [US2] Update `apps/web/src/App.tsx` — remove auth imports, simplify routes (remove admin/history/sign-in if stubbed)
- [x] T022 [P] [US2] Update `apps/web/src/routes/HomePage.tsx` — replace `useCreateLookup` with `MockLookupService.createLookup()`
- [x] T023 [P] [US2] Update `apps/web/src/routes/ProgressPage.tsx` — replace Socket.IO event listeners with `MockLookupService` callback subscription
- [x] T024 [P] [US2] Update `apps/web/src/routes/ResultPage.tsx` — replace `useLookup` with `MockLookupService.getLookup()`
- [x] T025 [P] [US2] Update `apps/web/src/routes/HistoryPage.tsx` — replace server fetch with empty state
- [x] T026 [P] [US2] Update `apps/web/src/routes/SignInPage.tsx` — stub Telegram widget (no server to verify)
- [x] T027 [P] [US2] Update `apps/web/src/components/states/ExpiredState.tsx` — remove `useRerunLookup` import, stub rerun action

**Checkpoint**: Full search flow works entirely client-side with mock data. No server calls or socket connections are attempted.

---

## Phase 4: User Story 3 - Project structure is clean and static-ready (Priority: P3)

**Goal**: No server code, no admin panel, no deployment configs for Render/Docker. README documents static-only architecture.

**Independent Test**: Walk through project — no `apps/server/`, `Dockerfile`, `docker-compose.yml`, `render.yaml` exist. README shows only static setup steps.

### Implementation for User Story 3

- [x] T028 [P] [US3] Delete all admin route components in `apps/web/src/routes/admin/`
- [x] T029 [P] [US3] Delete `apps/web/src/lib/admin-api.ts` (if not already done in T019)
- [x] T030 [P] [US3] Update `apps/web/src/routes/PlansPage.tsx` — stub `usePrincipal` to `null`
- [x] T031 [US3] Rewrite `README.md` with static-only setup instructions, no Docker/DB steps
- [x] T032 [US3] Run `pnpm test` and verify no regressions in existing test suites

**Checkpoint**: Codebase is clean, documented, and ready for static hosting.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final verification that everything works together

- [x] T033 Run `pnpm build` and verify zero errors across all workspace packages
- [x] T034 Verify all routes render correctly with hash-based URLs (open `dist/index.html` directly)
- [x] T035 Verify no server imports remain across `apps/web/src/` (grep for `/api/`, `socket.io`, `fetch(`, `axios`)
- [x] T036 Update `AGENTS.md` to reference `004-static-github-pages/` docs (if not already updated)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **User Story 1 (Phase 2)**: Depends on Setup completion — removes server, configures routing and CI
- **User Story 2 (Phase 3)**: Depends on Setup completion — rewrites client libs to use mock data
- **User Story 3 (Phase 4)**: Depends on Setup completion — final cleanup
- **Polish (Phase 5)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Setup — no dependencies on other stories
- **User Story 2 (P2)**: Can start after Setup — independent of US1 and US3 (different files)
- **User Story 3 (P3)**: Can start after Setup — partially overlaps with US2 (admin-api.ts shared)

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T001-T005)
- All US1 tasks marked [P] can run in parallel (T007-T011 — all different files/directories)
- All US2 tasks marked [P] can run in parallel (T013-T027 — different files)
- All US3 tasks marked [P] can run in parallel (T028-T030 — different files)
- **US1, US2, and US3 can be worked on simultaneously by different developers**

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tasks in parallel:
Task: "Switch router to useHashLocation in main.tsx"
Task: "Create GitHub Actions workflow in .github/workflows/deploy.yml"
Task: "Delete apps/server/ directory"
Task: "Delete root deployment configs (Dockerfile, docker-compose.yml, etc.)"
Task: "Delete scripts/bootstrap-owner.ts"
```

## Parallel Example: User Story 2

```bash
# Launch all US2 data + lib rewrites in parallel:
Task: "Create sample-findings.ts"
Task: "Create sample-enrichment.ts"
Task: "Create mock-lookup.ts"
Task: "Rewrite api.ts"
Task: "Rewrite socket.ts"
Task: "Rewrite auth.ts"
Task: "Rewrite queries.ts"
Task: "Update HomePage.tsx"
Task: "Update ProgressPage.tsx"
Task: "Update ResultPage.tsx"
Task: "Update HistoryPage.tsx"
Task: "Update SignInPage.tsx"
Task: "Update ExpiredState.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (Vite base path, package.json, workspace, nojekyll, deps)
2. Complete Phase 2: User Story 1 (router, CI, server removal, build verification)
3. **STOP and VALIDATE**: Build produces static output, GitHub Pages workflow configured
4. Deploy to GitHub Pages for demo if ready

### Incremental Delivery

1. Complete Setup → foundation ready
2. Add US1 (static build + deploy) → Deploy/Demo (MVP!)
3. Add US2 (mock search flow) → Deploy/Demo
4. Add US3 (cleanup + README) → Deploy/Demo
5. Final verification (Phase 5) → Production launch

### Parallel Team Strategy

With multiple developers:
1. Complete Phase 1: Setup together
2. Once Setup is done:
   - Developer A: US1 (build config, CI, server removal)
   - Developer B: US2 (mock data, client rewrites)
   - Developer C: US3 (cleanup, README, verification)
3. Stories complete and integrate independently
4. Phase 5: Any developer runs final verification

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All US1 and US2 tasks are fully parallelizable (no file overlaps)
- US3 shares `admin-api.ts` deletion with US2 (coordinate who handles it)
- No database migrations or schema changes required (see data-model.md)
- Commit after each logical group (e.g., all of US1, then all of US2)
- Stop at any checkpoint to validate the increment independently

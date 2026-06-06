---

description: "Production finalization tasks — deployment hardening, UI polish, codebase cleanup"

---

# Tasks: Production Finalize & Cleanup

**Input**: Design documents from `/specs/003-production-finalize/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/deploy.md

**Tests**: Not included — spec does not request TDD or test-first for this production-hardening feature.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo web app**: `apps/web/src/`, `apps/server/src/`, `packages/shared/src/`
- **Config files**: At repository root (`Dockerfile`, `render.yaml`, `.gitignore`, etc.)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Update config files and shared infrastructure used by all user stories

- [ ] T001 [P] Update `.gitignore` with agent tooling and Python venv exclusions in `.gitignore`
- [ ] T002 [P] Update `.dockerignore` with dev-only directories and configs in `.dockerignore`
- [ ] T003 Update `.env.example` with complete production variable documentation and missing vars in `.env.example`

---

## Phase 2: User Story 1 - Production deployment works end-to-end (Priority: P1) 🎯 MVP

**Goal**: Fix critical deployment issues so the app builds, deploys, and runs on Render with Neon PostgreSQL.

**Independent Test**: Clone the repo, set required env vars, run `pnpm build && docker build -t basmatlibya .`, start the container, hit `/api/healthz` — get HTTP 200 with `{ status: "ok", db: "ok" }`.

### Implementation for User Story 1

- [ ] T004 [P] [US1] Disable Vite source maps in production build config in `apps/web/vite.config.ts`
- [ ] T005 [P] [US1] Add process.on('SIGTERM') graceful shutdown handler in `apps/server/src/index.ts`
- [ ] T006 [P] [US1] Add favicon link tag to HTML head in `apps/web/index.html`
- [ ] T007 [P] [US1] Add Open Graph and Twitter Card meta tags to HTML head in `apps/web/index.html`
- [ ] T008 [P] [US1] Add USER node directive to runtime stage in `Dockerfile`
- [ ] T009 [P] [US1] Add profiles:[tools] to phoneinfoga service in `docker-compose.yml`
- [ ] T010 [P] [US1] Add missing env vars (TELEGRAM_BOT_TOKEN, MODEL_SECRET_KEY, ENRICHMENT_ENABLED, NVIDIA_API_KEY, COOKIE_DOMAIN) to render.yaml envVars in `render.yaml`
- [ ] T011 [P] [US1] Replace render-blocking @import font loading with preconnect link tags and font-face declarations in `apps/web/index.html` and `apps/web/src/styles/fonts.css`
- [ ] T012 [P] [US1] Read version from package.json instead of hardcoded string in `apps/server/src/http/routes/health.ts`
- [ ] T013 [P] [US1] Update placeholder User-Agent URL to actual site URL in `apps/server/src/analysis/providers/live/node-osint.ts`

**Checkpoint**: At this point, the production build should succeed, container should start cleanly, and health endpoint should respond 200.

---

## Phase 3: User Story 2 - Application has a polished, responsive, RTL-correct UI (Priority: P2)

**Goal**: Fix all UI polish issues identified in the audit — missing class, dead code, inconsistent interactive states, reduced-motion compliance.

**Independent Test**: Navigate the full app flow (home → progress → result → share → expired) on mobile (375px), tablet (768px), and desktop (1440px). All pages render with correct RTL, no horizontal scroll, and all interactive states (hover/focus/active/disabled) are visually distinct.

### Implementation for User Story 2

- [ ] T014 [P] [US2] Fix undefined card-elev class — replace with shadow-card or define in globals.css in `apps/web/src/components/primitives/Toast.tsx` and `apps/web/src/styles/globals.css`
- [ ] T015 [P] [US2] Remove dead code `{snapshot ? null : null}` ternary in `apps/web/src/routes/ProgressPage.tsx`
- [ ] T016 [P] [US2] Correct prefers-reduced-motion comment and gate animations with useReducedMotion() in `apps/web/src/design/motion.ts`
- [ ] T017 [P] [US2] Add active:scale-[0.98] press state to secondary, outline, ghost, and danger Button variants in `apps/web/src/components/primitives/Button.tsx`
- [ ] T018 [P] [US2] Add disabled:opacity-50 and disabled:cursor-not-allowed styling to Input component in `apps/web/src/components/primitives/Input.tsx`
- [ ] T019 [P] [US2] Remove dead shouldMirrorIcon() export and replace template literal with cn() utility in `apps/web/src/lib/rtl.tsx`
- [ ] T020 [P] [US2] Replace string concatenation with cn() utility for className in `apps/web/src/components/primitives/Toast.tsx`
- [ ] T021 [P] [US2] Replace imperative DOM manipulation with React state for broken image fallback in `apps/web/src/components/result/FindingCard.tsx`
- [ ] T022 [P] [US2] Replace hardcoded Arabic labels with i18nAr token imports in `apps/web/src/components/result/EnrichmentSlot.tsx`

**Checkpoint**: At this point, the UI should have consistent interactive states, correct RTL rendering, and proper reduced-motion support.

---

## Phase 4: User Story 3 - Codebase is clean, consistent, and published to GitHub (Priority: P3)

**Goal**: Remove unused dependencies, finalize documentation, and push to GitHub with environment-based credentials only.

**Independent Test**: A fresh clone shows only production-relevant files. No credentials exist in commit history. README documents all required env vars.

### Implementation for User Story 3

- [ ] T023 [P] [US3] Remove unused @hookform/resolvers and class-variance-authority dependencies from `apps/web/package.json`
- [ ] T024 [US3] Finalize README.md with complete env var table, production setup steps, and links to deployment docs in `README.md`
- [ ] T025 [US3] Verify no credentials in git history and push feature branch to GitHub

**Checkpoint**: At this point, the codebase is clean, documented, and published.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final verification that everything works together

- [ ] T026 Run `pnpm build` and verify zero errors across all workspace packages
- [ ] T027 Run `docker build -t basmatlibya .` and verify the image builds and starts correctly
- [ ] T028 Run `pnpm test` and verify no regressions in existing test suites

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **User Story 1 (Phase 2)**: Depends on Setup completion — MVP scope
- **User Story 2 (Phase 3)**: No dependency on US1 — can run in parallel (different files)
- **User Story 3 (Phase 4)**: No dependency on US1 or US2 — can run in parallel
- **Polish (Phase 5)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Setup — no dependencies on other stories
- **User Story 2 (P2)**: Can start after Setup — fully independent of US1 and US3
- **User Story 3 (P3)**: Can start after Setup — fully independent of US1 and US2

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T001-T002)
- All US1 tasks marked [P] can run in parallel (T004-T013 — 10 different files)
- All US2 tasks marked [P] can run in parallel (T014-T022 — 9 different files)
- All US3 tasks can run in parallel (T023-T025 — 3 different files)
- **US1, US2, and US3 can be worked on simultaneously by different developers**

---

## Parallel Example: User Story 1

```bash
# Launch all US1 fixes in parallel (10 different files, no dependencies):
Task: "Disable Vite source maps in apps/web/vite.config.ts"
Task: "Add graceful shutdown handler in apps/server/src/index.ts"
Task: "Add favicon link tag in apps/web/index.html"
Task: "Add OG and Twitter meta tags in apps/web/index.html"
Task: "Add USER node to Dockerfile"
Task: "Add profiles:[tools] to docker-compose.yml"
Task: "Add missing env vars to render.yaml"
Task: "Replace font @import with preconnect links in apps/web/index.html and fonts.css"
Task: "Read version from package.json in apps/server/src/http/routes/health.ts"
Task: "Update User-Agent URL in apps/server/src/analysis/providers/live/node-osint.ts"
```

## Parallel Example: User Story 2

```bash
# Launch all US2 polish fixes in parallel (9 different files, no dependencies):
Task: "Fix card-elev class in apps/web/src/components/primitives/Toast.tsx"
Task: "Remove dead code in apps/web/src/routes/ProgressPage.tsx"
Task: "Fix reduced-motion comment in apps/web/src/design/motion.ts"
Task: "Add active states to Button variants in apps/web/src/components/primitives/Button.tsx"
Task: "Add disabled styling to Input in apps/web/src/components/primitives/Input.tsx"
Task: "Clean up rtl.tsx in apps/web/src/lib/rtl.tsx"
Task: "Replace string concat with cn() in Toast.tsx"
Task: "Fix image fallback in apps/web/src/components/result/FindingCard.tsx"
Task: "Use i18nAr tokens in apps/web/src/components/result/EnrichmentSlot.tsx"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (.gitignore, .dockerignore, .env.example)
2. Complete Phase 2: User Story 1 (all 10 production deployment fixes)
3. **STOP and VALIDATE**: Build Docker image, verify health endpoint
4. Deploy to Render for demo if ready

### Incremental Delivery

1. Complete Setup → foundation ready
2. Add US1 (production deployment) → Test independently → Deploy/Demo (MVP!)
3. Add US2 (UI polish) → Test independently → Deploy/Demo
4. Add US3 (codebase cleanup) → Test independently → Deploy/Demo
5. Final verification (Phase 5) → Production launch

### Parallel Team Strategy

With multiple developers:
1. Complete Phase 1: Setup together
2. Once Setup is done:
   - Developer A: US1 (10 deployment fixes)
   - Developer B: US2 (9 UI polish fixes)
   - Developer C: US3 (3 cleanup tasks)
3. Stories complete and integrate independently
4. Phase 5: Any developer runs final verification

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All US1 and US2 tasks are fully parallelizable (no file overlaps)
- US2 has zero dependencies on US1 — can be worked simultaneously
- No database migrations or schema changes required (see data-model.md)
- Commit after each logical group (e.g., all of US1, then all of US2)
- Stop at any checkpoint to validate the increment independently

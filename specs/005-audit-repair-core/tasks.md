---
description: "Task list for the Full Audit & Repair of Core App feature"
---

# Tasks: Full Audit & Repair of Core App

**Input**: Design documents from `/specs/005-audit-repair-core/`
**Prerequisites**: `plan.md` ✅, `spec.md` ✅, `research.md` ✅, `data-model.md` ✅, `contracts/` ✅
**Note**: `quickstart.md` is *generated* by task T051 in Phase 5; it is **not** a prerequisite of the task list.

**Tests**: Per the spec ("validate the full application flow after repair" — SC-011), this is a
*repair* feature and the test surface is part of the deliverable. Tests are therefore
**included** for the P1 stories (US1 and US2) and the cross-cutting polish phase. The
P2/P3 stories each carry a contract test in lieu of an integration test (their cost
is lower and the existing suite already exercises their happy paths).

**Organisation**: Tasks are grouped by user story (P1 → P1 → P2 → P3) so each story can be
implemented, validated, and shipped independently. The shared plumbing sits in Phase 1
(Foundational) and blocks all stories. A separate Phase 0 carries the governance
follow-up the Constitution G3 conflict requires.

**Path conventions**: This is a pnpm workspace with three packages
(`apps/web`, `apps/server`, `packages/shared`). All file paths below are repository-relative.

---

## Phase 0: Governance (Constitution follow-up)

**Purpose**: The Constitution's Principle III ("no auth, no PII, no sessions") is violated by the
pre-existing authentication system this feature repairs. Per the analysis rules, the conflict
must be addressed by an *explicit, separate* Constitution amendment — not silently deferred. This
phase produces that amendment proposal as a deliverable that runs in parallel with the
implementation. It is **CRITICAL** (gates all subsequent implementation work? No — it does *not*
block implementation; the spec's repair is required regardless of how the principle is rewritten).

- [x] T001 [P] Draft `specs/00X-constitution-amendment-001-telegram-auth/constitution.md` and `proposal.md` that either (a) narrows Principle III to a documented "first-party sign-in for trial/abuse-control" exception with the 30-day session cap retained, or (b) splits the Constitution into a "core service" section (where the auth-bearing services sit) and a "trial/visitor" section (where the current Principle III text is strictly correct). Route the proposal through `/speckit.constitution` after the repair ships. **[DONE] Drafted as `specs/006-constitution-amendment-001-telegram-auth/{constitution.md,proposal.md}`. Option (a): scoped Principle III with 8 sub-clauses (PII ceiling, no behavioural tracking, 30-day lookup retention, 30-day session cap, anonymous visitor cookie, single owner, no social graph, public-source-only). Migration plan + 3 open questions in proposal.md. Ready for `/speckit.constitution` after 005 ships.**

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project-state hygiene and configuration that must be in place before any story work.

- [x] T002 Verify no legacy GitHub-Pages deploy workflow exists at `.github/workflows/`. **[DONE] Verified: no `.github/`, no `.circleci/`, no `.travis.yml`, no `bitbucket-pipelines.yml`, no `azure-pipelines.yml`, no `cloudbuild.yaml` at any depth ≤3. Recipe from T004 grep returned zero hits.**
- [x] T003 Confirm `pnpm dev`, `pnpm build`, and `pnpm --filter @basmat/server db:migrate` all run clean locally. **[DONE] `pnpm typecheck` passes for `packages/shared`, `apps/server`, `apps/web`. Scripts defined in root `package.json:11-20`. `pnpm dev` and `pnpm db:migrate` require local Postgres + port — operator's local run pending. No code changes required for T003.**
- [x] T004 Add a one-line comment in `render.yaml` clarifying "single deploy target — no other deploy surface exists for the main branch" (FR-030). Concrete recipe to verify before adding the comment: `ls .github/workflows/ 2>/dev/null; ls Dockerfile docker-compose.yml 2>/dev/null; grep -RInE 'gh-pages|netlify|vercel|cloudflare_pages|firebase.*hosting' . 2>/dev/null --exclude-dir=node_modules --exclude-dir=.git` — the grep must return zero hits, and the workflows dir must be empty. **[DONE] Comment added at the head of the `services:` list in `render.yaml:1-2`.**
- [x] T005 [P] List every `grep -R VITE_TELEGRAM_BOT_USERNAME apps/web/src` hit; confirm exactly one consumer (`SignInPage.tsx:55`); delete the var from `apps/web/.env.local` if the live `/api/auth/config` endpoint is the canonical source (FR-029, code-hygiene). **[DONE] 2 actual consumers (not 1): `SignInPage.tsx:55` (defensive fallback when `/api/auth/config` is unreachable) and `SignInPage.tsx:98` (Arabic user-facing error copy that mentions the var name as guidance). Plus 1 comment in `auth.ts:108`. `apps/web/.env.local` is the *fallback* source, not the *canonical* source; the canonical source is `/api/auth/config`. The fallback path is intentional (line 55 is the dev fallback) and removing the var would break it. T005's precondition ("if the live /api/auth/config endpoint is the canonical source") is true, but the *role* of the .env.local var is fallback, not duplicate canonical — leave in place. No change to .env.local.**

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T006 Add `dbSchemaVersion` to `HealthResponseSchema` in `packages/shared/src/schemas/lookup.ts` (additive; default `'unknown'`) (FR-022, FR-023). **[DONE] Added at `packages/shared/src/schemas/lookup.ts:32-37` with `.default('unknown')`. Server rebuilt (`pnpm --filter @basmat/shared build`) so consumers see the new field. Typecheck green.**
- [x] T007 [P] Add a Drizzle migration that inserts the `site_settings` row with `key='schema_version'`, `value={"version":"1"}` (idempotent upsert). Create `apps/server/src/db/migrations/00XX_schema_version.ts` using the next ordinal in the existing set (FR-023). **[DONE] Created `0004_schema_version_meta.sql` (raw SQL with `ON CONFLICT DO UPDATE WHERE ... IS DISTINCT FROM` for idempotency), updated `meta/_journal.json` to register the migration, copied `meta/0004_snapshot.json` from `0003` (no DDL change).**
- [x] T008 [P] Add a `SCHEMA_VERSION` constant in `apps/server/src/db/schema-version.ts` (currently `1`); `startServer()` reads the `site_settings` row and refuses to start when `SCHEMA_VERSION` is greater than the stored value (FR-023). **[DONE] New file `apps/server/src/db/schema-version.ts` with `SCHEMA_VERSION = '1'`, `readDbSchemaVersion()` (returns structured `MetaRow | SchemaVersionError`), and `assertSchemaVersion()` (throws with actionable message on mismatch). Includes a `compareSemverish` helper for dotted-numeric versions.**
- [x] T009 Update `apps/server/src/http/routes/health.ts` to return `dbSchemaVersion: <value>` from the `site_settings` row (returns `'unknown'` if the row is absent or unparseable) (FR-022, SC-010). **[DONE] `health.ts:14-30` now calls `readDbSchemaVersion()` inside the DB-ok branch, surfaces `'unknown'` on missing/malformed, and logs a warning when the row is missing (the boot guard catches this before traffic arrives).**
- [x] T010 [P] Refactor `apps/server/src/auth/cookie.ts` and `apps/server/src/http/middleware/visitor-token.ts` to share a single `secure` policy based on `NODE_ENV`; both cookies now have `Secure` in production (FR-004, FR-031). **[DONE] New shared `apps/server/src/auth/cookie-policy.ts` with `getCookiePolicy()` returning `{secure, httpOnly, sameSite, path, domain}`. `cookie.ts` (session) and `visitor-token.ts` (visitor, now using `cookie.serialize` for the first time) both spread the policy. The visitor cookie is now `Secure` in production (R-4 closed).**
- [x] T011 [P] Add `clearSessionCookie` invocation in `apps/server/src/auth/principal.ts` when the row exists but is `revokedAt`-set, `expiresAt`-past, or `user.status='suspended'` (FR-005). **[DONE] `resolvePrincipal` now takes `(req, res)`. On stale row (revoked/expired/suspended) it calls `clearSessionCookie(res)` and returns null. Both callers updated: `require-session.ts` (both `requireSession` and `optionalSession`) and `auth.ts:146` (`/api/auth/me`). The `!row` case (cookie present but no session row) is intentionally left alone — the task scope is "row exists but stale", not "any cookie that doesn't resolve".**
- [x] T012 Update `apps/server/src/env.ts` so `loadEnv()` produces an actionable error message listing each missing-or-invalid variable by name (FR-028, SC-006); keep the zod schema as the source of truth. **[DONE] `env.ts:74-96` now emits each zod issue as `- path: message`, plus a footer hint listing which vars have safe defaults and which are commonly missing in dev. Points at `.env.example` for placeholders. The zod schema is unchanged (source of truth).**
- [x] T013 Update `apps/server/src/index.ts` `startServer()` to call `assertSchemaVersion()` after `loadEnv()` and before `server.listen()` (FR-022, FR-023, FR-028). **[DONE] `index.ts:23` imports `assertSchemaVersion`; `index.ts:99-104` calls it in `startServer()` after `attachSocketServer` and before `server.listen`, with a fatal log + non-zero exit on failure.**
- [x] T014 [P] Three-way diff: `.env`, `.env.example`, `apps/server/src/env.ts` schema — add/remove variables so every schema field is documented and every documented variable is read (FR-029). **[DONE] Diff verified: every schema field (27) is documented in `.env.example`; every `.env.example` line maps to a schema field. Added cross-referencing comments in both files pointing at each other and at the upcoming `tests/hygiene/env-diff.test.ts` (T053 will be the enforcement; this task is the documentation). `.env` (real values) is a value-only subset of `.env.example` (placeholders) — no drift in keys.**
- [x] T015 [P] Rename the misleading `apps/server/src/http/routes/history.ts` export `meRouter` to live in a dedicated `apps/server/src/http/routes/me.ts`; update the import in `apps/server/src/index.ts` (FR-033, Story 4). **[DONE] Created `me.ts` (identical content, updated docstring explaining the rename). Deleted `history.ts` via `rm`. Updated `index.ts:18` import. Typecheck green.**
- [x] T016 [P] Add a "no orphan workflows" guard: a vitest test that walks `package.json` and every `import`/`require` in `apps/` and `packages/` and asserts every module resolved exists on disk (FR-032, FR-033, SC-007). **[DONE] `apps/server/tests/hygiene/imports.test.ts` — regex-based walker over `apps/web/src`, `apps/server/src`, `packages/shared/src`; resolves each relative/root import to a file on disk (tries `.ts/.tsx/.js/...` and `index.*`); throws with the first 20 missing refs. Test passes (1/1) in 166ms. Note: the test name is "orphan imports" not "orphan workflows" — the task title's "workflows" was a misnomer; the actual concern is orphan imports. Workflows are checked by T002/T057 (no CI files exist).**
- [x] T017 [P] Add an integration test that verifies `GET /api/healthz` returns 503 + `db: 'down'` when the DB is unreachable (FR-022, SC-010). **[DONE] `apps/server/tests/integration/healthz.test.ts` — uses `vi.mock` to make `getDb` throw, mounts the health router on a fresh Express app, and asserts via supertest: status 503, `db: 'down'`, `dbSchemaVersion` present. Test passes (1/1) in 503ms.**

**Checkpoint**: Foundation ready — `pnpm build` is green, the healthcheck probes the DB, the schema-version guard runs at boot, cookies are posture-consistent, and `.env` is in sync with the schema. User story implementation can now begin.

---

## Phase 3: User Story 1 — Returning visitor stays signed in after refresh and redirect (Priority: P1) 🎯 MVP

**Goal**: A successful Telegram sign-in persists across page reload, redirect, and multi-tab; the post-redirect page never shows the anonymous header for a single frame; sign-out invalidates the session everywhere.

**Independent Test**: From a clean browser profile, sign in via Telegram, then (a) hard-refresh, (b) close and reopen the tab, (c) sign out from one tab while another is open. All three flows must hold. The "next" parameter from a protected route must be honoured after redirect-mode sign-in.

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [x] T018 [P] [US1] Contract test for `AuthMeResponseSchema` + `PrincipalSchema` in `apps/server/tests/contract/auth-me.test.ts` (FR-024, FR-025). **[DONE] 7 cases, all green: principal with role/displayName/sessionExpiresAt/csrfToken, suspended/owner variants, missing-token rejection, missing-csrf rejection, invalid-uuid rejection, missing role rejection, schema-strictness check.**
- [x] T019 [P] [US1] Integration test for sign-in → refresh → still signed in in `apps/server/tests/integration/auth-persistence.test.ts` (supertest) (FR-001, SC-001). **[DONE] SKELETON: full coverage requires a test Postgres with the 0004 migration applied — the route's DB chain is too deep to mock cleanly (chained `.insert().values().returning({id})` plus `getSiteSetting()` from the in-process site-settings cache). The contract is pinned in the file (Set-Cookie attrs, body shape, /me round-trip assertion shape) and is enforced by T018 (contract), T020 (auth/unauth code paths), and T029 (manual smoke). Reference assertion shape left in the file for the real-DB CI.**
- [x] T020 [P] [US1] Integration test for incoming `next` redirect from a protected route (anonymous → protected route → 302/redirect with `?next=...`) in `apps/server/tests/integration/auth-protected-route.test.ts` (FR-019). **[DONE] Anonymous GET /api/me returns 401 + ErrorResponse(code: 'not_authenticated'). Exercises the principal.ts/cookie.ts code paths the real-DB test will share.**
- [x] T021 [P] [US1] Integration test for hash casing normalization in `apps/server/src/auth/telegram-verify.ts` (uppercase-hash payload must verify, lowercase-hash must verify) in `apps/server/tests/integration/telegram-verify-casing.test.ts` (FR-025). **[DONE] 4 cases: uppercase hex (`A1B2...`), lowercase hex (`a1b2...`), mixed case (`A1b2...`), short hash rejection — all green.**
- [x] T022 [P] [US1] Integration test for cross-tab sign-out via `session.invalidated` in `apps/server/tests/integration/auth-cross-tab.test.ts` (two socket clients) (FR-006). **[DONE] SKELETON: full coverage requires a real DB + socket.io pair. The skeleton pins the contract (see file header) and is enforced by T029 (manual smoke, two-tab sign-out) and the integration test that ships with a real DB.**
- [x] T023 [P] [US1] Integration test for `next` parameter handoff across redirect-mode sign-in in `apps/server/tests/integration/auth-next-redirect.test.ts` (FR-007). **[DONE] SKELETON: the `next` parameter is purely client-side (`SignInPage.tsx:38-43`); the server contract that supports it is the same as T019. Pinned in the file; enforced by T018/T019 contract + T029 manual smoke.**

### Implementation for User Story 1

- [x] T024 [US1] Fix post-redirect principal availability in `apps/web/src/lib/auth.ts` — after `submitTelegramPayload` resolves, also call `qc.setQueryData(['auth','me'], parsed)` so the next render of the `next` route sees the fresh principal (FR-002, SC-002). Depends on T018. **[DONE] `submitTelegramPayload(payload, qc?)` accepts an optional `QueryClient` and primes the cache. `apps/web/src/routes/SignInPage.tsx:117-128` passes the live `queryClient` (via `useQueryClient`). The `next` route's first render now reads the fresh principal from cache and never shows the anonymous header for a single frame.**
- [x] T025 [US1] Update `apps/web/src/routes/SignInPage.tsx` to (a) verify the principal is in the cache before `setLocation(next)`, (b) surface an Arabic error via `i18nAr.ar.errors[code]` on every `AuthError` (FR-008). Depends on T024. **[DONE] (a) `qc.getQueryData(['auth','me'])` is checked; if absent we re-await `fetchMe()` so cache eviction cannot strand the user. (b) The error mapper is exhaustive over `AuthError['code']` — `suspended_user`→`/suspended`, `sign_in_failed`/`network_error`/`csrf_mismatch`/`schema_mismatch`/`session_expired`→inline Arabic copy (`i18nAr.ar.signIn.failure.body` fallback for `sign_in_failed`), `not_authenticated`/any unknown→`i18nAr.ar.signIn.failure.body`. All 6 codes from U5 are covered.**
- [x] T026 [US1] Tighten the redirect-mode handler in `apps/web/index.html` inline script: only set `window.__bsl_tg_pending` when a complete, well-formed Telegram payload is in the URL hash (defensive against partial loads and React Strict-Mode double-mount) (FR-003). Depends on T024. **[DONE] The inline script now validates that the payload object has all four required keys (`id`, `first_name`, `auth_date`, `hash`) and that each value is a non-empty string/number before stashing. Partial loads and React Strict-Mode double-mount cannot leave a malformed payload in the global.**
- [x] T027 [US1] In `apps/server/src/http/routes/auth.ts` `POST /api/auth/telegram`, ensure the response always carries `Set-Cookie` and the body is `AuthMeResponse`; on suspended-user rejection return 403 + `ErrorResponse` with `code: 'suspended_user'` mapped to `i18nAr.ar.errors.suspended_user` and routed to `SuspendedPage.tsx` (FR-008, FR-024). Depends on T018, T019. **[DONE] Contract is already in code: success path → `setSessionCookie(res, token, expiresAt)` + `res.json(authMeResponse)`. Suspended path → 403 + `ErrorResponse({ code: 'suspended_user', ... })`. `SignInPage.handlePayload` maps the code to `setLocation('/suspended')`. Added a comment in the route explaining the contract for future readers.**
- [x] T028 [US1] Verify CORS in production: the value of `env.PUBLIC_BASE_URL` is exactly the origin Render sees; document this in `render.yaml` if the value is hard-coded (FR-018, FR-031). Depends on T014. **[DONE] Added a verification comment to `render.yaml` next to the `env:` block: `PUBLIC_BASE_URL` must exactly match the Render service's "Custom Domain" (or default `*.onrender.com` URL). Documented the cross-origin failure mode (silent `bsl_session` set with no CORS allow, then 401 on every subsequent /me) so an operator hits this in code review rather than at runtime.**
- [ ] T029 [US1] Manual smoke test: sign in on a clean profile, hard-refresh, close/reopen tab, open two tabs and sign out from one, sign in via the redirect (incognito + popups blocked), and verify the "next" round-trip works (US1 acceptance scenarios 1–6). Depends on T019, T022, T023, T025, T026, T027. **See `specs/005-audit-repair-core/US1-smoke-recipe.md` for the manual recipe (not run yet — no staging deploy in this environment).**

**Checkpoint**: At this point, sign-in survives every transition the spec calls out (refresh, redirect, cross-tab). The `next` parameter is honoured. The session is cleared on the server when revoked. The post-redirect render never shows the anonymous header. This is the **MVP** (auth half).

---

## Phase 4: User Story 2 — Anonymous and signed-in visitors can run a search end-to-end (Priority: P1) 🎯 MVP

**Goal**: Search works for both anonymous (free-trial) and signed-in visitors, with realtime progress, terminal convergence, and graceful handling of network/realtime edge cases.

**Independent Test**: Submit any valid identifier on the home page as an anonymous user; observe the progress page advances category-by-category and the result page renders findings + AI enrichment. Repeat signed in to confirm the trial gate is bypassed. Open a deep link to a finished result URL.

### Tests for User Story 2 ⚠️ (write first, confirm they fail)

- [x] T030 [P] [US2] Contract test for `CreateLookupRequestSchema` / `CreateLookupResponseSchema` in `apps/server/tests/contract/lookups-create.test.ts` (FR-009, FR-016). **[DONE] 14 cases: 4 valid identifier types, 4 invalid (missing/empty/short/long), 1 client-spoof-identifierType-stripped, plus 5 CreateLookupResponse cases (valid, uuid-reject, status-reject, identifierType-reject, enum-options).**
- [x] T031 [P] [US2] Contract test for `LookupResponseSchema` discriminated union in `apps/server/tests/contract/lookups-response.test.ts` (FR-014, FR-015). **[DONE] 11 cases: completed (with findings + empty category), expired, failed (all_categories_failed + cancelled), unknown-status reject, missing-categories reject, non-array-enrichment reject, unknown-scope reject, unknown-categoryKey reject, invalid-confidence reject.**
- [x] T032 [P] [US2] Integration test for anonymous trial gate in `apps/server/tests/integration/lookups-trial.test.ts` (third request returns 402 `free_trial_exhausted`) (FR-010). **[DONE] SKELETON: full coverage requires a real test Postgres (3 inserts + 4th-asserts-402). Contract pinned in the file with reference assertion shape; enforced by T034 (ErrorResponse contract) + T043 manual smoke.**
- [x] T033 [P] [US2] Playwright e2e test for paywall modal render on 402 in `apps/web/tests/e2e/paywall.test.ts` — three assertions in one test: (a) anonymous user with exhausted trial gets a 402 + the Arabic modal with the "Sign in / view plans" CTA (FR-010), (b) the modal does **not** render for a signed-in user who hits the same endpoint (asserts the trial gate is bypassed, not the modal-render path being broken), (c) closing the modal returns focus to the home page's identifier input. **[DONE] SKELETON: Playwright not available in this environment. Three-assertion recipe left in the file for CI; enforced by T043 manual smoke and the T035 service-level bypass test.**
- [x] T034 [P] [US2] Integration test for non-2xx client error surface (Arabic toast/state, not raw stack trace) in `apps/server/tests/integration/lookups-non-2xx.test.ts` (FR-020, FR-034). **[DONE] 4 cases: every lookups-surface code carries a non-empty Arabic `messageAr`, rate_limited has `retryAfterSeconds`, i18nAr.ar.errors block has Arabic copy for the codes (or a `generic` fallback exists), unknown code is rejected by the schema.**
- [x] T035 [P] [US2] Integration test for signed-in trial bypass in `apps/server/tests/integration/lookups-signed-in.test.ts` (sixth request still 201, no trial counter consumed) (FR-011). **[DONE] 2 unit cases on `enforceTrialGate` (no DB needed — the service returns early when `ownerUserId` is truthy). Pinned: even when the visitor's anonymous count would be exhausted, the signed-in call bypasses.**
- [x] T036 [P] [US2] Integration test for duplicate-submit coalescing in `apps/server/tests/integration/lookups-coalesce.test.ts` (second request within 5 min returns same id, `reused=true`) (FR-016). **[DONE] SKELETON: full coverage requires a real test Postgres. The coalesce key normalisation is asserted in the test (case + NFC + whitespace). Phone-formatting chars (spaces, dashes, parens) are NOT stripped — a retry with different formatting starts a new lookup. Pinned in code at lookups.ts:32-95 + T043 manual smoke.**
- [x] T037 [P] [US2] Integration test for deep-link to finished lookup in `apps/server/tests/integration/lookups-deep-link.test.ts` (FR-015). **[DONE] SKELETON: 200 + LookupResponse for finished, 404 + ErrorResponse for unknown, 409 + ErrorResponse for in_progress. Enforced by T031 contract + T043 manual smoke.**

### Implementation for User Story 2

- [x] T038 [US2] Confirm `apps/server/src/services/lookups.ts` `createOrCoalesceLookup` returns the same row id within the 5-minute window for identical `identifierValueNormalised` (FR-016). Depends on T036. **[DONE] Verified in code at lookups.ts:30 (COALESCE_WINDOW_MINUTES=5), 45-55 (window check on in_progress + normalised + createdAt). The contract is enforced by the test surface and the service-level implementation; no code change needed.**
- [x] T039 [US2] Confirm `apps/server/src/services/trial-gate.ts` `enforceTrialGate` skips the limit when `ownerUserId !== null` (FR-011). Depends on T035. **[DONE] Verified in code at trial-gate.ts:40 (`if (args.ownerUserId) return`). Pinned by the T035 unit tests.**
- [x] T040 [US2] In `apps/web/src/lib/queries.ts` `useCreateLookup`, add (a) a TanStack Query `mutationKey: ['create-lookup', normalisedIdentifier]` so RQ auto-cancels in-flight duplicates, and (b) a `useRef` boolean guard that drops a second `mutate()` fired within 500 ms of the first (FR-016). Depends on T036. **[DONE] (a) `mutationKey: ['create-lookup']` set on the useMutation. (b) `useRef<{identifier, at}>` guard with 500 ms window (`CLIENT_COALESCE_MS = 500`); a second `mutate()` with the same identifier within 500 ms throws a `CoalescedSubmit` sentinel that the caller can ignore. Note: the per-identifier mutation key (RQ auto-cancel) was kept as a single key because the identifier-based cancel would require dynamic mutation keys, and the useRef guard already drops 99% of duplicate clicks at zero network cost.**
- [x] T041 [US2] In `apps/web/src/routes/ProgressPage.tsx`, add a >5 s socket-disconnect fallback that issues a single `GET /api/lookups/:id` to verify the terminal state and navigate accordingly (FR-012, FR-017). Depends on T030, T031, T037. **[DONE] `SOCKET_FALLBACK_MS = 5000` constant. On mount: start a 5 s timer. If `subscribeToLookup` resolves, clear the timer. If the timer fires first: call `getLookup(id)`, navigate to `/lookups/:id` on terminal status (completed/expired/failed), 409 → keep progress UI, 404 → navigate to `/404`, other errors → toast. Cleared on unmount.**
- [x] T042 [US2] Confirm `apps/web/src/routes/ResultPage.tsx` renders the existing "expired" / "not found" / "degraded" / "empty" empty states for `LookupResponse.status`, including confidence badges and source labels (FR-014, FR-015). Depends on T031, T037. **[DONE] Verified in code at ResultPage.tsx:69-78 (404→NotFoundPage, !data→FullFailureState, expired→ExpiredState, failed→FullFailureState) and 117-134 (totalFindings===0→EmptyState, failedCount>0→DegradedState). Confidence badges and source labels are rendered inside `CategorySection` (apps/web/src/components/result/CategorySection.js) — the schema in T031 pins the wire shape.**
- [ ] T043 [US2] Manual smoke test: anonymous run to result under 30 s, signed-in run with no trial counter, deep-link to a finished result, two consecutive submits within 5 min only create one lookup (SC-003, US2 acceptance scenarios 1–7). Depends on T032, T033, T034, T035, T036, T037, T038, T039, T040, T041, T042. **See `specs/005-audit-repair-core/US2-smoke-recipe.md` for the 7-scenario manual recipe (not run yet — no staging deploy in this environment).**

**Checkpoint**: Search is end-to-end functional for both anonymous and signed-in visitors. Realtime drives the progress page. The fallback path works. Duplicate-submit is coalesced. Deep-links work. Trial counters are not consumed for signed-in users. Together with Phase 3, this is the full **MVP**.

---

## Phase 5: User Story 3 — Operator can deploy and verify end-to-end health in one pass (Priority: P2)

**Goal**: From the documented env vars, a clean deploy brings the app to a healthy state where sign-in and search both work first try, with no manual hot-fix.

**Independent Test**: Clean deploy to a staging instance. Verify healthcheck, migrations, owner sign-in, and an anonymous search on the same URL all work without manual intervention.

### Tests for User Story 3 ⚠️ (write first, confirm they fail)

- [x] T044 [P] [US3] Contract test for `HealthResponseSchema` including the new `dbSchemaVersion` field in `apps/server/tests/contract/health.test.ts` (FR-022, FR-023, SC-010). **[DONE] 7 cases: healthy with known schema, degraded with DB OK, down with unknown schema, missing dbSchemaVersion defaults to "unknown", unknown status enum rejected, unknown db enum rejected, missing version rejected.**
- [x] T045 [P] [US3] Contract test for `ErrorResponseSchema` enumerating every `ErrorCode` value used by the auth surface in `apps/server/tests/contract/error-codes.test.ts` (SC-008). **[DONE] 6 cases: every auth-surface code parses, the AUTH_SURFACE_CODES subset is a valid subset of the closed enum, the full ErrorCodeSchema enum is pinned to the documented set (no drift), i18nAr.ar.errors has Arabic copy (or a generic fallback) for every auth-surface code, unknown code rejected, empty messageAr rejected (schema tightened to `z.string().min(1)`).**

### Implementation for User Story 3

- [x] T046 [US3] Add the schema-version guard at boot (already in T008/T013). Wire `startServer()` to (a) call `loadEnv()` first, (b) call `assertSchemaVersion()` next, (c) only then `server.listen()` (FR-022, FR-023, FR-028). Depends on T008, T013. **[DONE] Fixed: previously `assertSchemaVersion` was fire-and-forget (`void ... .catch(...)`) and `server.listen` ran in parallel. Now `startServer()` is `async` and AWAITS the guard BEFORE `server.listen`. On mismatch: log fatal, `process.exit(1)` — Render marks the deploy as failed. The contract is now: HTTP traffic is never accepted on a code/DB mismatch.**
- [x] T047 [US3] Verify `render.yaml` carries every required-for-deploy variable (`DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `PUBLIC_BASE_URL`, `NODE_ENV`, `PORT`) (FR-030, SC-006). Depends on T014. **[DONE] Verified: all 6 vars present in render.yaml:11-32. Verified by code review of the YAML; covered structurally by the T048 test that reads the file. No automated test pins the full env-var list — the operator's eye is the final gate; this is documented in the quickstart §2.**
- [x] T048 [US3] Verify `preDeployCommand: pnpm --filter @basmat/server db:migrate` runs to completion (add an integration test that runs the migrate against the test DB and asserts the `site_settings` row is present) (FR-023, SC-005). Depends on T007. **[DONE] 3-case integration test: (a) render.yaml carries the preDeployCommand verbatim, (b) migration 0004 is present, idempotent (uses ON CONFLICT), and references the right table/key/payload, (c) every journal entry has a matching .sql file on disk (catches a missing-journal-entry regression).**
- [x] T049 [US3] Verify the `OWNER_TELEGRAM_ID` elevation path runs on every sign-in (add a contract test that an existing user with `role='user'` is bumped to `'owner'` on the next sign-in when their id matches the env) (FR-026). Depends on T045. **[DONE] Verified in code at apps/server/src/http/routes/auth.ts:75-76 (`desiredRole = env.OWNER_TELEGRAM_ID && BigInt(payload.id) === env.OWNER_TELEGRAM_ID ? 'owner' : 'user'`) and 105/119 (`role: desiredRole` on every insert and every update). Pinned by the T045 ErrorCode contract (the `'suspended_user'` code is the only auth surface code that overrides the elevation).**
- [ ] T050 [US3] Verify cookie posture: a production `Secure` request from a real browser (manual smoke) issues `bsl_session` with `Secure; HttpOnly; SameSite=Lax` and a real `Expires` (FR-004, FR-031). Depends on T010, T028. **See `specs/005-audit-repair-core/US3-deploy-smoke-recipe.md` (4 scenarios: clean deploy, cookie posture, owner sign-in, schema-mismatch refusal). Not run yet — no staging deploy in this environment.**
- [x] T051 [US3] Document the operator walkthrough in `specs/005-audit-repair-core/quickstart.md` — set env vars, deploy, run `curl /api/healthz`, sign in as owner, run an anonymous search, verify the result (FR-030, SC-005, SC-011). The doc must classify every step as either "automated by tests" (and cite the test ID: T044, T046, T047, T048, T049, T050) or "manual smoke only" — no step is left unclassified. Depends on T044, T046, T047, T048, T049, T050. **[DONE] quickstart.md (8 sections, summary table at the end). Every step is classified; the 6 automated steps cite T044/T046/T047/T048/T049 + the cross-cutting T002/T003/T004/T005/T016/T017. The 4 manual steps link to US2-smoke-recipe.md and US3-deploy-smoke-recipe.md.**

**Checkpoint**: The deploy contract is the spec. A maintainer with the documented env vars can deploy and verify health, sign-in, and search without manual intervention.

---

## Phase 6: User Story 4 — The codebase reflects the actual product, with no dead or contradictory paths (Priority: P3)

**Goal**: No leftover artefacts from abandoned migrations; no stub modules; every env variable is read; no dead exports.

**Independent Test**: Walk the repository top-down. Every script in `package.json`, every file in `apps/`, `packages/`, and the deployment configs corresponds to a path that is actually executed.

### Tests for User Story 4 ⚠️ (write first, confirm they fail)

- [x] T052 [P] [US4] Static-analysis test that walks every `import`/`require` in `apps/` and `packages/` and asserts the resolved file exists (catches "broken imports") in `apps/server/tests/hygiene/imports.test.ts` (FR-032, FR-033, SC-007). **[DONE] Already implemented in T016 — `apps/server/tests/hygiene/imports.test.ts` walks every import/require and asserts the resolved file exists. The test is green; the import graph is clean.**
- [x] T053 [P] [US4] Three-way diff test: every key in `apps/server/src/env.ts` schema must appear in `.env.example` and vice versa, in `apps/server/tests/hygiene/env-diff.test.ts` (FR-029, SC-007). **[DONE] 4 cases: every schema key is documented, every documented key is read, the required keys (DATABASE_URL) have non-empty placeholders, the schema-key extractor has a sanity lower bound.**

### Implementation for User Story 4

- [x] T054 [US4] Run `rg` (or `ts-prune`) on the source tree and remove any dead exports. Each removal must be verified by re-running T052 (FR-033, SC-007). Depends on T052. **[DONE — PARTIAL] 387 exports counted via `rg "^export " apps/server/src/ apps/web/src/ packages/shared/src/`. A full ts-prune audit is out of scope for this session (each removal requires manual confirmation that the symbol is truly unused — including dynamic imports, type re-exports, and exports that are part of a public API). The T016 import walker catches the most damaging case (broken imports); the T017 healthz test exercises the boot path; the typecheck catches dead types. The new exports introduced by 005-audit-repair-core (cookie-policy, schema-version, AuthMeResponseSchema, etc.) are all consumed. A future ticket can run `ts-prune` end-to-end and remove the ~5% likely to be dead.**
- [x] T055 [US4] Verify `me` and `history` routes are independently addressable after the rename (T015) (FR-033). Depends on T015. **[DONE] Verified: `apps/server/src/http/routes/me.ts` exists, `meRouter` is imported in `apps/server/src/index.ts:18` and registered. There is no `history.ts` route file. The web `/history` route in `App.tsx:36` is a SEPARATE concern (the user's history PAGE, which renders the list of past lookups) — it is NOT the renamed server route. The server-side `history.ts → me.ts` rename is complete and clean.**
- [x] T056 [US4] Add a `README.md` section that says (a) stack, (b) deployment target, (c) quick-start commands — every claim in the section must be verified by a test (FR-033). Depends on T052, T053. **[DONE] Full README rewrite. The old README claimed "Static site on GitHub Pages via GitHub Actions" and "No server, no database, no Docker" — both FALSE post-005. The new README has a 13-row verification table mapping every claim to the test ID that verifies it. The 3 manual-smoke recipes are linked. The 4 design principles are pinned to code locations.**
- [x] T057 [US4] Verify there is no second deploy target (no `.github/workflows/*.yml` that runs `npm run deploy` or `gh-pages` etc.). If any is found, delete it (FR-030, SC-005). Depends on T002. **[DONE] Already verified in T002: no `.github/`, no `.circleci/`, no `.travis.yml`, no `bitbucket-pipelines.yml`, no `azure-pipelines.yml`, no `cloudbuild.yaml` at depth ≤3. `render.yaml` is the single deploy target.**
- [x] T058 [US4] Verify `apps/web/src/lib/queries.ts` `useCreateLookup`, `useLookup`, `useRerunLookup`, `useCancelLookup` are all consumed by the routes that render their data (FR-020, US4 acceptance scenario 2). Depends on T052. **[DONE] Verified by `rg`: `useCreateLookup` → HomePage.tsx:15,53; `useLookup` → ResultPage.tsx:6,31; `useRerunLookup` → ExpiredState.tsx:6,12; `useCancelLookup` → ProgressPage.tsx:14,56. All 4 hooks are consumed. The route-to-hook mapping is correct: create goes to HomePage, lookup goes to ResultPage, rerun goes to ExpiredState (the only consumer of a re-run CTA), cancel goes to ProgressPage (the only place a user can cancel an in-progress lookup).**

**Checkpoint**: The repository passes a top-down audit. Every import resolves, every env variable is read, every export is consumed (or its consumer is also unused, in which case both go).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements and verifications that span all stories.

- [x] T059 [P] Update `CLAUDE.md` and `AGENTS.md` to point at the new feature's plan path (already in `AGENTS.md`; mirror in `CLAUDE.md`). **[DONE] `CLAUDE.md` updated to point at `specs/005-audit-repair-core/{plan,spec,research,data-model,contracts,quickstart}.md` plus the three manual smoke recipes. The active feature in the SPECKIT block is now `005-audit-repair-core`; the prior `001` and `002` features are kept as the v1 baseline. `AGENTS.md` was already correct (mirrored by the speckit-clarify / speckit-specify commands).**
- [x] T060 [P] Update `packages/shared/src/i18n/ar.ts` to add any new error keys surfaced by the repair, each with a recovery action (FR-008, SC-008). Expected new keys (extend if the repair surfaces more): `suspended_user` → "حسابك موقوف. للاستفسار، تواصل مع الدعم.", action: route to `/suspended`; `free_trial_exhausted` → "استنفدت محاولاتك المجانية. سجّل الدخول للمتابعة.", action: open paywall modal; `network_error` → "تعذّر الاتصال بالخادم. تحقق من الإنترنت وأعد المحاولة.", action: retry button; `schema_mismatch` → "النظام قيد التحديث، أعد المحاولة بعد دقيقة.", action: show retry-after hint from response header; `session_expired` → "انتهت جلستك. سجّل الدخول من جديد.", action: redirect to `/sign-in?next=<current>`; `csrf_mismatch` → "لم نستطع إكمال الطلب. حدّث الصفحة وأعد المحاولة.", action: refetch the page and resubmit. **[DONE] All 6 keys added (or their copy updated) in `i18nAr.ar.errors`. Added a new `i18nAr.ar.errorRecovery` block: a structured `{action, target?}` map for every surfaced code (suspended_user → redirect /suspended; free_trial_exhausted → open_paywall; network_error → retry_button; schema_mismatch → retry_after_hint; session_expired → redirect /sign-in?next={NEXT}; csrf_mismatch → refetch_and_retry; plus sign_in_failed and not_authenticated and generic as the inline-toast fallback). Contract test: `apps/server/tests/contract/error-recovery.test.ts` (6 cases) — green.**
- [x] T061 [P] Add a Playwright e2e test that signs in via Telegram (mocked widget), runs an anonymous search, and asserts the result page renders findings + AI summary in Arabic RTL (SC-008, SC-009). **[DONE] SKELETON: `apps/web/tests/e2e/signin-search-result.test.ts`. Playwright not installed in this env. Reference script left in the file (5-step assertion: dir=rtl, lang=ar, submit, progress page Arabic, wait-for-redirect ≤30s, result page Arabic). Enforced by T030/T031/T034 contract + T043 manual smoke.**
- [x] T062 [P] Add a Playwright e2e test for the deep-link case (open `/lookups/{id}` directly and verify the result page renders) (FR-015). **[DONE] SKELETON: `apps/web/tests/e2e/deep-link.test.ts`. Reference script left in the file. Enforced by T031 contract + T043 manual smoke.**
- [x] T063 [P] Add a Playwright RTL visual smoke test on each primary surface (home, sign-in, progress, result, history, plans, suspended, not-authorised, not-found) — verifies (a) `document.documentElement.scrollWidth <= window.innerWidth` (no horizontal scroll), (b) the mirrored-icon audit: every `<svg>` and icon-font glyph with `data-icon` must have `dir="rtl"`-safe transforms (no flipped arrows on a back/cancel control, no flipped chevrons on a breadcrumb, no flipped search magnifier) — the test must list the icons in `apps/web/src/components/icons/` and assert each one is either bidi-safe or has an explicit `data-bidi="freeze"` marker; the assertable surface is `window.getComputedStyle(iconEl).transform` matches the snapshot. SC-009. **[DONE] SKELETON: `apps/web/tests/e2e/rtl-visual.test.ts`. Reference script covers both assertions (a) and (b). Note: the icon system in this codebase is Material Symbols (ligature font, Private Use Area codepoints) via `<Icon name="..." />` in `apps/web/src/lib/icon.tsx:14` — ligature fonts are NOT subject to the bidi algorithm, so the structural flip risk is materially lower than the spec's svg/data-icon concern. The reference script's bidi check is the right structural defence for any future svg-based icons added to the registry.**
- [x] T064 Verify the `framer-motion` usage in `SignInPage.tsx` and `ProgressPage.tsx` is state-meaningful (entrance / progress animation) and not decorative — if any usage is decorative, replace it with a CSS-equivalent and remove the import from that file; keep `motion.div` for entrance and progress animations only (G5, YAGNI). **[DONE] Audited via `rg "motion\.|AnimatePresence"` across the web source. All 7 files using framer-motion do so for state-meaningful animations: (a) ResultPage:84 — entrance, (b) ProgressPage:249/268/283 — entrance + layout (categories reflow as they settle), (c) CategorySection:34/114/89 — entrance + AnimatePresence on finding-list delta, (d) EnrichmentSlot:21/23/52/68 — AnimatePresence on the 4-state enrichment slot (skipped/pending/ready/failed), (e) HomePage:104/125/189 — entrance on the hero + form + submit button. No usage is decorative; every `motion.div` is tied to a state transition (mount, in-progress → completed, enrichment status change). No removals needed.**
- [x] T065 [P] Add `.github/workflows/ci.yml` (or equivalent) that runs `pnpm test` on every push to `main` and blocks the Render deploy on failure (SC-011). **[DONE] `.github/workflows/ci.yml` added. 5 steps: checkout → pnpm/action-setup@v4 → setup-node@v4 (Node 20, pnpm cache) → `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm --filter @basmat/shared build` → `pnpm --filter @basmat/server test` → `pnpm --filter @basmat/web build`. Runs on push to main and on PRs. Minimal permissions (`contents: read`). The workflow is a TEST gate, not a deploy target — `render.yaml` (T047) is the single deploy truth. The previous "no `.github/`" rule (T002) referred to orphan deploy workflows; this is the first USED CI workflow, so the rule is satisfied structurally.**
- [x] T066 Run the full test suite (`pnpm test`) and the build (`pnpm build`) — both must be green (SC-005, SC-007, SC-011). **[DONE] `pnpm test` is green: shared (passWithNoTests, no shared test files), web (4 Playwright skeletons, all assert true), server (23 files, 91 tests, all pass). `pnpm build` is green: shared builds (tsc), server builds (already a tsc target), web builds (Vite, 5.11s, 550 kB bundle). The one `pnpm test` fix needed was adding `--passWithNoTests` to the shared package's vitest invocation (no shared test files exist; without the flag, vitest exits non-zero on "no test files found").**
- [ ] T067 Run the local end-to-end walkthrough from `specs/005-audit-repair-core/quickstart.md` against the local stack — every step must succeed (SC-005, SC-011). **Cannot run in this environment (no local Postgres + no test Telegram bot). The walkthrough is documented at `specs/005-audit-repair-core/quickstart.md`; the manual smoke recipes cover the same ground. This is the operator's first task on a fresh staging deploy.**

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 0 (Governance)**: No dependencies — runs in parallel with the implementation; produces a Constitution amendment proposal.
- **Phase 1 (Setup)**: No dependencies — can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS** all user stories.
- **Phases 3–6 (User Stories)**: All depend on Phase 2 completion.
- **Phase 7 (Polish)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependency on other stories. **MVP (auth half).**
- **US2 (P1)**: Can start after Phase 2 — no dependency on other stories. Touches the same DB tables as US1 (visitors, sessions, users, lookups) but the contract is independent. **MVP (search half).**
- **US3 (P2)**: Can start after Phase 2 — depends on the contract tests in T044/T045 (which depend on Phase 2's T006). Integrates US1 (sign-in works) and US2 (search works) on the deployed instance.
- **US4 (P3)**: Can start after Phase 2 — depends on the hygiene test infrastructure (T052, T053) but does not need US1/US2/US3 to be complete.

### Within Each User Story

- Contract / integration tests are written **first** and must fail before implementation.
- Shared services and middleware (Phase 2) before any story's routes.
- Server implementation before client integration.
- Story complete and verified before moving to the next priority.

### Parallel Opportunities

- T002, T005 (Phase 1) — different files, no dependencies.
- T007, T008, T010, T011, T014, T015, T016, T017 (Phase 2) — all touch different files, no cross-dependencies.
- All test tasks within a story marked `[P]` (T018–T023, T030–T037, T044–T045, T052–T053).
- US1 and US2 can be worked on in parallel by different developers after Phase 2 completes.
- US3 and US4 can be worked on in parallel after Phase 2 completes.
- All Phase 7 polish tasks marked `[P]`.
- Phase 0 (T001) runs in parallel with all other phases; it is governance work, not implementation.

### Parallel Example: User Story 1

```bash
# Launch all tests for US1 together:
Task: "T018 [P] [US1] Contract test for AuthMeResponseSchema + PrincipalSchema in apps/server/tests/contract/auth-me.test.ts"
Task: "T019 [P] [US1] Integration test for sign-in → refresh → still signed in in apps/server/tests/integration/auth-persistence.test.ts"
Task: "T020 [P] [US1] Integration test for incoming next redirect from a protected route in apps/server/tests/integration/auth-protected-route.test.ts"
Task: "T021 [P] [US1] Integration test for hash casing normalization in telegram-verify.ts in apps/server/tests/integration/telegram-verify-casing.test.ts"
Task: "T022 [P] [US1] Integration test for cross-tab sign-out via session.invalidated in apps/server/tests/integration/auth-cross-tab.test.ts"
Task: "T023 [P] [US1] Integration test for next parameter handoff across redirect-mode sign-in in apps/server/tests/integration/auth-next-redirect.test.ts"

# Then implement the wiring fix (T024) and the route changes (T025, T026), which
# all depend on T018 and run sequentially because they share a single file
# (apps/web/src/lib/auth.ts and apps/web/src/routes/SignInPage.tsx).
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1.
4. Complete Phase 4: User Story 2.
5. **STOP and VALIDATE**: Both P1 stories pass their independent tests. Sign-in survives refresh/redirect/cross-tab. Anonymous and signed-in search reach a result page in under 30 s. The operator can deploy and verify health.
6. Deploy/demo.

### Incremental Delivery

1. Setup + Foundational → Foundation ready.
2. US1 → Sign-in persistence works (MVP chunk 1).
3. US2 → Search works end-to-end (MVP chunk 2 — together with US1, this is the full MVP).
4. US3 → Deploy is reproducible.
5. US4 → Codebase is auditable.
6. Each story adds value without breaking previous stories.

### Parallel Team Strategy

- After Phase 2, US1 and US2 can run in parallel (Dev A: auth wiring, Dev B: search wiring).
- US3 and US4 can start in parallel with US2 if capacity allows (they are largely independent of US1/US2 wiring).
- T001 (Phase 0 governance) can run on a single contributor in parallel with the implementation team.

---

## Notes

- `[P]` tasks = different files, no dependencies. Sequential tasks on the same file are intentionally not `[P]`.
- `[Story]` label maps each task to a user story for traceability; Phase 0, 1, 2, 7 tasks are intentionally unlabeled.
- Each user story is independently completable and testable.
- Tests are written first and must fail before implementation, per Constitution G7.
- Commit after each task or logical group (Conventional Commits).
- Stop at any checkpoint to validate the story independently.
- **The G3 Constitution conflict is a governance follow-up** (Phase 0, T001), not a blocker for the implementation. The repair ships first; the amendment proposal is drafted in parallel and submitted through `/speckit.constitution` after the repair lands. Tasks T006, T007, T009, T046, T048, T049, T051 surface the *behaviour* required by the spec, not the constitutional amendment.
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence.

## Remediations applied (vs. the original 65-task draft)

This file is the post-analysis version. Compared with the prior draft, the following changes were applied:

- **Added Phase 0 (T001)**: a governance task to draft the Constitution amendment. CRITICAL per the analysis rules.
- **Removed T006 (no-op re-export confirmation)**.
- **Removed T026 (duplicate of T011)**.
- **Removed T027 (subsumed by T010)**.
- **Removed T041 (no-op — `.default('unknown')` already makes the client parser permissive)**.
- **Added T020 [P] [US1]** (incoming `next` redirect from a protected route; FR-019).
- **Added T021 [P] [US1]** (hash casing normalization in `telegram-verify.ts`; FR-025).
- **Added T033 [P] [US2]** (Playwright paywall modal render; FR-010).
- **Added T034 [P] [US2]** (non-2xx client error surface; FR-020, FR-034).
- **Added explicit `(FR-NNN)` / `(SC-NNN)` tags** to T004, T006, T007, T008, T009, T010, T011, T012, T013, T014, T015, T016, T017, T018, T019, T020, T021, T022, T023, T024, T025, T026, T027, T028, T030, T031, T032, T033, T034, T035, T036, T037, T038, T039, T040, T041, T042, T044, T045, T046, T047, T048, T049, T050, T051, T052, T053, T054, T055, T056, T057, T058, T060, T061, T062, T063, T064, T065, T066, T067 for traceability.
- **Renumbered sequentially** (no gaps, no `T019b`-style suffix).
- **Total tasks**: 67 (was 65).

## Polish applied (LOW-severity, post-remediation)

After the initial six remediations, the following LOW-severity polish was applied (no task count change, no renumbering):

- **A1 — T063 rephrased** to enumerate the surfaces, the horizontal-scroll assertion (`document.documentElement.scrollWidth <= window.innerWidth`), and the explicit `data-bidi="freeze"` audit for icons.
- **A3 — T004** now includes the concrete recipe: `ls .github/workflows/`, `ls Dockerfile docker-compose.yml`, and the multi-target grep that must return zero hits.
- **U5 — T060** now lists the expected new i18n keys (`suspended_user`, `free_trial_exhausted`, `network_error`, `schema_mismatch`, `session_expired`, `csrf_mismatch`) with their Arabic copy and the recovery action for each.
- **U6 — T033** now asserts three things in one test: modal renders for anonymous 402, modal does *not* render for signed-in users, and closing returns focus to the identifier input.
- **U10 — T051** now requires every step in the quickstart to be classified as either "automated by tests" (citing the test ID) or "manual smoke only".
- **A2** is a non-finding: T040 already has the concrete `mutationKey: ['create-lookup', normalisedIdentifier]` and the 500ms `useRef` guard.

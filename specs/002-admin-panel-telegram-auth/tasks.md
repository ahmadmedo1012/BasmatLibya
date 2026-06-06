---
description: "Task list — Premium Redesign, Telegram Login, and Owner Admin Panel"
---

# Tasks: Premium Redesign, Telegram Login, and Owner Admin Panel

**Input**: Design documents from `/specs/002-admin-panel-telegram-auth/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. Research R-16 requires unit, integration, contract, E2E, design-audit, and axe tests as the structural verification of constitutional gates G6–G11 and success criteria SC-002, SC-003, SC-006, SC-009.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. The four user stories from spec.md:

- **US1 (P1)** — Sign in with Telegram and continue using the platform
- **US2 (P1)** — Owner opens the admin panel and exercises full site control
- **US3 (P1)** — Premium redesign across every public surface
- **US4 (P2)** — Authenticated user manages their own footprint history

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- File paths are absolute-from-repo-root (e.g. `apps/server/src/...`)

## Path Conventions

Web application monorepo (pnpm workspace) inherited from feature `001`:
- **Server**: `apps/server/src/`
- **Web SPA**: `apps/web/src/`
- **Shared**: `packages/shared/src/`
- **Scripts**: `scripts/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Workspace, dependencies, environment, and lint rules needed before any user-story work.

- [X] T001 Add new runtime dependencies to `apps/server/package.json` (no new heavy deps — relies on Node `crypto`; add `cookie@^1` for parsing) and `apps/web/package.json` (`@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `@radix-ui/react-toast`, `react-hook-form`, `@hookform/resolvers`, `class-variance-authority`, `tailwind-merge`, `@tanstack/react-table`); run `pnpm install` and commit the updated `pnpm-lock.yaml`.
- [X] T002 [P] Extend `.env.example` with the feature-002 block from `specs/002-admin-panel-telegram-auth/quickstart.md` (`TELEGRAM_BOT_TOKEN`, `OWNER_TELEGRAM_ID`, `MODEL_SECRET_KEY`, `MODEL_SECRET_KEY_PREVIOUS`, `COOKIE_DOMAIN`).
- [X] T003 [P] Extend `apps/server/src/env.ts` (zod-validated env loader) to require `TELEGRAM_BOT_TOKEN` and `MODEL_SECRET_KEY` in production and to make `OWNER_TELEGRAM_ID` an optional `z.coerce.bigint()` (when absent, no user can have the owner role).
- [X] T004 [P] Add the no-physical-properties ESLint rule in `eslint.config.js` (custom rule under `tooling/eslint-rules/no-physical-rtl-properties.js`) that forbids Tailwind class names matching `/\b(left-|right-|pl-|pr-|ml-|mr-|border-l|border-r|rounded-l|rounded-r|text-left|text-right)\b/` outside of explicit allow-list files (e.g. third-party shims). Wire the rule into `eslint.config.js` and run `pnpm lint` to confirm zero violations on the existing v1 codebase.
- [X] T005 [P] Create `scripts/bootstrap-owner.ts` per quickstart "Owner bootstrap" section: reads `TELEGRAM_BOT_TOKEN` from `.env`, calls `getUpdates`, prints the numeric `from.id` of the most recent message, exits.
- [X] T006 [P] Add `pnpm test:design-audit` script to `apps/web/package.json` that runs the Playwright redesign-audit project defined in T077.
- [X] T007 [P] Add `pnpm db:rollback` script to `apps/server/package.json` that drops the six new tables and the `lookups.owner_user_id` column (used in CI to assert G10 — additive migrations only).
- [X] T008 Verify the workspace builds and the existing v1 test suite still passes after dependency additions: `pnpm typecheck && pnpm test` exits with status 0.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared schemas, design tokens, base primitives, DB migration, secret cipher, settings cache, audit choke-point, and middleware. Every user story depends on this phase.

**⚠️ CRITICAL**: No user-story work begins until this phase is complete.

### Shared schemas (`packages/shared`)

- [X] T009 [P] Create `packages/shared/src/auth/telegram.ts` with zod schemas `TelegramAuthPayload` and `TelegramAuthDataCheckString` (matching the `TelegramAuthPayload` schema in `contracts/auth-admin-api.openapi.yaml`).
- [X] T010 [P] Create `packages/shared/src/auth/session.ts` exporting `SESSION_COOKIE_NAME = 'bsl_session'`, `SESSION_LIFETIME_DAYS_DEFAULT = 30`, `Principal` zod schema, `AuthMeResponse` zod schema.
- [X] T011 [P] Create `packages/shared/src/admin/ai-models.ts` with zod schemas `AiModelEntryCreate`, `AiModelEntryUpdate`, `AiModelEntryDisplay`, `AiModelGenerationParams`, `AiModelProvider`, `AiModelStatus` (mirroring `contracts/auth-admin-api.openapi.yaml`).
- [X] T012 [P] Create `packages/shared/src/admin/users.ts` with zod schemas `AdminUserSummary`, `AdminUserDetail`, `AdminUsersPage`, `LookupHistoryItem`, `HistoryPage`.
- [X] T013 [P] Create `packages/shared/src/admin/site-settings.ts` with the discriminated-union `SiteSettingsMap` zod schema covering all keys + bounds in `data-model.md` § `site_settings` (research R-07).
- [X] T014 [P] Create `packages/shared/src/admin/audit.ts` with zod schemas `AuditEntry`, `AuditPage`, `AuditEventClass`, `AuditEventSubclass`.
- [X] T015 [P] Re-export every new schema from `packages/shared/src/index.ts`.
- [X] T016 [P] Extend `packages/shared/src/i18n/ar.json` with all Arabic copy referenced by the redesigned surfaces and error codes (sign-in, sign-out, suspended, not-authorised, rate-limited, admin section labels, audit verbs, design-system error states). Keys must follow existing dot-namespace convention.

### Design tokens (`packages/shared/src/design-tokens`)

- [X] T017 [P] Create `packages/shared/src/design-tokens/colors.ts` with semantic tokens (`bg-canvas`, `bg-elevated`, `fg-default`, `fg-muted`, `accent`, `danger`, `success`, `warning`, `border-subtle`, `border-strong`) for both light and dark modes per research R-09.
- [X] T018 [P] Create `packages/shared/src/design-tokens/typography.ts` with the Arabic-tuned scale (`xs / sm / base / lg / xl / 2xl / 3xl`), Arabic display family (IBM Plex Sans Arabic) and Latin family (Inter) with explicit `unicodeRange` blocks.
- [X] T019 [P] Create `packages/shared/src/design-tokens/spacing.ts` (4-pt rhythm), `radii.ts`, `motion.ts` (`motion-fast: 140ms`, `motion-base: 220ms`, `motion-slow: 340ms`, easings `out-soft`, `in-out-soft`, reduced-motion fallback).
- [X] T020 [P] Create `packages/shared/src/design-tokens/index.ts` that aggregates all tokens and exports a `tailwindPreset()` factory consumed by `apps/web/src/design/tailwind-preset.ts`.

### Database migration

- [X] T021 Update `apps/server/src/db/schema.ts` (Drizzle schema) with the six new tables and the `lookups.owner_user_id` column per `data-model.md`. Existing `001` tables must remain byte-for-byte unchanged (G10).
- [X] T022 Generate `apps/server/src/db/migrations/0002_admin_panel.sql` via `pnpm --filter @basmat/server drizzle-kit generate` and verify the SQL output matches the steps in `data-model.md` § "Migration: 0002_admin_panel.sql" (six CREATE TABLE, one ALTER TABLE ADD COLUMN, indexes, partial unique index `one_active_ai_model`, seed inserts for default `site_settings`).
- [X] T023 Apply the migration locally with `pnpm db:migrate` and run `pnpm db:rollback && pnpm db:migrate` to confirm clean idempotency.

### Server crypto + cache + audit choke-point

- [X] T024 [P] Create `apps/server/src/admin/secret-cipher.ts` implementing AES-256-GCM `encrypt(plaintext) -> { iv, ciphertext, tag }` and `decrypt({iv,ciphertext,tag}) -> plaintext` using `MODEL_SECRET_KEY` (with optional `MODEL_SECRET_KEY_PREVIOUS` fallback for decryption only) per research R-06.
- [X] T025 [P] Create `apps/server/src/admin/settings-cache.ts` — in-process `Map<key, { value, fetchedAt }>` with 30 s TTL, `get(key)`, `getAll()`, and `invalidate(key)` called by every site-settings mutation per research R-07.
- [X] T026 [P] Create `apps/server/src/admin/audit-log.ts` exporting `auditLog.append(tx, entry)` — the single choke-point that every admin mutation must call inside its own DB transaction. Apply field-redaction to `before`/`after` (any field whose name contains `secret`, `token`, `key`, `credential`, or `password`, or matches the explicit deny-list, is replaced by `{ redacted: true }`) per research R-08.

### Auth middleware

- [X] T027 [P] Create `apps/server/src/auth/cookie.ts` exporting `setSessionCookie(res, token, expiresAt)`, `clearSessionCookie(res)`, `readSessionCookie(req)` with attributes `HttpOnly; Secure (prod); SameSite=Lax; Path=/; Domain=COOKIE_DOMAIN?` per research R-04.
- [X] T028 [P] Create `apps/server/src/auth/principal.ts` exporting `resolvePrincipal(req): Promise<Principal | null>` — reads cookie, looks up `sessions` by `sha256(token)`, joins to `users`, verifies status/expiry/revocation, touches `last_seen_at`. Returns `null` for anonymous; never throws on missing cookie.
- [X] T029 [P] Create `apps/server/src/http/middleware/require-session.ts` — Express middleware that attaches `req.principal` and returns `401 { code: 'not_authenticated', messageAr }` for anonymous callers.
- [X] T030 [P] Create `apps/server/src/http/middleware/require-owner.ts` — depends on `require-session`; returns `403 { code: 'unauthorized', messageAr }` for any caller whose `principal.role !== 'owner'` or `principal.status !== 'active'`. Per FR-008, the response body MUST contain no admin data.
- [X] T031 [P] Create `apps/server/src/http/middleware/require-csrf.ts` — for state-changing routes, asserts `X-CSRF` header equals `req.principal.session.csrfToken`; returns `403 { code: 'csrf_required' }` otherwise. Exempts `POST /api/auth/telegram`.

### Web design system bootstrap

- [X] T032 [P] Create `apps/web/src/design/tailwind-preset.ts` consuming `@basmat/shared/design-tokens` and emit it as a Tailwind preset; wire it into `apps/web/tailwind.config.ts`.
- [X] T033 [P] Update `apps/web/src/styles/globals.css` to expose tokens as CSS variables on `:root` and `[data-theme="dark"]`, set `<html dir="rtl" lang="ar">`-driven base styles, and add the `data-design-system="bsl-002"` marker target per research R-09.
- [X] T034 [P] Create `apps/web/src/design/motion.ts` exporting framer-motion variants tied to motion tokens with `useReducedMotion()` fallbacks per research R-09 / FR-027.
- [X] T035 [P] Create `apps/web/src/design/primitives/Button.tsx` (RTL-first, `cva` variants: primary/secondary/ghost/danger; sizes sm/md/lg).
- [X] T036 [P] Create `apps/web/src/design/primitives/Input.tsx` and `Field.tsx` (label, error, helper-text; full RTL with logical properties).
- [X] T037 [P] Create `apps/web/src/design/primitives/Card.tsx`, `Badge.tsx`, `Avatar.tsx`.
- [X] T038 [P] Create `apps/web/src/design/primitives/Dialog.tsx` and `Toast.tsx` wrapping Radix primitives, with motion variants from T034.
- [X] T039 [P] Create `apps/web/src/design/primitives/Tabs.tsx`, `DropdownMenu.tsx`, `Tooltip.tsx` wrapping Radix primitives.

### Foundational tests

- [X] T040 [P] Add `apps/server/tests/unit/secret-cipher.test.ts` — round-trip plaintext → ciphertext → plaintext under `MODEL_SECRET_KEY`; key rotation via `MODEL_SECRET_KEY_PREVIOUS`; tamper detection via altered `tag`.
- [X] T041 [P] Add `apps/server/tests/unit/settings-cache.test.ts` — TTL expiry, `invalidate` clears the entry, `getAll` returns defaults from DB seeds.
- [X] T042 [P] Add `apps/server/tests/integration/audit-log-invariant.test.ts` — wraps a successful mutation and asserts exactly one audit row was inserted in the same transaction; wraps a failing mutation and asserts the audit row was rolled back together with the mutation (G9).
- [X] T043 [P] Add `apps/server/tests/contract/middleware-require-owner.test.ts` — non-owner authenticated user receives `403 { code: 'unauthorized' }` with empty admin body on every admin route fixture.
- [X] T044 [P] Add `apps/web/tests/unit/design-tokens-contrast.test.ts` — Vitest snapshot that walks every (fg, bg) pair declared as a valid combination in `colors.ts` and asserts WCAG 2.1 AA contrast ratio per research R-09.

**Checkpoint**: Foundation ready — every user story can now begin in parallel.

---

## Phase 3: User Story 1 — Sign in with Telegram (Priority: P1) 🎯 MVP gate 1/3

**Goal**: A visitor can sign in entirely through Telegram (no other provider visible), the session persists across reload, and the header reflects the signed-in identity.

**Independent Test**: Sign in via the stubbed Telegram widget (test fixture serves a hand-signed payload using a test bot token); assert the SPA header shows the user's display name + avatar; reload the page; assert still signed in. Sign out; assert anonymous header. Submit a tampered payload; assert `401 { code: 'hmac_invalid' }` and no `users`/`sessions` row created.

### Tests for User Story 1 ⚠️

> Write these tests FIRST and ensure they FAIL before implementation.

- [X] T045 [P] [US1] Add `apps/server/tests/unit/telegram-verify.test.ts` — happy path with a hand-signed fixture, tampered hash → reject, `auth_date` older than 300 s → reject (research R-01).
- [X] T046 [P] [US1] Add `apps/server/tests/integration/auth-telegram.test.ts` — `POST /api/auth/telegram` happy path issues a cookie and returns `AuthMeResponse`; tampered → `401 hmac_invalid`; expired → `401 auth_date_too_old`; suspended user → `403 suspended_user`; `payload.id === OWNER_TELEGRAM_ID` → user is created with `role='owner'`.
- [X] T047 [P] [US1] Add `apps/server/tests/integration/auth-me-and-signout.test.ts` — anonymous → `401 not_authenticated`; authenticated → `AuthMeResponse` with `csrfToken`; `POST /api/auth/sign-out` revokes the session and emits `session.invalidated`.
- [X] T048 [P] [US1] Add `apps/web/tests/e2e/sign-in.spec.ts` — Playwright flow against a stubbed Telegram widget; assert header reflects signed-in state, reload preserves session, sign out clears it.

### Implementation for User Story 1

- [X] T049 [P] [US1] Create `apps/server/src/auth/telegram-verify.ts` implementing the HMAC-SHA256 verification recipe in research R-01: `secret = sha256(BOT_TOKEN); data_check_string = sorted("k=v" except hash).join("\n"); expected = hmac_sha256(secret, data_check_string).hex();` `timingSafeEqual` compare; reject when `now - auth_date > 300`.
- [X] T050 [P] [US1] Create `apps/server/src/auth/session-store.ts` exporting `issue(userId)` (creates a `sessions` row with random 32-byte token, returns plaintext token + csrfToken + expiresAt), `revoke(sessionId, reason)`, `revokeAllForUser(userId, reason)`, `pruneExpired()`.
- [X] T051 [US1] Create `apps/server/src/http/routes/auth.ts` with `POST /api/auth/telegram`, `GET /api/auth/me`, `POST /api/auth/sign-out`. The Telegram route upserts the user (matched by `telegram_id`), grants `role='owner'` iff `telegram_id === OWNER_TELEGRAM_ID` (FR-009/FR-009a), refuses sign-in for `status='suspended'`, issues a session via T050, sets the cookie via `cookie.ts`, and appends an `auth/sign_in_success|sign_in_failure` audit row via T026.
- [X] T052 [US1] Wire the auth router into the Express app in `apps/server/src/index.ts` and ensure `cookie-parser` (or equivalent) is mounted before it.
- [X] T053 [US1] Extend `apps/server/src/realtime/socket.ts` so authenticated handshakes (cookie verified) auto-join `user:{userId}` per research R-11 / contracts/socket-events.md.
- [X] T054 [US1] Add the `session.invalidated` server-emit helper in `apps/server/src/realtime/events.ts` and call it from `session-store.revoke*` paths.
- [X] T055 [P] [US1] Create `apps/web/src/lib/auth.ts` — `useAuthMe()` TanStack Query hook (calls `/api/auth/me`, returns `Principal | null`); `signOut()` mutation; `attachTelegramWidget(elRef, onPayload)` helper that mounts the Telegram Login Widget script on `/sign-in` and posts the payload to `POST /api/auth/telegram`.
- [X] T056 [P] [US1] Update `apps/web/src/lib/socket.ts` to handle `session.invalidated` per contracts/socket-events.md (route `suspended` → `/suspended`, `removed` → `/sign-in` with notice, `manual`/`expired` → `/sign-in`).
- [X] T057 [P] [US1] Create `apps/web/src/routes/SignInPage.tsx` — single Telegram action plus designed Arabic error/cancel states; on success, redirect to the originating route or `/`.
- [X] T058 [P] [US1] Create `apps/web/src/routes/SuspendedPage.tsx` — designed "تم تعليق حسابك" state with no recovery action.
- [X] T059 [US1] Update `apps/web/src/components/Header.tsx` (or create if missing) — anonymous: shows "تسجيل الدخول عبر تليجرام" linking to `/sign-in`; signed-in: shows display name + avatar + dropdown with "تسجيل الخروج" calling `signOut()`.

**Checkpoint**: At this point, US1 is fully functional and testable independently. The site is signed-in capable but no admin panel or history exists yet.

---

## Phase 4: User Story 2 — Owner admin panel (Priority: P1) 🎯 MVP gate 2/3

**Goal**: The single owner reaches `/admin`, manages AI model entries (with full advanced parameters), users (with immediate suspension cascade), site settings (with ≤30 s public propagation), and the audit log. Non-owner authenticated users are denied.

**Independent Test**: With the +218 091 008 9975 owner account signed in, perform one create / one update / one destructive action in each of AI Models, Users, Site Settings; verify each action appears in the Audit log with actor + before/after; verify a separately-signed-in non-owner is denied at `/admin` with no admin UI flash and `403 unauthorized` on every `/api/admin/*` fetch.

### Tests for User Story 2 ⚠️

> Write these tests FIRST and ensure they FAIL before implementation.

- [X] T060 [P] [US2] Add `apps/server/tests/contract/admin-ai-models.test.ts` — happy CRUD + activation; invalid credentials → `400 validation_failed`, row not marked active; deleting active row → `409 active_model_protected`; non-owner → `403 unauthorized`. Asserts the GET response carries `credential: { present, lastFour }` and never plaintext.
- [ ] T061 [P] [US2] Add `apps/server/tests/contract/admin-users.test.ts` — list/filter/sort/paginate; `POST /suspend` revokes every active session of the target and emits `session.invalidated`; self-suspend → `403`; last-owner-removal → `409 last_owner_protected`; user with dependent ai_model_entries → `409 dependent_entries`.
- [ ] T062 [P] [US2] Add `apps/server/tests/contract/admin-site-settings.test.ts` — GET returns full typed map with seeded defaults; PATCH validates per-key bounds; out-of-range value → `400 validation_failed`; the cache invalidates within ≤30 s of the write (SC-005).
- [ ] T063 [P] [US2] Add `apps/server/tests/contract/admin-audit.test.ts` — every admin write in the previous tests appears as exactly one row in `audit_log_entries` with the right actor/target/before/after (G9, SC-009).
- [ ] T064 [P] [US2] Add `apps/web/tests/e2e/admin-flow.spec.ts` — signed-in owner walks Add AI Model → Activate → Suspend a user → Toggle `public_lookups_enabled` → Open Audit; non-owner attempt at `/admin` lands on `/not-authorised` with no admin chrome flash.
- [ ] T065 [P] [US2] Add `apps/web/tests/e2e/suspension-cascade.spec.ts` — owner suspends user in tab A; tab B (the user's signed-in session) lands on `/suspended` within 2 s without manual reload.

### Implementation for User Story 2 — server: AI model client and provider adapters

- [X] T066 [P] [US2] Create `apps/server/src/analysis/enrichment/ai-model-client.ts` defining the `AiModelClient` interface (`validate`, `enrich`) and the `pickAdapter(provider)` registry per research R-05.
- [X] T067 [P] [US2] Create `apps/server/src/analysis/enrichment/providers/openai.ts` (uses `openai` SDK; respects `temperature`, `maxOutputTokens`, `extraParams.top_p`).
- [X] T068 [P] [US2] Create `apps/server/src/analysis/enrichment/providers/anthropic.ts` (uses `@anthropic-ai/sdk`; maps `systemPrompt` to the system param; honours `maxOutputTokens` as `max_tokens`).
- [X] T069 [P] [US2] Create `apps/server/src/analysis/enrichment/providers/google.ts` (uses `@google/generative-ai`).
- [X] T070 [P] [US2] Create `apps/server/src/analysis/enrichment/providers/nvidia.ts` and `providers/openai-compatible.ts` (NIM uses the OpenAI-compatible adapter with a different `baseURL`).
- [X] T071 [US2] Refactor `apps/server/src/analysis/enrichment/enrichment.ts` so it reads the active row from `ai_model_entries` (single `is_active = true` row), decrypts via `secret-cipher`, picks the adapter via T066, and writes the result into `aggregated_results.enrichment_payload` / `enrichment_status` exactly as feature `001` defined (no schema change to `001`).

### Implementation for User Story 2 — server: admin routes

- [X] T072 [P] [US2] Create `apps/server/src/http/routes/admin/ai-models.ts` (`GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`, `POST /:id/activate`) per `contracts/auth-admin-api.openapi.yaml`. Every mutation calls `auditLog.append()` in the same transaction. The response stripper replaces `credential_ciphertext` with `{ present: true, lastFour }`. Activation atomically clears `is_active` on every other row and re-validates the target.
- [X] T073 [P] [US2] Create `apps/server/src/http/routes/admin/users.ts` (`GET /`, `GET /:id`, `DELETE /:id`, `POST /:id/suspend`, `POST /:id/unsuspend`). Suspension uses one DB transaction per research R-13: update user, revoke all active sessions, emit `session.invalidated`, append audit row. Self-suspend / last-owner-removal / dependent-entries are blocked with the documented error codes.
- [X] T074 [P] [US2] Create `apps/server/src/http/routes/admin/site-settings.ts` (`GET /`, `PATCH /`). PATCH validates the request against the discriminated `SiteSettingsMap` zod schema; applies all keys atomically; invalidates the in-process cache; appends one audit row per key changed.
- [X] T075 [P] [US2] Create `apps/server/src/http/routes/admin/audit.ts` (`GET /`) — paginated read-only timeline filterable by `eventClass`, `actorUserId`, `targetKind`, `targetId`. Owner only; never exposes redacted fields.
- [X] T076 [US2] Wire all admin routers under `app.use('/api/admin', requireSession, requireOwner, requireCsrf, adminRouter)` in `apps/server/src/index.ts` (note: GETs skip `requireCsrf`).

### Implementation for User Story 2 — web: admin SPA

- [X] T077 [P] [US2] Create `apps/web/src/lib/admin-api.ts` — typed admin client (TanStack Query hooks per endpoint, throws on non-2xx, surfaces Arabic copy from `error.messageAr`). Lazy-imported only by the admin chunk.
- [X] T078 [P] [US2] Create `apps/web/src/routes/NotAuthorisedPage.tsx` — designed "غير مصرح" state.
- [X] T079 [P] [US2] Create `apps/web/src/routes/admin/AdminLayout.tsx` — owner-only shell with side nav to AI Models / Users / Site Settings / Audit; renders `<NotAuthorisedPage/>` for non-owners (server still authoritative). Lazy-loaded route per research R-15.
- [X] T080 [P] [US2] Create `apps/web/src/routes/admin/AiModelsPage.tsx` — list + create/edit dialogs (using `react-hook-form` + zod resolver) + activate button + delete confirmation. Credential field is write-only; existing entries display `•••• lastFour`.
- [X] T081 [P] [US2] Create `apps/web/src/routes/admin/UsersPage.tsx` — `@tanstack/react-table` driven list with status/role filters, last-activity sort, cursor pagination, suspend / unsuspend / remove actions with designed confirmation dialogs.
- [X] T082 [P] [US2] Create `apps/web/src/routes/admin/SiteSettingsPage.tsx` — form grouped by area (retention, rate limits, public toggles, session lifetime); each field renders bounds from the shared zod schema.
- [X] T083 [P] [US2] Create `apps/web/src/routes/admin/AuditLogPage.tsx` — filterable timeline of audit entries; before/after rendered as a JSON diff viewer; redacted fields rendered as a lock icon.
- [X] T084 [US2] Register the `/admin/*` routes in `apps/web/src/App.tsx` (lazy-loaded chunk) and add a "لوحة التحكم" link in the header that is visible only when `principal.role === 'owner'`.

**Checkpoint**: At this point, US1 + US2 together form the functional MVP — the owner can sign in, manage AI models, manage users, change site settings, and audit every action. The platform is operable without DB surgery.

---

## Phase 5: User Story 3 — Premium redesign across every surface (Priority: P1) 🎯 MVP gate 3/3

**Goal**: Every public surface (home, sign-in, in-progress, result, share, expired, error, history, suspended, not-authorised) and every admin surface (AI Models, Users, Site Settings, Audit) consume `@basmat/shared/design-tokens` and the primitives in `apps/web/src/design/primitives/*`. Zero v1 styling remains in the redesigned scope. Reduced-motion is honoured. WCAG 2.1 AA passes via axe.

**Independent Test**: Run `pnpm test:design-audit`. The Playwright suite walks all 16 surfaces and asserts (a) `<html dir="rtl" lang="ar">`, (b) `data-design-system="bsl-002"` on the root layout, (c) Arabic copy in chrome with no leaked English, (d) no horizontal scroll at 320 px viewport, (e) zero `axe-playwright` violations. Manually compare home, result, and admin: typography rhythm, spacing, color, motion are visibly the same system.

> NOTE: T035–T039 (primitives) and T032–T034 (preset, motion, globals) have already been completed in Foundational. This phase migrates the v1 surfaces and adds the audit harness.

### Tests for User Story 3 ⚠️

- [ ] T085 [P] [US3] Add `apps/web/tests/e2e/design-audit.spec.ts` — Playwright project that visits each of the 16 redesigned surfaces (home, sign-in, sign-in-error, in-progress, result, share, expired, error, history, history-empty, suspended, not-authorised, admin/ai-models, admin/users, admin/site-settings, admin/audit) and asserts the five invariants in the Independent Test above.
- [ ] T086 [P] [US3] Add `apps/web/tests/e2e/redesign-axe.spec.ts` — runs `axe-playwright` against each of the 16 surfaces and fails on any WCAG 2.1 AA violation (FR-027).
- [ ] T087 [P] [US3] Add `apps/web/tests/e2e/reduced-motion.spec.ts` — sets `prefers-reduced-motion: reduce` and asserts decorative motion is suppressed while progress motion remains functional.
- [ ] T088 [P] [US3] Add a CI bundle-size check (`size-limit` or equivalent) wired into `package.json` per research R-15 — fails CI if the public gzipped bundle grows by more than 15% over the v1 baseline; hard-fails at 25%.

### Implementation for User Story 3 — migrate v1 surfaces to tokens + primitives

- [ ] T089 [P] [US3] Migrate `apps/web/src/routes/HomePage.tsx` to use `Button`, `Input`, `Field`, and design tokens; remove every physical-property class and any v1 ad-hoc CSS. Verify against T004's ESLint rule.
- [ ] T090 [P] [US3] Migrate `apps/web/src/routes/ProgressPage.tsx` and the per-category progress components to tokens + motion variants from T034. Decorative motion gates on `useReducedMotion()`.
- [ ] T091 [P] [US3] Migrate `apps/web/src/routes/ResultPage.tsx`, `apps/web/src/components/result/CategorySection.tsx`, `apps/web/src/components/result/FindingCard.tsx`, `apps/web/src/components/result/EnrichmentSlot.tsx` to tokens + primitives.
- [ ] T092 [P] [US3] Migrate `apps/web/src/routes/ExpiredPage.tsx` and `apps/web/src/routes/NotFoundPage.tsx` (and any error route used by `001`) to tokens.
- [ ] T093 [P] [US3] Migrate the v1 state components in `apps/web/src/components/states/*` (Empty, Degraded, FullFailure, Validation) to tokens + primitives.
- [X] T094 [P] [US3] Add the `data-design-system="bsl-002"` attribute on the root layout component (e.g. `apps/web/src/App.tsx` outer div) so the design audit suite has a cheap structural marker.
- [ ] T095 [P] [US3] Self-host Arabic + Latin font faces (already loaded in `001`) via `apps/web/src/styles/fonts.css` with explicit `unicode-range` blocks per research R-09; remove any third-party CDN font URL.

**Checkpoint**: Every surface consumes one design system; the public site, sign-in, and admin all visibly belong to the same product. MVP scope (US1 + US2 + US3) is complete.

---

## Phase 6: User Story 4 — Authenticated user manages their own footprint history (Priority: P2)

**Goal**: A signed-in user opens "سجلّي" and sees their lookups (most recent first), removes one entry, sees it disappear from their history while the underlying public share link still resolves.

**Independent Test**: Sign in, run two lookups, open `/history`, see both, remove one, refresh — the removed one is gone from history but its share link still resolves to the original result page (R-14).

### Tests for User Story 4 ⚠️

- [ ] T096 [P] [US4] Add `apps/server/tests/integration/me-history.test.ts` — `GET /api/me/history` returns the signed-in user's lookups (most recent first, paginated, hidden rows excluded); anonymous → `401`; foreign-user lookups never appear.
- [ ] T097 [P] [US4] Add `apps/server/tests/integration/me-history-hide.test.ts` — `DELETE /api/me/history/:lookupId` sets `hidden_by_user_at` and the underlying `lookups` row is unchanged; the public `GET /api/lookups/:id` share link still returns the result; second DELETE is idempotent.
- [ ] T098 [P] [US4] Add `apps/web/tests/e2e/history-flow.spec.ts` — full Playwright walk of the Independent Test above.

### Implementation for User Story 4

- [X] T099 [US4] Update the lookup-creation path (existing `POST /api/lookups` in `001`) so that, when `req.principal` is set, the server inserts a `user_lookup_associations` row and sets `lookups.owner_user_id`. Anonymous lookups are unchanged (G2).
- [ ] T100 [P] [US4] Create `apps/server/src/http/routes/history.ts` with `GET /api/me/history` (cursor pagination, joined to `lookups`) and `DELETE /api/me/history/:lookupId` (sets `hidden_by_user_at`, never deletes the lookup). Both routes go through `requireSession`; DELETE goes through `requireCsrf`. DELETE appends a `me/history_hide` audit-log entry.
- [ ] T101 [P] [US4] Create `apps/web/src/routes/HistoryPage.tsx` — RTL list with `Card` primitives, cursor pagination, per-row "إزالة" action with designed confirm dialog. Redirects anonymous visitors to `/sign-in?next=/history`.
- [ ] T102 [P] [US4] Create `apps/web/src/routes/HistoryEmptyPage.tsx` — designed empty-state inviting back to `/`.
- [ ] T103 [US4] Add a "سجلّي" link in the signed-in dropdown of `apps/web/src/components/Header.tsx`.

**Checkpoint**: All four user stories are independently functional. Feature 002 is feature-complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening, retention sweepers, observability, and quickstart validation.

- [ ] T104 [P] Implement nightly sweepers in `apps/server/src/services/retention.ts` — delete `audit_log_entries` older than `audit_retention_days` (default 365) and prune `sessions` whose `expires_at` is in the past. Schedule via the same node-cron (or equivalent) used by `001`'s retention sweep.
- [ ] T105 [P] Extend structured logging in `apps/server/src/observability/logger.ts` so every auth event and admin event carries `event_class`, `event_subclass`, `actor_user_id` (where applicable). Verify no log line ever contains `BOT_TOKEN`, `MODEL_SECRET_KEY`, or any AI credential (FR-030).
- [ ] T106 [P] Implement `scripts/rotate-model-secret-key.ts` per quickstart "Rotating MODEL_SECRET_KEY" — re-encrypts every `ai_model_entries` row under the new key and exits 0 on success.
- [ ] T107 [P] Add a contract regression test (`apps/server/tests/contract/v1-untouched.test.ts`) that re-runs every v1 OpenAPI assertion from `001/contracts/rest-api.openapi.yaml` against the running server to verify FR-028 (no v1 capability regression).
- [ ] T108 Run the full quickstart walkthrough end-to-end on a fresh checkout: `pnpm install && pnpm db:reset && pnpm db:migrate && pnpm dev`, then perform every step under "Walkthrough — sign-in and admin panel" and "Walkthrough — non-owner is denied". Document any deviation.
- [ ] T109 Run `pnpm test`, `pnpm test:design-audit`, and `pnpm lint` across the whole repo and confirm all green; attach the output to the PR description.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → no dependencies; can start immediately.
- **Foundational (Phase 2)** → depends on Setup; **blocks every user story**.
- **US1 / US2 / US3 / US4 (Phases 3–6)** → all depend on Foundational. After Foundational they can proceed in parallel by separate developers; sequentially by priority on a single-developer track.
- **Polish (Phase 7)** → depends on the user stories you intend to ship.

### User Story Dependencies

- **US1 (Sign-in)** depends only on Foundational. No other story depends on it for compilation, but US2/US4 are functionally meaningless without it (you cannot reach the admin panel or have history without identity). Ship US1 first.
- **US2 (Admin panel)** depends on Foundational + US1 functionally (the admin gate needs sessions). All US2 tasks are independently testable using a seeded owner session, so test-side parallelism is safe.
- **US3 (Premium redesign)** depends only on Foundational (which built the design system) and on the existence of the surfaces it migrates. US3 can proceed in parallel with US1/US2 once Foundational is done — both story owners pull from the same primitives.
- **US4 (User history)** depends on Foundational + US1. US4 does not depend on US2 or US3.

### Within Each User Story

- Tests (T045–T048, T060–T065, T085–T088, T096–T098) are written first and must FAIL before implementation begins.
- Models / migrations (in Foundational) before services (in story phases).
- Services before routes; routes before SPA pages.
- Each story finishes with its checkpoint validation before moving on.

### Parallel Opportunities

- All Phase 1 tasks marked [P] can run in parallel (T002–T007).
- Phase 2 splits into four independent streams that run in parallel after T021–T023 (DB migration) lands: shared schemas (T009–T016), design tokens (T017–T020), server crypto/cache/audit (T024–T026), auth middleware (T027–T031), web design system bootstrap (T032–T039), and foundational tests (T040–T044).
- Within US2, server adapters (T066–T071) and web admin pages (T077–T084) can run in parallel by different developers.
- US3 surface migrations (T089–T095) can run in parallel — each touches a separate file.

---

## Parallel Example: Foundational Phase

```bash
# Stream A — shared zod schemas (one developer)
T009 packages/shared/src/auth/telegram.ts
T010 packages/shared/src/auth/session.ts
T011 packages/shared/src/admin/ai-models.ts
T012 packages/shared/src/admin/users.ts
T013 packages/shared/src/admin/site-settings.ts
T014 packages/shared/src/admin/audit.ts

# Stream B — design tokens (parallel developer)
T017 packages/shared/src/design-tokens/colors.ts
T018 packages/shared/src/design-tokens/typography.ts
T019 packages/shared/src/design-tokens/spacing.ts (+radii.ts, motion.ts)
T020 packages/shared/src/design-tokens/index.ts

# Stream C — server crypto + cache + audit (parallel developer)
T024 apps/server/src/admin/secret-cipher.ts
T025 apps/server/src/admin/settings-cache.ts
T026 apps/server/src/admin/audit-log.ts

# Stream D — auth middleware (parallel developer)
T027 apps/server/src/auth/cookie.ts
T028 apps/server/src/auth/principal.ts
T029 apps/server/src/http/middleware/require-session.ts
T030 apps/server/src/http/middleware/require-owner.ts
T031 apps/server/src/http/middleware/require-csrf.ts

# Stream E — web primitives (parallel developer)
T035 Button, T036 Input/Field, T037 Card/Badge/Avatar, T038 Dialog/Toast, T039 Tabs/Menu/Tooltip
```

---

## Implementation Strategy

### MVP Scope

The functional MVP is **US1 + US2 + US3** together — all three are P1 and the platform does not deliver the requested experience without all three:

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 (sign-in) → 4. Phase 4 US2 (admin) → 5. Phase 5 US3 (redesign rollout).

**STOP and VALIDATE**: At this point, run `pnpm test:design-audit`, walk the quickstart, sign in as the +218 091 008 9975 owner, register one AI model, suspend a test user, change `public_lookups_enabled`, and observe an audit-log entry per action. Demo and ship.

### Incremental Delivery

1. Setup + Foundational → foundation ready (no user-visible change yet).
2. Add US1 → Telegram sign-in works; no admin or redesign yet → optional internal demo.
3. Add US2 → admin panel operates against the still-v1-styled public surfaces → internal demo.
4. Add US3 → redesign sweeps every surface → external launch (MVP).
5. Add US4 → history view becomes available → second public release.

### Parallel Team Strategy (3 developers post-Foundational)

- Developer A: US1 (auth wiring, session store, sign-in surface) → then US4 once US1 lands.
- Developer B: US2 (admin server + adapters + audit pipeline).
- Developer C: US3 (design system rollout + design audit harness) — works against unfinished US1/US2 surfaces using stub data.

The three streams converge at Polish (Phase 7).

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps task to a specific user story for traceability and independent testing.
- Each user story should be independently completable and testable using the Independent Test for that story.
- Tests in test phases MUST be written and observed to FAIL before the implementation tasks in the same phase are started (TDD discipline per research R-16).
- Every admin write goes through `auditLog.append()` in the same transaction (G9). A new admin endpoint that bypasses the choke-point fails T063.
- No `001` column is altered, dropped, or renamed (G10). Verified by T107.
- AI model credentials are write-only from the admin UI's perspective (G8). Verified by T060.
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence, and never bypass `auditLog.append()` for admin mutations.

# Implementation Plan: Premium Redesign, Telegram Login, and Owner Admin Panel

**Branch**: `002-admin-panel-telegram-auth` | **Date**: 2026-06-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-admin-panel-telegram-auth/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Layer Telegram-only authentication, an owner-only admin panel, and a single coherent premium visual system on top of the v1 Digital Footprint Analyzer (`001-digital-footprint-analyzer`) without regressing the anonymous-lookup baseline.

Technical approach: keep the existing pnpm workspace shape (`apps/web`, `apps/server`, `packages/shared`); add identity, sessions, role-based access, AI model registry, site settings, and audit log as additive Drizzle tables in the same Neon Postgres database. Authenticate users via the **Telegram Login Widget** with HMAC-SHA256 server-side payload verification, mint an opaque server-issued session token in an `HttpOnly Secure SameSite=Lax` cookie, and resolve the owner role from an `OWNER_TELEGRAM_ID` operator env var (the Telegram numeric ID belonging to the +218 091 008 9975 account). The admin panel ships as a guarded route subtree (`/admin/*`) inside the same Vite SPA, protected by a server-side admin gate that returns the designed `unauthorized` shape for non-owners. Replace the v1 ad-hoc styling with a single tokenised design system (`packages/shared/design-tokens`) consumed by Tailwind 3.4 + a small set of RTL-first primitives; the redesign is rolled out across every public surface (home, sign-in, in-progress, result, share, expired, error, history) and across the new admin surfaces in one pass. AI model entries are stored as Drizzle rows whose credentials are encrypted-at-rest with a server-held key (`MODEL_SECRET_KEY`) and consumed through a unified `AiModelClient` that subsumes the v1 NVIDIA-NIM path and adds OpenAI-compatible, Anthropic, and Google adapters; the existing `aggregated_results.enrichment_*` slot is reused so v1's data path is unchanged. Site settings live in a single key/value table with strongly typed accessors and a 30-second in-process cache so propagation hits SC-005 without adding Redis. Every admin write goes through one `auditLog.append()` choke-point, so SC-009 (100% audit coverage) is structural, not best-effort.

## Technical Context

**Language/Version**: TypeScript 5.6+, Node.js 22 LTS (server and tooling). React 19 on the client. Inherited from feature `001`.

**Primary Dependencies** (additive on top of `001`):
- Frontend: `@radix-ui/react-*` primitives (Dialog, DropdownMenu, Tabs, Tooltip, Toast) wrapped in our own RTL-first components; `class-variance-authority` + `tailwind-merge` for component variants; `react-hook-form` + `zod` resolver for admin forms; `@tanstack/react-table` v8 for the admin user list; existing `framer-motion` continues to handle state-meaningful motion.
- Backend: `cookie` + `cookie-signature` (or built-in `crypto.timingSafeEqual` over our own opaque session ids — see R-02), `bcrypt`-grade is **not** needed (no passwords). For payload verification we use Node's built-in `crypto` (`createHmac('sha256', sha256(BOT_TOKEN))`). Symmetric encryption of model credentials uses `crypto.subtle.encrypt`/`createCipheriv` with AES-256-GCM and a 32-byte `MODEL_SECRET_KEY`.
- Shared: extend `packages/shared` with `auth/`, `admin/`, and `design-tokens/` subtrees. Existing `zod` schemas continue to be the single source of truth.

**Storage**: Same PostgreSQL on Neon (prod) / Docker (dev) database as `001`. Six new tables (`users`, `sessions`, `ai_model_entries`, `site_settings`, `audit_log_entries`, `user_lookup_associations`) and one column on `lookups` (`owner_user_id uuid NULL REFERENCES users(id)`). All migrations are forward-only, additive, and zero-downtime — no v1 column is dropped or renamed.

**Testing**:
- Unit + integration: Vitest. New test packs: Telegram payload HMAC verifier, session lifecycle, admin-gate middleware, encrypted-credential round-trip, audit-log append-on-write invariant.
- Contract: every new REST endpoint and the new Socket.IO `session.invalidated` event has a `zod` schema in `packages/shared` and is asserted in both client and server tests.
- E2E: Playwright. Existing v1 flows are re-run against the redesigned UI as regression coverage (FR-028). New flows: Telegram sign-in (against a stubbed Telegram widget that returns a deterministic, HMAC-signed payload using a dev `BOT_TOKEN`), owner reaches `/admin`, non-owner is denied at `/admin`, suspending a logged-in user terminates their session in the other tab via `session.invalidated`.

**Target Platform**: Same as `001` — modern evergreen browsers; Linux x64 container on Render; Neon Postgres.

**Project Type**: Web application — the same single pnpm workspace (`apps/web`, `apps/server`, `packages/shared`) introduced in `001`. No new deployable; the admin panel is a route subtree, not a separate app.

**Performance Goals**:
- Telegram sign-in → usable session in ≤ 3 s p90 (matches SC-001).
- Admin user-list interactions ≤ 1 s on 4G p90 (matches SC-008).
- Site-setting change visible on the public site ≤ 30 s p95 (matches SC-005).
- Cold container start unchanged from `001` (≤ 5 s).

**Constraints**:
- Telegram is the **only** user-facing authentication method — no other provider visible in the UI (FR-001).
- Owner cannot be self-claimed; owner role is controlled by operator env var (FR-009 / FR-009a).
- Public lookups remain available to unauthenticated visitors by default; the owner can disable via the `public_lookups_enabled` site setting (FR-007 / FR-021).
- AI model credentials are write-only from the admin UI, encrypted at rest, redacted in logs, never returned in any public response (FR-014, FR-030).
- Single coherent redesign across every public + admin surface (FR-024) — no surface left in v1 styling.
- WCAG 2.1 AA baseline, RTL-first, including the admin panel (FR-027).
- All v1 capabilities preserved (FR-028) — anonymous lookup intake, progress streaming, share link, retention, and rate limiting continue to work as in `001`.

**Scale/Scope**:
- Initial target: ≤ 1k concurrent visitors (unchanged from `001`); ≤ 5 k registered users; ≤ 10 AI model entries; ≤ 20 distinct site settings; ≤ 100 admin actions/day → audit-log table sized for 5+ years at that rate without index pressure.
- Surfaces: ~12 public surfaces (home, sign-in, sign-in-error, in-progress, result, share, expired, error, history, history-empty, suspended, not-authorised) + 3 admin sections (AI Models, Users, Site Settings) + audit-log read view = 16 redesigned surfaces total, all in the inventory for the SC-002 / SC-006 audit.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution at `.specify/memory/constitution.md` is still the unmodified template (placeholder principles, no ratification). Like feature `001`, this plan adopts a set of self-imposed gates consistent with the spec's success criteria; they extend (not replace) the gates from `001` and can be promoted into the constitution later via `/speckit-constitution`.

Inherited from `001` (still in force):

- **G1 — Arabic-first / RTL by default**.
- **G2 — Public-data only, no PII storage in lookups** — preserved: identity is now stored, but only Telegram-public data (numeric id, display name, avatar URL).
- **G3 — Push-based progress** — preserved.
- **G4 — AI-ready, AI-not-required** — strengthened: this feature lights up the slot reserved by `001` without changing its shape.
- **G5 — One-command local dev parity** — preserved.
- **G6 — Shared, typed contracts** — preserved.

New for this feature:

- **G7 — Telegram-only auth, owner via operator config**: no other auth provider may be wired into UI or routes; the owner role is granted only when the verified Telegram numeric id matches `OWNER_TELEGRAM_ID`. Verified by the auth contract tests and by an admin-gate test that asserts a non-owner receives the `unauthorized` shape on every admin route.
- **G8 — Secrets are write-only from the admin UI**: AI model credentials are encrypted at rest, never returned in any GET response (the field is replaced by `{ present: true, lastFour: '…' }` for display only), redacted in logs, and excluded from audit-log `before/after` values.
- **G9 — Every admin write produces an audit log entry**: enforced by routing every admin mutation through a single `auditLog.append()` choke-point in the service layer; the contract tests assert the table grew by exactly one row per admin write, including failures that make a partial change.
- **G10 — Additive migrations only**: this feature must not drop, rename, or repurpose any column from `001`. New columns are nullable or have safe defaults so a roll-back of feature `002` leaves `001` operable.
- **G11 — One design system, every surface**: the redesigned token set and primitive components are the single source of truth for visual treatment. A surface either consumes them or is failing FR-024.

Re-evaluated after Phase 1 design (data-model.md, contracts/, quickstart.md): still pass — see the Post-Design Constitution Re-check at the end of this plan.

## Project Structure

### Documentation (this feature)

```text
specs/002-admin-panel-telegram-auth/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── auth-admin-api.openapi.yaml
│   └── socket-events.md
├── checklists/
│   └── requirements.md  # produced by /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks command — NOT created by /speckit-plan)
```

### Source Code (repository root)

Only the additive paths are listed; everything from `001`'s tree continues to exist unchanged.

```text
basmatlibya/
├── packages/
│   └── shared/
│       └── src/
│           ├── auth/
│           │   ├── telegram.ts          # zod schemas: TelegramAuthPayload, SessionPrincipal
│           │   └── session.ts           # cookie name, lifetime, principal shape
│           ├── admin/
│           │   ├── ai-models.ts         # zod: AiModelEntry create/update/list, redacted-display shape
│           │   ├── users.ts             # zod: AdminUser list/filter, suspend/unsuspend
│           │   ├── site-settings.ts     # zod: SiteSettingKey union, value types, defaults
│           │   └── audit.ts             # zod: AuditLogEntry list/filter
│           ├── design-tokens/
│           │   ├── colors.ts            # semantic tokens (bg, fg, primary, danger, …)
│           │   ├── typography.ts        # Arabic + Latin scales, line heights tuned for ar
│           │   ├── spacing.ts           # 4-pt rhythm, RTL-aware logicals
│           │   ├── radii.ts
│           │   ├── motion.ts            # durations, easings, reduced-motion fallbacks
│           │   └── index.ts             # re-exports + Tailwind preset emitter
│           └── i18n/ar.json             # +new keys for sign-in, admin, errors, audit verbs
│
├── apps/
│   ├── server/
│   │   └── src/
│   │       ├── auth/
│   │       │   ├── telegram-verify.ts   # HMAC-SHA256 over sorted payload, bot-token-derived key
│   │       │   ├── session-store.ts     # opaque token → sessions row; revoke, prune
│   │       │   ├── cookie.ts            # HttpOnly Secure SameSite=Lax helpers
│   │       │   └── principal.ts         # request → Principal (anonymous | user | owner)
│   │       ├── http/
│   │       │   ├── routes/
│   │       │   │   ├── auth.ts          # /api/auth/telegram, /api/auth/me, /api/auth/sign-out
│   │       │   │   ├── history.ts       # /api/me/history, /api/me/history/:id (DELETE)
│   │       │   │   └── admin/
│   │       │   │       ├── ai-models.ts
│   │       │   │       ├── users.ts
│   │       │   │       ├── site-settings.ts
│   │       │   │       └── audit.ts
│   │       │   └── middleware/
│   │       │       ├── require-session.ts
│   │       │       └── require-owner.ts
│   │       ├── admin/
│   │       │   ├── audit-log.ts         # append() choke-point used by every admin service
│   │       │   ├── settings-cache.ts    # 30s in-proc cache + invalidate-on-write
│   │       │   └── secret-cipher.ts     # AES-256-GCM with MODEL_SECRET_KEY
│   │       ├── analysis/
│   │       │   └── enrichment/
│   │       │       ├── ai-model-client.ts  # unified provider adapter (OpenAI-compat, Anthropic, Google, NIM)
│   │       │       └── enrichment.ts        # consumes the active AiModelEntry; replaces v1 hard-coded NIM path
│   │       ├── db/
│   │       │   ├── schema.ts            # extended with users, sessions, ai_model_entries, site_settings, audit_log_entries, user_lookup_associations
│   │       │   └── migrations/0002_*.sql
│   │       └── realtime/
│   │           └── events.ts            # +session.invalidated server→client event
│   │
│   └── web/
│       └── src/
│           ├── design/
│           │   ├── tailwind-preset.ts   # consumes @basmat/shared/design-tokens
│           │   ├── primitives/          # Button, Input, Field, Card, Dialog, Toast, Tabs, Menu, Avatar, Badge — RTL-first, token-driven
│           │   └── motion.ts            # framer-motion variants tied to motion tokens
│           ├── routes/
│           │   ├── SignInPage.tsx       # single Telegram action, designed error/cancel states
│           │   ├── HistoryPage.tsx
│           │   ├── HistoryEmptyPage.tsx
│           │   ├── SuspendedPage.tsx    # designed suspended-state
│           │   ├── NotAuthorisedPage.tsx
│           │   └── admin/
│           │       ├── AdminLayout.tsx  # owner-only shell with side nav (AI Models / Users / Site Settings / Audit)
│           │       ├── AiModelsPage.tsx
│           │       ├── UsersPage.tsx
│           │       ├── SiteSettingsPage.tsx
│           │       └── AuditLogPage.tsx
│           ├── lib/
│           │   ├── auth.ts              # principal hook, sign-in/out helpers, telegram widget binding
│           │   ├── admin-api.ts         # typed admin client, throws on non-2xx, surfaces Arabic copy
│           │   └── socket.ts            # +handles session.invalidated → redirect to /suspended or /sign-in
│           └── styles/
│               └── globals.css          # tokens → CSS vars; RTL utilities preserved
│
└── (Dockerfile, render.yaml, docker-compose.yml unchanged in shape; env vars added — see quickstart.md)
```

**Structure Decision**: Keep the single pnpm workspace established in `001`. The admin panel is a guarded route subtree inside `apps/web`, not a separate app — splitting it would force an extra Vite build, an extra origin, an extra Render service, and a second design-token consumer for no proportionate benefit at v1 scale. Identity, admin services, and the design-token package live in `packages/shared` so the same `zod` and token sources are read by client, server, and the OpenAPI snapshot in `contracts/`. The unified `AiModelClient` replaces v1's hard-coded NVIDIA path, so the v1 enrichment slot in `aggregated_results` is now driven by the active row in `ai_model_entries` — the data shape of the slot is unchanged, satisfying G4 and FR-028.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

No constitution violations to justify. Three deliberate complexities are added on top of `001`'s structure; each is justified below:

| Choice | Why Needed | Simpler Alternative Rejected Because |
|--------|------------|--------------------------------------|
| `packages/shared/design-tokens` | FR-024 demands one coherent visual system across public + admin; G11 requires a single source of truth that both `apps/web` Tailwind and `apps/server` (e.g. system emails, error pages) can read. | Inlining tokens inside `apps/web` only — rejected: any future server-rendered surface (e.g. a 500 page) drifts and FR-024 silently breaks. |
| Server-issued opaque session cookie + `sessions` table | G8 (server-side revocation on suspension), FR-018 ("suspension takes effect immediately across all open sessions"). | Stateless JWT — rejected: cannot be revoked mid-lifetime without an extra blacklist table, which is the same complexity, with worse semantics. |
| AES-256-GCM at-rest encryption of model credentials with `MODEL_SECRET_KEY` | FR-014 + G8: credentials must never be returned in plaintext, even in admin GETs, and must be redacted in logs and audit entries. | Plaintext column reachable only via app code — rejected: leaks via DB backups, replication, or a single SELECT mistake; G8 would not hold. |

## Post-Design Constitution Re-check

After Phase 1 design (`data-model.md`, `contracts/`, `quickstart.md`):

- **G1 (RTL-first)** — preserved: redesigned tokens emit logical-property utilities; admin primitives are RTL-first and pass the existing Playwright RTL suite extended to admin surfaces.
- **G2 (no PII beyond public Telegram data)** — preserved: only `telegram_id`, `display_name`, `avatar_url` are stored on `users`; phone numbers are never read or stored (the +218 091 008 9975 number is operator-side only — see R-03 / FR-009a).
- **G3 (push-based progress)** — preserved; one new server→client event (`session.invalidated`) is additive and never replaces a poll.
- **G4 (AI-ready)** — fulfilled: the `aggregated_results.enrichment_*` slot reserved by `001` is now driven by the active `ai_model_entries` row, with no schema change to `001`'s table.
- **G5 (one-command local dev)** — preserved: `quickstart.md` documents the additional env vars (`TELEGRAM_BOT_TOKEN`, `OWNER_TELEGRAM_ID`, `MODEL_SECRET_KEY`) and a `scripts/bootstrap-owner.ts` helper that resolves the +218 091 008 9975 account's Telegram numeric id via the bot once at setup.
- **G6 (shared typed contracts)** — preserved: every new REST endpoint and the new Socket.IO event live in `packages/shared`.
- **G7 (Telegram-only, owner via env)** — verified by `contracts/auth-admin-api.openapi.yaml` (no other provider) and by the admin-gate tests.
- **G8 (write-only secrets)** — verified by `data-model.md` (encrypted column, redacted-display shape in contracts) and audit-log redaction tests.
- **G9 (audit on every admin write)** — verified by the single `auditLog.append()` choke-point in the service layer and by the SC-009 contract test.
- **G10 (additive migrations only)** — verified by the migration plan in `data-model.md`: zero altered columns from `001`, all new columns nullable/defaulted.
- **G11 (one design system, every surface)** — verified by the redesigned-surface inventory in `quickstart.md` and the Playwright design audit (16 surfaces, all consume `@basmat/shared/design-tokens`).

Gate: PASS.

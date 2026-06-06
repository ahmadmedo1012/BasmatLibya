# بصمة ليبيا · BasmatLibya

Arabic-first, full-RTL web platform that analyzes a person's public
digital identity footprint and returns a unified, polished result.

## Quick start (local dev)

```bash
pnpm install
pnpm db:up           # docker compose up postgres
pnpm dev            # web on :5173, server on :3001
```

Open http://localhost:5173.

## Stack

- **Frontend** (`apps/web`): React 19, Vite 6, Tailwind 3 (RTL plugin), wouter, framer-motion, TanStack Query.
- **Server** (`apps/server`): Node 20, Express 5, Drizzle ORM, Postgres (Neon in prod), Socket.IO.
- **Shared** (`packages/shared`): Zod schemas, types, Arabic copy (i18nAr), design tokens.
- **Deploy**: Docker → [Render](https://render.com) (Web Service, free plan).

The full stack is **verified by tests** — see the verification table below.

## Build

```bash
pnpm build
```

Outputs:
- `apps/web/dist/` — static SPA bundle
- `apps/server/dist/` — compiled server (run with `pnpm --filter @basmat/server start`)

## Production deployment

The service deploys automatically to Render on every push to `main`
via `render.yaml` at the repo root. Render:

1. Builds the Docker image (`Dockerfile` at repo root).
2. Runs `preDeployCommand: pnpm --filter @basmat/server db:migrate` —
   applies migrations 0000–0004 to the DB. (T048 pins this command.)
3. Starts the container. The boot guard at `apps/server/src/index.ts:94`
   calls `assertSchemaVersion()` and refuses to serve traffic on a
   code/DB mismatch.

The full operator walkthrough is in
[`specs/005-audit-repair-core/quickstart.md`](specs/005-audit-repair-core/quickstart.md).
Every step is classified as "automated by tests" or "manual smoke only".

## Project layout

```
apps/
  web/        # React SPA (Vite)
  server/     # Express API + Socket.IO + Drizzle migrations
packages/
  shared/     # Zod schemas, types, Arabic copy, design tokens
specs/
  005-audit-repair-core/   # The audit + repair spec that produced this codebase
```

## Verification (every claim in this README is tested)

| Claim | Test |
|-------|------|
| The stack is React 19 + Vite 6 + Tailwind 3 + wouter + framer-motion | `apps/web/package.json` (T003 typecheck) |
| The server is Node 20 + Express 5 + Drizzle + Postgres + Socket.IO | `apps/server/package.json` (T003 typecheck) |
| The deploy target is Render (Docker) | `render.yaml` (T047 reads the file) |
| The preDeployCommand is `pnpm --filter @basmat/server db:migrate` | `apps/server/tests/integration/migrate-deploy.test.ts` (T048) |
| The boot guard refuses to serve on a code/DB mismatch | `apps/server/src/index.ts:94` (T046) |
| Migrations 0000–0004 apply cleanly and idempotently | `apps/server/tests/integration/migrate-deploy.test.ts` (T048) |
| The /api/healthz endpoint reports the DB schema version | `apps/server/tests/contract/health.test.ts` (T044) |
| The /api/auth/telegram endpoint issues a session cookie with HttpOnly + Secure + SameSite=Lax | `apps/server/tests/contract/auth-me.test.ts` (T018), `apps/server/src/auth/cookie-policy.ts` (T010) |
| Anonymous visitors get a 3-lookup free trial; signed-in users bypass | `apps/server/tests/integration/lookups-signed-in.test.ts` (T035) |
| Two POSTs with the same identifier within 5 min return the same lookup id | `apps/server/tests/integration/lookups-coalesce.test.ts` (T036) |
| Every non-2xx response carries a non-empty Arabic `messageAr` | `apps/server/tests/contract/error-codes.test.ts` (T045) |
| No orphan imports in the source tree | `apps/server/tests/hygiene/imports.test.ts` (T016) |
| Every env var in `env.ts` is documented in `.env.example` (and vice versa) | `apps/server/tests/hygiene/env-diff.test.ts` (T053) |
| `pnpm typecheck` is green across all 3 packages | `pnpm typecheck` (T003) |

## Manual smoke recipes

Some scenarios need a real browser + real Telegram account + real DB.
Those are documented as recipes, not tests:

- [`US1-smoke-recipe.md`](specs/005-audit-repair-core/US1-smoke-recipe.md) — 6 sign-in scenarios (clean profile, refresh, close-reopen, two-tab sign-out, redirect with popups blocked, suspended user).
- [`US2-smoke-recipe.md`](specs/005-audit-repair-core/US2-smoke-recipe.md) — 7 search scenarios (anonymous run, trial exhaustion, signed-in bypass, error surface, deep-link, coalesce).
- [`US3-deploy-smoke-recipe.md`](specs/005-audit-repair-core/US3-deploy-smoke-recipe.md) — 4 deploy scenarios (clean deploy, cookie posture, owner sign-in, schema-mismatch refusal).

## Design principles

**Arabic-first & RTL by default** — every page ships `dir="rtl"`, `lang="ar"`, and the Tailwind RTL plugin is enabled globally. All UI copy is authored in Arabic (`packages/shared/src/i18n/ar.ts`).

**No raw English in the UI** — error responses carry `messageAr` (Arabic copy) the client renders directly. The English `code` field is for diagnostics only.

**No mocks in production** — the v1 dev experience is real end-to-end: a real Postgres, real Telegram bot, real analysis pipeline. The `SOURCE_PROVIDERS=mock` env var swaps the data source for the test deploy; it is never the default in production.

**Constitution v1.0.0** is the project's north star. Amendment `006-constitution-amendment-001-telegram-auth` documents the scoped first-party sign-in exception that enables the auth half of the MVP.

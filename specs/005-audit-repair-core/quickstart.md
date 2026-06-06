# Quickstart: Deploy and verify Basmat Libya

This is the operator walkthrough for shipping a clean deploy and
verifying the app is healthy end-to-end. Every step is classified as
either **automated by tests** (with the test ID) or **manual smoke
only** (with a link to the recipe). If a step is not classified, it
is a documentation bug.

**Time to healthy**: 5–8 minutes (Render build + migrate + boot).

## 1. Preconditions (manual smoke only)

- A Render account with a Web Service created (plan: `free` is fine).
- A Postgres database (Neon or Render's managed Postgres).
- A Telegram bot (`@BotFather` → `/newbot`).
- The `OWNER_TELEGRAM_ID` of the operator's Telegram account (get it
  from `@userinfobot` or similar).
- A 32-byte secret for `MODEL_SECRET_KEY` (use `openssl rand -base64 32`).

**Recipe**: see the operator onboarding runbook (out of scope for this
spec; tracked separately).

## 2. Set env vars (manual smoke only)

The full set of env vars is in `render.yaml` at the repo root. Render
reads this file on deploy. For a manual dashboard setup, the same
values must be set in the Render service's Environment tab.

Required:
- `DATABASE_URL` — Postgres connection string (sync: false = manual)
- `TELEGRAM_BOT_TOKEN` — from `@BotFather` (sync: false = manual)
- `TELEGRAM_BOT_USERNAME` — the bot's username without `@` (sync: false = manual)
- `MODEL_SECRET_KEY` — 32 bytes base64 (sync: false = manual)
- `OWNER_TELEGRAM_ID` — integer, the operator's telegram id (sync: false = manual)

Optional (with defaults in `apps/server/src/env.ts`):
- `NODE_ENV` — defaults to `production` in render.yaml
- `PORT` — defaults to `3001` in render.yaml
- `PUBLIC_BASE_URL` — defaults to `https://basmatly.onrender.com`
  (must match the Render service's Custom Domain; see `render.yaml` T028 comment)
- `SOURCE_PROVIDERS` — `mock` for the test deploy, real provider keys later
- `ENRICHMENT_ENABLED` — `false` for the test deploy
- `RATE_LIMIT_MAX_PER_WINDOW` — `50` (per-IP cap)

**Recipe**: render.yaml carries all 11 env vars in the `envVars:` block.
T047 verifies the YAML; setting them in the Render dashboard is
operator-driven.

## 3. Deploy (automated by tests: T047, T048)

- Push the repo's `main` branch (Render auto-deploys).
- Render runs `preDeployCommand: pnpm --filter @basmat/server db:migrate`
  first (T048 pins this exact command).
- The migration applies 0000–0004 to the DB. The 0004 migration
  upserts the `schema_version` meta row (idempotent; safe to re-run).
- Render builds the Docker image and starts the container.
- T047 verifies all required env vars are present in render.yaml.
- T048 verifies the preDeployCommand string and the 0004 migration file.

## 4. Verify health (automated by tests: T044, T046)

```bash
curl -fsS https://<staging>/api/healthz
```

**Expect**:
```json
{
  "status": "ok",
  "db": "ok",
  "version": "0.1.0",
  "dbSchemaVersion": "1"
}
```

If `dbSchemaVersion` is `"unknown"`, the 0004 migration did not run
(re-run the deploy command manually). If `db` is `"down"`, the
`DATABASE_URL` is wrong or the DB is unreachable.

T044 pins the schema. T046 wires the boot guard.

## 5. Sign in as owner (automated by tests: T049)

1. Open `https://<staging>/` in a browser.
2. Click the Telegram widget.
3. Sign in with the account whose `telegram_id` matches `OWNER_TELEGRAM_ID`.
4. **Expect**: 200 from `POST /api/auth/telegram`. The `principal.role` in
   the response body is `"owner"`.
5. In the DB: `SELECT id, role FROM users WHERE telegram_id = <OWNER_TELEGRAM_ID>;`
   **Expect**: `role = 'owner'`.

T049 pins the elevation contract (an existing `user` is bumped to
`owner` on the next sign-in when their id matches the env var). The
live verification is **manual smoke only** — the test pins the code
path, the operator confirms with a real Telegram account.

## 6. Run an anonymous search (manual smoke only)

1. Open a private/incognito window.
2. Enter a real public identifier (e.g. a Twitter handle) and submit.
3. **Expect**: progress page advances category-by-category within 30 s.
   Result page renders findings + AI enrichment (`skipped` in v1).

The US2 manual smoke recipe (`US2-smoke-recipe.md`) covers seven
scenarios in detail (anonymous run, trial exhaustion, signed-in
bypass, error surface, deep-link, coalesce).

T030–T042 (the US2 test surface) pin the contract; the live
verification is operator-driven.

## 7. Verify cookie posture (manual smoke only)

See `US3-deploy-smoke-recipe.md` scenario 2 (FR-004, FR-031):

- `bsl_session` cookie is `HttpOnly; Secure; SameSite=Lax; Path=/` with
  a real `Expires` ~30 days out.
- Sign-out clears the cookie immediately.
- The cookie is set on `POST /api/auth/telegram` and honoured on
  `GET /api/auth/me`.

T010 (T004 comment in render.yaml), T012 (cookie policy helper), and
T050 (this recipe) cover the contract.

## 8. Verify cross-cutting (automated by tests: T002, T003, T004, T005, T016, T017)

- T002: no orphan CI workflows
- T003: typecheck green
- T004: render.yaml is the single deploy target
- T005: env vars are documented and used
- T016: no orphan imports
- T017: `/api/healthz` returns 503 with `db: "down"` when the DB is
  unreachable (fail-loud contract)

## Summary of automation

| Step | Classification | Reference |
|------|----------------|-----------|
| 1. Preconditions | manual smoke | runbook |
| 2. Set env vars | manual smoke | render.yaml |
| 3. Deploy | automated | T047, T048 |
| 4. Verify health | automated (schema) + manual (curl) | T044, T046 |
| 5. Sign in as owner | automated (elevation path) + manual (live) | T049 |
| 6. Run anonymous search | manual smoke | US2-smoke-recipe.md |
| 7. Verify cookie posture | manual smoke | US3-deploy-smoke-recipe.md |
| 8. Verify cross-cutting | automated | T002, T003, T004, T005, T016, T017 |

Every step is classified. No step is left unclassified.

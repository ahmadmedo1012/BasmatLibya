# Quickstart — Feature 002: Telegram Login + Owner Admin Panel + Premium Redesign

**Plan**: [plan.md](./plan.md) · **Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md) · **Data model**: [data-model.md](./data-model.md) · **Contracts**: [contracts/](./contracts/) · **Date**: 2026-06-04

This is the developer-facing setup for the additions in feature `002`. Feature `001`'s quickstart still applies for the base stack — read it first if you have not yet brought the v1 platform up. This document only adds what is new.

---

## Prerequisites (additive on top of `001`)

- A Telegram bot token. Create it once via [@BotFather](https://t.me/BotFather) (`/newbot`), copy the token, and **enable login on a domain**: in BotFather send `/setdomain` and set the local-dev domain (e.g. `localhost:5173` for dev, then your Render domain for prod).
- The Telegram numeric user id of the owner account (the holder of `+218 091 008 9975`). See **Owner bootstrap** below — there is a one-time helper script that resolves the number for you.
- A 32-byte random key for at-rest encryption of AI-model credentials.

---

## Environment variables (added to `.env.example`)

```dotenv
# --- Auth (feature 002) ---
TELEGRAM_BOT_TOKEN=        # from @BotFather
OWNER_TELEGRAM_ID=         # numeric id of the owner's Telegram account (NOT the phone number)

# --- Secret encryption (feature 002) ---
# 32 raw bytes, base64-encoded. Generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
MODEL_SECRET_KEY=
# Optional: previous key during rotation. Decrypt-only fallback.
MODEL_SECRET_KEY_PREVIOUS=

# --- Cookie / CSRF posture (feature 002) ---
# In production, the deployed origin (e.g. https://basmatlibya.example.com).
# In dev, leave empty — the server defaults to host-only on localhost.
COOKIE_DOMAIN=
```

The v1 enrichment env block (`ENRICHMENT_ENABLED`, `NVIDIA_*`) is kept for one minor release but is no longer the source of truth — the active `ai_model_entries` row replaces it. New deployments should leave `ENRICHMENT_ENABLED=false` and configure enrichment exclusively from the admin panel.

---

## Owner bootstrap (one-time)

You only need this once per environment, and only the operator runs it. It maps the +218 091 008 9975 Telegram account to a numeric id and prints what to put into `OWNER_TELEGRAM_ID`.

```bash
# 1. Set TELEGRAM_BOT_TOKEN in .env (no other 002 vars needed yet).
# 2. Open Telegram on the +218 091 008 9975 account.
# 3. Find the bot you created in @BotFather and send "/start" to it.
# 4. Run the helper:
pnpm tsx scripts/bootstrap-owner.ts
# 5. The script prints something like:
#      Resolved owner Telegram numeric id: 123456789
#    Copy that number into OWNER_TELEGRAM_ID in your .env (or Render env vars).
# 6. Restart `pnpm dev`. From now on, signing in with the +218 091 008 9975
#    account grants the owner role automatically; any other Telegram account
#    signs in as a regular user.
```

If the helper times out, make sure you sent `/start` to **the same bot** whose token is in `TELEGRAM_BOT_TOKEN`, not a different bot.

---

## First run after pulling feature 002

```bash
pnpm install                 # picks up new deps (radix, react-hook-form, react-table)
pnpm db:migrate              # applies 0002_admin_panel.sql (additive only)
pnpm dev                     # starts server (3001) + web (5173)
```

The migration is forward-only and never touches v1 columns (G10). A roll-back is `pnpm db:rollback` (drops the six new tables and the new `lookups.owner_user_id` column); v1 continues to function after roll-back.

---

## Walkthrough — sign-in and admin panel

1. Open `http://localhost:5173`. The redesigned home page shows the v1 lookup intake plus a "تسجيل الدخول عبر تليجرام" action in the header.
2. Click sign-in. The Telegram Login Widget opens. Authenticate with the +218 091 008 9975 account.
3. You return to the home page in a logged-in state — your display name and avatar appear in the header. Reload the page; the session persists.
4. Open `http://localhost:5173/admin`. Because your `telegram_id` matches `OWNER_TELEGRAM_ID`, the admin panel renders. You see four sections in the side nav: **AI Models**, **Users**, **Site Settings**, **Audit**.
5. **AI Models → Add**: pick a provider (e.g. OpenAI), enter the model id (`gpt-4o`), paste the API key, set the system prompt + temperature + max output tokens, save. The server validates the credential against the provider before persisting; if validation fails you see a designed Arabic inline error and the row is not marked active.
6. Activate the entry. The active row immediately drives lookup-result enrichment via `AiModelClient` (R-05), reusing the v1 `aggregated_results.enrichment_*` slot.
7. **Users → list**: there is one row (you, with role `owner`). Sign in from a private window with a different Telegram account; refresh the admin Users list — the new account appears with role `user`. Suspend it. The other window receives `session.invalidated` over Socket.IO and lands on `/suspended` immediately, no refresh needed.
8. **Site Settings**: toggle `public_lookups_enabled` to false. Open an incognito window — the home page now shows the designed sign-in-required state instead of the lookup intake. Toggle it back to true to restore the v1 behaviour.
9. **Audit**: every action you took above is listed with actor, target, before/after values (sensitive fields show as `{ redacted: true }`).

---

## Walkthrough — non-owner is denied

1. With a non-owner account signed in, navigate directly to `http://localhost:5173/admin`.
2. The SPA renders the designed `/not-authorised` (`غير مصرح`) state. The admin chrome never flashes.
3. From the same non-owner session, run a fetch against any `/api/admin/*` endpoint. The server responds `403 { code: 'unauthorized', messageAr: '…' }`. No admin data leaks into the response body.

---

## Tests

```bash
pnpm test                                  # all packages
pnpm --filter @basmat/server test:integration   # supertest + testcontainers
pnpm --filter @basmat/web test:e2e         # Playwright; uses a stubbed Telegram payload
```

The Playwright E2E suite uses `TEST_BOT_TOKEN` (set in CI and `apps/web/.env.test`) to hand-sign deterministic payloads — the real Telegram widget is not contacted in tests.

---

## Redesign audit (FR-024 / SC-006)

Run the design audit once before opening a PR:

```bash
pnpm --filter @basmat/web test:design-audit
```

This walks the 16 redesigned surfaces (`home`, `sign-in`, `sign-in-error`, `in-progress`, `result`, `share`, `expired`, `error`, `history`, `history-empty`, `suspended`, `not-authorised`, `admin/ai-models`, `admin/users`, `admin/site-settings`, `admin/audit`) and asserts:

- `<html dir="rtl" lang="ar">`
- The root layout carries `data-design-system="bsl-002"` (cheap structural marker).
- All visible text in chrome is Arabic (no leaked English).
- No horizontal scroll at 320 px viewport width.
- `axe-playwright` reports zero violations.

Failures here block the PR.

---

## Operational notes

- **Rotating `MODEL_SECRET_KEY`**: set the new key in `MODEL_SECRET_KEY` and the previous key in `MODEL_SECRET_KEY_PREVIOUS`, then run `pnpm tsx scripts/rotate-model-secret-key.ts`. The script re-encrypts every row with the new key and clears `MODEL_SECRET_KEY_PREVIOUS` requirement on the next deploy.
- **Rotating `TELEGRAM_BOT_TOKEN`**: BotFather → `/revoke` → set the new token in env → redeploy. All future Login Widget HMACs are verified with the new key. Existing sessions are unaffected (sessions are server-issued opaque tokens, independent of the bot token).
- **Changing the owner**: stop the service, update `OWNER_TELEGRAM_ID`, restart. The previous owner becomes a regular user on their next request; the new owner becomes the owner on their next sign-in. There is no in-app handover (the spec specifies a single owner, designated via operator config).
- **Production cookie posture**: `bsl_session` is `HttpOnly; Secure; SameSite=Lax`. `Secure` is automatically gated on `NODE_ENV==='production'` so localhost works without TLS.
- **Render env vars**: add `TELEGRAM_BOT_TOKEN`, `OWNER_TELEGRAM_ID`, `MODEL_SECRET_KEY`, optional `MODEL_SECRET_KEY_PREVIOUS`, optional `COOKIE_DOMAIN` to the same Render service that already serves feature `001`. No new Render service is required (the admin panel ships inside the same SPA bundle).

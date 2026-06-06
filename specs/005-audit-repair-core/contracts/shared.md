# Contract — Shared (cross-cutting)

**Date**: 2026-06-06
**Spec**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Data model**: [data-model.md](../data-model.md)

This contract documents the cross-cutting shapes that the auth,
lookups, and realtime contracts all depend on: the error envelope,
identifier validation, the healthcheck, the env schema, and the
cookie posture.

## Error envelope

`ErrorResponse` (in `packages/shared/src/schemas/errors.ts`):

```ts
{
  code: ErrorCode
  messageAr: string
  retryAfterSeconds?: number
  details?: Record<string, unknown>
}
```

`code` is the closed enum:

| Code | Where it appears | HTTP status |
|------|------------------|-------------|
| `identifier_invalid` | `POST /api/lookups` | 400 |
| `identifier_too_short` | `POST /api/lookups` | 400 |
| `identifier_too_long` | `POST /api/lookups` | 400 |
| `rate_limited` | `POST /api/lookups` | 429 |
| `lookup_in_progress` | `GET /api/lookups/:id` | 409 |
| `lookup_not_found` | `GET /api/lookups/:id`, `subscribe.lookup` | 404 |
| `free_trial_exhausted` | `POST /api/lookups` | 402 |
| `not_authenticated` | `GET /api/auth/me` | 401 |
| `unauthorized` | owner-only routes | 403 |
| `csrf_required` | mutations with stale CSRF | 403 |
| `hmac_invalid` | `POST /api/auth/telegram` | 401 |
| `auth_date_too_old` | `POST /api/auth/telegram` | 401 |
| `bot_unavailable` | `POST /api/auth/telegram` | 503 |
| `suspended_user` | `POST /api/auth/telegram` | 403 |
| `validation_failed` | admin writes | 400 |
| `last_owner_protected` | admin owner demote | 409 |
| `dependent_entries` | admin user delete | 409 |
| `active_model_protected` | admin model delete | 409 |
| `not_found` | admin reads | 404 |

`messageAr` is the human-readable Arabic string (the i18n key in
`packages/shared/src/i18n/ar.ts` is the source of truth). The
client's `i18nAr.ar.errors[code]` map covers every entry in the
enum; the fallback is `i18nAr.ar.errors.generic`. This is the
"every user-facing error path renders an Arabic message" contract
(SC-008).

## Identifier validation

```ts
IdentifierValueSchema = z.string().trim().min(2).max(80)
```

`IdentifierTypeSchema = z.enum(['name','username','email','phone'])`.

Detection is server-side (`detectIdentifierType` in
`packages/shared/src/identifier.ts`): the same logic runs on both
the request and the response (the response `identifierType` is the
authoritative result). The client must not assume a type from the
raw input.

## Healthcheck: `HealthResponse` (extended in this repair)

```ts
{
  status: 'ok' | 'degraded'
  db: 'ok' | 'down'
  version: string            // semver of the running image (from package.json)
  dbSchemaVersion: string    // NEW: the schema version the running DB is at
}
```

Returned by `GET /api/healthz`:
- HTTP 200 when `db === 'ok'`.
- HTTP 503 when `db === 'down'` (so Render's healthcheck probe
  takes the instance out of rotation — FR-022 / SC-010).
- The body is still JSON in both cases.

`dbSchemaVersion` is read from the `site_settings` row with key
`'schema_version'`. If the row is missing, the field is
`'unknown'` (and `startServer()` refuses to serve traffic in that
case — the running code is at a known version, so the row must
exist).

## Environment schema

`apps/server/src/env.ts` is a zod schema. The following fields are
read by the running code:

| Field | Required? | Default | Notes |
|-------|-----------|---------|-------|
| `NODE_ENV` | no | `'development'` | drives `Secure` cookie attribute |
| `PORT` | no | `3001` | |
| `DATABASE_URL` | **YES** | — | zod `.url()`; no default |
| `SOURCE_PROVIDERS` | no | `'mock'` | `'live'` requires real provider creds |
| `PUBLIC_BASE_URL` | no | `http://localhost:5173` | CORS origin + canonical share links |
| `RATE_LIMIT_WINDOW_MINUTES` | no | `10` | |
| `RATE_LIMIT_MAX_PER_WINDOW` | no | `5` | |
| `RETENTION_DAYS` | no | `30` | applied to `lookups.expiresAt` |
| `TELEGRAM_BOT_TOKEN` | conditionally required | `''` | required for sign-in to work |
| `TELEGRAM_BOT_USERNAME` | conditionally required | `''` | required for the widget to render |
| `OWNER_TELEGRAM_ID` | no | `null` | numeric string; the env-side elevation trigger |
| `MODEL_SECRET_KEY` | no | `''` | required for the admin AI model features |
| `MODEL_SECRET_KEY_PREVIOUS` | no | `''` | decrypt-only fallback during rotation |
| `COOKIE_DOMAIN` | no | `''` | host-only when empty |
| `NVIDIA_*` | no | (see schema) | AI enrichment chain (no-op in v1) |
| `PHONEINFOGA_URL` | no | `''` | disables the provider gracefully when empty |
| `NUMVERIFY_API_KEY` / `SERPAPI_KEY` | no | `''` | disables the providers when empty |
| `ENRICHMENT_ENABLED` | no | `false` | |
| `ENRICHMENT_FAST` | no | `true` | |

**Repair change**: `loadEnv()` is updated so that a missing
`TELEGRAM_BOT_TOKEN` *or* `TELEGRAM_BOT_USERNAME` is surfaced as
a `503 bot_unavailable` at the *first* sign-in attempt (which it
already is) but the *startup* error message now lists each missing
required-or-required-for-sign-in variable by name (FR-028, SC-006).
The list of *required* fields at the schema level is unchanged
(`DATABASE_URL` is the only field with no default); the
*required-to-serve-sign-in* list is widened from the current
`logger.warn` to a blocking boot error in `startServer()`.

## Cookie posture (consolidated)

| Cookie | HttpOnly | Secure (prod) | SameSite | Path | Lifetime | Purpose |
|--------|----------|---------------|----------|------|----------|---------|
| `bsl_session` | ✓ | ✓ | `Lax` | `/` | session.expiresAt (≤90 d) | signed-in principal |
| `basmat_visitor` | ✓ | ✓ (repair) | `Lax` | `/` | 1 year | anonymous identity for free trial |

## Arabic-only / RTL contract

- Every user-visible string is sourced from
  `packages/shared/src/i18n/ar.ts`. The client renders from
  `i18nAr.ar.*`; the server uses the same module to build
  `messageAr` in `ErrorResponse`.
- The HTML shell sets `dir="rtl"` and `lang="ar"` (verified at
  `apps/web/index.html`).
- Tailwind's `tailwindcss-rtl` plugin is enabled; no LTR overrides
  in the user-facing routes.
- This is the SC-009 / G1 contract. The repair does not introduce
  English-only text in any user-visible flow.

## Wire-contract versioning policy (G2)

- New fields may be added to a response without bumping a version
  (clients ignore unknown fields).
- Removing or renaming a field is a breaking change and requires
  (a) a documented migration plan in a follow-up spec, (b) a
  `version` bump in the response envelope.
- `version: string` on `HealthResponse` is the image version, not
  the wire-contract version. The wire-contract version is implicit
  in the `packages/shared` package version.

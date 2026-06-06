# Contract — Authentication

**Date**: 2026-06-06
**Spec**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Data model**: [data-model.md](../data-model.md)

This contract documents every wire-level shape on the auth surface.
Schemas live in `packages/shared/src/auth/session.ts`,
`packages/shared/src/auth/telegram.ts`, and
`packages/shared/src/schemas/errors.ts`. Routes live in
`apps/server/src/http/routes/auth.ts`. Client lives in
`apps/web/src/lib/auth.ts` and `apps/web/src/routes/SignInPage.tsx`.

## Endpoints

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| GET | `/api/auth/config` | anonymous | — | `AuthConfigResponse` |
| POST | `/api/auth/telegram` | anonymous | `TelegramAuthPayload` | `AuthMeResponse` |
| GET | `/api/auth/me` | optional | — | `AuthMeResponse` \| 401 `ErrorResponse` |
| POST | `/api/auth/sign-out` | session + CSRF | — | 204 \| 401/403 `ErrorResponse` |

## Schemas

### `AuthConfigResponse` (new — current behaviour exists but undocumented)

```ts
{
  telegramBotUsername: string   // empty string if not configured
}
```

Served at `GET /api/auth/config`. Used by the client to render the
Telegram Login Widget with the right bot username without relying on
`VITE_TELEGRAM_BOT_USERNAME` (which is the dev-only fallback).

### `TelegramAuthPayload`

Defined in `packages/shared/src/auth/telegram.ts`. The
Telegram-published fields plus `hash` (lowercase hex SHA-256). The
server's verifier (`apps/server/src/auth/telegram-verify.ts`)
**normalises** `hash` to lowercase before schema validation so a
valid payload is never rejected for casing (FR-025).

### `AuthMeResponse`

```ts
{
  principal: Principal
  csrfToken: string            // ≥16 chars; sent in X-CSRF on mutations
  sessionExpiresAt: string     // ISO timestamp
}
```

Returned by both `POST /api/auth/telegram` (on success) and
`GET /api/auth/me`. On 401 from `/me`, the body is an `ErrorResponse`
with `code: 'not_authenticated'`.

### `Principal`

```ts
{
  id: string                    // uuid
  telegramId: number            // positive int
  displayName: string
  username: string | null
  avatarUrl: string | null
  role: 'owner' | 'user'
  status: 'active' | 'suspended'
}
```

A suspended principal is *never* returned (the user is treated as
anonymous at `resolvePrincipal`).

## Cookies

### `bsl_session` (the session cookie)

| Attribute | Value |
|-----------|-------|
| Name | `bsl_session` (`SESSION_COOKIE_NAME` in `packages/shared/src/auth/session.ts`) |
| Value | 32 random bytes base64url |
| `HttpOnly` | always |
| `Secure` | `NODE_ENV === 'production'` |
| `SameSite` | `Lax` (survives the Telegram OAuth redirect back to the app's own origin) |
| `Path` | `/` |
| `Expires` | session row's `expiresAt` (now + `min(90, configured_lifetime_days)` days) |
| `Domain` | `env.COOKIE_DOMAIN` if set, else host-only |

Issued by `setSessionCookie` in `apps/server/src/auth/cookie.ts`.
Cleared by `clearSessionCookie` on sign-out, suspended, or
owner-driven rotation. **Repair**: when `resolvePrincipal` returns
`null` *and* the row was found but revoked/expired, the response
should also `clearSessionCookie` so the browser does not keep
sending a known-stale cookie (closes the gap in R-1).

### `basmat_visitor` (the anonymous visitor cookie)

| Attribute | Value |
|-----------|-------|
| Name | `basmat_visitor` |
| Value | 24 random bytes hex |
| `HttpOnly` | always |
| `Secure` | **`NODE_ENV === 'production'`** (repair: was missing; now consistent with `bsl_session`) |
| `SameSite` | `Lax` |
| `Path` | `/` |
| `Max-Age` | 1 year |
| `Domain` | host-only (no `COOKIE_DOMAIN` for visitor) |

The hash of the visitor token (`sha256-hex`) is the value stored in
`lookups.visitorTokenHash`. The plaintext lives only in the cookie.

## CSRF

- Module-scope `csrfToken` in `apps/web/src/lib/auth.ts:18` is
  refreshed from every `AuthMeResponse` (both `submitTelegramPayload`
  and `fetchMe`).
- Mutations (`POST /api/auth/sign-out`, `POST /api/lookups/:id/rerun`,
  admin writes) require `X-CSRF` header equal to the in-memory
  `csrfToken` (enforced by `requireCsrf` middleware).
- On 403 `csrf_required`, the client should re-fetch `/me` and retry
  the mutation once.

## Cross-tab invalidation

- `POST /api/auth/sign-out` (and the suspended / manual / removed
  / rotated / expired paths in `realtime/user-events.ts`) emit
  `session.invalidated` to room `user:{userId}`.
- The client (`apps/web/src/lib/socket.ts:24-42`) routes the event:
  - `suspended` → `window.location.assign('/suspended')`
  - `removed` / `manual` / `expired` / `rotated` → `window.location.assign('/sign-in?next=...')`
  - `sign_out` (default) → no-op (the originating tab already navigated)

This is the FR-006 / Story 1 acceptance scenario 4 contract.

## CORS

- `cors({ origin: env.PUBLIC_BASE_URL, credentials: true })` on
  Express.
- `cors({ origin: env.PUBLIC_BASE_URL, methods: ['GET','POST'], credentials: true })`
  on Socket.IO.
- In dev, `PUBLIC_BASE_URL` defaults to `http://localhost:5173` and
  the SPA at that origin proxies `/api` and `/socket.io` to
  `http://localhost:3001` via Vite (so the browser sees a
  same-origin request).
- In production, both Express and Socket.IO live behind the same
  reverse proxy and the SPA HTML is served from the same Express
  process, so all requests are same-origin. CORS is therefore not
  *exercised* in production, but the policy must still match the
  origin Render sees (which equals the value of `PUBLIC_BASE_URL`).

## Error envelope

All auth errors return `ErrorResponse` (from
`packages/shared/src/schemas/errors.ts`):

```ts
{
  code: ErrorCode
  messageAr: string
  retryAfterSeconds?: number
  details?: Record<string, unknown>
}
```

| HTTP | `code` | When |
|------|--------|------|
| 401 | `not_authenticated` | `/me` called with no valid session |
| 401 | `hmac_invalid` | Telegram payload HMAC mismatch |
| 401 | `auth_date_too_old` | Telegram payload older than 300 s |
| 503 | `bot_unavailable` | `TELEGRAM_BOT_TOKEN` not set |
| 403 | `suspended_user` | User status is `'suspended'` |
| 403 | `csrf_required` | Missing/incorrect `X-CSRF` |
| 403 | `unauthorized` | Owner-only route without owner role |

# US3 Deploy + Cookie Posture Manual Smoke (T050)

This is the operator walkthrough for the US3 acceptance scenario. The
deploy contract (T046, T047, T048, T049) is enforced by automated tests;
this document covers the parts that require a real browser, a real
session, and a real network — specifically the cookie posture
verification (FR-004, FR-031).

## Preconditions

- A deployed staging instance (Render) with all env vars from `render.yaml`.
- A modern Chromium-based browser.
- DevTools open to the Network tab.

## Scenarios

### 1. Clean deploy brings the app to a healthy state
1. Trigger a deploy from the Render dashboard (or push a no-op commit to main).
2. Watch the Render logs.
3. **Expect** (in order):
   - `pnpm --filter @basmat/server db:migrate` runs and prints `migrations applied`.
   - The server boots without `schema version guard failed`.
   - `GET /api/healthz` returns 200 with `status: 'ok'`, `db: 'ok'`, `dbSchemaVersion: '1'`.

### 2. Cookie posture in production (FR-004, FR-031)
1. Open `https://<staging>/` in a fresh private/incognito window.
2. Open DevTools → Application → Cookies.
3. **Expect**: no `bsl_session` cookie yet (you haven't signed in).
4. Click the Telegram widget and complete the sign-in flow.
5. **Expect**: a new `bsl_session` cookie appears with:
   - **HttpOnly**: ✅ (no `document.cookie` value via JS)
   - **Secure**: ✅ (the cookie is set with `Secure;`)
   - **SameSite=Lax**: ✅ (the cookie's SameSite attribute is `Lax`)
   - **Path=/**: ✅
   - **Expires**: a real date ~30 days in the future (NOT a session cookie)
6. In DevTools → Network, find the `POST /api/auth/telegram` response.
7. **Expect**: `Set-Cookie` header has the same attributes as above.
8. Reload the page (Cmd/Ctrl-R).
9. **Expect**: still signed in. The cookie is still in the jar.
10. Sign out via the header.
11. **Expect**: `bsl_session` is removed (or set to empty with `Max-Age=0`).
   The server has set the cookie to expire immediately and the
   `session.invalidated` socket event tells other tabs to do the same.

### 3. Owner sign-in (T049)
1. Sign in with a Telegram account whose `telegram_id` matches `OWNER_TELEGRAM_ID`.
2. **Expect**: 200 from `POST /api/auth/telegram`, the `principal.role` is `'owner'`.
3. In the database: `SELECT id, role FROM users WHERE telegram_id = <OWNER_TELEGRAM_ID>;`
4. **Expect**: `role = 'owner'`.
5. Sign out, then sign in again with the SAME Telegram account.
6. **Expect**: `role` is STILL `'owner'` (the elevation persists; it does
   not decay back to `'user'` on subsequent sign-ins).

### 4. Schema-version guard refuses to serve on a mismatch
1. In the database: `UPDATE site_settings SET value = '{"version":"99"}' WHERE key = 'schema_version';`
2. Trigger a redeploy (or restart the service).
3. **Expect**: the server fails to start. The Render log shows
   `schema version guard failed — refusing to start`. The HTTP
   endpoint is never opened.
4. Revert: `UPDATE site_settings SET value = '{"version":"1"}' WHERE key = 'schema_version';`
5. Redeploy. **Expect**: server boots normally.

## Network inspection checklist

For each scenario, confirm in DevTools → Network:
- `GET /api/healthz` → 200, `Content-Type: application/json`, body
  matches `HealthResponseSchema` (T044).
- `POST /api/auth/telegram` → 200 (or 403 for suspended), `Set-Cookie`
  header present and well-formed.
- `GET /api/auth/me` → 200 with body matching `AuthMeResponseSchema`
  (T018).

## Reporting

If any expectation fails, capture:
- The browser console + network trace
- The `apps/server` logs for the same time window
- The `telegram_id` and timestamp
- The exact scenario number and step

Then file a bug referencing the relevant task ID (T046, T047, T048, T049, T050)
and this recipe.

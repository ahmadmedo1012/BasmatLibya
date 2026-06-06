# US1 Manual Smoke Recipe (T029)

This is the operator walkthrough for the six US1 acceptance scenarios. The
contract is enforced in code and by the automated tests (T018, T020, T021,
T022-skeleton, T023-skeleton); this document covers the parts that require
a real browser, a real session, and a real network.

## Preconditions

- A deployed staging instance (Render) with all env vars from `render.yaml`.
- A Telegram test bot + test user whose `telegram_id` matches `OWNER_TELEGRAM_ID`.
- A second test user (non-owner) for the suspended / free-trial checks.
- A modern Chromium-based browser + a private/incognito window.
- Network access to the staging URL.

## Scenarios

### 1. Sign in on a clean profile
1. Open a private/incognito window.
2. Navigate to `https://<staging>/sign-in`.
3. Click the Telegram widget. Complete the flow in the popup.
4. **Expect**: redirect to `/` (or `/<next>` if you came in via a deep link).
   Header shows the user's display name and avatar (NOT the anonymous
   "Sign in" link).

### 2. Hard refresh
1. From scenario 1, press `Cmd/Ctrl-R`.
2. **Expect**: header STILL shows the signed-in user. No flash of the
   anonymous header. `bsl_session` cookie is still in the cookie jar.
   This is the T024 + T025 contract.

### 3. Close and reopen the tab
1. From scenario 2, close the tab.
2. Reopen `https://<staging>/`.
3. **Expect**: signed in. Same `bsl_session` cookie (HttpOnly, Secure,
   SameSite=Lax, Expires ~30 days from issue).

### 4. Two tabs, sign out from one
1. From scenario 3, open `https://<staging>/` in a second tab.
2. In the FIRST tab, click "Sign out" in the header.
3. **Expect**: the first tab shows the anonymous header. Within ~5 s the
   second tab ALSO shows the anonymous header (the `session.invalidated`
   socket event has propagated). Refresh the second tab to force-clear
   any local state.

### 5. Sign in via redirect (incognito + popups blocked)
1. With both tabs signed out, navigate to `https://<staging>/me` (a
   protected route).
2. **Expect**: redirect to `/sign-in?next=%2Fme`.
3. Block popups in the browser settings.
4. Click the Telegram widget.
5. Complete the flow.
6. **Expect**: redirect to `/me`. NO flash of the anonymous header. URL
   has `?next=` cleared.

### 6. Suspended user rejection
1. Sign in as the second test user.
2. In the database, set that user's `status = 'suspended'`.
3. Sign out, then sign in again.
4. **Expect**: 403 with `ErrorResponse({ code: 'suspended_user', ... })`
   surfaced in the UI as Arabic copy (`i18nAr.ar.errors.suspended_user`),
   routed to `/suspended`.

## Network inspection checklist

For each scenario, also confirm in DevTools → Network:
- `POST /api/auth/telegram` → 200 (or 403 for scenario 6), with
  `Set-Cookie: bsl_session=...; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=...`
- `GET /api/auth/me` → 200 with `{ principal, csrfToken, sessionExpiresAt }`
  body matching the `AuthMeResponseSchema` contract (see T018).

## Reporting

If any expectation fails, capture:
- The browser console + network trace
- The `apps/server` logs for the same time window
- The `telegram_id` and timestamp
- The exact scenario number and step

Then file a bug referencing the relevant task ID (T024–T028) and this recipe.

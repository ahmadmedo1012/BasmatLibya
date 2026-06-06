# US2 Manual Smoke Recipe (T043)

This is the operator walkthrough for the seven US2 acceptance scenarios.
The contract is enforced in code and by the automated tests (T030, T031,
T034, T035; T032, T036, T037 are skeletons pinned in code with reference
assertion shapes for the real-DB CI). This document covers the parts
that require a real DB, a real network, and a real browser.

## Preconditions

- A deployed staging instance (Render) with all env vars from `render.yaml`.
- A real Postgres (the 0001–0004 migrations applied).
- A modern Chromium-based browser + a private/incognito window.
- A test identifier that the pipeline can actually look up (e.g. a real
  public Twitter handle). For the empty-state scenarios, use a
  non-existent identifier.

## Scenarios

### 1. Anonymous run to a result under 30 s
1. Open a private/incognito window.
2. Navigate to `https://<staging>/`.
3. Enter a real public identifier and submit.
4. **Expect**: progress page advances category-by-category within 30 s.
   Result page renders findings + AI enrichment (`skipped` in v1 — the
   enrichment section shows the "skipped" copy).

### 2. Anonymous, exhausted trial
1. From scenario 1, run 3 more anonymous lookups (any identifier).
2. On the 4th submit, **expect**: 402 with `code: 'free_trial_exhausted'`.
   The Arabic paywall modal renders with the "تسجيل الدخول / عرض الخطط"
   CTA. (T033 pins the three assertions: modal renders, doesn't render
   for signed-in, close returns focus to the identifier input.)

### 3. Signed-in bypass
1. Sign in via the Telegram widget.
2. Run a lookup.
3. **Expect**: 201. The "trial" indicator in the header is hidden or
   shows N/A (signed-in users have no trial). Repeat 10× to confirm no
   trial counter decrements. (T035 pins the bypass at the service layer.)

### 4. Signed-in, no trial counter
1. With a signed-in session, query `GET /api/lookups/trial`.
2. **Expect**: 200 with `used: 0, remaining: 3, exhausted: false` —
   the trial state is per-visitor, not per-user. Signed-in lookups do
   NOT count against the visitor's anonymous trial quota because the
   `lookups.visitorTokenHash` row is associated to a user. (T032 pins
   the per-visitor counting; T035 pins the bypass.)

### 5. Non-2xx surfaces Arabic copy
1. Submit an empty identifier.
2. **Expect**: Arabic inline error (`identifier_too_short`) on the home
   page input. No raw stack trace, no English.
3. Submit a 1-char identifier.
4. **Expect**: same.
5. Submit a 1000-char identifier.
6. **Expect**: `identifier_too_long` Arabic error.
7. Spam-submit the same identifier 10× in a second.
8. **Expect**: `rate_limited` Arabic error after the threshold. (T034
   pins the ErrorResponse schema + i18nAr.ar.errors coverage.)

### 6. Deep-link to a finished lookup
1. With a completed lookup id in hand, navigate to
   `https://<staging>/lookups/<id>` directly.
2. **Expect**: ResultPage renders the `completed` view. Refresh → same.
3. Navigate to `/lookups/00000000-0000-0000-0000-000000000000` (unknown id).
4. **Expect**: 404 → NotFoundPage. (T037 pins the 404 contract.)

### 7. Two consecutive submits within 5 min → one lookup
1. Open a private window.
2. Submit identifier "ahmed" twice in quick succession (double-click).
3. **Expect**: ONE progress page render, ONE `/api/lookups` POST (the
   client guard drops the second; the server would coalesce anyway).
4. Query `GET /api/lookups?identifier=ahmed` (admin) or check the
   server logs.
5. **Expect**: exactly one row. (T036 pins the server-side coalesce.)

## Network inspection checklist

For each POST `/api/lookups`:
- **201**: body matches `CreateLookupResponseSchema` (T030)
- **402**: body matches `ErrorResponseSchema` with `code: 'free_trial_exhausted'`
- **429**: body has `retryAfterSeconds > 0`
- All responses carry `X-Trial-Used` and `X-Trial-Remaining` headers

For each GET `/api/lookups/:id`:
- **200**: body matches `LookupResponseSchema` discriminated union (T031)
- **404**: body has `code: 'lookup_not_found'` + Arabic `messageAr`
- **409**: body has `code: 'lookup_in_progress'` + Arabic `messageAr`

For the progress page, open DevTools → Network → WS:
- Connect to `/socket.io` within ~1 s
- Receive `lookup.subscribe` ack with the initial `LookupSnapshot`
- Push events update the per-category state
- On `lookup.completed` / `lookup.failed`, the client navigates to
  `/lookups/:id` within ~200 ms
- If the WS never connects (the T041 fallback), the page navigates
  after 5 s based on a single GET `/api/lookups/:id`

## Reporting

If any expectation fails, capture:
- The browser console + network trace (HTTP + WS)
- The `apps/server` logs for the same time window
- The lookup id (if any) and timestamp
- The exact scenario number and step

Then file a bug referencing the relevant task ID (T038–T042) and this recipe.

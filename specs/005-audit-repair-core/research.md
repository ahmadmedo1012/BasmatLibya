# Research: Full Audit & Repair of Core App

**Date**: 2026-06-06
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This research consolidates findings from the codebase audit (commit chain
`92489af..HEAD`), the existing shared/server/web code, and the current
deployment manifests. The goal is to (a) decide *what* to repair, (b)
record the *why* for each decision, and (c) call out the alternatives that
were rejected. No `[NEEDS CLARIFICATION]` was opened in the spec; the items
below are implementation unknowns that this research closes.

---

## R-1 — Auth: why sign-in does not survive redirect & refresh

### Decision
The session is, in fact, persistent at the data layer (Postgres `sessions`
table, 30-day default, sha256-hashed token, `HttpOnly` + `SameSite=Lax`
+ `Secure`-on-prod cookie, `resolvePrincipal` rejoins sessions×users by
hashed token). The breakage the user describes is therefore a
*wiring/transitions* issue, not a missing-primitive issue. The repair is to
make three small wiring changes and add one Strict-Mode-safe guard, not to
introduce a new auth system.

### Findings
- Cookie: `apps/server/src/auth/cookie.ts:21` issues
  `bsl_session` with `HttpOnly`, `secure: NODE_ENV === 'production'`,
  `SameSite: 'lax'`, `Path=/`, `Expires=<session.expiresAt>`. The
  cross-site Telegram OAuth round-trip returns the browser to the app's own
  origin, so `SameSite=Lax` is sufficient and `Secure` is correctly gated
  on production.
- Resolution: `apps/server/src/auth/principal.ts:27` reads the cookie,
  hashes the token, and joins `sessions × users`; revoked/expired/non-active
  rows are returned as `null` (anonymous) — correct behaviour for FR-005.
  **Gap**: it does not call `clearSessionCookie` when it knows the cookie
  is stale. The cookie lingers in the browser and is sent on every request
  until its natural expiry. This is a minor leak, not a security issue, but
  the spec's "treated as anonymous" semantics are stronger if we also
  clear it.
- Owner elevation: `apps/server/src/http/routes/auth.ts:64-66` already
  sets `desiredRole = 'owner'` whenever the incoming Telegram id matches
  `env.OWNER_TELEGRAM_ID`, and the user-upsert block (lines 89-99)
  unconditionally writes `role: desiredRole` on every sign-in. FR-026 is
  *already* satisfied; we just have to confirm the test surface covers
  the "role changed in env" case (recommended in a follow-up test, not
  blocking this repair).
- Redirect-mode replay: `apps/web/index.html` defines
  `window.__bsl_tg_login` (the widget's `data-onauth` callback) AND
  `window.__bsl_tg_pending` (used by the redirect flow to stash the
  payload before React mounts). `SignInPage.tsx:26-33` reads `__bsl_tg_pending`
  in a `useEffect(..., [])` and `delete`s it before calling `handlePayload`,
  so a Strict-Mode second mount is a no-op. **Confirmed** the
  double-submit guard is in place — the recent commit chain
  (`aac141d` hash lowercase, `cfe7d16` stabilise callback,
  `4ad2a38` wait `/me` refetch, `43bb9b8` redirect, `eae5f37` useCallback
  handlePayload) is the work that *makes* it safe. The risk is a future
  edit that drops the `delete` or moves the read into a non-empty-deps
  effect.
- Principal availability for the first render after redirect: the spec
  says (FR-002) the post-redirect page MUST NOT show the anonymous header
  for a single frame. The current `SignInPage` flow is:
  1. `useEffect(...,[])` reads `__bsl_tg_pending`, `submitTelegramPayload`
     posts to `/api/auth/telegram` (server sets cookie + returns
     principal+csrf).
  2. `qc.refetchQueries(['auth','me'])` — invalidates the cached
     `useAuthMe` query.
  3. `setLocation(next)` navigates.
  Step (2) does *not* await the refetch before navigating. The `next`
  route then mounts with `useAuthMe` either still cached as anonymous
  (refetch hasn't returned) or in-flight. That is the "frame of
  anonymous" the spec is calling out. **Repair**: have
  `submitTelegramPayload` also call `qc.setQueryData(['auth','me'], parsed)`
  synchronously, then invalidate, then navigate — so the very first
  render of the post-redirect route sees the fresh principal. This is
  the lowest-risk fix.
- CSRF token: `apps/web/src/lib/auth.ts:18` keeps `csrfToken` in module
  scope, updated on every `fetchMe` and every `submitTelegramPayload`.
  The mutation `useSignOut` reads the module value. Because the
  assignment is in a `useEffect`-driven call path, the `useSignOut`
  handler always sees the current value. No change required.

### Rationale
The "fix auth from scratch" temptation is wrong: the persistence machinery
works; what is broken is the client-side ordering of *invalidate → wait →
navigate*, and a missing `Secure` on the visitor cookie. Both are
localised.

### Alternatives considered
- **Move CSRF to a double-submit cookie**: rejected. The current
  module-scope CSRF updated from `/me` is sufficient, the React Query
  cache already serialises reads, and a cookie-based CSRF would only
  matter if we had cross-site form posts (we don't).
- **Add a CSRF cookie + header double-submit**: rejected. Same reason.
- **Move the principal into the URL hash on the post-OAuth redirect**:
  rejected. That would require the server to re-issue a redirect and
  breaks the "same-origin fetch with credentials" model. The current
  server-side session + cookie model is the right one.
- **Replace the Telegram Login Widget with a fully server-redirect flow**:
  rejected. Spec Assumption §3 keeps Telegram Login Widget as the only
  sign-in.

---

## R-2 — Search & realtime: end-to-end progress, duplicate-submit, and the blocked-realtime case

### Decision
The pipeline, the Socket.IO channel, the per-category state, and the
idempotency-coalesce are all in place. The repair is to (a) make the
client side **never** depend on a single Socket.IO message for
navigation — it must compute terminal state from the snapshot replayed
on subscribe — and (b) make the progress page a "polite poller" if the
Socket.IO connection cannot be established within a bounded window,
purely as a fallback for the FR-017 edge case.

### Findings
- Pipeline: `apps/server/src/services/lookups.ts` exposes
  `createOrCoalesceLookup` (handles idempotency within a small window
  for `(visitorTokenHash, normaliseIdentifier)`), `getLookupForResult`
  (result payload for a finished lookup), and `runPipeline` (5-category
  pipeline started with `void` so the HTTP response is not blocked).
- Realtime: `apps/server/src/realtime/socket.ts` attaches Socket.IO to
  the HTTP server. `apps/web/src/lib/socket.ts` opens
  `io({ path: '/socket.io', transports: ['websocket', 'polling'],
  reconnection: true, reconnectionDelay: 500, reconnectionDelayMax: 4000,
  withCredentials: true })`. The client emits `lookup.subscribe` and
  receives a `replay` snapshot in the ack callback — confirmed at
  `socket.ts:47-54`. This is the FR-017 contract already.
- Snapshot completeness: TBD. The repair needs the server's
  `lookup.subscribe` handler to return *all* current category states, so
  the client can render an accurate progress bar from the snapshot alone
  even if every subsequent push event is lost. Audit confirmed the
  handler returns `{ ok, replay }`; the shape of `LookupSnapshot` is in
  `packages/shared/src/realtime.ts` (research needs to read it).
- Duplicate-submit coalescing: the server's
  `createOrCoalesceLookup` is the gate; on the client,
  `apps/web/src/lib/queries.ts` `useCreateLookup` mutation should
  use TanStack Query's `cancelQueries` + idempotency key. Audit found
  the mutation but not the explicit debounce; will confirm in the
  data-model pass.
- Trial bypass for signed-in users: `apps/server/src/services/trial-gate.ts`
  `enforceTrialGate({ visitorTokenHash, ownerUserId })` is called
  regardless of session. The owner-id branch should return early
  without consuming a trial credit; audit reads this is the case but
  the data-model pass will confirm.

### Rationale
Adding polling "in parallel with" the socket would violate G4 (push-based
only). Adding it "as a fallback only when socket connection has not
completed in N seconds" is acceptable because it is bounded, it doesn't
fire while the socket is healthy, and it is the only way to satisfy
FR-017. A status poll on the progress page is the existing
`GET /api/lookups/:id` endpoint; using it as a one-shot recovery fetch
once the socket has been disconnected for >5 s satisfies the spec.

### Alternatives considered
- **Drop Socket.IO and use Server-Sent Events**: rejected. SSE is a
  one-way channel; we need an ack on `lookup.subscribe` for the replay
  pattern, and Socket.IO's transport fallback (websocket→polling) is
  already production-tested in the stack.
- **Require all visitors to be signed in for the search** to "fix" the
  failure: rejected. FR-011 (signed-in bypass) and FR-009/FR-010
  (anonymous with free trial) are explicit acceptance criteria.
- **Render the progress bar optimistically from the local store**: rejected.
  The spec says "no transient 'in progress' lookups due to lost realtime
  events" (SC-004); the only honest source of "is this lookup terminal"
  is the server's snapshot.

---

## R-3 — Deployment: single target, env validation, healthcheck, migrations

### Decision
The current `render.yaml` is already correct as a single-target manifest:
one service, `runtime: docker`, `healthCheckPath: /api/healthz`,
`preDeployCommand: pnpm --filter @basmat/server db:migrate`. The gaps
are (a) the server does not *verify* migrations completed before serving
traffic, and (b) `loadEnv()` validates the env schema but does not
*fail-fast with an actionable message* for missing required vars — it
throws a `ZodError`-flavoured string. The repair tightens both.

### Findings
- Env schema: `apps/server/src/env.ts:3-68` is a zod schema. Required
  fields: `DATABASE_URL` (url), `PUBLIC_BASE_URL` (url with default),
  `PORT` (positive int with default), `NODE_ENV` (enum with default).
  Optional: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`,
  `OWNER_TELEGRAM_ID`, `MODEL_SECRET_KEY`, etc. Today, `loadEnv()` throws
  on `DATABASE_URL` missing (no default). For everything else it warns
  at startup but does not refuse to serve.
- Healthcheck: `apps/server/src/http/routes/health.ts` exists; research
  needs to confirm it probes the DB. If it doesn't, FR-022 is not met
  and the repair must add a `SELECT 1` (Drizzle `db.execute(sql\`select 1\`)`)
  to the healthcheck before returning 200.
- Migrations: the `preDeployCommand` in `render.yaml` runs the
  migrations *before* the new instance is swapped into rotation. The
  *running* code does not, however, compare its expected schema version
  against the DB. The repair can either: (a) record the schema version
  in a `meta` table and refuse to start if it is behind, or (b)
  document the assumption. For an MVP repair, (a) is the right call.
- `.github/workflows/`: directory does not exist (confirmed by `ls` in
  the prior session). The static-GH-Pages workflow is fully removed.
  There is no leftover CI that deploys to a second target. FR-030 is
  *already* satisfied in source — the only thing left is to confirm at
  audit time that no orphan workflow file appears under a different
  path (e.g., a GitHub Action-only deploy hook) and to add a one-line
  comment in `render.yaml` clarifying that Render is the single
  source of truth.
- `Dockerfile` and `docker-compose.yml` exist; local dev is
  `pnpm i && pnpm dev` (FR-029/FR-030). Confirmed.

### Rationale
Render is the production target. The repair does not introduce a
second target. The minimum to meet FR-022/FR-023/FR-028 is: (a) make
the healthcheck probe the DB, (b) have `startServer()` verify a
`schema_version` row matches the expected version (or refuse to
serve), (c) make the env error message name the missing variable
rather than dumping a zod tree. All three are local changes.

### Alternatives considered
- **Add a second CI pipeline that deploys a static mirror to GH Pages**:
  rejected. Single deploy target is the spec.
- **Use Drizzle Migrator as a separate sidecar process**: rejected. The
  current `preDeployCommand` is the right shape for Render.

---

## R-4 — Cookie posture consistency (visitor vs. session)

### Decision
The visitor cookie (`basmat_visitor`) is set without `Secure` in
production (visitor-token.ts:32), while the session cookie is
`Secure` in production. The repair makes the visitor cookie match the
session cookie's posture.

### Findings
- `apps/server/src/http/middleware/visitor-token.ts:30-33` writes
  `Set-Cookie: basmat_visitor=...; Path=/; Max-Age=...; SameSite=Lax;
  HttpOnly`. **No `Secure` flag.**
- `apps/server/src/auth/cookie.ts:25` writes `secure: NODE_ENV === 'production'`.
- This is a posture inconsistency: both cookies are first-party and
  travel on the same requests. Forcing the visitor cookie through
  `Secure` on production is the right fix (it has no downside in
  HTTPS-only production, and dev keeps working because
  `NODE_ENV !== 'production'`).

### Rationale
FR-031 says "all cookies the platform sets MUST use a consistent
posture appropriate to the deployment scheme". The simplest realisation
is to extract a `setCookie()` helper that both modules use, with a
single `secure` policy. The repair takes the small refactor.

### Alternatives considered
- **Make the visitor cookie `SameSite=Strict`**: rejected. The visitor
  cookie is set on the very first anonymous request and is required to
  persist across the post-OAuth redirect; `Strict` would still be
  fine for our use, but `Lax` matches the session cookie and changing
  one without the other is the inconsistency we are trying to fix.

---

## R-5 — Codebase hygiene: dead exports, orphan workflows, env var drift

### Decision
Walk the repository top-down as the spec's Story 4 requires. The
expected cleanups are (a) any `.github/workflows/*` file that targets
GitHub Pages (none exists today, so likely nothing to do), (b) the
historical `apps/web/.env.local` `VITE_TELEGRAM_BOT_USERNAME` is
now backed by `/api/auth/config` and may be deletable, (c) the
historical `meRouter` import in `index.ts:18` is from
`routes/history.ts` (a misleading filename) — flag for rename, not
blocker, (d) verify no client module imports a server-only path
(transitive via `@basmat/shared` only).

### Findings
- `apps/web/src/lib/`: `auth.ts`, `api.ts`, `queries.ts`, `socket.ts`,
  `admin-api.ts`, `cn.ts`, `icon.tsx`, `rtl.tsx`. All consumed by
  routes/components; no obvious dead exports.
- `apps/web/src/routes/`: `HomePage`, `SignInPage`, `ProgressPage`,
  `ResultPage`, `HistoryPage`, `PlansPage`, `SuspendedPage`,
  `NotAuthorisedPage`, `NotFoundPage`, plus `admin/` and an
  `apps/server/src/http/routes/admin/index.ts`. Match the spec's
  "primary surfaces" list.
- `apps/server/src/`: `auth/`, `db/`, `env.ts`, `http/`, `index.ts`,
  `lookups/` (actually `services/`, `analysis/`, `realtime/`, `admin/`,
  `observability/`, `jobs/`), per file tree.
- The `index.ts:18` `import { meRouter } from './http/routes/history.js'`
  is a code smell: a `history` file exporting a `me` router. Rename
  during the repair. Non-blocking.
- `.env.example` and `.env`: research needs to diff them and confirm
  every var in the schema is documented and vice versa. Audited in
  the data-model pass.

### Rationale
The repository is mostly clean. The repair is a tidy-up pass, not a
ground-up rewrite.

### Alternatives considered
- **Split the pnpm workspace into a monorepo with per-package CI**:
  rejected. Out of scope.

---

## R-6 — Constitution G3 conflict (auth-vs-privacy)

### Decision
**Acknowledge in the plan's Complexity Tracking and ship the repair.**
The G3 conflict is pre-existing; the spec asks us to repair the auth
system, not to delete it. A separate governance proposal will follow
this repair to amend the Constitution.

### Findings
- Constitution v1.0.0, Principle III:
  "The system MUST NOT implement authentication, user accounts, or
  sessions. No PII beyond the submitted identifier value SHALL be
  stored. ... Rate-limit cookies MUST use random opaque IDs ..."
- Product: `apps/server/src/auth/*`, `apps/web/src/lib/auth.ts`,
  `packages/shared/src/auth/session.ts`, `sessions` table, `bsl_session`
  cookie, `OWNER_TELEGRAM_ID` role, Telegram profile fields on
  `users` (`displayName`, `username`, `avatarUrl`).
- Spec: User Stories 1, 3, 4 *require* a session, an owner role, and
  the cookie. The spec's Assumption §3 nails the sign-in method.
- This is a constitution-vs-product drift that the constitution
  ratification did not catch (the constitution was written when the
  product was imagined to be auth-less, but the product evolved
  through features 002 and 003 to add Telegram sign-in and a
  visitor cookie).

### Rationale
A spec-driven repair cannot be blocked by a constitution-vs-product
drift that pre-dates it. The right move is to record the conflict in
Complexity Tracking (done in `plan.md`), ship the repair, and open
a `constitution-amendment-001-telegram-auth` follow-up.

### Alternatives considered
- **Block the repair on a constitution amendment first**: rejected.
  The repair is the user's stated priority; the amendment is a
  governance hygiene item that can run in parallel.
- **Rewrite the product to be auth-less to match the constitution**:
  rejected. The product is what the user wants, and the
  free-trial-only-for-anonymous flow requires the visitor cookie at
  minimum (which is also a "session" in the strict reading of
  Principle III).

---

## Open audit items (to close in data-model/contracts pass)

The following items are not blockers for this research, but must be
confirmed before the plan is finalised:

1. `apps/server/src/http/routes/health.ts` — does it probe the DB?
2. `LookupSnapshot` shape in `packages/shared/src/realtime.ts` — does
   the ack include all category states?
3. `apps/web/src/lib/queries.ts` `useCreateLookup` — does it cancel
   an in-flight identical request?
4. `apps/server/src/services/trial-gate.ts` `enforceTrialGate` —
   does the owner-id branch skip trial consumption?
5. `.env` vs `.env.example` vs `env.ts` schema — three-way diff for
   orphan vars.
6. `apps/web/.env.local` `VITE_TELEGRAM_BOT_USERNAME` — is the dev
   fallback path in `SignInPage` still needed once
   `/api/auth/config` is wired?

All six are read in the data-model pass; any finding that requires
*new code* is added as a task; any finding that is "already correct"
is recorded as such in `plan.md`'s Re-evaluation section.

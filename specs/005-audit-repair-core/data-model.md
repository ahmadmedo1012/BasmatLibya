# Data Model: Full Audit & Repair of Core App

**Date**: 2026-06-06
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

This document captures the entities involved in the repair, their
relationships, validation rules, and state transitions. The model is
documented *as it currently exists*; the repair does not introduce
new entities unless explicitly called out in **Repair-introduced
changes** below.

## Entity overview

```text
+---------------------+         +---------------------+
|  users              |  1   *  |  sessions           |
|  (signed-in id)     +<--------+  (persistent login) |
+---------------------+         +---------------------+
        |                                ^
        | 1                              | hash(token) → session row
        v                                |
+---------------------+                  |
|  user_lookup_assoc  |  *  *            |
|  (history)          +-----> lookups    |
+---------------------+         |        |
                                |        | FK visitor_token_hash (no row)
                                v        v
+---------------------+         +---------------------+
|  source_categories  |  1   *  |  lookups            |
|  (5 fixed keys)     +<--------+  (search request)   |
+---------------------+         +---------------------+
                                      | 1
                                      v *
                              +-------------------+
                              |  lookup_categories|
                              |  (per-cat state)  |
                              +-------------------+
                                      | 1
                                      v *
                              +-------------------+
                              |  findings         |
                              |  (evidence)       |
                              +-------------------+
                                      | 1
                                      v 0..1
                              +-------------------+
                              |  aggregated_results|
                              |  (enrichment slot) |
                              +-------------------+

+---------------------+         +---------------------+
|  site_settings      |         |  audit_log_entries  |
|  (kv; session_days) |         |  (auth + admin)     |
+---------------------+         +---------------------+

+---------------------+
|  rate_limit_counters|  (anonymous per-visitor cap)
+---------------------+

+---------------------+
|  ai_model_entries   |  (admin-managed; encryption via MODEL_SECRET_KEY)
+---------------------+
```

## Entities

### `users` — the signed-in identity

| Field | Type | Notes |
|-------|------|-------|
| `id` | `uuid` PK | server-generated |
| `telegramId` | `bigint` UNIQUE | Telegram user id (numeric) |
| `displayName` | `text` | composed of `first_name [+ " " + last_name]` from the Login Widget |
| `username` | `text` nullable | Telegram `@username`, may be absent |
| `avatarUrl` | `text` nullable | `photo_url` from the Login Widget |
| `role` | `enum('owner','user')` | **`'owner'` is granted only when `telegramId === env.OWNER_TELEGRAM_ID`**, on every sign-in (no self-claim) |
| `status` | `enum('active','suspended')` | `'suspended'` blocks new sessions at `auth.ts:76-87` |
| `joinedAt` | `timestamptz` | set on first sign-in |
| `lastSeenAt` | `timestamptz` | bumped on every `resolvePrincipal` hit |

Validation rules:
- `telegramId` must be a positive integer that fits in a Postgres `bigint`.
- `displayName` must be non-empty.
- `username` is null when the Telegram account has no public handle.
- `role` transitions are server-controlled; a user with `status='suspended'`
  is returned as anonymous by `resolvePrincipal` and cannot sign in.

State transitions:
- `active` → `suspended` (admin action; future work; not in this repair).
- `user` → `owner` is **idempotent** on every sign-in when the
  `OWNER_TELEGRAM_ID` env var matches; existing owner role is preserved
  otherwise.

### `sessions` — the persistent login row

| Field | Type | Notes |
|-------|------|-------|
| `id` | `uuid` PK | server-generated |
| `userId` | `uuid` FK → users | cascade on user delete |
| `tokenHash` | `text` UNIQUE | `sha256(token).base64url()`; never the raw token |
| `csrfToken` | `text` | 24 random bytes base64url; sent in `X-CSRF` for mutations |
| `issuedAt` / `lastSeenAt` | `timestamptz` | both default now(); `lastSeenAt` bumped on every resolve |
| `expiresAt` | `timestamptz` | now + min(90, configured `session_lifetime_days` site-setting) days |
| `revokedAt` | `timestamptz` nullable | set by `revoke()` / `revokeAllForUser()` / `pruneExpired()` |
| `revokeReason` | `text` nullable | one of `'sign_out' \| 'suspended' \| 'removed' \| 'manual' \| 'expired' \| 'rotated'` |
| `clientSignature` | `text` | sha256 over `ua + first-two-octets(ip)` — coarse fingerprint, not a binding |

Validation rules:
- The plaintext token is **never** stored; the hash is the only lookup key.
- `expiresAt` is bounded `≤ 90 days` (Constitution §30-day retention is
  applied to *lookups*, not to *sessions*; the spec accepts 30-day
  default with up to 90-day max via the `site_settings` row).
- `revokeReason` is a closed enum (CHECK constraint in the migration).

State transitions:
- `active → revoked (sign_out)` on user sign-out (auth route + cookie
  clear + `session.invalidated` event).
- `active → revoked (suspended/removed/manual)` on admin action (out of
  scope for this repair beyond the cross-tab handler).
- `active → revoked (expired)` via the daily purge job.

### `visitor` — the cookie-only anonymous identity (no row)

The visitor is **not** a database row. It is a long-lived, opaque token
issued as an HttpOnly cookie on the first request that needs it
(`apps/server/src/http/middleware/visitor-token.ts`). The token is
sha256-hashed wherever it is referenced server-side, so the plaintext
leaves the browser only once.

| Aspect | Value | Notes |
|--------|-------|-------|
| Cookie name | `basmat_visitor` | distinct from `bsl_session` so sign-out leaves it in place |
| Cookie posture | `HttpOnly`, `Secure` (prod), `SameSite=Lax`, `Path=/` | shared policy with `bsl_session` (T010) |
| Cookie lifetime | 180 days (rolling) | long enough to track "returning visitor" across typical absence |
| Generation | 32 random bytes, base64url | `crypto.randomBytes(32).toString('base64url')` |
| Storage | none (cookie only) | never persisted server-side |
| Server-side handle | `sha256(token).hex()` → `visitorTokenHash` | used as the partition key for `rate_limit_counters` and for lookup coalescing |

Why it is **not** a row:
- It is not a user account; it cannot sign in, cannot be suspended, and
  carries no PII.
- It is intentionally **not** cleared on sign-out, sign-in, or
  session-invalidation: the returning visitor's trial counter and
  coalesce window must survive so a user who signs out and back in is
  not granted a fresh trial and is not racing their own previous
  in-flight lookup.
- It is **not** a foreign key. `lookups.visitorTokenHash` is a denormalised
  hex string, not a foreign key to a (non-existent) `visitors` table.

Lifecycle:
- **Issued**: lazily on the first request that needs it (rate-limit
  middleware, `POST /api/lookups`, or any route that calls
  `resolveVisitorToken`).
- **Refreshed**: the cookie's `Max-Age` is re-issued on every request so
  an active visitor never silently loses the cookie.
- **Rotated**: only when the visitor is believed compromised (out of
  scope for this repair; not currently implemented).
- **Expired**: the browser drops the cookie; the server treats the
  next request as a fresh visitor (new cookie, new hash, new
  rate-limit bucket).

Distinct from `sessions`:
- The session cookie (`bsl_session`) is the **authenticated** identity.
  It is short-lived (≤90 days), revocable, and tied to a `users` row.
- The visitor cookie (`basmat_visitor`) is the **anonymous** identity.
  It is long-lived (180 days), non-revocable, and tied to no row.
- A single browser may have both at once, neither, or one without the
  other. The middleware resolves them independently; the principal
  resolver prefers the session when both are present.

Repair-introduced change to this entity:
- T010 closes a posture gap: `basmat_visitor` currently omits `Secure`
  in production because `apps/server/src/http/middleware/visitor-token.ts`
  and `apps/server/src/auth/cookie.ts` have drifted. The repair
  consolidates them on a single `secure = NODE_ENV === 'production'`
  policy.

### `lookups` — the search request

| Field | Type | Notes |
|-------|------|-------|
| `id` | `uuid` PK | default random |
| `identifierValue` | `text` | user-typed, trimmed |
| `identifierValueNormalised` | `text` | lowercased email / phone-digits / username-lowercase — used for coalescing |
| `identifierType` | `enum('name','username','email','phone')` | detected from `IdentifierValueSchema` |
| `status` | `enum('in_progress','completed','cancelled','failed')` | terminal: completed, cancelled, failed |
| `visitorTokenHash` | `text` | sha256 hex of the visitor cookie token; not a FK (visitor is not a row) |
| `ownerUserId` | `uuid` nullable | set when a signed-in user creates the lookup |
| `createdAt` / `completedAt` / `cancelledAt` | `timestamptz` | `createdAt` default now() |
| `expiresAt` | `timestamptz` | `createdAt + env.RETENTION_DAYS * 24h`; default 30 d; **enforced by 30-day purge job** (Constitution III) |
| `failureReason` | `text` nullable | populated when `status='failed'` |

Validation rules:
- `identifierValue` is `trim().min(2).max(80)` (zod).
- `identifierType` is one of four; auto-detected by `detectIdentifierType`.
- `status` transitions: `in_progress → completed | cancelled | failed` (terminal).
- A second `in_progress` lookup for the same `(visitorTokenHash, identifierValueNormalised)`
  within 5 minutes **reuses** the existing one (`createOrCoalesceLookup`).
  This is the duplicate-submit coalesce (FR-016).

### `lookup_categories` — per-category lifecycle

| Field | Type | Notes |
|-------|------|-------|
| `id` | `uuid` PK | |
| `lookupId` | `uuid` FK → lookups | cascade |
| `categoryKey` | `text` FK → source_categories | one of 5 fixed keys |
| `state` | `enum('queued','running','completed','failed','skipped')` | |
| `startedAt` / `settledAt` | `timestamptz` nullable | |
| `failureReason` | `text` nullable | for `'failed'` state |

State transitions:
- `queued → running → completed | failed | skipped` (terminal).
- The `(lookupId, categoryKey)` pair is UNIQUE; the lifecycle is
  one-row-per-category.

### `findings` — the per-category evidence

Schema matches `FindingSchema` in `packages/shared/src/schemas/finding.ts`
(per the `ContractLookup` spec). Render order is governed by
`orderingWeight` (Drizzle index `findings_lookup_cat_order_idx`).

### `aggregated_results` — the enrichment slot

| Field | Type | Notes |
|-------|------|-------|
| `lookupId` | `uuid` PK, FK → lookups | one-to-one |
| `summaryHeadlineAr` | `text` | from `EnrichmentPayloadSchema.headlineAr` |
| `totalFindings` | `integer` | |
| `populatedCategories` | `text[]` | the subset of 5 keys with ≥1 finding |
| `enrichmentStatus` | `enum('skipped','pending','ready','failed')` | the no-op in v1 |
| `enrichmentPayload` | `jsonb` | nullable; AI payload when ready |

The `enrichmentPayload` slot is the **no-op in v1**; the column exists
so future providers can populate it without DDL (G5).

### `site_settings` — kv config (session lifetime + future tunables)

| Field | Type | Notes |
|-------|------|-------|
| `key` | `text` PK | e.g. `'session_lifetime_days'`, future `'schema_version'` |
| `value` | `jsonb` | schema-validated by `admin/site-settings.ts` |
| `lastUpdatedBy` / `lastUpdatedAt` | audit fields | |

### `audit_log_entries` — auth + admin audit trail

| Field | Type | Notes |
|-------|------|-------|
| `eventClass` | `enum('auth','admin')` | |
| `eventSubclass` | `text` | e.g. `sign_in_success`, `sign_in_failure`, `sign_out` |
| `actorUserId` | `uuid` nullable | the principal at the time of the event |
| `requestSignature` | `text` | the same coarse fingerprint used on the session row |

### `rate_limit_counters` — per-(visitor, identifier) window

PK: `(visitorTokenHash, identifierHash, windowStart)`. `windowStart` is
the `RATE_LIMIT_WINDOW_MINUTES`-bucket start; `count` is incremented on
each request. `expiresAt` is the prune cutoff.

### `ai_model_entries` — admin-managed AI credentials

Schema is documented in `apps/server/src/db/schema.ts` and the
shared contract in `packages/shared/src/admin/ai-models.ts`. Out of
scope for this repair beyond ensuring the encryption key is present
(`MODEL_SECRET_KEY`) so reads don't fail.

## Repair-introduced changes

The audit-and-repair only *adds* the following to the data model. No
existing table is altered in a breaking way (no column drop, no type
narrowing).

### New: `meta` row to record DB schema version (R-3 / FR-023)

- Implemented as a row in `site_settings` with key `'schema_version'`,
  value `{"version": "<n>"}`. No new table is needed.
- Migration writes the row at the end of the migration set.
- `startServer()` reads it on boot and refuses to serve traffic if
  the running code's `SCHEMA_VERSION` constant is not greater-than-or-
  equal to the row's value. This is the FR-023 "match schema version"
  guard.

### Updated: `LOOKUP_SNAPSHOT` is unchanged

`LookupSnapshot` in `packages/shared/src/schemas/events.ts` already
includes `findingsSoFar: Finding[]` per category, the current
`status`, and the `completedAt` timestamp. The replay path at
`socket.ts:115-118` returns this shape. No contract change.

### Updated: `HealthResponse` extends with `dbSchemaVersion`

The current schema (`HealthResponseSchema`) returns
`{ status, db, version }`. The repair adds `dbSchemaVersion: string`
so the boot-check and the live healthcheck can be cross-referenced
and an operator can confirm the deployed image matches the
schema that the running DB is at. This is an *additive* change to
the shared contract.

## State-machine summary

```text
[user not present] ── telegram verify (HMAC + 300s) ──> upsert users
                                                          │
                                                          ▼
                                                  issue session row
                                                          │
                                                          ▼
                                                  set bsl_session cookie
                                                          │
                                                          ▼
[user active] ── (any request) ──> resolvePrincipal ──> 200 + AuthMeResponse
       │                                  │
       │                                  └── revoked/expired/inactive ──> 401 + clear cookie
       │
       ├── POST /api/auth/sign-out ──> revoke session + emit session.invalidated
       │                                  │
       │                                  └── every other open tab of this user: → /sign-in (or /suspended)
       │
       └── admin suspend ──> revokeAllForUser(reason='suspended') ──> emit session.invalidated(suspended)
                                                              ──>  every other open tab: → /suspended
```

```text
[anonymous visitor] ── POST /api/lookups ──> enforceTrialGate (skip if signed in)
                                                │
                                                ▼
                                       createOrCoalesceLookup (5-min window)
                                                │
                                                ▼
                                       201 + CreateLookupResponse (room = lookup:{id})
                                                │
                                                ▼
                                       runPipeline (void, 5 categories)
                                                │
                                                ▼
                                       realtime events to lookup:{id}
                                                │
                                                ▼
                                       terminal state ──> client navigates to /lookups/{id}
```

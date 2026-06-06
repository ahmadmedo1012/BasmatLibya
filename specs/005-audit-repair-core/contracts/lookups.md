# Contract — Lookups

**Date**: 2026-06-06
**Spec**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Data model**: [data-model.md](../data-model.md)

This contract documents the search surface: intake, per-category
progress, terminal states, the result envelope, and the trial
quota. Schemas in `packages/shared/src/schemas/lookup.ts`,
`packages/shared/src/schemas/finding.ts`, and
`packages/shared/src/schemas/identifier.ts`. Routes in
`apps/server/src/http/routes/lookups.ts`.

## Endpoints

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/api/lookups` | optional | `CreateLookupRequest` | 201 `CreateLookupResponse` \| 402/404/409/429 `ErrorResponse` |
| GET | `/api/lookups/trial` | anonymous | — | 200 `TrialState` \| 4xx `ErrorResponse` |
| GET | `/api/lookups/:id` | optional | — | 200 `LookupResponse` \| 404/409 `ErrorResponse` |
| DELETE | `/api/lookups/:id` | anonymous (owner check by `visitorTokenHash`) | — | 204 \| 404 `ErrorResponse` |
| POST | `/api/lookups/:id/rerun` | optional | — | 201 `CreateLookupResponse` \| 402/404 `ErrorResponse` |

## Intake: `CreateLookupRequest`

```ts
{
  identifier: string   // trim().min(2).max(80)
}
```

`identifierType` is **derived** on the server by `detectIdentifierType`
(never sent by the client). The four valid types are
`'name' | 'username' | 'email' | 'phone'`. The
`identifierValueNormalised` column is the lowercased email / phone
digits / lowercased username; it is the key used for coalescing.

## Acceptance: `CreateLookupResponse`

```ts
{
  id: string                 // uuid
  identifierType: 'name' | 'username' | 'email' | 'phone'
  status: 'in_progress'
  expiresAt: string          // ISO timestamp (now + RETENTION_DAYS)
  socketRoom: string         // `lookup:${id}`
}
```

Response headers also carry:
- `X-Trial-Used: <number>`
- `X-Trial-Remaining: <number>`

The client uses `socketRoom` to subscribe via the Socket.IO
`lookup.subscribe` event (see `realtime.md`).

## Trial gate

`POST /api/lookups` calls `enforceTrialGate({ visitorTokenHash, ownerUserId })`:

- If `ownerUserId !== null` (signed-in), the gate is **bypassed** (no
  trial credit consumed, no `free_trial_exhausted` possible).
- If `ownerUserId === null` (anonymous), the visitor's lookups are
  counted via `rate_limit_counters` / `lookups.visitorTokenHash` and
  the `FREE_TRIAL_LIMIT` constant (currently `3`). When exhausted, a
  `HttpError(402, 'free_trial_exhausted')` is thrown and the client
  renders the paywall modal (Arabic copy in `i18nAr.ar.paywall`).

## Coalescing

`createOrCoalesceLookup` reuses an existing `in_progress` lookup for
the same `(visitorTokenHash, identifierValueNormalised)` pair if it
was created within the last `COALESCE_WINDOW_MINUTES = 5` minutes.
This is the FR-016 contract (a double-click never produces two
lookups or double-decrements the trial). The response sets
`reused: true` in the service-level return; the HTTP body shape is
unchanged either way.

If `reused === false`, the server kicks off
`runPipeline({...})` with `void` (the HTTP response is not blocked).
If `reused === true`, the existing pipeline is allowed to continue.

## Rate limit

`enforceLookupLimit(visitorTokenHash, normaliseIdentifier)` is the
per-identifier cap (default 5 per 10 minutes — `RATE_LIMIT_MAX_PER_WINDOW`).
On exceed, a `HttpError(429, 'rate_limited')` is thrown with
`retryAfterSeconds` populated.

## Result envelope: `LookupResponse` (discriminated union)

```ts
type LookupResponse =
  | { status: 'completed', id, identifierValue, identifierType, summaryHeadlineAr, totalFindings, categories, enrichment, createdAt, expiresAt }
  | { status: 'expired',   id, identifierValue, identifierType, expiredAt }
  | { status: 'failed',    id, scope: 'all_categories_failed' | 'cancelled' }
```

`GET /api/lookups/:id` returns:
- 200 with `LookupResponse` when the lookup is in a viewable state.
- 404 `lookup_not_found` when no row exists with that id.
- 409 `lookup_in_progress` when the lookup is still running — the
  client is expected to navigate to the progress page, not render
  a result yet.

The `'cancelled'` scope in the failed branch is used when the
cancellation completed without a single category finishing (so the
"degraded" state of having some findings is not triggered).

### `CategoryBlock` (within `CompletedLookupResponse`)

```ts
{
  key: 'social_presence' | 'public_mentions' | 'contact_signals' | 'reputation_indicators' | 'profile_imagery'
  displayLabelAr: string
  state: 'completed' | 'failed' | 'skipped'
  failureReason?: string
  findings: Finding[]
}
```

A category with `state: 'completed'` and `findings: []` is valid and
renders the existing styled "no findings" empty state
(`i18nAr.ar.states.empty`).

### `EnrichmentSlot`

```ts
{
  status: 'skipped' | 'pending' | 'ready' | 'failed'
  payload?: EnrichmentPayload
}
```

The no-op slot in v1: `status: 'skipped'` and no `payload`. The
"AI summary" section in the result page renders the "skipped" copy
in that case.

## Realtime: see `realtime.md`

The Socket.IO `lookup.subscribe` ack returns a `LookupSnapshot` that
includes the same per-category state. A re-rendering client should
treat the snapshot as the source of truth for the *current* state
and the event stream as a way to update it; if a push event is
missed, the snapshot is sufficient to converge to the correct UI.

## Cancel

`DELETE /api/lookups/:id` sets `cancelledAt = now()` and stops the
pipeline (`abortPipeline`). The row is preserved for the rest of
the retention window so the cancel history remains visible.

## Rerun

`POST /api/lookups/:id/rerun` looks up the original row by id (404
if not found), re-runs the trial gate and rate limit against the
**original identifier**, and creates or coalesces a new lookup
(using the same 5-minute coalesce window). Returns the same
`CreateLookupResponse` shape.

# Socket.IO Event Contract

**Plan**: [../plan.md](../plan.md) · **REST contract**: [rest-api.openapi.yaml](./rest-api.openapi.yaml) · **Date**: 2026-06-03

This is the wire contract for the live-progress channel (FR-004). The server pushes events; the client never polls a `status` endpoint.

All payloads are validated by `zod` schemas in `packages/shared/src/schemas/events.ts`. Both server and client import the same schemas, so any drift breaks the build (G6).

---

## Connection

- Path: `/socket.io` (default).
- Origin: same origin as the API in production; in dev, Vite proxies `/socket.io` to the Express server.
- Auth: none. There is no concept of a user session.
- Transport: WebSocket preferred, long-polling fallback (Socket.IO defaults).

---

## Rooms

One room per lookup. Room name format:

```
lookup:{id}        // e.g. lookup:7f4a3c60-…
```

A client joins the room **only after** `POST /api/lookups` returns the lookup id, and only by emitting `lookup.subscribe` (below). The server validates that the id corresponds to a real lookup before joining the socket to the room. Clients are not pre-authorised — anyone with the id may subscribe (it is the share-link primitive).

---

## Client → Server events

### `lookup.subscribe`

Client requests to be added to a lookup's room.

```ts
// payload
{ lookupId: string /* uuid */ }
```

Acks:
- `{ ok: true, replay: LookupSnapshot }` — server has joined the socket to the room and pushed the current state inline as a one-shot replay.
- `{ ok: false, code: 'lookup_not_found' }` — unknown id; client renders the `not-found` state.

`LookupSnapshot` — full current state, designed so a fresh subscriber after page reload reaches parity without missing earlier events:

```ts
{
  status: 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'expired',
  categories: Array<{
    key: CategoryKey,
    state: CategoryState,
    findingsSoFar: Finding[],
    failureReason: string | null
  }>,
  totalFindings: number,
  startedAt: string,            // ISO
  completedAt: string | null    // ISO if terminal
}
```

### `lookup.unsubscribe`

Client leaves the room (e.g. user navigated away). Best-effort. The server also cleans up automatically on disconnect.

```ts
{ lookupId: string /* uuid */ }
```

No ack required.

---

## Server → Client events

All server events are emitted **into the room** `lookup:{id}` and carry the lookup id as `lookupId` so the client can route them when subscribed to multiple rooms (e.g. result-page tab observing a re-run).

### `category.started`

A provider for `category` has begun work.

```ts
{
  lookupId: string,
  categoryKey: CategoryKey,
  startedAt: string  // ISO
}
```

### `category.finding`

A single finding has been persisted. Streaming earlier than `category.completed` is allowed and expected — providers may yield results incrementally (R-05).

```ts
{
  lookupId: string,
  categoryKey: CategoryKey,
  finding: Finding   // full Finding shape — see REST schema
}
```

### `category.completed`

The provider finished successfully. `findingsCount` is the count for **this category only**.

```ts
{
  lookupId: string,
  categoryKey: CategoryKey,
  findingsCount: number,
  settledAt: string  // ISO
}
```

### `category.failed`

The provider failed (timeout, upstream unavailable, etc.). The result page renders a designed degraded section, not an error. `failureReason` is an internal class (e.g. `timeout`, `provider_unavailable`); the client maps it to Arabic copy.

```ts
{
  lookupId: string,
  categoryKey: CategoryKey,
  failureReason: 'timeout' | 'provider_unavailable' | 'unknown',
  settledAt: string  // ISO
}
```

### `category.skipped`

The provider does not support the lookup's identifier type (e.g. profile-imagery from a phone number). Emitted once per skipped category at lookup start.

```ts
{
  lookupId: string,
  categoryKey: CategoryKey,
  reason: 'unsupported_identifier'
}
```

### `lookup.completed`

Every category has settled (any of `completed | failed | skipped`) and the aggregated result has been persisted. The client is expected to navigate to the result route and fetch via `GET /api/lookups/:id`.

```ts
{
  lookupId: string,
  totalFindings: number,
  populatedCategories: CategoryKey[],
  completedAt: string  // ISO
}
```

### `lookup.failed`

Pipeline-level failure (every category failed, or an unrecoverable error). Triggers the "all categories failed" full-failure state with retry control (FR-011).

```ts
{
  lookupId: string,
  scope: 'all_categories_failed' | 'pipeline_error',
  failedAt: string  // ISO
}
```

### `lookup.cancelled`

Emitted after the user clicks cancel (`DELETE /api/lookups/:id`) or after the server cancels for any other reason. The client navigates back to home and discards local state.

```ts
{
  lookupId: string,
  cancelledAt: string  // ISO
}
```

---

## Ordering and idempotency guarantees

- Per `lookupId`, the server emits events in this lifecycle order:
  ```
  (category.skipped*)?
  for each non-skipped category:
    category.started
    category.finding*
    category.completed | category.failed
  (lookup.completed | lookup.failed | lookup.cancelled)
  ```
- A client that joins late receives a one-shot `LookupSnapshot` via the `lookup.subscribe` ack and then continues to receive subsequent events live. Replay never fires individual past events.
- Every event is safe to apply at-most-once on the client; if the same event arrives twice (transient reconnect race), the client merges by `(lookupId, categoryKey, finding.id)`.

---

## Error handling

- A client that subscribes to an unknown id receives `{ ok:false, code:'lookup_not_found' }` and renders the not-found state.
- A client that subscribes to an `expired` lookup receives `{ ok:true, replay: { status:'expired', ... } }` so the result page can render the designed expired-state without a separate REST round-trip.
- On disconnect, the client uses Socket.IO's built-in backoff to reconnect, then re-emits `lookup.subscribe` with the same `lookupId`. The server replies with a fresh snapshot — the client must treat the snapshot as authoritative and discard any in-flight optimistic state.

---

## Future-proofing

- AI enrichment (R-06) will introduce one additional terminal-adjacent event:
  ```
  enrichment.ready  { lookupId, payload }
  enrichment.failed { lookupId, reason }
  ```
  These are additive — clients ignoring them remain correct (they simply never render the enrichment slot's "ready" state). Adding them does not change any existing event.

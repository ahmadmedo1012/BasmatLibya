# Contract — Realtime

**Date**: 2026-06-06
**Spec**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Data model**: [data-model.md](../data-model.md)

This contract documents the Socket.IO channel used for live
progress, the replay-on-subscribe protocol, and the cross-tab
session invalidation. Schemas in
`packages/shared/src/schemas/events.ts` and
`packages/shared/src/auth/session.ts`. Server in
`apps/server/src/realtime/socket.ts` and
`apps/server/src/realtime/user-events.ts`. Client in
`apps/web/src/lib/socket.ts` and `apps/web/src/routes/ProgressPage.tsx`.

## Transport

- Path: `/socket.io`
- Transports: `['websocket', 'polling']` (Socket.IO will negotiate to
  the best available; the fallback to long-polling is what keeps
  FR-017 alive on networks that block WebSockets).
- CORS: `origin: env.PUBLIC_BASE_URL`, `credentials: true`.
- Authentication: the session cookie is parsed at handshake
  (`socket.ts:64-87`). If the cookie is present and resolves to a
  live session, the socket joins `user:{userId}` automatically.
  Anonymous sockets may still subscribe to `lookup:{id}` rooms.

## Rooms

| Room | Producer | Consumer | Auth |
|------|----------|----------|------|
| `lookup:{lookupId}` | `emitCategory*`, `emitLookup*`, `emitEnrichment*` | `ProgressPage` while viewing a lookup | anyone (the lookup is publicly viewable) |
| `user:{userId}` | `emitSessionInvalidated` | every open tab of that user | only the user themselves (auto-join on handshake) |

## Client → Server

```ts
interface ClientToServerEvents {
  'lookup.subscribe': (
    payload: { lookupId: string },
    ack: (response: SubscribeAck) => void
  ) => void
  'lookup.unsubscribe': (payload: { lookupId: string }) => void
}
```

`lookup.subscribe` is **acknowledged**: the server replies with
`SubscribeAck`, either:

```ts
{ ok: true,  replay: LookupSnapshot }      // happy path
{ ok: false, code: 'lookup_not_found' }    // unknown / purged id
```

The client uses the snapshot to render the *current* state of the
progress page *before* listening for incremental events. This is the
FR-017 fallback contract: even if no push events are received after
the subscribe, the snapshot is sufficient to know the lookup's
terminal state.

## Server → Client

```ts
interface ServerToClientEvents {
  'category.started':     CategoryStartedEvent
  'category.finding':     CategoryFindingEvent
  'category.completed':   CategoryCompletedEvent
  'category.failed':      CategoryFailedEvent
  'category.skipped':     CategorySkippedEvent
  'lookup.completed':     LookupCompletedEvent
  'lookup.failed':        LookupFailedEvent
  'lookup.cancelled':     LookupCancelledEvent
  'enrichment.started':   EnrichmentStartedEvent
  'enrichment.chunk':     EnrichmentChunkEvent
  'enrichment.ready':     EnrichmentReadyEvent
  'enrichment.failed':    EnrichmentFailedEvent
  'session.invalidated':  SessionInvalidatedEvent
}
```

Event shapes are defined in
`packages/shared/src/schemas/events.ts`. The client is required to
filter by `event.lookupId === currentId` before mutating UI state
(multiple lookups may be in flight in different tabs).

## `LookupSnapshot` (the replay payload)

```ts
{
  status: 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'expired'
  categories: Array<{
    key: CategoryKey
    state: 'queued' | 'running' | 'completed' | 'failed' | 'skipped'
    findingsSoFar: Finding[]
    failureReason: string | null
  }>
  totalFindings: number
  startedAt: string
  completedAt: string | null
}
```

Built by `getLookupSnapshot(lookupId)` in
`apps/server/src/services/lookups.ts`. Returned on subscribe; the
client renders the progress page from this snapshot and then
increments state on each subsequent event.

The `'expired'` status is special: it appears in the snapshot when
the row has been purged by the 30-day retention job but the
WebSocket race happened to fire after a lookup was already
requested. Clients should treat it as a "go to the result page and
show the expired empty state" signal.

## Progress page lifecycle

```text
mount ProgressPage({ id })
  │
  ▼
subscribeToLookup(id) ──> ack: SubscribeAck
  │                        │
  │                        ├── ok:false, lookup_not_found ──> NotFoundPage
  │                        └── ok:true, replay: LookupSnapshot
  │                              │
  │                              ├── status is terminal ──> navigate to /lookups/{id}
  │                              └── status is in_progress
  │                                    │
  │                                    ▼
  │                              subscribe to all 12 event types
  │                                    │
  │                                    ▼
  │                              update local state on each event
  │                                    │
  │                                    ▼
  │                              on lookup.completed/failed/cancelled ──> navigate
  │                                    │
  │                                    ▼
  │                              on unmount ──> unsubscribe + socket.off handlers
```

If at any point the socket disconnects for > 5 s, the client MUST
fall back to `GET /api/lookups/:id` (a one-shot, not a poll) to
verify the terminal state. This is the FR-017 "stuck" recovery
contract.

## Cross-tab session invalidation

On sign-out (and on admin suspend / manual revocation / rotation /
expiry), the server emits `session.invalidated` to `user:{userId}`:

```ts
{
  userId: string
  sessionId: string
  reason: 'sign_out' | 'suspended' | 'removed' | 'manual' | 'expired' | 'rotated'
  emittedAt: string
}
```

Client routing (`apps/web/src/lib/socket.ts:24-42`):
- `suspended` → `window.location.assign('/suspended')`
- `removed` / `manual` / `expired` / `rotated` →
  `window.location.assign('/sign-in?next=' + encodeURIComponent(currentPath))`
- `sign_out` (default) → no-op (the originating tab already navigated
  via the explicit `useSignOut().onSettled`)

## Reconnection

The client uses Socket.IO's built-in `reconnection: true,
reconnectionDelay: 500, reconnectionDelayMax: 4000`. On reconnect,
the client must re-subscribe to the current `lookup:{id}` room
(`subscribeToLookup` is idempotent — it returns the same snapshot).
The cross-tab invalidation survives reconnect because the server
emits to the user room, not to a specific socket.

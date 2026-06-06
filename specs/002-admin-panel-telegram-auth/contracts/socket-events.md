# Socket.IO Event Contract — Feature 002 additions

**Plan**: [../plan.md](../plan.md) · **REST contract**: [auth-admin-api.openapi.yaml](./auth-admin-api.openapi.yaml) · **Date**: 2026-06-04

This document describes **only the additions** introduced by feature `002-admin-panel-telegram-auth`. The full v1 event surface (`lookup.subscribe`, `category.*`, `lookup.*`) defined in `specs/001-digital-footprint-analyzer/contracts/socket-events.md` remains in force unchanged.

All payloads are validated by `zod` schemas in `packages/shared/src/auth` and `packages/shared/src/admin`. Both client and server import the same schemas (G6).

---

## Connection (extended)

- Path, transport, and origin posture are unchanged from `001`.
- **Authentication on the socket**: the Socket.IO middleware reads the `bsl_session` cookie from the handshake, looks up the session, and attaches a `principal` to the socket if and only if the session is active. Anonymous sockets remain supported (lookup-room subscription does not require auth — the share link is a public primitive, see `001`).
- An authenticated socket is **automatically** added to the per-user room `user:{userId}` after the handshake. There is no client-emitted `user.subscribe` event; membership is implicit and tied to the verified cookie.

---

## Rooms (extended)

| Room | Joined by | Purpose |
|------|-----------|---------|
| `lookup:{lookupId}` | any client emitting `lookup.subscribe` | Live progress per lookup. Unchanged from `001`. |
| `user:{userId}` | every authenticated socket on connect | Targeted server→client signals to all open tabs of one user (e.g. forced sign-out on suspension). New in `002`. |

The room name format is fixed; clients do not assemble or emit user-room names.

---

## Server → Client events (additions)

### `session.invalidated`

Emitted into `user:{userId}` when a session belonging to that user transitions to `revoked`. The receiving tab handles it according to `reason`:

- `suspended` → navigate to `/suspended` (designed Arabic state); discard local state.
- `removed` → navigate to `/sign-in` with a designed "تم حذف حسابك" notice; discard local state.
- `manual` → navigate to `/sign-in` (matches sign-out).
- `expired` → navigate to `/sign-in` with a designed "انتهت الجلسة" notice.
- `rotated` → reissue silently if the cookie was rotated by the same tab; otherwise treat as `manual`.

```ts
{
  userId: string,                 // uuid
  sessionId: string,              // uuid of the session whose revocation triggered the event
  reason: 'suspended' | 'removed' | 'manual' | 'expired' | 'rotated',
  emittedAt: string               // ISO
}
```

The event MUST NOT carry the cookie value, the token hash, or any credential. The receiving client never needs to read its own cookie — the server has already revoked it on the wire by setting `Set-Cookie` with `Max-Age=0` on whichever HTTP response performed the revocation.

---

### `enrichment.ready` *(reserved, future)*

Lit up when the v1 `aggregated_results.enrichment_*` slot transitions to `ready` because the active `ai_model_entries` row produced an output for a completed lookup. Already foreshadowed in `001 R-06` — listed here so the future event is on record alongside the new admin-driven AI flow.

```ts
{
  lookupId: string,
  status: 'ready',
  // Payload shape is opaque to the wire contract — the result page reads
  // it via GET /api/lookups/:id, where the server returns the agreed shape.
  emittedAt: string
}
```

### `enrichment.failed` *(reserved, future)*

```ts
{
  lookupId: string,
  status: 'failed',
  reasonClass: 'auth_failed' | 'timeout' | 'model_error' | 'rate_limited' | 'unknown',
  emittedAt: string
}
```

Both `enrichment.*` events are **additive**: clients that ignore them remain correct (the result page falls back to `enrichment.status` from the REST response). Their introduction does not change any existing event.

---

## Ordering and idempotency (extensions)

- `session.invalidated` may fire at any time, including before, during, or after any `lookup.*` event. The client MUST handle it independently of any active lookup subscription; receiving it never invalidates an in-flight lookup result on its own.
- A client receiving the same `session.invalidated` twice (transient reconnect race) MUST treat it idempotently — the local effect (navigate to a designed Arabic state) is the same on either receipt.
- The per-user room is left automatically when the underlying session is revoked, so a tab that handled `session.invalidated` will not continue to receive further user-scoped events.

---

## Error handling (extensions)

- A socket whose handshake cookie fails verification (signature mismatch, revoked session) connects as **anonymous**. The connection is not refused — the share-link UX from `001` continues to work for unauthenticated visitors.
- A socket that connects authenticated and whose user is suspended after connection receives `session.invalidated` exactly once and is then disconnected by the server.

---

## Future-proofing

- A future `notification.*` channel for owner-targeted ops alerts (e.g. "AI model X failed validation in last sweep") would attach to a new room `owner:notifications` — additive, not a change to `user:{userId}` or `lookup:{id}`.
- A future Telegram Mini App auth path (deferred, see `R-01`) would not change the wire contract; it would add a second authenticator before the same handshake middleware.

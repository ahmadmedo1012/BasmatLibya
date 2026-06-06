import { Server as SocketServer } from 'socket.io'
import type { Server as HttpServer } from 'node:http'
import { parse as parseCookie } from 'cookie'
import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import {
  type ClientToServerEvents,
  type ServerToClientEvents,
  type CategoryStartedEvent,
  type CategoryFindingEvent,
  type CategoryCompletedEvent,
  type CategoryFailedEvent,
  type CategorySkippedEvent,
  type LookupCompletedEvent,
  type LookupFailedEvent,
  type LookupCancelledEvent,
  type EnrichmentStartedEvent,
  type EnrichmentChunkEvent,
  type EnrichmentReadyEvent,
  type EnrichmentFailedEvent,
  type SessionInvalidatedEvent,
  SESSION_COOKIE_NAME,
} from '@basmat/shared'
import { loadEnv } from '../env.js'
import { logger } from '../observability/logger.js'
import { getLookupSnapshot } from '../services/lookups.js'
import { getDb, schema } from '../db/client.js'
import { setSocketServer } from './user-events.js'

let io: SocketServer<ClientToServerEvents, ServerToClientEvents> | null = null

export interface Realtime {
  emitCategoryStarted: (e: CategoryStartedEvent) => void
  emitCategoryFinding: (e: CategoryFindingEvent) => void
  emitCategoryCompleted: (e: CategoryCompletedEvent) => void
  emitCategoryFailed: (e: CategoryFailedEvent) => void
  emitCategorySkipped: (e: CategorySkippedEvent) => void
  emitLookupCompleted: (e: LookupCompletedEvent) => void
  emitLookupFailed: (e: LookupFailedEvent) => void
  emitLookupCancelled: (e: LookupCancelledEvent) => void
  emitEnrichmentStarted: (e: EnrichmentStartedEvent) => void
  emitEnrichmentChunk: (e: EnrichmentChunkEvent) => void
  emitEnrichmentReady: (e: EnrichmentReadyEvent) => void
  emitEnrichmentFailed: (e: EnrichmentFailedEvent) => void
  emitSessionInvalidated: (e: SessionInvalidatedEvent) => void
}

let realtime: Realtime | null = null

export function getRealtime(): Realtime | null {
  return realtime
}

export function attachSocketServer(server: HttpServer) {
  const env = loadEnv()
  io = new SocketServer(server, {
    cors: { origin: env.PUBLIC_BASE_URL, methods: ['GET', 'POST'], credentials: true },
    path: '/socket.io',
    transports: ['websocket', 'polling'],
  })

  // Feature 002: resolve the cookie at handshake; authenticated sockets
  // auto-join `user:{userId}` so session.invalidated reaches every open tab.
  io.use(async (socket, next) => {
    try {
      const header = socket.handshake.headers.cookie
      if (!header) return next()
      const cookies = parseCookie(header)
      const token = cookies[SESSION_COOKIE_NAME]
      if (!token) return next()
      const tokenHash = createHash('sha256').update(token).digest('base64url')
      const db = getDb()
      const rows = await db
        .select({ userId: schema.sessions.userId, revokedAt: schema.sessions.revokedAt, expiresAt: schema.sessions.expiresAt })
        .from(schema.sessions)
        .where(eq(schema.sessions.tokenHash, tokenHash))
        .limit(1)
      const row = rows[0]
      if (!row || row.revokedAt || row.expiresAt.getTime() < Date.now()) return next()
      void socket.join(`user:${row.userId}`)
      ;(socket.data as Record<string, unknown>).userId = row.userId
      next()
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'socket cookie auth failed; continuing as anonymous')
      next()
    }
  })

  setSocketServer(io)

  const room = (id: string) => `lookup:${id}`

  realtime = {
    emitCategoryStarted: (e) => io?.to(room(e.lookupId)).emit('category.started', e),
    emitCategoryFinding: (e) => io?.to(room(e.lookupId)).emit('category.finding', e),
    emitCategoryCompleted: (e) => io?.to(room(e.lookupId)).emit('category.completed', e),
    emitCategoryFailed: (e) => io?.to(room(e.lookupId)).emit('category.failed', e),
    emitCategorySkipped: (e) => io?.to(room(e.lookupId)).emit('category.skipped', e),
    emitLookupCompleted: (e) => io?.to(room(e.lookupId)).emit('lookup.completed', e),
    emitLookupFailed: (e) => io?.to(room(e.lookupId)).emit('lookup.failed', e),
    emitLookupCancelled: (e) => io?.to(room(e.lookupId)).emit('lookup.cancelled', e),
    emitEnrichmentStarted: (e) => io?.to(room(e.lookupId)).emit('enrichment.started', e),
    emitEnrichmentChunk: (e) => io?.to(room(e.lookupId)).emit('enrichment.chunk', e),
    emitEnrichmentReady: (e) => io?.to(room(e.lookupId)).emit('enrichment.ready', e),
    emitEnrichmentFailed: (e) => io?.to(room(e.lookupId)).emit('enrichment.failed', e),
    emitSessionInvalidated: (e) => io?.to(`user:${e.userId}`).emit('session.invalidated', e),
  }

  io.on('connection', (socket) => {
    socket.on('lookup.subscribe', async (payload, ack) => {
      try {
        if (!payload || typeof payload.lookupId !== 'string') {
          return ack({ ok: false, code: 'lookup_not_found' })
        }
        const snapshot = await getLookupSnapshot(payload.lookupId)
        if (!snapshot) return ack({ ok: false, code: 'lookup_not_found' })
        socket.join(room(payload.lookupId))
        ack({ ok: true, replay: snapshot })
      } catch (err) {
        logger.warn({ err: (err as Error).message }, 'lookup.subscribe error')
        ack({ ok: false, code: 'lookup_not_found' })
      }
    })

    socket.on('lookup.unsubscribe', (payload) => {
      if (payload?.lookupId) socket.leave(room(payload.lookupId))
    })
  })

  return io
}

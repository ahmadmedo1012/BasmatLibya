/**
 * Session store: issue / revoke / prune.
 *
 * Tokens are 32 random bytes (base64url-encoded) and stored as sha256(hash).
 * The plaintext token is returned by issue() exactly once — set on the cookie
 * and discarded.
 */

import { randomBytes, createHash } from 'node:crypto'
import { eq, and, inArray, lte, isNull } from 'drizzle-orm'
import { SESSION_LIFETIME_DAYS_DEFAULT, SESSION_LIFETIME_DAYS_MAX } from '@basmat/shared'
import { getDb, schema } from '../db/client.js'
import { getSiteSetting } from '../admin/settings-cache.js'

export interface IssuedSession {
  sessionId: string
  token: string
  csrfToken: string
  expiresAt: Date
}

export async function issue(opts: {
  userId: string
  clientSignature: string
}): Promise<IssuedSession> {
  const token = randomBytes(32).toString('base64url')
  const csrfToken = randomBytes(24).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('base64url')
  const lifetimeDays = Math.min(
    SESSION_LIFETIME_DAYS_MAX,
    Math.max(1, await getSiteSetting('session_lifetime_days').catch(() => SESSION_LIFETIME_DAYS_DEFAULT))
  )
  const expiresAt = new Date(Date.now() + lifetimeDays * 24 * 60 * 60 * 1000)
  const [row] = await getDb()
    .insert(schema.sessions)
    .values({
      userId: opts.userId,
      tokenHash,
      csrfToken,
      expiresAt,
      clientSignature: opts.clientSignature,
    })
    .returning({ id: schema.sessions.id })
  return { sessionId: row!.id, token, csrfToken, expiresAt }
}

export async function revoke(sessionId: string, reason: 'sign_out' | 'manual' | 'rotated'): Promise<void> {
  await getDb()
    .update(schema.sessions)
    .set({ revokedAt: new Date(), revokeReason: reason })
    .where(and(eq(schema.sessions.id, sessionId), isNull(schema.sessions.revokedAt)))
}

export async function revokeAllForUser(
  userId: string,
  reason: 'suspended' | 'removed' | 'manual'
): Promise<{ revokedSessionIds: string[] }> {
  const rows = await getDb()
    .update(schema.sessions)
    .set({ revokedAt: new Date(), revokeReason: reason })
    .where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)))
    .returning({ id: schema.sessions.id })
  return { revokedSessionIds: rows.map((r) => r.id) }
}

export async function pruneExpired(): Promise<number> {
  const rows = await getDb()
    .update(schema.sessions)
    .set({ revokedAt: new Date(), revokeReason: 'expired' })
    .where(and(lte(schema.sessions.expiresAt, new Date()), isNull(schema.sessions.revokedAt)))
    .returning({ id: schema.sessions.id })
  return rows.length
}

export async function findActiveByIds(ids: string[]) {
  if (ids.length === 0) return []
  return getDb()
    .select()
    .from(schema.sessions)
    .where(and(inArray(schema.sessions.id, ids), isNull(schema.sessions.revokedAt)))
}

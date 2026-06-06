/**
 * Principal resolution: cookie → session row → users row → Principal | null.
 *
 * Anonymous callers receive `null` (never throws on missing cookie). A revoked
 * or expired session is treated as anonymous and is also revoked-with-reason
 * if it had only just expired. When the row is *present but stale* (revoked,
 * expired, or its user is suspended) the session cookie is cleared on the
 * response so the browser stops sending it on every request (T011, FR-005).
 */

import { createHash } from 'node:crypto'
import type { Request, Response } from 'express'
import { eq } from 'drizzle-orm'
import { type Principal, type Role, type UserStatus } from '@basmat/shared'
import { getDb, schema } from '../db/client.js'
import { readSessionCookie, clearSessionCookie } from './cookie.js'

export interface ResolvedSession {
  principal: Principal
  sessionId: string
  csrfToken: string
  expiresAt: Date
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url')
}

export async function resolvePrincipal(req: Request, res: Response): Promise<ResolvedSession | null> {
  const token = readSessionCookie(req)
  if (!token) return null
  const tokenHash = hashToken(token)
  const db = getDb()
  const rows = await db
    .select({
      session: schema.sessions,
      user: schema.users,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(eq(schema.sessions.tokenHash, tokenHash))
    .limit(1)
  const row = rows[0]
  // Cookie present but no row matches — leave the cookie alone (it could be
  // a typo'd or rotated value that the next sign-in will overwrite).
  if (!row) return null
  const { session, user } = row
  const now = new Date()
  // T011: when the row exists but is stale, clear the cookie on the
  // response so the browser stops sending it.
  if (session.revokedAt || session.expiresAt.getTime() < now.getTime() || user.status !== 'active') {
    clearSessionCookie(res)
    return null
  }
  // Touch last_seen_at on the session and the user (best-effort, fire-and-forget).
  void db
    .update(schema.sessions)
    .set({ lastSeenAt: now })
    .where(eq(schema.sessions.id, session.id))
    .catch(() => undefined)
  void db
    .update(schema.users)
    .set({ lastSeenAt: now })
    .where(eq(schema.users.id, user.id))
    .catch(() => undefined)

  const principal: Principal = {
    id: user.id,
    telegramId: Number(user.telegramId),
    displayName: user.displayName,
    username: user.username,
    avatarUrl: user.avatarUrl,
    role: user.role as Role,
    status: user.status as UserStatus,
  }
  return {
    principal,
    sessionId: session.id,
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt,
  }
}

export { hashToken }

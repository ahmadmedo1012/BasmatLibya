/**
 * Auth routes — POST /api/auth/telegram, GET /api/auth/me, POST /api/auth/sign-out.
 */

import { Router, type Request, type Response } from 'express'
import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { type AuthMeResponse, type Principal, type ErrorResponse } from '@basmat/shared'
import { getDb, schema } from '../../db/client.js'
import { loadEnv } from '../../env.js'
import { logger } from '../../observability/logger.js'
import { verifyTelegramPayload } from '../../auth/telegram-verify.js'
import { issue, revoke, revokeAllForUser } from '../../auth/session-store.js'
import { setSessionCookie, clearSessionCookie } from '../../auth/cookie.js'
import { resolvePrincipal } from '../../auth/principal.js'
import { auditLog } from '../../admin/audit-log.js'
import { emitSessionInvalidated, disconnectUserSockets } from '../../realtime/user-events.js'
import { requireSession } from '../middleware/require-session.js'
import { requireCsrf } from '../middleware/require-csrf.js'
import { buildArErrorBody } from '../middleware/error.js'

export const authRouter = Router()

authRouter.get('/config', (_req, res) => {
  const env = loadEnv()
  res.json({ telegramBotUsername: env.TELEGRAM_BOT_USERNAME || '' })
})

function clientSignature(req: Request): string {
  const ua = req.header('user-agent') ?? ''
  // Coarse IP — keep prefix only so we don't pretend to do binding.
  const ip = req.ip ?? ''
  return createHash('sha256').update(ua + '|' + ip.split('.').slice(0, 2).join('.')).digest('base64url')
}

authRouter.post('/telegram', async (req, res) => {
  const env = loadEnv()
  const result = verifyTelegramPayload(req.body)
  if (!result.ok) {
    // Audit the failure (no payload fields written — only the result code).
    await getDb()
      .insert(schema.auditLogEntries)
      .values({
        actorUserId: null,
        eventClass: 'auth',
        eventSubclass: 'sign_in_failure',
        afterValue: { reason: result.code },
        requestSignature: clientSignature(req),
      })
      .catch((err) => logger.warn({ err: (err as Error).message }, 'audit insert failed'))
    const status =
      result.code === 'auth_date_too_old' ? 401 :
      result.code === 'bot_unavailable' ? 503 :
      401
    return res.status(status).json(buildArErrorBody(
      result.code === 'malformed' ? 'hmac_invalid' : (result.code as 'hmac_invalid' | 'auth_date_too_old' | 'bot_unavailable')
    ))
  }

  const payload = result.payload
  const db = getDb()

  // Upsert user (matched by telegram_id). Owner role is set when telegram_id
  // matches OWNER_TELEGRAM_ID — never self-claimable (G7, FR-009).
  const desiredRole: 'owner' | 'user' =
    env.OWNER_TELEGRAM_ID && BigInt(payload.id) === env.OWNER_TELEGRAM_ID ? 'owner' : 'user'

  const displayName = [payload.first_name, payload.last_name].filter(Boolean).join(' ').trim()
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.telegramId, BigInt(payload.id)))
    .limit(1)
  let user = existing[0]
  if (user) {
    if (user.status === 'suspended') {
      await db
        .insert(schema.auditLogEntries)
        .values({
          actorUserId: user.id,
          eventClass: 'auth',
          eventSubclass: 'sign_in_failure',
          afterValue: { reason: 'suspended_user' },
          requestSignature: clientSignature(req),
        })
      return res.status(403).json(buildArErrorBody('suspended_user'))
    }
    // Refresh display name, username, avatar; bump role if the env var changed.
    const [updated] = await db
      .update(schema.users)
      .set({
        displayName,
        username: payload.username ?? null,
        avatarUrl: payload.photo_url ?? null,
        role: desiredRole,
        lastSeenAt: new Date(),
      })
      .where(eq(schema.users.id, user.id))
      .returning()
    user = updated!
  } else {
    const [created] = await db
      .insert(schema.users)
      .values({
        telegramId: BigInt(payload.id),
        displayName,
        username: payload.username ?? null,
        avatarUrl: payload.photo_url ?? null,
        role: desiredRole,
      })
      .returning()
    user = created!
  }

  const session = await issue({ userId: user.id, clientSignature: clientSignature(req) })
  setSessionCookie(res, session.token, session.expiresAt)

  await db
    .insert(schema.auditLogEntries)
    .values({
      actorUserId: user.id,
      eventClass: 'auth',
      eventSubclass: 'sign_in_success',
      requestSignature: clientSignature(req),
    })
    .catch((err) => logger.warn({ err: (err as Error).message }, 'audit insert failed'))

  const principal: Principal = {
    id: user.id,
    telegramId: Number(user.telegramId),
    displayName: user.displayName,
    username: user.username,
    avatarUrl: user.avatarUrl,
    role: user.role as 'owner' | 'user',
    status: user.status as 'active' | 'suspended',
  }
  const body: AuthMeResponse = {
    principal,
    csrfToken: session.csrfToken,
    sessionExpiresAt: session.expiresAt.toISOString(),
  }
  res.status(200).json(body)
})

authRouter.get('/me', async (req, res) => {
  const session = await resolvePrincipal(req)
  if (!session) {
    const body: ErrorResponse = buildArErrorBody('not_authenticated')
    return res.status(401).json(body)
  }
  const body: AuthMeResponse = {
    principal: session.principal,
    csrfToken: session.csrfToken,
    sessionExpiresAt: session.expiresAt.toISOString(),
  }
  res.status(200).json(body)
})

authRouter.post('/sign-out', requireSession, requireCsrf, async (req, res) => {
  const session = req.session!
  await revoke(session.sessionId, 'sign_out')
  clearSessionCookie(res)
  emitSessionInvalidated({
    userId: session.principal.id,
    sessionId: session.sessionId,
    reason: 'sign_out',
    emittedAt: new Date().toISOString(),
  })
  await getDb()
    .insert(schema.auditLogEntries)
    .values({
      actorUserId: session.principal.id,
      eventClass: 'auth',
      eventSubclass: 'sign_out',
      requestSignature: clientSignature(req),
    })
    .catch((err) => logger.warn({ err: (err as Error).message }, 'audit insert failed'))
  res.status(204).end()
})

/**
 * Admin: users — list, get, suspend, unsuspend, remove (US2).
 *
 * Suspension transactionally:
 *   1. sets users.status='suspended' + suspended_at
 *   2. revokes every active session for that user
 *   3. appends audit row
 *   4. emits session.invalidated to user:{id} (post-tx best-effort)
 */

import { Router } from 'express'
import { eq, and, desc, isNull, sql } from 'drizzle-orm'
import {
  AdminUserListFiltersSchema,
  type AdminUserSummary,
  type AdminUserDetail,
  type LookupHistoryItem,
  type Role,
  type UserStatus,
  type AdminUsersPage,
  type IdentifierType,
} from '@basmat/shared'
import { getDb, schema } from '../../../db/client.js'
import { auditLog } from '../../../admin/audit-log.js'
import { revokeAllForUser } from '../../../auth/session-store.js'
import { emitSessionInvalidated } from '../../../realtime/user-events.js'
import { buildArErrorBody } from '../../middleware/error.js'

export const adminUsersRouter = Router()

function toSummary(row: typeof schema.users.$inferSelect): AdminUserSummary {
  return {
    id: row.id,
    telegramId: Number(row.telegramId),
    displayName: row.displayName,
    username: row.username,
    avatarUrl: row.avatarUrl,
    role: row.role as Role,
    status: row.status as UserStatus,
    joinedAt: row.joinedAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    suspendedAt: row.suspendedAt?.toISOString() ?? null,
  }
}

function previewIdentifier(value: string): string {
  return value.length <= 24 ? value : value.slice(0, 22) + '…'
}

adminUsersRouter.get('/', async (req, res) => {
  const filters = AdminUserListFiltersSchema.safeParse(req.query)
  if (!filters.success) return res.status(400).json(buildArErrorBody('validation_failed'))

  const { status, role, sort, limit } = filters.data
  const db = getDb()
  const whereParts = [] as Array<ReturnType<typeof eq>>
  if (status) whereParts.push(eq(schema.users.status, status))
  if (role) whereParts.push(eq(schema.users.role, role))
  const orderBy = sort === 'joined_desc' ? desc(schema.users.joinedAt) : desc(schema.users.lastSeenAt)
  const rows = await db
    .select()
    .from(schema.users)
    .where(whereParts.length ? and(...whereParts) : undefined)
    .orderBy(orderBy)
    .limit(limit + 1)

  const items = rows.slice(0, limit).map(toSummary)
  const nextCursor = rows.length > limit ? String(items[items.length - 1]!.id) : null
  const body: AdminUsersPage = { items, nextCursor }
  res.status(200).json(body)
})

adminUsersRouter.get('/:id', async (req, res) => {
  const id = req.params.id!
  const db = getDb()
  const user = (await db.select().from(schema.users).where(eq(schema.users.id, id)))[0]
  if (!user) return res.status(404).json(buildArErrorBody('not_found'))
  const associations = await db
    .select({
      lookupId: schema.lookups.id,
      identifierValue: schema.lookups.identifierValue,
      identifierType: schema.lookups.identifierType,
      status: schema.lookups.status,
      createdAt: schema.lookups.createdAt,
      expiresAt: schema.lookups.expiresAt,
    })
    .from(schema.userLookupAssociations)
    .innerJoin(schema.lookups, eq(schema.userLookupAssociations.lookupId, schema.lookups.id))
    .where(eq(schema.userLookupAssociations.userId, id))
    .orderBy(desc(schema.lookups.createdAt))
    .limit(50)
  const history: LookupHistoryItem[] = associations.map((a) => ({
    lookupId: a.lookupId,
    identifierType: a.identifierType as IdentifierType,
    identifierPreview: previewIdentifier(a.identifierValue),
    status: a.status as 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'expired',
    createdAt: a.createdAt.toISOString(),
    expiresAt: a.expiresAt.toISOString(),
  }))
  const activeSessionsRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.sessions)
    .where(and(eq(schema.sessions.userId, id), isNull(schema.sessions.revokedAt)))
  const activeSessionsCount = activeSessionsRows[0]?.count ?? 0
  const body: AdminUserDetail = {
    ...toSummary(user),
    history,
    activeSessions: activeSessionsCount,
  }
  res.status(200).json(body)
})

adminUsersRouter.post('/:id/suspend', async (req, res) => {
  const id = req.params.id!
  const actorId = req.session!.principal.id
  if (id === actorId) return res.status(403).json(buildArErrorBody('last_owner_protected'))
  const db = getDb()
  const target = (await db.select().from(schema.users).where(eq(schema.users.id, id)))[0]
  if (!target) return res.status(404).json(buildArErrorBody('not_found'))
  if (target.status === 'suspended') return res.status(200).json(toSummary(target))

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(schema.users)
      .set({ status: 'suspended', suspendedAt: new Date() })
      .where(eq(schema.users.id, id))
      .returning()
    await auditLog.append(tx, {
      actorUserId: actorId,
      eventClass: 'admin',
      eventSubclass: 'user_suspend',
      targetKind: 'user',
      targetId: id,
      beforeValue: { status: 'active' },
      afterValue: { status: 'suspended' },
    })
    return row!
  })

  // Revoke all sessions outside the txn so we capture the txn's commit timestamp.
  const { revokedSessionIds } = await revokeAllForUser(id, 'suspended')
  for (const sid of revokedSessionIds) {
    emitSessionInvalidated({
      userId: id,
      sessionId: sid,
      reason: 'suspended',
      emittedAt: new Date().toISOString(),
    })
  }
  res.status(200).json(toSummary(updated))
})

adminUsersRouter.post('/:id/unsuspend', async (req, res) => {
  const id = req.params.id!
  const db = getDb()
  const target = (await db.select().from(schema.users).where(eq(schema.users.id, id)))[0]
  if (!target) return res.status(404).json(buildArErrorBody('not_found'))
  if (target.status === 'active') return res.status(200).json(toSummary(target))

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(schema.users)
      .set({ status: 'active', suspendedAt: null })
      .where(eq(schema.users.id, id))
      .returning()
    await auditLog.append(tx, {
      actorUserId: req.session!.principal.id,
      eventClass: 'admin',
      eventSubclass: 'user_unsuspend',
      targetKind: 'user',
      targetId: id,
      beforeValue: { status: 'suspended' },
      afterValue: { status: 'active' },
    })
    return row!
  })
  res.status(200).json(toSummary(updated))
})

adminUsersRouter.delete('/:id', async (req, res) => {
  const id = req.params.id!
  const actorId = req.session!.principal.id
  if (id === actorId) return res.status(409).json(buildArErrorBody('last_owner_protected'))
  const db = getDb()
  const target = (await db.select().from(schema.users).where(eq(schema.users.id, id)))[0]
  if (!target) return res.status(404).json(buildArErrorBody('not_found'))

  // Block last-owner-removal.
  if (target.role === 'owner') {
    const ownerCountRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.users)
      .where(and(eq(schema.users.role, 'owner'), eq(schema.users.status, 'active')))
    const ownerCount = ownerCountRows[0]?.count ?? 0
    if (ownerCount <= 1) {
      return res.status(409).json(buildArErrorBody('last_owner_protected'))
    }
  }

  // Block when target has dependent ai_model_entries (FK is RESTRICT).
  const deps = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.aiModelEntries)
    .where(eq(schema.aiModelEntries.createdBy, id))
  if ((deps[0]?.count ?? 0) > 0) {
    return res.status(409).json(buildArErrorBody('dependent_entries'))
  }

  await db.transaction(async (tx) => {
    await tx.delete(schema.users).where(eq(schema.users.id, id))
    await auditLog.append(tx, {
      actorUserId: actorId,
      eventClass: 'admin',
      eventSubclass: 'user_remove',
      targetKind: 'user',
      targetId: id,
      beforeValue: { telegramId: Number(target.telegramId), role: target.role, status: target.status },
    })
  })
  // Sessions cascade-deleted by FK. Best-effort socket disconnect.
  emitSessionInvalidated({
    userId: id,
    sessionId: 'removed',
    reason: 'removed',
    emittedAt: new Date().toISOString(),
  })
  res.status(204).end()
})

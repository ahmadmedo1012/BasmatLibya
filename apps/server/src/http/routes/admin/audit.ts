/**
 * Admin: audit log read view (US2).
 */

import { Router } from 'express'
import { and, desc, eq, lt } from 'drizzle-orm'
import { AuditFiltersSchema, type AuditEntry, type AuditPage } from '@basmat/shared'
import { getDb, schema } from '../../../db/client.js'
import { buildArErrorBody } from '../../middleware/error.js'

export const adminAuditRouter = Router()

adminAuditRouter.get('/', async (req, res) => {
  const filters = AuditFiltersSchema.safeParse(req.query)
  if (!filters.success) return res.status(400).json(buildArErrorBody('validation_failed'))
  const { eventClass, actorUserId, targetKind, targetId, cursor, limit } = filters.data

  const db = getDb()
  const whereParts: Array<ReturnType<typeof eq>> = []
  if (eventClass) whereParts.push(eq(schema.auditLogEntries.eventClass, eventClass))
  if (actorUserId) whereParts.push(eq(schema.auditLogEntries.actorUserId, actorUserId))
  if (targetKind) whereParts.push(eq(schema.auditLogEntries.targetKind, targetKind))
  if (targetId) whereParts.push(eq(schema.auditLogEntries.targetId, targetId))
  if (cursor) whereParts.push(lt(schema.auditLogEntries.createdAt, new Date(cursor)))

  const rows = await db
    .select({
      entry: schema.auditLogEntries,
      actor: schema.users,
    })
    .from(schema.auditLogEntries)
    .leftJoin(schema.users, eq(schema.auditLogEntries.actorUserId, schema.users.id))
    .where(whereParts.length ? and(...whereParts) : undefined)
    .orderBy(desc(schema.auditLogEntries.createdAt))
    .limit(limit + 1)

  const items: AuditEntry[] = rows.slice(0, limit).map((r) => ({
    id: r.entry.id,
    actor: r.actor
      ? {
          id: r.actor.id,
          telegramId: Number(r.actor.telegramId),
          displayName: r.actor.displayName,
          username: r.actor.username,
          avatarUrl: r.actor.avatarUrl,
          role: r.actor.role as 'owner' | 'user',
          status: r.actor.status as 'active' | 'suspended',
          joinedAt: r.actor.joinedAt.toISOString(),
          lastSeenAt: r.actor.lastSeenAt.toISOString(),
          suspendedAt: r.actor.suspendedAt?.toISOString() ?? null,
        }
      : null,
    eventClass: r.entry.eventClass as 'auth' | 'admin',
    eventSubclass: r.entry.eventSubclass,
    targetKind: r.entry.targetKind,
    targetId: r.entry.targetId,
    beforeValue: r.entry.beforeValue,
    afterValue: r.entry.afterValue,
    createdAt: r.entry.createdAt.toISOString(),
  }))
  const nextCursor =
    rows.length > limit ? rows[limit - 1]!.entry.createdAt.toISOString() : null
  const body: AuditPage = { items, nextCursor }
  res.status(200).json(body)
})

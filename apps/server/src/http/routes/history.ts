/**
 * Me — signed-in user's history (US4).
 */

import { Router } from 'express'
import { and, desc, eq, isNull, lt, or } from 'drizzle-orm'
import {
  type HistoryPage,
  type LookupHistoryItem,
  type IdentifierType,
} from '@basmat/shared'
import { getDb, schema } from '../../db/client.js'
import { auditLog } from '../../admin/audit-log.js'
import { requireSession } from '../middleware/require-session.js'
import { requireCsrf } from '../middleware/require-csrf.js'
import { buildArErrorBody } from '../middleware/error.js'

export const meRouter = Router()
meRouter.use(requireSession)

function preview(value: string): string {
  return value.length <= 24 ? value : value.slice(0, 22) + '…'
}

meRouter.get('/history', async (req, res) => {
  const userId = req.session!.principal.id
  const cursorParam = typeof req.query.cursor === 'string' ? req.query.cursor : null
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20))
  const db = getDb()
  const where = and(
    eq(schema.userLookupAssociations.userId, userId),
    isNull(schema.userLookupAssociations.hiddenByUserAt),
    cursorParam ? lt(schema.lookups.createdAt, new Date(cursorParam)) : undefined
  )
  const rows = await db
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
    .where(where)
    .orderBy(desc(schema.lookups.createdAt))
    .limit(limit + 1)

  const items: LookupHistoryItem[] = rows.slice(0, limit).map((r) => ({
    lookupId: r.lookupId,
    identifierType: r.identifierType as IdentifierType,
    identifierPreview: preview(r.identifierValue),
    status: r.status as 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'expired',
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
  }))
  const nextCursor = rows.length > limit ? items[items.length - 1]!.createdAt : null
  const body: HistoryPage = { items, nextCursor }
  res.status(200).json(body)
})

meRouter.delete('/history/:lookupId', requireCsrf, async (req, res) => {
  const userId = req.session!.principal.id
  const lookupId = String(req.params.lookupId ?? '')
  if (!lookupId) return res.status(404).json(buildArErrorBody('not_found'))
  const db = getDb()
  const existing = (
    await db
      .select()
      .from(schema.userLookupAssociations)
      .where(
        and(
          eq(schema.userLookupAssociations.userId, userId),
          eq(schema.userLookupAssociations.lookupId, lookupId)
        )
      )
      .limit(1)
  )[0]
  if (!existing) return res.status(404).json(buildArErrorBody('not_found'))
  if (existing.hiddenByUserAt) return res.status(204).end()

  await db.transaction(async (tx) => {
    await tx
      .update(schema.userLookupAssociations)
      .set({ hiddenByUserAt: new Date() })
      .where(eq(schema.userLookupAssociations.id, existing.id))
    await auditLog.append(tx, {
      actorUserId: userId,
      eventClass: 'admin',
      eventSubclass: 'history_hide',
      targetKind: 'user_lookup_association',
      targetId: existing.id,
      afterValue: { lookupId },
    })
  })
  res.status(204).end()
})

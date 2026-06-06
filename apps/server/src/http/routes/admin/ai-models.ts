/**
 * Admin: AI model entries — list, create, update, delete, activate (US2).
 * Every mutation goes through auditLog.append() in the same transaction (G9).
 */

import { Router } from 'express'
import { eq, desc, and, ne } from 'drizzle-orm'
import {
  AiModelEntryCreateSchema,
  AiModelEntryUpdateSchema,
  type AiModelEntryDisplay,
  type AiModelProvider,
} from '@basmat/shared'
import { getDb, schema } from '../../../db/client.js'
import { encrypt, decrypt, lastFour } from '../../../admin/secret-cipher.js'
import { auditLog } from '../../../admin/audit-log.js'
import { pickAdapter } from '../../../analysis/enrichment/ai-model-client.js'
import { logger } from '../../../observability/logger.js'
import { buildArErrorBody } from '../../middleware/error.js'

export const adminAiModelsRouter = Router()

function toDisplay(row: typeof schema.aiModelEntries.$inferSelect): AiModelEntryDisplay {
  return {
    id: row.id,
    provider: row.provider as AiModelProvider,
    modelId: row.modelId,
    displayLabel: row.displayLabel,
    baseUrl: row.baseUrl,
    credential: { present: true, lastFour: row.credentialLastFour },
    generation: {
      systemPrompt: row.systemPrompt,
      temperature: Number(row.temperature),
      maxOutputTokens: row.maxOutputTokens,
      extraParams: (row.extraParams as Record<string, unknown>) ?? {},
    },
    status: row.status as 'active' | 'inactive' | 'invalid',
    isActive: row.isActive,
    validatedAt: row.validatedAt?.toISOString() ?? null,
    lastValidationError: row.lastValidationError,
    createdAt: row.createdAt.toISOString(),
    lastUpdatedAt: row.lastUpdatedAt.toISOString(),
  }
}

adminAiModelsRouter.get('/', async (_req, res) => {
  const rows = await getDb()
    .select()
    .from(schema.aiModelEntries)
    .orderBy(desc(schema.aiModelEntries.lastUpdatedAt))
  res.status(200).json(rows.map(toDisplay))
})

adminAiModelsRouter.post('/', async (req, res) => {
  const parsed = AiModelEntryCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json(buildArErrorBody('validation_failed'))
  }
  const data = parsed.data
  const adapter = pickAdapter(data.provider)
  const v = await adapter.validate({
    credential: data.credential,
    modelId: data.modelId,
    baseUrl: data.baseUrl ?? null,
  })
  const cipher = encrypt(data.credential)
  const lf = lastFour(data.credential)

  const db = getDb()
  const inserted = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(schema.aiModelEntries)
      .values({
        provider: data.provider,
        modelId: data.modelId,
        displayLabel: data.displayLabel ?? null,
        baseUrl: data.baseUrl ?? null,
        credentialCiphertext: cipher,
        credentialLastFour: lf,
        systemPrompt: data.generation.systemPrompt,
        temperature: String(data.generation.temperature),
        maxOutputTokens: data.generation.maxOutputTokens,
        extraParams: data.generation.extraParams ?? {},
        status: v.ok ? 'inactive' : 'invalid',
        validatedAt: v.ok ? new Date() : null,
        lastValidationError: v.ok ? null : (v.reason ?? 'unknown'),
        createdBy: req.session!.principal.id,
      })
      .returning()
    await auditLog.append(tx, {
      actorUserId: req.session!.principal.id,
      eventClass: 'admin',
      eventSubclass: 'ai_model_create',
      targetKind: 'ai_model_entry',
      targetId: row!.id,
      afterValue: { provider: data.provider, modelId: data.modelId, status: row!.status },
    })
    return row!
  })

  if (!v.ok) {
    return res.status(400).json({
      ...buildArErrorBody('validation_failed'),
      details: { reason: v.reason ?? 'unknown', entry: toDisplay(inserted) },
    })
  }
  res.status(201).json(toDisplay(inserted))
})

adminAiModelsRouter.patch('/:id', async (req, res) => {
  const id = req.params.id!
  const parsed = AiModelEntryUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json(buildArErrorBody('validation_failed'))
  }
  const data = parsed.data
  const db = getDb()
  const existing = (await db.select().from(schema.aiModelEntries).where(eq(schema.aiModelEntries.id, id)))[0]
  if (!existing) return res.status(404).json(buildArErrorBody('not_found'))

  // If credential is being rotated, validate it; otherwise reuse the existing ciphertext.
  let credentialCiphertext = existing.credentialCiphertext
  let credentialLastFour = existing.credentialLastFour
  let validatedAt = existing.validatedAt
  let validationError = existing.lastValidationError
  let nextStatus = existing.status

  if (data.credential) {
    const adapter = pickAdapter(existing.provider as AiModelProvider)
    const v = await adapter.validate({
      credential: data.credential,
      modelId: data.modelId ?? existing.modelId,
      baseUrl: (data.baseUrl ?? existing.baseUrl) ?? null,
    })
    if (!v.ok) {
      return res.status(400).json({
        ...buildArErrorBody('validation_failed'),
        details: { reason: v.reason ?? 'unknown' },
      })
    }
    credentialCiphertext = encrypt(data.credential)
    credentialLastFour = lastFour(data.credential)
    validatedAt = new Date()
    validationError = null
    nextStatus = existing.status === 'invalid' ? 'inactive' : existing.status
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(schema.aiModelEntries)
      .set({
        modelId: data.modelId ?? existing.modelId,
        displayLabel: data.displayLabel === undefined ? existing.displayLabel : data.displayLabel,
        baseUrl: data.baseUrl === undefined ? existing.baseUrl : data.baseUrl,
        credentialCiphertext,
        credentialLastFour,
        systemPrompt: data.generation?.systemPrompt ?? existing.systemPrompt,
        temperature: data.generation?.temperature !== undefined ? String(data.generation.temperature) : existing.temperature,
        maxOutputTokens: data.generation?.maxOutputTokens ?? existing.maxOutputTokens,
        extraParams: data.generation?.extraParams ?? existing.extraParams,
        status: nextStatus,
        validatedAt,
        lastValidationError: validationError,
        lastUpdatedBy: req.session!.principal.id,
        lastUpdatedAt: new Date(),
      })
      .where(eq(schema.aiModelEntries.id, id))
      .returning()
    await auditLog.append(tx, {
      actorUserId: req.session!.principal.id,
      eventClass: 'admin',
      eventSubclass: 'ai_model_update',
      targetKind: 'ai_model_entry',
      targetId: id,
      beforeValue: { modelId: existing.modelId, displayLabel: existing.displayLabel, status: existing.status },
      afterValue: { modelId: row!.modelId, displayLabel: row!.displayLabel, status: row!.status },
    })
    return row!
  })

  res.status(200).json(toDisplay(updated))
})

adminAiModelsRouter.delete('/:id', async (req, res) => {
  const id = req.params.id!
  const db = getDb()
  const existing = (await db.select().from(schema.aiModelEntries).where(eq(schema.aiModelEntries.id, id)))[0]
  if (!existing) return res.status(404).json(buildArErrorBody('not_found'))
  if (existing.isActive) {
    return res.status(409).json(buildArErrorBody('active_model_protected'))
  }
  await db.transaction(async (tx) => {
    await tx.delete(schema.aiModelEntries).where(eq(schema.aiModelEntries.id, id))
    await auditLog.append(tx, {
      actorUserId: req.session!.principal.id,
      eventClass: 'admin',
      eventSubclass: 'ai_model_delete',
      targetKind: 'ai_model_entry',
      targetId: id,
      beforeValue: { provider: existing.provider, modelId: existing.modelId },
    })
  })
  res.status(204).end()
})

adminAiModelsRouter.post('/:id/activate', async (req, res) => {
  const id = req.params.id!
  const db = getDb()
  const existing = (await db.select().from(schema.aiModelEntries).where(eq(schema.aiModelEntries.id, id)))[0]
  if (!existing) return res.status(404).json(buildArErrorBody('not_found'))

  // Re-validate before flipping the flag.
  let plaintext: string
  try {
    plaintext = decrypt(existing.credentialCiphertext as never)
  } catch (err) {
    logger.warn({ err: (err as Error).message, id }, 'failed to decrypt credential during activate')
    return res.status(400).json(buildArErrorBody('validation_failed'))
  }
  const adapter = pickAdapter(existing.provider as AiModelProvider)
  const v = await adapter.validate({
    credential: plaintext,
    modelId: existing.modelId,
    baseUrl: existing.baseUrl,
  })
  if (!v.ok) {
    await db
      .update(schema.aiModelEntries)
      .set({ status: 'invalid', lastValidationError: v.reason ?? 'unknown' })
      .where(eq(schema.aiModelEntries.id, id))
    return res.status(400).json({
      ...buildArErrorBody('validation_failed'),
      details: { reason: v.reason ?? 'unknown' },
    })
  }

  const updated = await db.transaction(async (tx) => {
    // Atomically clear is_active everywhere else, then set on target.
    await tx
      .update(schema.aiModelEntries)
      .set({ isActive: false, status: 'inactive' })
      .where(and(eq(schema.aiModelEntries.isActive, true), ne(schema.aiModelEntries.id, id)))
    const [row] = await tx
      .update(schema.aiModelEntries)
      .set({
        isActive: true,
        status: 'active',
        validatedAt: new Date(),
        lastValidationError: null,
        lastUpdatedBy: req.session!.principal.id,
        lastUpdatedAt: new Date(),
      })
      .where(eq(schema.aiModelEntries.id, id))
      .returning()
    await auditLog.append(tx, {
      actorUserId: req.session!.principal.id,
      eventClass: 'admin',
      eventSubclass: 'ai_model_activate',
      targetKind: 'ai_model_entry',
      targetId: id,
      afterValue: { provider: row!.provider, modelId: row!.modelId, isActive: true },
    })
    return row!
  })
  res.status(200).json(toDisplay(updated))
})

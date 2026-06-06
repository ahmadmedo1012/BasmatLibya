import { eq, and, gte } from 'drizzle-orm'
import { getDb, schema } from '../db/client.js'
import {
  detectIdentifierType,
  normaliseIdentifier,
  type IdentifierType,
  type Finding,
  type CategoryBlock,
  type CategoryKey,
  type CompletedLookupResponse,
  type ExpiredLookupResponse,
  type FailedLookupResponse,
  type EnrichmentPayload,
  i18nAr,
} from '@basmat/shared'
import { loadEnv } from '../env.js'
import { HttpError } from '../http/middleware/error.js'
import { lookupLogger } from '../observability/logger.js'

const env = loadEnv()

export interface CreatedLookup {
  id: string
  identifierType: IdentifierType
  expiresAt: Date
  reused: boolean
}

// Coalesce in-flight lookups for the same normalised identifier within this window.
const COALESCE_WINDOW_MINUTES = 5

export async function createOrCoalesceLookup(args: {
  identifierValue: string
  visitorTokenHash: string
  ownerUserId?: string | null
}): Promise<CreatedLookup> {
  const db = getDb()
  const trimmed = args.identifierValue.trim()
  const idType = detectIdentifierType(trimmed)
  const normalised = normaliseIdentifier(trimmed)

  // Coalesce: if an in_progress lookup exists for the same normalised identifier
  // within the coalesce window, return its id instead of creating a new one.
  const cutoff = new Date(Date.now() - COALESCE_WINDOW_MINUTES * 60_000)
  const existing = await db
    .select()
    .from(schema.lookups)
    .where(
      and(
        eq(schema.lookups.identifierValueNormalised, normalised),
        eq(schema.lookups.status, 'in_progress'),
        gte(schema.lookups.createdAt, cutoff)
      )
    )
    .limit(1)
  if (existing[0]) {
    // If the caller is signed in, ensure an association exists for this lookup.
    if (args.ownerUserId) {
      await db
        .insert(schema.userLookupAssociations)
        .values({ userId: args.ownerUserId, lookupId: existing[0].id })
        .onConflictDoNothing()
    }
    return {
      id: existing[0].id,
      identifierType: existing[0].identifierType as IdentifierType,
      expiresAt: existing[0].expiresAt,
      reused: true,
    }
  }

  const expiresAt = new Date(Date.now() + env.RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const inserted = await db
    .insert(schema.lookups)
    .values({
      identifierValue: trimmed,
      identifierValueNormalised: normalised,
      identifierType: idType,
      status: 'in_progress',
      visitorTokenHash: args.visitorTokenHash,
      expiresAt,
      ownerUserId: args.ownerUserId ?? null,
    })
    .returning({ id: schema.lookups.id, expiresAt: schema.lookups.expiresAt })
  const row = inserted[0]
  if (!row) throw new Error('failed to insert lookup')
  if (args.ownerUserId) {
    await db
      .insert(schema.userLookupAssociations)
      .values({ userId: args.ownerUserId, lookupId: row.id })
      .onConflictDoNothing()
  }
  lookupLogger(row.id).info({ event: 'lookup.created', idType }, 'lookup created')
  return { id: row.id, identifierType: idType, expiresAt: row.expiresAt, reused: false }
}

export async function loadLookupRow(id: string) {
  const db = getDb()
  const rows = await db.select().from(schema.lookups).where(eq(schema.lookups.id, id)).limit(1)
  return rows[0] ?? null
}

export async function cancelLookup(id: string): Promise<'cancelled' | 'already_terminal' | 'not_found'> {
  const db = getDb()
  const row = await loadLookupRow(id)
  if (!row) return 'not_found'
  if (row.status !== 'in_progress') return 'already_terminal'
  await db.transaction(async (tx) => {
    await tx
      .update(schema.lookups)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(schema.lookups.id, id))
    // Per spec: cancel produces NO partial result.
    await tx.delete(schema.findings).where(eq(schema.findings.lookupId, id))
  })
  lookupLogger(id).info({ event: 'lookup.cancelled' }, 'lookup cancelled')
  return 'cancelled'
}

export async function getLookupForResult(
  id: string
): Promise<
  | CompletedLookupResponse
  | ExpiredLookupResponse
  | FailedLookupResponse
  | { status: 'in_progress' }
  | null
> {
  const db = getDb()
  const lookup = await loadLookupRow(id)
  if (!lookup) return null

  // Expired: still keep identifier_value so US3 can offer one-click re-run.
  if (lookup.expiresAt < new Date() && lookup.status !== 'in_progress') {
    return {
      status: 'expired',
      id: lookup.id,
      identifierValue: lookup.identifierValue,
      identifierType: lookup.identifierType as IdentifierType,
      expiredAt: lookup.expiresAt.toISOString(),
    }
  }

  if (lookup.status === 'in_progress') return { status: 'in_progress' }

  if (lookup.status === 'cancelled') {
    return { status: 'failed', id: lookup.id, scope: 'cancelled' }
  }

  if (lookup.status === 'failed') {
    return { status: 'failed', id: lookup.id, scope: 'all_categories_failed' }
  }

  // status === 'completed' — assemble the polished response.
  const aggregated = await db
    .select()
    .from(schema.aggregatedResults)
    .where(eq(schema.aggregatedResults.lookupId, id))
    .limit(1)
  const agg = aggregated[0]
  if (!agg) {
    // Defensive: if completed but aggregated row missing, treat as failed.
    return { status: 'failed', id: lookup.id, scope: 'all_categories_failed' }
  }

  const cats = await db
    .select()
    .from(schema.lookupCategories)
    .where(eq(schema.lookupCategories.lookupId, id))
  const allFindings = await db
    .select()
    .from(schema.findings)
    .where(eq(schema.findings.lookupId, id))
  const sourceCategoryRows = await db.select().from(schema.sourceCategories)
  const labelByKey = new Map(sourceCategoryRows.map((r) => [r.key, r.displayLabelAr] as const))
  const orderByKey = new Map(sourceCategoryRows.map((r) => [r.key, r.orderingWeight] as const))

  const categories: CategoryBlock[] = cats
    .map((c) => {
      const findings: Finding[] = allFindings
        .filter((f) => f.categoryKey === c.categoryKey)
        .sort((a, b) => a.orderingWeight - b.orderingWeight)
        .map((f) => ({
          id: f.id,
          categoryKey: f.categoryKey as CategoryKey,
          title: f.title,
          snippet: f.snippet,
          sourceUrl: f.sourceUrl,
          sourceName: f.sourceName,
          language: f.language,
          confidence: f.confidence as Finding['confidence'],
          metadata: (f.metadata as Finding['metadata']) ?? null,
        }))
      return {
        key: c.categoryKey as CategoryKey,
        displayLabelAr: labelByKey.get(c.categoryKey) ?? c.categoryKey,
        state: c.state as CategoryBlock['state'],
        failureReason: c.failureReason,
        findings,
      }
    })
    .sort(
      (a, b) =>
        (orderByKey.get(a.key) ?? Number.MAX_SAFE_INTEGER) -
        (orderByKey.get(b.key) ?? Number.MAX_SAFE_INTEGER)
    )

  return {
    status: 'completed',
    id: lookup.id,
    identifierValue: lookup.identifierValue,
    identifierType: lookup.identifierType as IdentifierType,
    summaryHeadlineAr: agg.summaryHeadlineAr,
    totalFindings: agg.totalFindings,
    categories,
    enrichment: {
      status: agg.enrichmentStatus as 'skipped' | 'pending' | 'ready' | 'failed',
      payload: (agg.enrichmentPayload ?? null) as EnrichmentPayload | null,
    },
    createdAt: lookup.createdAt.toISOString(),
    expiresAt: lookup.expiresAt.toISOString(),
  }
}

export function buildSummaryHeadline(totalFindings: number, populatedCategoryCount: number): string {
  return i18nAr.ar.result.summaryHeadlineFmt
    .replace('{{count}}', String(totalFindings))
    .replace('{{categories}}', String(populatedCategoryCount))
}

export async function getLookupSnapshot(id: string) {
  const db = getDb()
  const lookup = await loadLookupRow(id)
  if (!lookup) return null
  const cats = await db
    .select()
    .from(schema.lookupCategories)
    .where(eq(schema.lookupCategories.lookupId, id))
  const allFindings = await db
    .select()
    .from(schema.findings)
    .where(eq(schema.findings.lookupId, id))

  let snapshotStatus: 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'expired' =
    lookup.status as 'in_progress' | 'completed' | 'failed' | 'cancelled'
  if (lookup.expiresAt < new Date() && lookup.status !== 'in_progress') {
    snapshotStatus = 'expired'
  }

  return {
    status: snapshotStatus,
    categories: cats.map((c) => ({
      key: c.categoryKey as CategoryKey,
      state: c.state as CategoryBlock['state'],
      findingsSoFar: allFindings
        .filter((f) => f.categoryKey === c.categoryKey)
        .map((f) => ({
          id: f.id,
          categoryKey: f.categoryKey as CategoryKey,
          title: f.title,
          snippet: f.snippet,
          sourceUrl: f.sourceUrl,
          sourceName: f.sourceName,
          language: f.language,
          confidence: f.confidence as Finding['confidence'],
        })),
      failureReason: c.failureReason,
    })),
    totalFindings: allFindings.length,
    startedAt: lookup.createdAt.toISOString(),
    completedAt: lookup.completedAt ? lookup.completedAt.toISOString() : null,
  }
}

export async function rerunLookup(originalId: string, visitorTokenHash: string): Promise<CreatedLookup> {
  const original = await loadLookupRow(originalId)
  if (!original) throw new HttpError(404, 'lookup_not_found')
  return createOrCoalesceLookup({
    identifierValue: original.identifierValue,
    visitorTokenHash,
  })
}

export async function markLookupFailed(id: string, reason: string) {
  const db = getDb()
  await db
    .update(schema.lookups)
    .set({ status: 'failed', completedAt: new Date(), failureReason: reason })
    .where(eq(schema.lookups.id, id))
}

export async function markLookupCompleted(
  id: string,
  totalFindings: number,
  populatedCategories: CategoryKey[],
  enrichmentStatus: 'skipped' | 'pending' = 'skipped'
) {
  const db = getDb()
  const headline = buildSummaryHeadline(totalFindings, populatedCategories.length)
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.aggregatedResults)
      .values({
        lookupId: id,
        summaryHeadlineAr: headline,
        totalFindings,
        populatedCategories,
        enrichmentStatus,
        enrichmentPayload: null,
      })
      .onConflictDoUpdate({
        target: schema.aggregatedResults.lookupId,
        set: {
          summaryHeadlineAr: headline,
          totalFindings,
          populatedCategories,
          enrichmentStatus,
        },
      })
    await tx
      .update(schema.lookups)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(schema.lookups.id, id))
  })
}

export async function setEnrichmentResult(
  lookupId: string,
  status: 'ready' | 'failed' | 'skipped',
  payload: unknown | null
) {
  const db = getDb()
  await db
    .update(schema.aggregatedResults)
    .set({
      enrichmentStatus: status,
      // Drizzle's jsonb type is strict; cast through unknown to keep the
      // service signature flexible while honouring the schema at runtime.
      enrichmentPayload: payload as never,
    })
    .where(eq(schema.aggregatedResults.lookupId, lookupId))
}

export async function loadFindingsForLookup(lookupId: string): Promise<Finding[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(schema.findings)
    .where(eq(schema.findings.lookupId, lookupId))
  return rows
    .sort((a, b) => a.orderingWeight - b.orderingWeight)
    .map((f) => ({
      id: f.id,
      categoryKey: f.categoryKey as CategoryKey,
      title: f.title,
      snippet: f.snippet,
      sourceUrl: f.sourceUrl,
      sourceName: f.sourceName,
      language: f.language,
      confidence: f.confidence as Finding['confidence'],
      metadata: (f.metadata as Finding['metadata']) ?? null,
    }))
}

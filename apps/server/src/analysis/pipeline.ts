import { eq, and } from 'drizzle-orm'
import { getDb, schema } from '../db/client.js'
import { getProviders } from './providers/registry.js'
import { insertFinding } from '../services/findings.js'
import {
  markLookupCompleted,
  markLookupFailed,
  setEnrichmentResult,
  loadFindingsForLookup,
} from '../services/lookups.js'
import { lookupLogger } from '../observability/logger.js'
import { runEnrichment } from './enrichment/index.js'
import { runFastEnrichment } from './enrichment/fast.js'
import type { CategoryKey, IdentifierType } from '@basmat/shared'
import { getRealtime } from '../realtime/socket.js'
import { loadEnv } from '../env.js'

const PER_PROVIDER_TIMEOUT_MS = 90_000
const env = loadEnv()

interface PipelineInput {
  lookupId: string
  identifierValue: string
  identifierType: IdentifierType
}

const inflight = new Map<string, AbortController>()

export function abortPipeline(lookupId: string) {
  const ac = inflight.get(lookupId)
  if (ac) {
    ac.abort()
    inflight.delete(lookupId)
  }
}

export async function runPipeline(input: PipelineInput): Promise<void> {
  const log = lookupLogger(input.lookupId)
  const ac = new AbortController()
  inflight.set(input.lookupId, ac)

  const db = getDb()
  const providers = getProviders()
  const realtime = getRealtime()

  // Bucket providers by category — run all providers per category, but in v1
  // each category has exactly one provider, so the bucketed view is a
  // category-per-provider 1:1 mapping.
  const supported = providers.filter((p) => p.supports(input.identifierType))
  const skipped = providers.filter((p) => !p.supports(input.identifierType))

  // Ensure a lookup_categories row exists per category.
  for (const p of providers) {
    await db
      .insert(schema.lookupCategories)
      .values({
        lookupId: input.lookupId,
        categoryKey: p.categoryKey,
        state: skipped.includes(p) ? 'skipped' : 'queued',
      })
      .onConflictDoNothing()
  }

  // Emit skipped events early.
  for (const p of skipped) {
    realtime?.emitCategorySkipped({
      lookupId: input.lookupId,
      categoryKey: p.categoryKey,
      reason: 'unsupported_identifier',
    })
  }

  try {
    const populatedCategories: CategoryKey[] = []
    let totalFindings = 0

    await Promise.all(
      supported.map(async (p) => {
        const startedAt = new Date()
        await db
          .update(schema.lookupCategories)
          .set({ state: 'running', startedAt })
          .where(
            and(
              eq(schema.lookupCategories.lookupId, input.lookupId),
              eq(schema.lookupCategories.categoryKey, p.categoryKey)
            )
          )
        realtime?.emitCategoryStarted({
          lookupId: input.lookupId,
          categoryKey: p.categoryKey,
          startedAt: startedAt.toISOString(),
        })

        let providerFindings = 0
        let orderingWeight = 0
        const timeout = setTimeout(() => ac.abort(), PER_PROVIDER_TIMEOUT_MS)
        try {
          for await (const raw of p.analyze(
            { identifierValue: input.identifierValue, identifierType: input.identifierType },
            { signal: ac.signal, lookupId: input.lookupId }
          )) {
            if (ac.signal.aborted) break
            const finding = await insertFinding(input.lookupId, raw, orderingWeight)
            orderingWeight += 10
            providerFindings += 1
            realtime?.emitCategoryFinding({
              lookupId: input.lookupId,
              categoryKey: p.categoryKey,
              finding,
            })
          }
          clearTimeout(timeout)
          if (ac.signal.aborted) return // skipped, lookup cancelled
          const settledAt = new Date()
          await db
            .update(schema.lookupCategories)
            .set({ state: 'completed', settledAt })
            .where(
              and(
                eq(schema.lookupCategories.lookupId, input.lookupId),
                eq(schema.lookupCategories.categoryKey, p.categoryKey)
              )
            )
          totalFindings += providerFindings
          if (providerFindings > 0) populatedCategories.push(p.categoryKey)
          realtime?.emitCategoryCompleted({
            lookupId: input.lookupId,
            categoryKey: p.categoryKey,
            findingsCount: providerFindings,
            settledAt: settledAt.toISOString(),
          })
        } catch (err) {
          clearTimeout(timeout)
          if (ac.signal.aborted) return
          const settledAt = new Date()
          const reason: 'timeout' | 'provider_unavailable' | 'unknown' =
            (err as Error)?.name === 'AbortError' ? 'timeout' : 'provider_unavailable'
          await db
            .update(schema.lookupCategories)
            .set({ state: 'failed', settledAt, failureReason: reason })
            .where(
              and(
                eq(schema.lookupCategories.lookupId, input.lookupId),
                eq(schema.lookupCategories.categoryKey, p.categoryKey)
              )
            )
          realtime?.emitCategoryFailed({
            lookupId: input.lookupId,
            categoryKey: p.categoryKey,
            failureReason: reason,
            settledAt: settledAt.toISOString(),
          })
          log.warn({ providerId: p.id, err: (err as Error).message }, 'provider failed')
        }
      })
    )

    if (ac.signal.aborted) {
      log.info('pipeline aborted')
      return
    }

    // Determine outcome: all categories failed → lookup_failed; otherwise completed.
    const cats = await db
      .select()
      .from(schema.lookupCategories)
      .where(eq(schema.lookupCategories.lookupId, input.lookupId))
    const nonSkipped = cats.filter((c) => c.state !== 'skipped')
    const allFailed = nonSkipped.length > 0 && nonSkipped.every((c) => c.state === 'failed')

    if (allFailed) {
      await markLookupFailed(input.lookupId, 'all_categories_failed')
      realtime?.emitLookupFailed({
        lookupId: input.lookupId,
        scope: 'all_categories_failed',
        failedAt: new Date().toISOString(),
      })
      log.info({ event: 'lookup.failed' }, 'lookup failed (all categories)')
    } else {
      const enrichmentEnabled = env.ENRICHMENT_ENABLED && Boolean(env.NVIDIA_API_KEY) && totalFindings > 0
      // Mark completed FIRST so the user sees the result page immediately;
      // enrichment runs in the background and emits its own events.
      await markLookupCompleted(
        input.lookupId,
        totalFindings,
        populatedCategories,
        enrichmentEnabled ? 'pending' : 'skipped'
      )
      realtime?.emitLookupCompleted({
        lookupId: input.lookupId,
        totalFindings,
        populatedCategories,
        completedAt: new Date().toISOString(),
      })
      log.info({ event: 'lookup.completed', totalFindings }, 'lookup completed')

      if (enrichmentEnabled) {
        // Fire-and-forget — do not delay lookup.completed on this.
        void runEnrichmentForLookup(input.lookupId, input.identifierValue, input.identifierType)
      }
    }
  } catch (err) {
    log.error({ err: (err as Error).message }, 'pipeline error')
    await markLookupFailed(input.lookupId, 'pipeline_error')
    realtime?.emitLookupFailed({
      lookupId: input.lookupId,
      scope: 'pipeline_error',
      failedAt: new Date().toISOString(),
    })
  } finally {
    inflight.delete(input.lookupId)
  }
}

async function runEnrichmentForLookup(
  lookupId: string,
  identifierValue: string,
  identifierType: IdentifierType
) {
  const log = lookupLogger(lookupId)
  const realtime = getRealtime()
  realtime?.emitEnrichmentStarted({
    lookupId,
    startedAt: new Date().toISOString(),
  })
  try {
    const findings = await loadFindingsForLookup(lookupId)

    // FAST PATH — single streaming call to NVIDIA_MODEL_FAST.
    // The user sees Arabic words appear within ~1 s instead of waiting for
    // a 3-stage chain (saves 30-60 s on every lookup).
    if (env.ENRICHMENT_FAST) {
      let seq = 0
      const result = await runFastEnrichment(
        { lookupId, identifierValue, identifierType, findings },
        {
          onDelta: (delta) => {
            realtime?.emitEnrichmentChunk({ lookupId, delta, seq: seq++ })
          },
        }
      )
      if (result.status === 'ready' && result.payload) {
        await setEnrichmentResult(lookupId, 'ready', result.payload)
        realtime?.emitEnrichmentReady({
          lookupId,
          payload: result.payload,
          readyAt: new Date().toISOString(),
        })
        log.info(
          { event: 'enrichment.ready', path: 'fast', ttfbMs: result.ttfbMs, totalMs: result.elapsedMs },
          'enrichment ready'
        )
        return
      }
      // Fast path failed — fall through to the slow chain so we still try.
      log.warn(
        { event: 'enrichment.fast_fail', reason: result.reason },
        'fast path failed, falling back to chain'
      )
    }

    // SLOW PATH — 3-stage chain.
    const result = await runEnrichment({
      lookupId,
      identifierValue,
      identifierType,
      findings,
    })
    if (result.status === 'ready' && result.payload) {
      await setEnrichmentResult(lookupId, 'ready', result.payload)
      realtime?.emitEnrichmentReady({
        lookupId,
        payload: result.payload,
        readyAt: new Date().toISOString(),
      })
      log.info({ event: 'enrichment.ready', path: 'chain' }, 'enrichment ready')
    } else if (result.status === 'failed') {
      await setEnrichmentResult(lookupId, 'failed', null)
      realtime?.emitEnrichmentFailed({
        lookupId,
        reason: result.error ?? 'unknown',
        failedAt: new Date().toISOString(),
      })
      log.warn({ event: 'enrichment.failed', reason: result.error }, 'enrichment failed')
    } else {
      await setEnrichmentResult(lookupId, 'skipped', null)
    }
  } catch (err) {
    log.error({ err: (err as Error).message }, 'enrichment crashed')
    await setEnrichmentResult(lookupId, 'failed', null).catch(() => {})
    realtime?.emitEnrichmentFailed({
      lookupId,
      reason: 'crash',
      failedAt: new Date().toISOString(),
    })
  }
}

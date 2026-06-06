import { z } from 'zod'
import { CategoryKeySchema, CategoryStateSchema } from './lookup.js'
import { FindingSchema, EnrichmentPayloadSchema } from './finding.js'

export const SubscribePayloadSchema = z.object({
  lookupId: z.string().uuid(),
})
export type SubscribePayload = z.infer<typeof SubscribePayloadSchema>

export const LookupSnapshotSchema = z.object({
  status: z.enum(['in_progress', 'completed', 'failed', 'cancelled', 'expired']),
  categories: z.array(
    z.object({
      key: CategoryKeySchema,
      state: CategoryStateSchema,
      findingsSoFar: z.array(FindingSchema),
      failureReason: z.string().nullable(),
    })
  ),
  totalFindings: z.number().int().nonnegative(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
})
export type LookupSnapshot = z.infer<typeof LookupSnapshotSchema>

export const SubscribeAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), replay: LookupSnapshotSchema }),
  z.object({ ok: z.literal(false), code: z.literal('lookup_not_found') }),
])
export type SubscribeAck = z.infer<typeof SubscribeAckSchema>

const baseEvent = { lookupId: z.string().uuid() }

export const CategoryStartedEventSchema = z.object({
  ...baseEvent,
  categoryKey: CategoryKeySchema,
  startedAt: z.string(),
})
export const CategoryFindingEventSchema = z.object({
  ...baseEvent,
  categoryKey: CategoryKeySchema,
  finding: FindingSchema,
})
export const CategoryCompletedEventSchema = z.object({
  ...baseEvent,
  categoryKey: CategoryKeySchema,
  findingsCount: z.number().int().nonnegative(),
  settledAt: z.string(),
})
export const CategoryFailedEventSchema = z.object({
  ...baseEvent,
  categoryKey: CategoryKeySchema,
  failureReason: z.enum(['timeout', 'provider_unavailable', 'unknown']),
  settledAt: z.string(),
})
export const CategorySkippedEventSchema = z.object({
  ...baseEvent,
  categoryKey: CategoryKeySchema,
  reason: z.literal('unsupported_identifier'),
})
export const LookupCompletedEventSchema = z.object({
  ...baseEvent,
  totalFindings: z.number().int().nonnegative(),
  populatedCategories: z.array(CategoryKeySchema),
  completedAt: z.string(),
})
export const LookupFailedEventSchema = z.object({
  ...baseEvent,
  scope: z.enum(['all_categories_failed', 'pipeline_error']),
  failedAt: z.string(),
})
export const LookupCancelledEventSchema = z.object({
  ...baseEvent,
  cancelledAt: z.string(),
})

export const EnrichmentStartedEventSchema = z.object({
  ...baseEvent,
  startedAt: z.string(),
})
export const EnrichmentChunkEventSchema = z.object({
  ...baseEvent,
  delta: z.string(),
  // Sequence number so a late subscriber can know if it missed earlier chunks.
  seq: z.number().int().nonnegative(),
})
export const EnrichmentReadyEventSchema = z.object({
  ...baseEvent,
  payload: EnrichmentPayloadSchema,
  readyAt: z.string(),
})
export const EnrichmentFailedEventSchema = z.object({
  ...baseEvent,
  reason: z.string(),
  failedAt: z.string(),
})

export interface ServerToClientEvents {
  'category.started': (e: z.infer<typeof CategoryStartedEventSchema>) => void
  'category.finding': (e: z.infer<typeof CategoryFindingEventSchema>) => void
  'category.completed': (e: z.infer<typeof CategoryCompletedEventSchema>) => void
  'category.failed': (e: z.infer<typeof CategoryFailedEventSchema>) => void
  'category.skipped': (e: z.infer<typeof CategorySkippedEventSchema>) => void
  'lookup.completed': (e: z.infer<typeof LookupCompletedEventSchema>) => void
  'lookup.failed': (e: z.infer<typeof LookupFailedEventSchema>) => void
  'lookup.cancelled': (e: z.infer<typeof LookupCancelledEventSchema>) => void
  'enrichment.started': (e: z.infer<typeof EnrichmentStartedEventSchema>) => void
  'enrichment.chunk': (e: z.infer<typeof EnrichmentChunkEventSchema>) => void
  'enrichment.ready': (e: z.infer<typeof EnrichmentReadyEventSchema>) => void
  'enrichment.failed': (e: z.infer<typeof EnrichmentFailedEventSchema>) => void
  // feature 002 — emitted into user:{userId} room
  'session.invalidated': (e: {
    userId: string
    sessionId: string
    reason: 'sign_out' | 'suspended' | 'removed' | 'manual' | 'expired' | 'rotated'
    emittedAt: string
  }) => void
}

export interface ClientToServerEvents {
  'lookup.subscribe': (
    payload: SubscribePayload,
    ack: (response: SubscribeAck) => void
  ) => void
  'lookup.unsubscribe': (payload: SubscribePayload) => void
}

export type CategoryStartedEvent = z.infer<typeof CategoryStartedEventSchema>
export type CategoryFindingEvent = z.infer<typeof CategoryFindingEventSchema>
export type CategoryCompletedEvent = z.infer<typeof CategoryCompletedEventSchema>
export type CategoryFailedEvent = z.infer<typeof CategoryFailedEventSchema>
export type CategorySkippedEvent = z.infer<typeof CategorySkippedEventSchema>
export type LookupCompletedEvent = z.infer<typeof LookupCompletedEventSchema>
export type LookupFailedEvent = z.infer<typeof LookupFailedEventSchema>
export type LookupCancelledEvent = z.infer<typeof LookupCancelledEventSchema>
export type EnrichmentStartedEvent = z.infer<typeof EnrichmentStartedEventSchema>
export type EnrichmentChunkEvent = z.infer<typeof EnrichmentChunkEventSchema>
export type EnrichmentReadyEvent = z.infer<typeof EnrichmentReadyEventSchema>
export type EnrichmentFailedEvent = z.infer<typeof EnrichmentFailedEventSchema>

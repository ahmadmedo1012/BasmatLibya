import { z } from 'zod'
import { CategoryKeySchema, CategoryStateSchema, LookupStatusSchema } from './lookup.js'
import { IdentifierTypeSchema } from './identifier.js'

export const ConfidenceSchema = z.enum(['high', 'medium', 'low'])
export type Confidence = z.infer<typeof ConfidenceSchema>

/**
 * Rich, structured profile metadata extracted from a public source.
 * Findings that only confirm existence carry `metadata: null`.
 */
export const FindingMetadataSchema = z
  .object({
    fullname: z.string().nullable().optional(),
    bio: z.string().nullable().optional(),
    imageUrl: z.string().url().nullable().optional(),
    followerCount: z.coerce.number().int().nullable().optional(),
    followingCount: z.coerce.number().int().nullable().optional(),
    location: z.string().nullable().optional(),
    blogUrl: z.string().url().nullable().optional(),
    joinedAt: z.string().nullable().optional(),
    isVerified: z.boolean().nullable().optional(),
    uid: z.string().nullable().optional(),
    company: z.string().nullable().optional(),
    publicRepos: z.coerce.number().int().nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
  })
  .partial()
export type FindingMetadata = z.infer<typeof FindingMetadataSchema>

export const FindingSchema = z.object({
  id: z.string().uuid(),
  categoryKey: CategoryKeySchema,
  title: z.string(),
  snippet: z.string().nullable().optional(),
  sourceUrl: z.string().url().nullable().optional(),
  sourceName: z.string(),
  language: z.string().nullable().optional(),
  confidence: ConfidenceSchema,
  metadata: FindingMetadataSchema.nullable().optional(),
})
export type Finding = z.infer<typeof FindingSchema>

export const CategoryBlockSchema = z.object({
  key: CategoryKeySchema,
  displayLabelAr: z.string(),
  state: CategoryStateSchema,
  failureReason: z.string().nullable().optional(),
  findings: z.array(FindingSchema),
})
export type CategoryBlock = z.infer<typeof CategoryBlockSchema>

export const EnrichmentPayloadSchema = z.object({
  headlineAr: z.string(),
  summaryAr: z.string(),
  highlightsAr: z.array(z.string()).max(6),
  identityClusters: z
    .array(
      z.object({
        labelAr: z.string(),
        confidence: z.enum(['high', 'medium', 'low']),
        findingIds: z.array(z.string()),
        rationaleAr: z.string(),
      })
    )
    .max(3),
  riskFlagsAr: z.array(z.string()).max(4),
  gapsAr: z.array(z.string()).max(4),
  modelChain: z.object({
    analyzer: z.string(),
    reasoner: z.string(),
    writer: z.string(),
  }),
})
export type EnrichmentPayload = z.infer<typeof EnrichmentPayloadSchema>

export const EnrichmentSlotSchema = z.object({
  status: z.enum(['skipped', 'pending', 'ready', 'failed']),
  payload: EnrichmentPayloadSchema.nullable().optional(),
})
export type EnrichmentSlot = z.infer<typeof EnrichmentSlotSchema>

export const CompletedLookupResponseSchema = z.object({
  status: z.literal('completed'),
  id: z.string().uuid(),
  identifierValue: z.string(),
  identifierType: IdentifierTypeSchema,
  summaryHeadlineAr: z.string(),
  totalFindings: z.number().int().nonnegative(),
  categories: z.array(CategoryBlockSchema),
  enrichment: EnrichmentSlotSchema,
  createdAt: z.string(),
  expiresAt: z.string(),
})
export type CompletedLookupResponse = z.infer<typeof CompletedLookupResponseSchema>

export const ExpiredLookupResponseSchema = z.object({
  status: z.literal('expired'),
  id: z.string().uuid(),
  identifierValue: z.string(),
  identifierType: IdentifierTypeSchema,
  expiredAt: z.string(),
})
export type ExpiredLookupResponse = z.infer<typeof ExpiredLookupResponseSchema>

export const FailedLookupResponseSchema = z.object({
  status: z.literal('failed'),
  id: z.string().uuid(),
  scope: z.enum(['all_categories_failed', 'cancelled']),
})
export type FailedLookupResponse = z.infer<typeof FailedLookupResponseSchema>

export const LookupResponseSchema = z.discriminatedUnion('status', [
  CompletedLookupResponseSchema,
  ExpiredLookupResponseSchema,
  FailedLookupResponseSchema,
])
export type LookupResponse = z.infer<typeof LookupResponseSchema>

export const LookupStatusEnvelopeSchema = LookupStatusSchema

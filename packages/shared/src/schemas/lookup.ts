import { z } from 'zod'
import { IdentifierTypeSchema } from './identifier.js'

export const CategoryKeySchema = z.enum([
  'social_presence',
  'public_mentions',
  'contact_signals',
  'reputation_indicators',
  'profile_imagery',
])
export type CategoryKey = z.infer<typeof CategoryKeySchema>

export const CategoryStateSchema = z.enum(['queued', 'running', 'completed', 'failed', 'skipped'])
export type CategoryState = z.infer<typeof CategoryStateSchema>

export const LookupStatusSchema = z.enum(['in_progress', 'completed', 'cancelled', 'failed'])
export type LookupStatus = z.infer<typeof LookupStatusSchema>

export const CreateLookupResponseSchema = z.object({
  id: z.string().uuid(),
  identifierType: IdentifierTypeSchema,
  status: z.literal('in_progress'),
  expiresAt: z.string(),
  socketRoom: z.string(),
})
export type CreateLookupResponse = z.infer<typeof CreateLookupResponseSchema>

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  db: z.enum(['ok', 'down']),
  version: z.string(),
})
export type HealthResponse = z.infer<typeof HealthResponseSchema>

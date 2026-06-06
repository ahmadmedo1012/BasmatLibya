import { z } from 'zod'

export const ErrorCodeSchema = z.enum([
  // v1 codes
  'identifier_invalid',
  'identifier_too_short',
  'identifier_too_long',
  'rate_limited',
  'lookup_in_progress',
  'lookup_not_found',
  'free_trial_exhausted',

  // feature 002 — auth
  'not_authenticated',
  'unauthorized',
  'csrf_required',
  'hmac_invalid',
  'auth_date_too_old',
  'bot_unavailable',
  'suspended_user',

  // feature 002 — admin
  'validation_failed',
  'last_owner_protected',
  'dependent_entries',
  'active_model_protected',
  'not_found',
])
export type ErrorCode = z.infer<typeof ErrorCodeSchema>

export const ErrorResponseSchema = z.object({
  code: ErrorCodeSchema,
  /**
   * Arabic copy the client renders directly. Non-empty: empty `messageAr`
   * is meaningless (the client would have to fall back, defeating the
   * purpose of the localised error). Routes enforce this at the
   * `buildArErrorBody(code)` choke-point.
   */
  messageAr: z.string().min(1),
  retryAfterSeconds: z.number().int().nonnegative().nullable().optional(),
  details: z.record(z.unknown()).nullable().optional(),
})
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>

import { z } from 'zod'

/** Cookie name and lifetime constants (R-02, R-04). */
export const SESSION_COOKIE_NAME = 'bsl_session'
export const SESSION_LIFETIME_DAYS_DEFAULT = 30
export const SESSION_LIFETIME_DAYS_MAX = 90

export const RoleSchema = z.enum(['owner', 'user'])
export type Role = z.infer<typeof RoleSchema>

export const UserStatusSchema = z.enum(['active', 'suspended'])
export type UserStatus = z.infer<typeof UserStatusSchema>

export const PrincipalSchema = z.object({
  id: z.string().uuid(),
  telegramId: z.coerce.number().int().positive(),
  displayName: z.string(),
  username: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  role: RoleSchema,
  status: UserStatusSchema,
})
export type Principal = z.infer<typeof PrincipalSchema>

export const AuthMeResponseSchema = z.object({
  principal: PrincipalSchema,
  csrfToken: z.string().min(16),
  sessionExpiresAt: z.string(),
})
export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>

export const SessionInvalidatedReasonSchema = z.enum([
  'sign_out',
  'suspended',
  'removed',
  'manual',
  'expired',
  'rotated',
])
export type SessionInvalidatedReason = z.infer<typeof SessionInvalidatedReasonSchema>

export const SessionInvalidatedEventSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
  reason: SessionInvalidatedReasonSchema,
  emittedAt: z.string(),
})
export type SessionInvalidatedEvent = z.infer<typeof SessionInvalidatedEventSchema>

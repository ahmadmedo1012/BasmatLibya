import { z } from 'zod'
import { AdminUserSummarySchema } from './users.js'

export const AuditEventClassSchema = z.enum(['auth', 'admin'])
export type AuditEventClass = z.infer<typeof AuditEventClassSchema>

/**
 * Stable subclass strings used by `auditLog.append`.
 * Adding a new subclass is a code-only change; readers tolerate unknown values.
 */
export const AuditEventSubclassSchema = z.enum([
  // auth
  'sign_in_attempt',
  'sign_in_success',
  'sign_in_failure',
  'sign_out',
  'session_revoked',
  'session_expired',
  // admin — users
  'user_suspend',
  'user_unsuspend',
  'user_remove',
  // admin — ai models
  'ai_model_create',
  'ai_model_update',
  'ai_model_delete',
  'ai_model_activate',
  // admin — site settings
  'site_setting_update',
  // me — history
  'history_hide',
])
export type AuditEventSubclass = z.infer<typeof AuditEventSubclassSchema>

export const AuditEntrySchema = z.object({
  id: z.string().uuid(),
  actor: AdminUserSummarySchema.nullable(),
  eventClass: AuditEventClassSchema,
  // Tolerant of unknown subclasses for forward-compat reads.
  eventSubclass: z.string(),
  targetKind: z.string().nullable(),
  targetId: z.string().nullable(),
  beforeValue: z.unknown().nullable(),
  afterValue: z.unknown().nullable(),
  createdAt: z.string(),
})
export type AuditEntry = z.infer<typeof AuditEntrySchema>

export const AuditPageSchema = z.object({
  items: z.array(AuditEntrySchema),
  nextCursor: z.string().nullable(),
})
export type AuditPage = z.infer<typeof AuditPageSchema>

export const AuditFiltersSchema = z.object({
  eventClass: AuditEventClassSchema.optional(),
  actorUserId: z.string().uuid().optional(),
  targetKind: z.string().optional(),
  targetId: z.string().optional(),
  cursor: z.string().nullable().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})
export type AuditFilters = z.infer<typeof AuditFiltersSchema>

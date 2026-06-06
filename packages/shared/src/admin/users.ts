import { z } from 'zod'
import { RoleSchema, UserStatusSchema } from '../auth/session.js'
import { IdentifierTypeSchema } from '../schemas/identifier.js'

export const AdminUserSummarySchema = z.object({
  id: z.string().uuid(),
  telegramId: z.coerce.number().int().positive(),
  displayName: z.string(),
  username: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  role: RoleSchema,
  status: UserStatusSchema,
  joinedAt: z.string(),
  lastSeenAt: z.string(),
  suspendedAt: z.string().nullable(),
})
export type AdminUserSummary = z.infer<typeof AdminUserSummarySchema>

export const LookupHistoryItemSchema = z.object({
  lookupId: z.string().uuid(),
  identifierType: IdentifierTypeSchema,
  identifierPreview: z.string(),
  status: z.enum(['in_progress', 'completed', 'failed', 'cancelled', 'expired']),
  createdAt: z.string(),
  expiresAt: z.string(),
})
export type LookupHistoryItem = z.infer<typeof LookupHistoryItemSchema>

export const AdminUserDetailSchema = AdminUserSummarySchema.extend({
  history: z.array(LookupHistoryItemSchema),
  activeSessions: z.number().int().nonnegative(),
})
export type AdminUserDetail = z.infer<typeof AdminUserDetailSchema>

export const AdminUsersPageSchema = z.object({
  items: z.array(AdminUserSummarySchema),
  nextCursor: z.string().nullable(),
})
export type AdminUsersPage = z.infer<typeof AdminUsersPageSchema>

export const HistoryPageSchema = z.object({
  items: z.array(LookupHistoryItemSchema),
  nextCursor: z.string().nullable(),
})
export type HistoryPage = z.infer<typeof HistoryPageSchema>

export const AdminUserListFiltersSchema = z.object({
  status: UserStatusSchema.optional(),
  role: RoleSchema.optional(),
  sort: z.enum(['joined_desc', 'last_seen_desc']).default('last_seen_desc'),
  cursor: z.string().nullable().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})
export type AdminUserListFilters = z.infer<typeof AdminUserListFiltersSchema>

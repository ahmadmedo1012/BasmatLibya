/**
 * Typed admin API client (US2). Lazy-imported only by the admin chunk.
 * Errors surface server-side Arabic copy via `error.messageAr`.
 */

import {
  AiModelEntryDisplaySchema,
  AdminUsersPageSchema,
  AdminUserDetailSchema,
  AdminUserSummarySchema,
  AuditPageSchema,
  ErrorResponseSchema,
  SiteSettingsMapSchema,
  type AiModelEntryCreate,
  type AiModelEntryUpdate,
  type AiModelEntryDisplay,
  type AdminUserSummary,
  type AdminUserDetail,
  type AdminUsersPage,
  type AuditPage,
  type AuditFilters,
  type SiteSettingsMap,
  type SiteSettingsPatch,
  type ErrorResponse,
} from '@basmat/shared'
import { z } from 'zod'
import { getCsrfToken } from './auth.js'

export class AdminApiError extends Error {
  constructor(public readonly status: number, public readonly payload: ErrorResponse) {
    super(payload.code)
  }
}

async function adminFetch(input: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  }
  const csrf = getCsrfToken()
  if (csrf && method !== 'GET' && method !== 'HEAD') {
    headers['X-CSRF'] = csrf
  }
  return fetch(input, { credentials: 'include', ...init, headers })
}

async function fail(res: Response): Promise<never> {
  let payload: ErrorResponse
  try {
    payload = ErrorResponseSchema.parse(await res.json())
  } catch {
    payload = { code: 'not_found', messageAr: 'حدث خلل غير متوقع.', retryAfterSeconds: null }
  }
  throw new AdminApiError(res.status, payload)
}

// ---------- AI Models ----------
export async function listAiModels(): Promise<AiModelEntryDisplay[]> {
  const res = await adminFetch('/api/admin/ai-models')
  if (!res.ok) await fail(res)
  return z.array(AiModelEntryDisplaySchema).parse(await res.json())
}

export async function createAiModel(input: AiModelEntryCreate): Promise<AiModelEntryDisplay> {
  const res = await adminFetch('/api/admin/ai-models', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.ok) await fail(res)
  return AiModelEntryDisplaySchema.parse(await res.json())
}

export async function updateAiModel(id: string, input: AiModelEntryUpdate): Promise<AiModelEntryDisplay> {
  const res = await adminFetch(`/api/admin/ai-models/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  if (!res.ok) await fail(res)
  return AiModelEntryDisplaySchema.parse(await res.json())
}

export async function activateAiModel(id: string): Promise<AiModelEntryDisplay> {
  const res = await adminFetch(`/api/admin/ai-models/${id}/activate`, { method: 'POST' })
  if (!res.ok) await fail(res)
  return AiModelEntryDisplaySchema.parse(await res.json())
}

export async function deleteAiModel(id: string): Promise<void> {
  const res = await adminFetch(`/api/admin/ai-models/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) await fail(res)
}

// ---------- Users ----------
export async function listUsers(params: {
  status?: 'active' | 'suspended'
  role?: 'owner' | 'user'
  sort?: 'joined_desc' | 'last_seen_desc'
  limit?: number
}): Promise<AdminUsersPage> {
  const q = new URLSearchParams()
  if (params.status) q.set('status', params.status)
  if (params.role) q.set('role', params.role)
  if (params.sort) q.set('sort', params.sort)
  if (params.limit) q.set('limit', String(params.limit))
  const res = await adminFetch(`/api/admin/users?${q.toString()}`)
  if (!res.ok) await fail(res)
  return AdminUsersPageSchema.parse(await res.json())
}

export async function getUser(id: string): Promise<AdminUserDetail> {
  const res = await adminFetch(`/api/admin/users/${id}`)
  if (!res.ok) await fail(res)
  return AdminUserDetailSchema.parse(await res.json())
}

export async function suspendUser(id: string): Promise<AdminUserSummary> {
  const res = await adminFetch(`/api/admin/users/${id}/suspend`, { method: 'POST' })
  if (!res.ok) await fail(res)
  return AdminUserSummarySchema.parse(await res.json())
}

export async function unsuspendUser(id: string): Promise<AdminUserSummary> {
  const res = await adminFetch(`/api/admin/users/${id}/unsuspend`, { method: 'POST' })
  if (!res.ok) await fail(res)
  return AdminUserSummarySchema.parse(await res.json())
}

export async function deleteUser(id: string): Promise<void> {
  const res = await adminFetch(`/api/admin/users/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) await fail(res)
}

// ---------- Site Settings ----------
export async function getSiteSettings(): Promise<SiteSettingsMap> {
  const res = await adminFetch('/api/admin/site-settings')
  if (!res.ok) await fail(res)
  return SiteSettingsMapSchema.parse(await res.json())
}

export async function patchSiteSettings(patch: SiteSettingsPatch): Promise<SiteSettingsMap> {
  const res = await adminFetch('/api/admin/site-settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  if (!res.ok) await fail(res)
  return SiteSettingsMapSchema.parse(await res.json())
}

// ---------- Audit ----------
export async function listAudit(filters: Partial<AuditFilters>): Promise<AuditPage> {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null) q.set(k, String(v))
  }
  const res = await adminFetch(`/api/admin/audit?${q.toString()}`)
  if (!res.ok) await fail(res)
  return AuditPageSchema.parse(await res.json())
}

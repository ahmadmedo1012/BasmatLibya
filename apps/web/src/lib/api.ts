import {
  CreateLookupRequestSchema,
  CreateLookupResponseSchema,
  LookupResponseSchema,
  ErrorResponseSchema,
  type CreateLookupRequest,
  type CreateLookupResponse,
  type LookupResponse,
  type ErrorResponse,
} from '@basmat/shared'
import { getCsrfToken } from './auth.js'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: ErrorResponse
  ) {
    super(payload.code)
  }
}

async function parseError(res: Response): Promise<never> {
  let payload: ErrorResponse
  try {
    payload = ErrorResponseSchema.parse(await res.json())
  } catch {
    payload = {
      code: 'identifier_invalid',
      messageAr: 'حدث خلل غير متوقع.',
      retryAfterSeconds: null,
    }
  }
  throw new ApiError(res.status, payload)
}

async function doFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  }
  // Attach CSRF for state-changing requests when we have a session.
  const csrf = getCsrfToken()
  const method = (init?.method ?? 'GET').toUpperCase()
  if (csrf && method !== 'GET' && method !== 'HEAD' && !headers['X-CSRF']) {
    headers['X-CSRF'] = csrf
  }
  const res = await fetch(input, {
    credentials: 'include',
    ...init,
    headers,
  })
  return res
}

export async function createLookup(req: CreateLookupRequest): Promise<CreateLookupResponse> {
  CreateLookupRequestSchema.parse(req)
  const res = await doFetch('/api/lookups', { method: 'POST', body: JSON.stringify(req) })
  if (!res.ok) await parseError(res)
  return CreateLookupResponseSchema.parse(await res.json())
}

export async function getLookup(id: string): Promise<LookupResponse> {
  const res = await doFetch(`/api/lookups/${id}`, { method: 'GET' })
  if (!res.ok) await parseError(res)
  return LookupResponseSchema.parse(await res.json())
}

export async function cancelLookup(id: string): Promise<void> {
  const res = await doFetch(`/api/lookups/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) await parseError(res)
}

export async function rerunLookup(id: string): Promise<CreateLookupResponse> {
  const res = await doFetch(`/api/lookups/${id}/rerun`, { method: 'POST' })
  if (!res.ok) await parseError(res)
  return CreateLookupResponseSchema.parse(await res.json())
}

export interface TrialState {
  used: number
  limit: number
  remaining: number
  exhausted: boolean
}

export async function getTrial(): Promise<TrialState> {
  const res = await doFetch('/api/lookups/trial', { method: 'GET' })
  if (!res.ok) {
    return { used: 0, limit: 3, remaining: 3, exhausted: false }
  }
  const json = (await res.json()) as Partial<TrialState>
  return {
    used: Number(json.used ?? 0),
    limit: Number(json.limit ?? 3),
    remaining: Number(json.remaining ?? 3),
    exhausted: Boolean(json.exhausted ?? false),
  }
}

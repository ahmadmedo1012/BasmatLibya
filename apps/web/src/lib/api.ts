import { MockLookupService } from '../data/mock-lookup.js'
import type {
  CreateLookupRequest,
  CreateLookupResponse,
  LookupResponse,
} from '@basmat/shared'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: { code: string; messageAr: string }
  ) {
    super(payload.code)
  }
}

export async function createLookup(req: CreateLookupRequest): Promise<CreateLookupResponse> {
  const result = MockLookupService.createLookup()
  return {
    id: result.id,
    identifierType: 'name',
    status: 'in_progress',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    socketRoom: `lookup:${result.id}`,
  }
}

export async function getLookup(id: string): Promise<LookupResponse> {
  return MockLookupService.getLookup(id)
}

export async function cancelLookup(_id: string): Promise<void> {}

export async function rerunLookup(_id: string): Promise<{ id: string }> {
  return MockLookupService.createLookup()
}

export interface TrialState {
  used: number
  limit: number
  remaining: number
  exhausted: boolean
}

export async function getTrial(): Promise<TrialState> {
  return MockLookupService.getTrial()
}

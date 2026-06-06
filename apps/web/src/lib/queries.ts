import { MockLookupService } from '../data/mock-lookup.js'
import type { CreateLookupRequest } from '@basmat/shared'

function fakeMutation<TResult, TArgs = void>() {
  let state: { isPending: boolean; data: TResult | null; error: unknown } = {
    isPending: false,
    data: null,
    error: null,
  }
  const listeners = new Set<() => void>()
  function notify() {
    listeners.forEach((fn) => fn())
  }
  return {
    get state() {
      return state
    },
    mutateAsync: async (args: TArgs): Promise<TResult> => {
      state = { ...state, isPending: true }
      notify()
      try {
        const result = await Promise.resolve(
          (null as unknown) as TResult
        )
        state = { isPending: false, data: result, error: null }
        notify()
        return result
      } catch (err) {
        state = { isPending: false, data: null, error: err }
        notify()
        throw err
      }
    },
    mutate: (args: TArgs) => {
      state = { ...state, isPending: true }
      notify()
    },
    isPending: false,
    subscribe: (cb: () => void) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }
}

export function useCreateLookup() {
  return {
    mutateAsync: async (req: CreateLookupRequest) => {
      const result = MockLookupService.createLookup()
      return {
        id: result.id,
        identifierType: 'name' as const,
        status: 'in_progress' as const,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        socketRoom: `lookup:${result.id}`,
      }
    },
    isPending: false,
    isError: false,
    error: null,
    reset: () => {},
  }
}

export function useTrialState() {
  return {
    data: MockLookupService.getTrial(),
    isLoading: false,
    isError: false,
    error: null,
  }
}

export function useLookup(id: string | undefined, _opts?: unknown) {
  const data = id ? MockLookupService.getLookup(id) : undefined
  return {
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: async () => ({ data }),
  }
}

export function useRerunLookup() {
  return {
    mutateAsync: async (_id: string) => MockLookupService.createLookup(),
    isPending: false,
  }
}

export function useCancelLookup() {
  return {
    mutateAsync: async (_id: string) => {},
    isPending: false,
  }
}

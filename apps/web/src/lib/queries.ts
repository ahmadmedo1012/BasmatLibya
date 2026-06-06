import { useRef } from 'react'
import { useMutation, useQuery, type Query } from '@tanstack/react-query'
import * as api from './api.js'
import type { CreateLookupRequest, LookupResponse } from '@basmat/shared'

/**
 * Time window (ms) during which a second `mutate()` call from the same
 * component is dropped at the client. The server also coalesces (5-min
 * window — see apps/server/src/services/lookups.ts:30), but the client
 * guard prevents the wasted network round-trip and the UI "double flash".
 */
const CLIENT_COALESCE_MS = 500

export function useCreateLookup() {
  // FR-016: per-component debounce so a double-click never produces two
  // network requests. The server's 5-min coalesce is the durable guarantee
  // (a second tab clicking at the same time still gets the same id back);
  // this guard is the cheaper, faster one.
  const lastSubmitRef = useRef<{ identifier: string; at: number } | null>(null)

  return useMutation({
    mutationKey: ['create-lookup'],
    mutationFn: (req: CreateLookupRequest) => api.createLookup(req),
    onMutate: (req) => {
      const now = Date.now()
      const last = lastSubmitRef.current
      if (last && last.identifier === req.identifier && now - last.at < CLIENT_COALESCE_MS) {
        // Throw a sentinel that onError will re-throw so the caller
        // sees a no-op (no error UI, no toast).
        const err = new Error('coalesced')
        err.name = 'CoalescedSubmit'
        throw err
      }
      lastSubmitRef.current = { identifier: req.identifier, at: now }
    },
  })
}

export function useTrialState() {
  return useQuery({
    queryKey: ['trial-state'],
    queryFn: api.getTrial,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}

type RefetchInterval =
  | number
  | false
  | ((query: Query<LookupResponse, Error>) => number | false | undefined)

export function useLookup(
  id: string | undefined,
  opts?: { enabled?: boolean; refetchInterval?: RefetchInterval }
) {
  return useQuery({
    queryKey: ['lookup', id],
    enabled: Boolean(id) && (opts?.enabled ?? true),
    queryFn: () => api.getLookup(id!),
    retry: (failureCount, err) => {
      if (err instanceof api.ApiError && (err.status === 404 || err.status === 409)) return false
      return failureCount < 2
    },
    refetchInterval: opts?.refetchInterval ?? false,
  })
}

export function useRerunLookup() {
  return useMutation({
    mutationFn: (id: string) => api.rerunLookup(id),
  })
}

export function useCancelLookup() {
  return useMutation({
    mutationFn: (id: string) => api.cancelLookup(id),
  })
}

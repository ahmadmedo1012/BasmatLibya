import { useMutation, useQuery, type Query } from '@tanstack/react-query'
import * as api from './api.js'
import type { CreateLookupRequest, LookupResponse } from '@basmat/shared'

export function useCreateLookup() {
  return useMutation({
    mutationFn: (req: CreateLookupRequest) => api.createLookup(req),
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

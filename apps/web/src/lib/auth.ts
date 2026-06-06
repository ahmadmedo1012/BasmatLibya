import type { Principal } from '@basmat/shared'

export function getCsrfToken(): string | null {
  return null
}

export class AuthError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(code)
  }
}

export function usePrincipal(): Principal | null {
  return null
}

export function useAuthMe() {
  return { data: null, isLoading: false, error: null }
}

export function useSignOut() {
  return {
    mutate: () => {},
    mutateAsync: async () => {},
    isPending: false,
  }
}

export async function submitTelegramPayload(_payload: Record<string, unknown>): Promise<never> {
  throw new AuthError(503, 'service_unavailable')
}

export function attachTelegramWidget(_opts: {
  el: HTMLElement
  botUsername: string
  onPayload: (payload: Record<string, unknown>) => void
  size?: 'small' | 'medium' | 'large'
  cornerRadius?: number
}): () => void {
  return () => {}
}

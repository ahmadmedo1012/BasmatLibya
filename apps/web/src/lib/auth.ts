/**
 * Auth client — useAuthMe hook, sign-in (Telegram callback), sign-out.
 *
 * Flow:
 *   - SignInPage mounts the Telegram Login Widget script (R-01); the widget
 *     calls a global JS callback that POSTs the payload to /api/auth/telegram.
 *   - On success, /me returns the principal + csrfToken; we stash csrfToken
 *     in module-scope so future fetches set X-CSRF.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AuthMeResponseSchema,
  type AuthMeResponse,
  type Principal,
} from '@basmat/shared'

let csrfToken: string | null = null

export function getCsrfToken(): string | null {
  return csrfToken
}

export class AuthError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(code)
  }
}

async function fetchMe(): Promise<AuthMeResponse | null> {
  const res = await fetch('/api/auth/me', { credentials: 'include' })
  if (res.status === 401) {
    csrfToken = null
    return null
  }
  if (!res.ok) throw new AuthError(res.status, 'auth_me_failed')
  const parsed = AuthMeResponseSchema.parse(await res.json())
  csrfToken = parsed.csrfToken
  return parsed
}

export function useAuthMe() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

export function usePrincipal(): Principal | null {
  const { data } = useAuthMe()
  return data?.principal ?? null
}

export function useSignOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'include',
        headers: csrfToken ? { 'X-CSRF': csrfToken } : undefined,
      })
      if (!res.ok && res.status !== 204) {
        throw new AuthError(res.status, 'sign_out_failed')
      }
      csrfToken = null
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })
}

/**
 * Submit a Telegram payload received from the Login Widget callback to the
 * server. On success, the cookie is set and /me is invalidated so the next
 * render shows the signed-in principal.
 */
export async function submitTelegramPayload(payload: Record<string, unknown>): Promise<AuthMeResponse> {
  const res = await fetch('/api/auth/telegram', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    let code = 'sign_in_failed'
    try {
      const body = await res.json()
      if (body && typeof body.code === 'string') code = body.code
    } catch {
      /* ignore */
    }
    throw new AuthError(res.status, code)
  }
  const parsed = AuthMeResponseSchema.parse(await res.json())
  csrfToken = parsed.csrfToken
  return parsed
}

/**
 * Mount the Telegram Login Widget into the given DOM element.
 * Returns a cleanup function that detaches the widget.
 *
 * Bot username (without @) is read from `import.meta.env.VITE_TELEGRAM_BOT_USERNAME`
 * — set in apps/web/.env.local for development.
 */
export function attachTelegramWidget(opts: {
  el: HTMLElement
  botUsername: string
  onPayload: (payload: Record<string, unknown>) => void
  size?: 'small' | 'medium' | 'large'
  cornerRadius?: number
}): () => void {
  const callbackName = `__bsl_tg_login_${Math.random().toString(36).slice(2)}`
  ;(window as unknown as Record<string, unknown>)[callbackName] = (payload: Record<string, unknown>) => {
    opts.onPayload(payload)
  }
  const script = document.createElement('script')
  script.async = true
  script.src = 'https://telegram.org/js/telegram-widget.js?22'
  script.setAttribute('data-telegram-login', opts.botUsername)
  script.setAttribute('data-size', opts.size ?? 'large')
  script.setAttribute('data-radius', String(opts.cornerRadius ?? 12))
  script.setAttribute('data-onauth', `${callbackName}(user)`)
  script.setAttribute('data-request-access', 'write')
  opts.el.appendChild(script)
  return () => {
    script.remove()
    delete (window as unknown as Record<string, unknown>)[callbackName]
  }
}

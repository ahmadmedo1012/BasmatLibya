/**
 * Session cookie helpers (R-04, T010).
 *
 * Cookie name + lifetime + attributes. `Secure`, `HttpOnly`,
 * `SameSite=Lax`, `Path=/`, and `COOKIE_DOMAIN` are sourced from the
 * shared `cookie-policy.ts` so the visitor cookie and the session cookie
 * cannot drift again.
 */

import type { Request, Response } from 'express'
import { parse, serialize } from 'cookie'
import { SESSION_COOKIE_NAME } from '@basmat/shared'
import { getCookiePolicy } from './cookie-policy.js'

export function readSessionCookie(req: Request): string | null {
  const header = req.header('cookie')
  if (!header) return null
  const cookies = parse(header)
  const v = cookies[SESSION_COOKIE_NAME]
  return v ? v : null
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  const policy = getCookiePolicy()
  const value = serialize(SESSION_COOKIE_NAME, token, {
    ...policy,
    expires: expiresAt,
  })
  res.appendHeader('Set-Cookie', value)
}

export function clearSessionCookie(res: Response): void {
  const policy = getCookiePolicy()
  const value = serialize(SESSION_COOKIE_NAME, '', {
    ...policy,
    maxAge: 0,
  })
  res.appendHeader('Set-Cookie', value)
}

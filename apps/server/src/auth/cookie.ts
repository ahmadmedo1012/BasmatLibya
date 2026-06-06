/**
 * Session cookie helpers (R-04).
 *
 * Cookie name + lifetime + attributes. Production gates `Secure` on
 * NODE_ENV === 'production' so localhost dev works without TLS.
 */

import type { Request, Response } from 'express'
import { parse, serialize } from 'cookie'
import { SESSION_COOKIE_NAME } from '@basmat/shared'
import { loadEnv } from '../env.js'

export function readSessionCookie(req: Request): string | null {
  const header = req.header('cookie')
  if (!header) return null
  const cookies = parse(header)
  const v = cookies[SESSION_COOKIE_NAME]
  return v ? v : null
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  const env = loadEnv()
  const value = serialize(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
    domain: env.COOKIE_DOMAIN || undefined,
  })
  res.appendHeader('Set-Cookie', value)
}

export function clearSessionCookie(res: Response): void {
  const env = loadEnv()
  const value = serialize(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    domain: env.COOKIE_DOMAIN || undefined,
  })
  res.appendHeader('Set-Cookie', value)
}

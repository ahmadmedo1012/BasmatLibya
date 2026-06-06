import type { Request, Response, NextFunction } from 'express'
import { randomBytes, createHash } from 'node:crypto'
import { serialize } from 'cookie'
import { getCookiePolicy } from '../../auth/cookie-policy.js'

const COOKIE_NAME = 'basmat_visitor'
const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365

declare module 'express' {
  interface Request {
    visitorToken?: string
    visitorTokenHash?: string
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {}
  const out: Record<string, string> = {}
  for (const part of header.split(';')) {
    const [k, ...rest] = part.split('=')
    if (!k) continue
    out[k.trim()] = decodeURIComponent(rest.join('=').trim())
  }
  return out
}

export function visitorTokenMiddleware(req: Request, res: Response, next: NextFunction) {
  const cookies = parseCookies(req.header('cookie'))
  let token = cookies[COOKIE_NAME]
  if (!token || token.length < 16) {
    token = randomBytes(24).toString('hex')
    // T010 / R-4: Secure is now applied in production via the shared
    // cookie policy (was missing before; the two cookie helpers had
    // drifted).
    const policy = getCookiePolicy()
    const value = serialize(COOKIE_NAME, encodeURIComponent(token), {
      ...policy,
      maxAge: Math.floor(ONE_YEAR_MS / 1000),
    })
    res.appendHeader('Set-Cookie', value)
  }
  ;(req as Request & { visitorToken: string; visitorTokenHash: string }).visitorToken = token
  ;(req as Request & { visitorToken: string; visitorTokenHash: string }).visitorTokenHash =
    createHash('sha256').update(token).digest('hex')
  next()
}

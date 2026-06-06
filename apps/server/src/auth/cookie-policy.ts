/**
 * Shared cookie policy (T010, FR-004, FR-031, R-4).
 *
 * Single source of truth for the production `Secure` flag, the
 * `SameSite=Lax` policy, the `Path=/` scope, and the `HttpOnly` flag
 * shared by every first-party cookie the platform sets:
 *   - `bsl_session`    (apps/server/src/auth/cookie.ts)
 *   - `basmat_visitor` (apps/server/src/http/middleware/visitor-token.ts)
 *
 * Before this module, the visitor cookie omitted `Secure` in production
 * (R-4) and the two files had drifted. The fix is one shared policy.
 */

import { loadEnv } from '../env.js'

export interface CookiePolicy {
  secure: boolean
  httpOnly: boolean
  sameSite: 'lax'
  path: '/'
  domain: string | undefined
}

/**
 * Returns the cookie flags every first-party cookie MUST use. `Secure` is
 * gated on `NODE_ENV === 'production'` so localhost dev (HTTP) keeps
 * working without TLS. `domain` follows `COOKIE_DOMAIN` so production
 * cookies can be scoped to a parent domain (e.g. `.onrender.com`).
 */
export function getCookiePolicy(): CookiePolicy {
  const env = loadEnv()
  return {
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    domain: env.COOKIE_DOMAIN || undefined,
  }
}

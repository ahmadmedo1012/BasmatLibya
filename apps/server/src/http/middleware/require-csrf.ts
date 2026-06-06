import type { Request, Response, NextFunction } from 'express'
import { buildArErrorBody } from './error.js'

/**
 * CSRF defence (R-04): state-changing requests must carry an `X-CSRF` header
 * whose value matches the per-session csrfToken. Telegram callback at
 * `POST /api/auth/telegram` is exempt — it has its own HMAC verification.
 *
 * Assumes `requireSession` has run before it.
 */
export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  const session = req.session
  if (!session) {
    return res.status(401).json(buildArErrorBody('not_authenticated'))
  }
  const provided = req.header('x-csrf') ?? ''
  if (!provided || provided !== session.csrfToken) {
    return res.status(403).json(buildArErrorBody('csrf_required'))
  }
  next()
}

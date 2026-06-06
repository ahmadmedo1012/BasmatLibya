import type { Request, Response, NextFunction } from 'express'
import { resolvePrincipal } from '../../auth/principal.js'
import { buildArErrorBody } from './error.js'

/**
 * Attaches `req.session` for authenticated callers; returns 401 with a
 * designed Arabic body for anonymous callers. Use for routes that require
 * an authenticated user but not specifically the owner.
 */
export async function requireSession(req: Request, res: Response, next: NextFunction) {
  const session = await resolvePrincipal(req, res)
  if (!session) {
    return res.status(401).json(buildArErrorBody('not_authenticated'))
  }
  req.session = session
  next()
}

/**
 * Attaches `req.session` if available, but never blocks anonymous callers.
 * Use for routes that read identity opportunistically (e.g. POST /api/lookups
 * that records `owner_user_id` only when signed in).
 */
export async function optionalSession(req: Request, res: Response, next: NextFunction) {
  const session = await resolvePrincipal(req, res)
  if (session) req.session = session
  next()
}

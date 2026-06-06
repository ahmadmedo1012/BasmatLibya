import type { Request, Response, NextFunction } from 'express'
import { buildArErrorBody } from './error.js'

/**
 * Owner gate (FR-008, G7). The response body MUST contain no admin data —
 * a leaked owner-only field would be a constitutional violation.
 *
 * Assumes `requireSession` has run before it and populated `req.session`.
 */
export function requireOwner(req: Request, res: Response, next: NextFunction) {
  const session = req.session
  if (!session) {
    // requireSession should have caught this, but be defensive.
    return res.status(401).json(buildArErrorBody('not_authenticated'))
  }
  const { principal } = session
  if (principal.role !== 'owner' || principal.status !== 'active') {
    return res.status(403).json(buildArErrorBody('unauthorized'))
  }
  next()
}

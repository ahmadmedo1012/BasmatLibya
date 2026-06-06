/**
 * Admin router aggregator. Mounts under /api/admin with requireSession +
 * requireOwner; state-changing methods additionally go through requireCsrf.
 */

import { Router } from 'express'
import { requireSession } from '../../middleware/require-session.js'
import { requireOwner } from '../../middleware/require-owner.js'
import { requireCsrf } from '../../middleware/require-csrf.js'
import { adminAiModelsRouter } from './ai-models.js'
import { adminUsersRouter } from './users.js'
import { adminSiteSettingsRouter } from './site-settings.js'
import { adminAuditRouter } from './audit.js'

export const adminRouter = Router()

// All admin routes require an active owner session.
adminRouter.use(requireSession, requireOwner)

// CSRF only on state-changing verbs.
adminRouter.use((req, res, next) => {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    return requireCsrf(req, res, next)
  }
  next()
})

adminRouter.use('/ai-models', adminAiModelsRouter)
adminRouter.use('/users', adminUsersRouter)
adminRouter.use('/site-settings', adminSiteSettingsRouter)
adminRouter.use('/audit', adminAuditRouter)

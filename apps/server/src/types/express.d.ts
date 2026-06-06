/**
 * Global Express Request augmentation. Uses the standard `Express` namespace
 * which @types/express opens for declaration merging.
 */

import type { ResolvedSession } from '../auth/principal.js'

declare global {
  namespace Express {
    interface Request {
      session?: ResolvedSession
      visitorToken?: string
      visitorTokenHash?: string
      id?: string
    }
  }
}

export {}

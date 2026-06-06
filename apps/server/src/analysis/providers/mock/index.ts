import { mockSocialPresence } from './social-presence.js'
import { mockPublicMentions } from './public-mentions.js'
import { mockContactSignals } from './contact-signals.js'
import { mockReputationIndicators } from './reputation-indicators.js'
import { mockProfileImagery } from './profile-imagery.js'
import type { SourceProvider } from '../types.js'

export const mockProviders: SourceProvider[] = [
  mockSocialPresence,
  mockPublicMentions,
  mockContactSignals,
  mockReputationIndicators,
  mockProfileImagery,
]

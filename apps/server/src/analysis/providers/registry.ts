import { loadEnv } from '../../env.js'
import { logger } from '../../observability/logger.js'
import type { SourceProvider } from './types.js'
import { mockProviders } from './mock/index.js'
import { liveProviders } from './live/index.js'

const env = loadEnv()

let _registered: SourceProvider[] | null = null

export function getProviders(): SourceProvider[] {
  if (_registered) return _registered
  if (env.SOURCE_PROVIDERS === 'live') {
    // Live providers run holehe + sherlock (OSINT) for ALL identifier types,
    // and additionally call the LLM researcher when NVIDIA_API_KEY is set.
    // OSINT alone produces real results without an LLM key; the missing key
    // just means the LLM-recall layer is silent.
    _registered = liveProviders
    if (!env.NVIDIA_API_KEY) {
      logger.warn('SOURCE_PROVIDERS=live but NVIDIA_API_KEY missing — LLM researcher will return empty; OSINT (holehe/sherlock) still runs')
    }
    logger.info({ count: _registered.length }, 'live providers registered')
  } else {
    _registered = mockProviders
    logger.info({ count: _registered.length }, 'mock providers registered')
  }
  return _registered
}

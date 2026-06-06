import { loadEnv } from '../../env.js';
import { logger } from '../../observability/logger.js';
import type { SourceProvider } from './types.js';
import { mockProviders } from './mock/index.js';
import { liveProviders } from './live/index.js';

const env = loadEnv();

let _registered: SourceProvider[] | null = null;

/**
 * Provider selection strategy:
 *
 * SOURCE_PROVIDERS=live  → live OSINT + LLM providers only (production).
 * SOURCE_PROVIDERS=mock  → deterministic mock data (development / demo).
 *
 * The live researcher calls NVIDIA Nemotron for every lookup. When the model
 * has no knowledge of the identifier (common names, unknown emails, etc.) it
 * correctly returns zero findings — that is expected behaviour. OSINT tools
 * (holehe, sherlock, maigret, ignorant, phoneinfoga) still run for supported
 * identifier types and produce real results when those tools are installed.
 *
 * For a better demo/dev experience, use SOURCE_PROVIDERS=mock which returns
 * realistic sample data without any external dependencies.
 */
export function getProviders(): SourceProvider[] {
  if (_registered) return _registered;

  if (env.SOURCE_PROVIDERS === 'live') {
    _registered = liveProviders;
    logger.info({ count: _registered.length }, 'live providers registered');
  } else {
    _registered = mockProviders;
    logger.info({ count: _registered.length }, 'mock providers registered');
  }
  return _registered;
}

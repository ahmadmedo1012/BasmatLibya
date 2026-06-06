import type { SourceProvider, AnalyzeCtx, AnalyzeInput } from '../types.js'
import type { Finding } from '@basmat/shared'

function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

export const mockSocialPresence: SourceProvider = {
  id: 'mock.social_presence',
  categoryKey: 'social_presence',
  displayLabel: 'الحضور على منصات التواصل',
  supports() {
    return true
  },
  async *analyze(input: AnalyzeInput, ctx: AnalyzeCtx): AsyncIterable<Omit<Finding, 'id'>> {
    await delay(800, ctx.signal)
    yield {
      categoryKey: 'social_presence',
      title: `حساب على منصة عامة باسم "${input.identifierValue}"`,
      snippet: 'حساب نشط مع ١٢٠ متابعًا.',
      sourceUrl: 'https://example.com/social/profile',
      sourceName: 'Example Social',
      language: 'ar',
      confidence: 'high',
    }
    await delay(600, ctx.signal)
    yield {
      categoryKey: 'social_presence',
      title: `Profile: @${input.identifierValue.replace(/\s+/g, '').slice(0, 20).toLowerCase()}`,
      snippet: 'Public profile, last active recently.',
      sourceUrl: 'https://example.org/u/profile',
      sourceName: 'Example Network',
      language: 'en',
      confidence: 'medium',
    }
  },
}

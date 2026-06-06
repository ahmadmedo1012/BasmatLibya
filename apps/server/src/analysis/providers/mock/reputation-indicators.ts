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

export const mockReputationIndicators: SourceProvider = {
  id: 'mock.reputation_indicators',
  categoryKey: 'reputation_indicators',
  displayLabel: 'مؤشرات السمعة',
  supports() {
    return true
  },
  async *analyze(_input: AnalyzeInput, ctx: AnalyzeCtx): AsyncIterable<Omit<Finding, 'id'>> {
    await delay(1200, ctx.signal)
    yield {
      categoryKey: 'reputation_indicators',
      title: 'تقييم عام إيجابي على منصة مهنية',
      snippet: 'ملخص: متوسط ٤.٥ من ٥ بناءً على ٣٢ تقييمًا.',
      sourceUrl: 'https://example.reviews/profile',
      sourceName: 'Example Reviews',
      language: 'ar',
      confidence: 'medium',
    }
  },
}

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

export const mockPublicMentions: SourceProvider = {
  id: 'mock.public_mentions',
  categoryKey: 'public_mentions',
  displayLabel: 'الإشارات العامة',
  supports() {
    return true
  },
  async *analyze(input: AnalyzeInput, ctx: AnalyzeCtx): AsyncIterable<Omit<Finding, 'id'>> {
    await delay(900, ctx.signal)
    yield {
      categoryKey: 'public_mentions',
      title: `مقال عام يذكر "${input.identifierValue}"`,
      snippet: 'مقال صحفي يتضمن إشارة عامة قابلة للتحقق.',
      sourceUrl: 'https://example.news/article/12345',
      sourceName: 'Example News',
      language: 'ar',
      confidence: 'medium',
    }
  },
}

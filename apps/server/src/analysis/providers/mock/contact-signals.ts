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

export const mockContactSignals: SourceProvider = {
  id: 'mock.contact_signals',
  categoryKey: 'contact_signals',
  displayLabel: 'إشارات التواصل',
  supports(idType) {
    return idType === 'email' || idType === 'phone' || idType === 'username'
  },
  async *analyze(_input: AnalyzeInput, ctx: AnalyzeCtx): AsyncIterable<Omit<Finding, 'id'>> {
    await delay(700, ctx.signal)
    yield {
      categoryKey: 'contact_signals',
      title: 'ظهور هذا المعرّف في دليل عام',
      snippet: 'إدراج عام دون معلومات خاصة إضافية.',
      sourceUrl: 'https://example.directory/listing',
      sourceName: 'Example Directory',
      language: 'ar',
      confidence: 'low',
    }
  },
}

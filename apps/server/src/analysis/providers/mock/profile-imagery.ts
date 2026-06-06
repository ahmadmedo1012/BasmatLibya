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

export const mockProfileImagery: SourceProvider = {
  id: 'mock.profile_imagery',
  categoryKey: 'profile_imagery',
  displayLabel: 'الصور الشخصية المحتملة',
  supports(idType) {
    return idType !== 'phone'
  },
  async *analyze(_input: AnalyzeInput, ctx: AnalyzeCtx): AsyncIterable<Omit<Finding, 'id'>> {
    await delay(1500, ctx.signal)
    yield {
      categoryKey: 'profile_imagery',
      title: 'صورة شخصية محتملة من ملف عام',
      snippet: 'مطابقة منخفضة الثقة — يُرجى التحقق يدويًا.',
      sourceUrl: 'https://example.images/img/abc123',
      sourceName: 'Example Images',
      language: 'en',
      confidence: 'low',
    }
  },
}

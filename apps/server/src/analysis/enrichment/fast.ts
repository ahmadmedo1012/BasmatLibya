/**
 * Fast streaming enrichment path (R-FAST).
 *
 * One call to NVIDIA_MODEL_FAST (defaults to nemotron-3-super-120b-a12b),
 * streamed back to the client over Socket.IO so the Arabic summary appears
 * word-by-word starting within ~1 s of being kicked off — instead of waiting
 * 30-60 s for the 3-stage chain.
 *
 * The response is a structured Arabic text marked with section headers:
 *   ## العنوان
 *   ## الملخص
 *   ## النقاط
 *   - …
 *   ## مخاطر
 *   - …
 *   ## ثغرات
 *   - …
 *
 * The client renders the stream live; on completion, the server parses the
 * text into the same EnrichmentPayload shape so the persisted record matches
 * the slow path's contract (G4 — UI doesn't care which path produced it).
 */

import type { EnrichmentPayload, Finding } from '@basmat/shared'
import { chatCompleteStream, NimError } from './nim-client.js'
import { loadEnv } from '../../env.js'
import { lookupLogger } from '../../observability/logger.js'

const env = loadEnv()

export interface FastStreamCallbacks {
  onFirstByte?: () => void
  onDelta: (chunk: string, accumulated: string) => void
}

const SYSTEM_PROMPT = `أنت محلِّل بصمات رقمية يكتب باللغة العربية الفصحى الواضحة.
ستتلقّى مُعرّفًا (اسم/مستخدم/بريد/هاتف) وقائمة نتائج عامة عنه عبر فئات.
مهمتك: كتابة تحليل عربي موجَز ومحترف يعتمد فقط على ما ورد في المدخلات.

قواعد صارمة:
1. لا تخترع أيّ معلومات لم ترد. لا أسماء، ولا حسابات، ولا أرقام، ولا روابط.
2. أعد إجابتك بالشكل التالي بالضبط، مع رؤوس الأقسام كما هي:

## العنوان
سطر واحد ≤ ١٢ كلمة يصف هوية الكيان.

## الملخص
فقرة من ٢-٤ جمل بنبرة محايدة محترفة.

## النقاط
- نقطة قصيرة ١
- نقطة قصيرة ٢
- … (٣-٦ نقاط ≤ ١٢ كلمة لكل واحدة)

## مخاطر
- إشارة تستحق المراجعة ١
- … (٠-٣ نقاط؛ احذف القسم لو لا توجد)

## ثغرات
- معلومة مفقودة ١
- … (٠-٣ نقاط؛ احذف القسم لو لا توجد)

3. لا تضف Markdown آخر، ولا أسوار كود، ولا أي نص خارج الأقسام أعلاه.`

function compactFindings(findings: Finding[]): string {
  return JSON.stringify(
    findings.slice(0, 80).map((f) => ({
      cat: f.categoryKey,
      title: f.title,
      snippet: (f.snippet ?? '').slice(0, 200),
      source: f.sourceName,
      conf: f.confidence,
      meta: f.metadata
        ? {
            name: f.metadata.fullname ?? null,
            bio: (f.metadata.bio ?? '').slice(0, 200) || null,
            followers: f.metadata.followerCount ?? null,
            location: f.metadata.location ?? null,
            joined: f.metadata.joinedAt ?? null,
          }
        : null,
    })),
    null,
    0
  )
}

export interface FastEnrichmentResult {
  status: 'ready' | 'failed'
  text: string
  payload: EnrichmentPayload | null
  reason?: string
  elapsedMs: number
  ttfbMs: number | null
}

export async function runFastEnrichment(
  args: {
    lookupId: string
    identifierValue: string
    identifierType: string
    findings: Finding[]
    signal?: AbortSignal
  },
  cb: FastStreamCallbacks
): Promise<FastEnrichmentResult> {
  const log = lookupLogger(args.lookupId).child({ provider_id: 'nvidia.fast' })
  const t0 = Date.now()
  if (!env.NVIDIA_API_KEY) {
    return { status: 'failed', text: '', payload: null, reason: 'no_api_key', elapsedMs: 0, ttfbMs: null }
  }
  if (args.findings.length === 0) {
    return { status: 'failed', text: '', payload: null, reason: 'no_findings', elapsedMs: 0, ttfbMs: null }
  }

  const userPrompt = `IDENTIFIER:
${JSON.stringify({ value: args.identifierValue, type: args.identifierType })}

FINDINGS (JSON array, 1 entry per signal):
${compactFindings(args.findings)}

اكتب التحليل الآن وفق التنسيق المحدد.`

  let acc = ''
  let firstByteAt: number | null = null
  try {
    for await (const chunk of chatCompleteStream({
      model: env.NVIDIA_MODEL_FAST,
      temperature: 0.4,
      maxTokens: 1100,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      signal: args.signal,
    })) {
      if (firstByteAt === null) {
        firstByteAt = Date.now()
        cb.onFirstByte?.()
      }
      acc += chunk
      cb.onDelta(chunk, acc)
    }
  } catch (err) {
    const reason = err instanceof NimError ? err.message : (err as Error).message
    log.warn({ event: 'fast.fail', reason }, 'fast enrichment failed')
    return {
      status: 'failed',
      text: acc,
      payload: null,
      reason,
      elapsedMs: Date.now() - t0,
      ttfbMs: firstByteAt ? firstByteAt - t0 : null,
    }
  }

  const payload = parseEnrichmentText(acc)
  log.info(
    {
      event: 'fast.ok',
      ttfbMs: firstByteAt ? firstByteAt - t0 : null,
      totalMs: Date.now() - t0,
      chars: acc.length,
      hasPayload: Boolean(payload),
    },
    'fast enrichment ok'
  )
  return {
    status: 'ready',
    text: acc,
    payload,
    elapsedMs: Date.now() - t0,
    ttfbMs: firstByteAt ? firstByteAt - t0 : null,
  }
}

/**
 * Parse the model's section-headed Arabic output into the structured payload
 * shape so it persists in the same column the slow path uses (G4).
 */
export function parseEnrichmentText(raw: string): EnrichmentPayload | null {
  if (!raw.trim()) return null
  const sections: Record<string, string> = {}
  let currentKey: string | null = null
  let currentLines: string[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    const headerMatch = /^##\s+(.+)$/.exec(trimmed)
    if (headerMatch) {
      if (currentKey) sections[currentKey] = currentLines.join('\n').trim()
      currentKey = headerMatch[1]!.trim()
      currentLines = []
    } else if (currentKey) {
      currentLines.push(line)
    }
  }
  if (currentKey) sections[currentKey] = currentLines.join('\n').trim()

  const headline = sections['العنوان'] ?? ''
  const summary = sections['الملخص'] ?? ''
  if (!headline && !summary) return null

  const bullets = (k: string): string[] => {
    const block = sections[k] ?? ''
    return block
      .split('\n')
      .map((l) => l.replace(/^\s*[-•]\s*/, '').trim())
      .filter((l) => l.length > 0)
      .slice(0, 6)
  }

  return {
    headlineAr: headline.split('\n')[0]!.trim() || headline.trim(),
    summaryAr: summary,
    highlightsAr: bullets('النقاط'),
    identityClusters: [],
    riskFlagsAr: bullets('مخاطر').slice(0, 4),
    gapsAr: bullets('ثغرات').slice(0, 4),
    modelChain: {
      analyzer: env.NVIDIA_MODEL_FAST,
      reasoner: env.NVIDIA_MODEL_FAST,
      writer: env.NVIDIA_MODEL_FAST,
    },
  }
}

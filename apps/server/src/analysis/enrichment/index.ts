import { z } from 'zod'
import type { Finding, CategoryKey } from '@basmat/shared'
import { loadEnv } from '../../env.js'
import { lookupLogger } from '../../observability/logger.js'
import { chatComplete, NimError } from './nim-client.js'

const env = loadEnv()

// --- Output schema (also persisted into aggregated_results.enrichment_payload) ---

export const EnrichmentPayloadSchema = z.object({
  headlineAr: z.string(),
  summaryAr: z.string(),
  highlightsAr: z.array(z.string()).max(6),
  identityClusters: z
    .array(
      z.object({
        labelAr: z.string(),
        confidence: z.enum(['high', 'medium', 'low']),
        findingIds: z.array(z.string()),
        rationaleAr: z.string(),
      })
    )
    .max(3),
  riskFlagsAr: z.array(z.string()).max(4),
  gapsAr: z.array(z.string()).max(4),
  modelChain: z.object({
    analyzer: z.string(),
    reasoner: z.string(),
    writer: z.string(),
  }),
})

export type EnrichmentPayload = z.infer<typeof EnrichmentPayloadSchema>

// --- Stage schemas ---

const AnalyzerOutputSchema = z.object({
  clusters: z
    .array(
      z.object({
        label: z.string(),
        finding_ids: z.array(z.string()),
        confidence: z.enum(['high', 'medium', 'low']),
      })
    )
    .max(4),
  key_signals: z.array(z.string()).max(8),
  risk_flags: z.array(z.string()).max(6),
})

const ReasonerOutputSchema = z.object({
  persona_summary_en: z.string(),
  cluster_assessments: z
    .array(
      z.object({
        label: z.string(),
        confidence: z.enum(['high', 'medium', 'low']),
        rationale_en: z.string(),
        finding_ids: z.array(z.string()),
      })
    )
    .max(3),
  highlights_en: z.array(z.string()).max(6),
  risk_flags_en: z.array(z.string()).max(4),
  investigation_gaps_en: z.array(z.string()).max(4),
})

const WriterOutputSchema = z.object({
  headline_ar: z.string(),
  summary_ar: z.string(),
  highlights_ar: z.array(z.string()).max(6),
  cluster_labels_ar: z.array(z.object({ label_ar: z.string(), rationale_ar: z.string() })).max(3),
  risk_flags_ar: z.array(z.string()).max(4),
  gaps_ar: z.array(z.string()).max(4),
})

// --- Helpers ---

/**
 * Robust JSON extraction. NIM models sometimes return:
 *  - bare JSON
 *  - JSON wrapped in ```json ... ``` fences
 *  - JSON preceded by an explanation paragraph
 *  - JSON followed by trailing text
 * This walks the string to find the largest balanced {…} block, then validates.
 */
function extractFirstJsonObject(raw: string): string | null {
  // Strip code fences if present.
  let s = raw.trim()
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')

  let depth = 0
  let start = -1
  let inStr = false
  let escape = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!
    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\') {
      escape = true
      continue
    }
    if (ch === '"') {
      inStr = !inStr
      continue
    }
    if (inStr) continue
    if (ch === '{') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && start >= 0) {
        return s.slice(start, i + 1)
      }
    }
  }
  return null
}

function tryParseJson<T>(raw: string, schema: z.ZodSchema<T>): T | null {
  const candidate = extractFirstJsonObject(raw) ?? raw
  try {
    const obj = JSON.parse(candidate)
    const r = schema.safeParse(obj)
    if (r.success) return r.data
    return null
  } catch {
    return null
  }
}

function compactFindingsForPrompt(findings: Finding[]) {
  return findings.map((f) => ({
    id: f.id,
    category: f.categoryKey,
    title: f.title,
    snippet: f.snippet ?? null,
    source: f.sourceName,
    confidence: f.confidence,
    lang: f.language ?? null,
  }))
}

async function callWithRetry(
  attempt: () => Promise<string>,
  retries = 1
): Promise<string | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await attempt()
    } catch (err) {
      if (i === retries) {
        // Bubble up the last error to the caller's catch.
        throw err
      }
      // Brief jittered backoff.
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 600))
    }
  }
  return null
}

// --- The chain ---

export interface EnrichmentInput {
  lookupId: string
  identifierValue: string
  identifierType: string
  findings: Finding[]
}

export interface EnrichmentRunResult {
  status: 'skipped' | 'ready' | 'failed'
  payload: EnrichmentPayload | null
  error?: string
}

const ANALYZER_SYSTEM = `You are a digital footprint analyst.
You receive a set of public-source FINDINGS about a queried identifier.
You DO NOT know any private data; reason ONLY from the findings provided.
Group findings into 1-3 identity clusters that plausibly refer to the same individual.
Surface the most informative key signals and any risk flags worth a human review.
Output a single JSON object that matches the requested schema. Output JSON ONLY — no prose, no fences, no preamble.`

const REASONER_SYSTEM = `detailed thinking off
You are a senior identity analyst.
You receive (a) the original findings, (b) an analyzer's first-pass clustering and signals.
Your job: critique the clustering, assign confidence, write a concise persona summary in English,
list 4-6 highlights worth showing on a result page, and surface investigation gaps.
Be skeptical. Lower confidence when evidence is thin or sources are weak.
Output a single JSON object that matches the requested schema. Output JSON ONLY — no prose, no fences, no preamble.`

const WRITER_SYSTEM = `أنت محرر عربي محترف. مهمتك صياغة ملخص فاخر للنتائج باللغة العربية الفصحى الواضحة.
- العنوان: جملة واحدة قصيرة جذابة (٦-١٠ كلمات).
- الملخص: فقرة من ٢-٤ جمل بنبرة محترفة وهادئة.
- النقاط البارزة: ٣-٦ عبارات قصيرة (≤ ١٢ كلمة لكل واحدة).
- لا تخترع أي معلومات لم ترد في المدخلات.
- أعد JSON صالحًا فقط، بدون أي شرح وبدون علامات تنسيق Markdown ولا أسوار كود.`

export async function runEnrichment(input: EnrichmentInput): Promise<EnrichmentRunResult> {
  const log = lookupLogger(input.lookupId).child({ provider_id: 'nvidia.enrichment' })

  if (!env.ENRICHMENT_ENABLED || !env.NVIDIA_API_KEY) {
    return { status: 'skipped', payload: null }
  }
  if (input.findings.length === 0) {
    log.info({ event: 'enrichment.skipped' }, 'no findings, skip enrichment')
    return { status: 'skipped', payload: null }
  }

  const compact = compactFindingsForPrompt(input.findings)
  const findingsBlob = JSON.stringify(compact, null, 2)

  // ------------ Stage 1: Analyzer ------------
  let analyzerOut: z.infer<typeof AnalyzerOutputSchema> | null = null
  try {
    const text = await callWithRetry(
      () =>
        chatComplete({
          model: env.NVIDIA_MODEL_ANALYZER,
          temperature: 0.2,
          maxTokens: 700,
          messages: [
            { role: 'system', content: ANALYZER_SYSTEM },
            {
              role: 'user',
              content: `IDENTIFIER: ${JSON.stringify({
                value: input.identifierValue,
                type: input.identifierType,
              })}

FINDINGS (JSON):
${findingsBlob}

Respond ONLY with a JSON object matching this exact shape:
{
  "clusters": [{ "label": "...", "finding_ids": ["..."], "confidence": "high"|"medium"|"low" }],
  "key_signals": ["..."],
  "risk_flags": ["..."]
}`,
            },
          ],
        }),
      1
    )
    if (text) analyzerOut = tryParseJson(text, AnalyzerOutputSchema)
    log.info(
      { event: 'enrichment.analyzer_ok', clusters: analyzerOut?.clusters.length ?? 0 },
      'analyzer ok'
    )
  } catch (err) {
    log.warn(
      { event: 'enrichment.analyzer_fail', err: (err as NimError).message },
      'analyzer failed'
    )
  }

  // ------------ Stage 2: Reasoner ------------
  let reasonerOut: z.infer<typeof ReasonerOutputSchema> | null = null
  if (analyzerOut) {
    try {
      const text = await callWithRetry(
        () =>
          chatComplete({
            model: env.NVIDIA_MODEL_REASONER,
            temperature: 0.4,
            maxTokens: 900,
            messages: [
              { role: 'system', content: REASONER_SYSTEM },
              {
                role: 'user',
                content: `IDENTIFIER: ${JSON.stringify({
                  value: input.identifierValue,
                  type: input.identifierType,
                })}

ANALYZER OUTPUT:
${JSON.stringify(analyzerOut, null, 2)}

ORIGINAL FINDINGS:
${findingsBlob}

Respond ONLY with a JSON object matching this exact shape:
{
  "persona_summary_en": "...",
  "cluster_assessments": [{ "label": "...", "confidence": "high"|"medium"|"low", "rationale_en": "...", "finding_ids": ["..."] }],
  "highlights_en": ["..."],
  "risk_flags_en": ["..."],
  "investigation_gaps_en": ["..."]
}`,
              },
            ],
          }),
        1
      )
      if (text) reasonerOut = tryParseJson(text, ReasonerOutputSchema)
      log.info({ event: 'enrichment.reasoner_ok', ok: Boolean(reasonerOut) }, 'reasoner done')
    } catch (err) {
      log.warn(
        { event: 'enrichment.reasoner_fail', err: (err as NimError).message },
        'reasoner failed'
      )
    }
  }

  // Build the writer's brief. If neither analyzer nor reasoner produced
  // structured output, we fall back to a deterministic brief built from the
  // raw findings — the writer ALWAYS gets meaningful input.
  const writerBrief =
    reasonerOut ??
    (analyzerOut
      ? {
          persona_summary_en:
            'Limited public-source information; identity correlation requires manual review.',
          cluster_assessments: analyzerOut.clusters.slice(0, 3).map((c) => ({
            label: c.label,
            confidence: c.confidence,
            rationale_en: '',
            finding_ids: c.finding_ids,
          })),
          highlights_en: analyzerOut.key_signals.slice(0, 6),
          risk_flags_en: analyzerOut.risk_flags.slice(0, 4),
          investigation_gaps_en: [],
        }
      : buildDeterministicBrief(input))

  // ------------ Stage 3: Writer (Arabic) ------------
  let writerOut: z.infer<typeof WriterOutputSchema> | null = null
  try {
    const text = await callWithRetry(
      () =>
        chatComplete({
          model: env.NVIDIA_MODEL_WRITER,
          temperature: 0.7,
          maxTokens: 800,
          messages: [
            { role: 'system', content: WRITER_SYSTEM },
            {
              role: 'user',
              content: `INPUT_FOR_WRITING:
${JSON.stringify(writerBrief, null, 2)}

أعد JSON بهذا الشكل بالضبط (بالعربية):
{
  "headline_ar": "...",
  "summary_ar": "...",
  "highlights_ar": ["..."],
  "cluster_labels_ar": [{ "label_ar": "...", "rationale_ar": "..." }],
  "risk_flags_ar": ["..."],
  "gaps_ar": ["..."]
}`,
            },
          ],
        }),
      2
    )
    if (text) writerOut = tryParseJson(text, WriterOutputSchema)
    log.info({ event: 'enrichment.writer_ok', ok: Boolean(writerOut) }, 'writer done')
  } catch (err) {
    log.warn(
      { event: 'enrichment.writer_fail', err: (err as NimError).message },
      'writer failed'
    )
  }

  // If the writer also failed, return a deterministic Arabic payload built
  // from the findings — never leave the user with an empty card after waiting.
  const localised: WriterShape =
    writerOut ?? buildDeterministicArabicWriter(input, analyzerOut, writerBrief)

  // ------------ Compose final payload ------------
  const clusters: EnrichmentPayload['identityClusters'] = (
    reasonerOut?.cluster_assessments ??
    (analyzerOut?.clusters ?? []).map((c) => ({
      label: c.label,
      confidence: c.confidence,
      rationale_en: '',
      finding_ids: c.finding_ids,
    }))
  )
    .slice(0, 3)
    .map((c, i) => {
      const localisedCluster =
        localised.cluster_labels_ar[i] ?? { label_ar: c.label, rationale_ar: '' }
      return {
        labelAr: localisedCluster.label_ar,
        confidence: c.confidence,
        findingIds: c.finding_ids,
        rationaleAr: localisedCluster.rationale_ar,
      }
    })

  const payload: EnrichmentPayload = {
    headlineAr: localised.headline_ar,
    summaryAr: localised.summary_ar,
    highlightsAr: localised.highlights_ar.slice(0, 6),
    identityClusters: clusters,
    riskFlagsAr: localised.risk_flags_ar.slice(0, 4),
    gapsAr: localised.gaps_ar.slice(0, 4),
    modelChain: {
      analyzer: env.NVIDIA_MODEL_ANALYZER,
      reasoner: env.NVIDIA_MODEL_REASONER,
      writer: env.NVIDIA_MODEL_WRITER,
    },
  }

  return { status: 'ready', payload }
}

// --- Deterministic fallbacks (so we never strand the user) ---

interface ReasonerLikeBrief {
  persona_summary_en: string
  cluster_assessments: Array<{
    label: string
    confidence: 'high' | 'medium' | 'low'
    rationale_en: string
    finding_ids: string[]
  }>
  highlights_en: string[]
  risk_flags_en: string[]
  investigation_gaps_en: string[]
}

interface WriterShape {
  headline_ar: string
  summary_ar: string
  highlights_ar: string[]
  cluster_labels_ar: Array<{ label_ar: string; rationale_ar: string }>
  risk_flags_ar: string[]
  gaps_ar: string[]
}

function buildDeterministicBrief(input: EnrichmentInput): ReasonerLikeBrief {
  const total = input.findings.length
  const cats = new Set<CategoryKey>(input.findings.map((f) => f.categoryKey))
  return {
    persona_summary_en: `${total} public-source signals across ${cats.size} categories.`,
    cluster_assessments: [],
    highlights_en: input.findings
      .slice(0, 6)
      .map((f) => `${f.sourceName}: ${f.title}`),
    risk_flags_en: [],
    investigation_gaps_en: [],
  }
}

const CATEGORY_AR: Record<CategoryKey, string> = {
  social_presence: 'الحضور على منصات التواصل',
  public_mentions: 'الإشارات العامة',
  contact_signals: 'إشارات التواصل',
  reputation_indicators: 'مؤشرات السمعة',
  profile_imagery: 'الصور الشخصية المحتملة',
}

function buildDeterministicArabicWriter(
  input: EnrichmentInput,
  analyzerOut: z.infer<typeof AnalyzerOutputSchema> | null,
  _brief: ReasonerLikeBrief
): WriterShape {
  const total = input.findings.length
  const cats = Array.from(new Set(input.findings.map((f) => f.categoryKey)))
  const headline =
    total > 0
      ? `تم رصد ${total} إشارة عامة عبر ${cats.length} ${cats.length === 1 ? 'فئة' : 'فئات'}`
      : 'لم يتم العثور على إشارات عامة'
  const summary =
    total > 0
      ? `تم تجميع ${total} إشارة من مصادر علنية تشمل ${cats
          .slice(0, 3)
          .map((k) => CATEGORY_AR[k])
          .join('، ')}. تحقّق يدويًا قبل اعتماد أي ربط للهوية.`
      : 'لم تُكتشف معلومات علنية كافية لبناء ملخّص.'
  return {
    headline_ar: headline,
    summary_ar: summary,
    highlights_ar: input.findings.slice(0, 5).map((f) => `${CATEGORY_AR[f.categoryKey]}: ${f.title}`),
    cluster_labels_ar:
      analyzerOut?.clusters.slice(0, 3).map((c) => ({ label_ar: c.label, rationale_ar: '' })) ?? [],
    risk_flags_ar: [],
    gaps_ar: ['لم يُجرَ تحقّق آلي من تطابق الهوية بين المصادر.'],
  }
}

import type { Finding, FindingMetadata, IdentifierType, CategoryKey } from '@basmat/shared'
import type { SourceProvider, AnalyzeCtx, AnalyzeInput } from '../types.js'
import { chatComplete } from '../../enrichment/nim-client.js'
import { loadEnv } from '../../../env.js'
import { lookupLogger } from '../../../observability/logger.js'
import { runHolehe, runSherlock, runIgnorant, runMaigret } from './osint-runner.js'
import { checkGravatar, checkGitHubUser } from './node-osint.js'
import { runPhoneInfoga } from './phoneinfoga.js'

const env = loadEnv()

/**
 * Live researcher backed by NVIDIA Nemotron-3-super-120b.
 *
 * Honest design:
 *  - The model is NOT a search engine. It returns ONLY information it actually
 *    learned during training about the specific identifier.
 *  - When it has no verifiable knowledge, it returns an empty list — never
 *    invents profiles, sources, URLs, or biographies.
 *  - All 5 categories are produced by ONE call; we cache the promise per-lookup
 *    and route findings to the right category, so the user sees progress per
 *    category but pays for only one model call.
 */

type ResearcherFinding = {
  category_key: CategoryKey
  title: string
  snippet: string | null
  source_url: string | null
  source_name: string
  language: string | null
  confidence: 'high' | 'medium' | 'low'
}

interface ResearcherResult {
  findings: ResearcherFinding[]
  knownEntity: boolean
  notes: string | null
}

/* ---------- per-lookup shared cache ---------- */

interface CachedRun {
  promise: Promise<ResearcherResult>
}
const inflight = new Map<string, CachedRun>()

interface OsintFinding {
  categoryKey: CategoryKey
  title: string
  snippet: string | null
  source_url: string | null
  source_name: string
  language: 'en' | null
  confidence: 'high' | 'medium' | 'low'
  metadata?: FindingMetadata | null
}

interface OsintResult {
  findings: OsintFinding[]
}

/**
 * Per-lookup cache for OSINT (holehe + sherlock) so the 5 per-category
 * providers share one execution.
 */
const osintInflight = new Map<string, Promise<OsintResult>>()

function runOsintOnce(input: AnalyzeInput, ctx: AnalyzeCtx): Promise<OsintResult> {
  const cached = osintInflight.get(ctx.lookupId)
  if (cached) return cached
  const promise = doOsint(input, ctx).finally(() => {
    setTimeout(() => osintInflight.delete(ctx.lookupId), 60_000)
  })
  osintInflight.set(ctx.lookupId, promise)
  return promise
}

async function doOsint(input: AnalyzeInput, ctx: AnalyzeCtx): Promise<OsintResult> {
  const log = lookupLogger(ctx.lookupId).child({ provider_id: 'live.osint' })
  const findings: OsintFinding[] = []

  function buildSnippet(site: string, m: FindingMetadata): string | null {
    const bits: string[] = []
    if (m.location) bits.push(`من ${m.location}`)
    if (typeof m.followerCount === 'number') bits.push(`${m.followerCount.toLocaleString('ar-LY')} متابع`)
    if (m.joinedAt) {
      const year = m.joinedAt.slice(0, 4)
      if (/^\d{4}$/.test(year)) bits.push(`منذ ${year}`)
    }
    if (m.isVerified === true) bits.push('موثَّق ✓')
    return bits.length ? bits.join(' · ') : null
  }

  if (input.identifierType === 'email') {
    // Run holehe + Gravatar in parallel.
    const [holeheResult, gravatarFindings] = await Promise.all([
      runHolehe(input.identifierValue, ctx.signal),
      checkGravatar(input.identifierValue, ctx.signal).catch(() => []),
    ])
    if (holeheResult.ok) {
      log.info({ event: 'holehe.ok', checked: holeheResult.checked, used: holeheResult.used.length }, 'holehe ok')
      for (const site of holeheResult.used) {
        findings.push({
          categoryKey: 'social_presence',
          title: site.domain,
          snippet: `هذا البريد مسجَّل لدى ${site.domain}.`,
          source_url: null,
          source_name: 'holehe',
          language: 'en',
          confidence: 'high',
        })
        findings.push({
          categoryKey: 'contact_signals',
          title: `${site.domain} (مرتبط بهذا البريد)`,
          snippet: null,
          source_url: null,
          source_name: 'holehe',
          language: 'en',
          confidence: 'medium',
        })
      }
    } else {
      log.warn({ reason: holeheResult.reason }, 'holehe failed')
    }
    if (gravatarFindings.length > 0) {
      log.info({ event: 'gravatar.ok', findings: gravatarFindings.length }, 'gravatar ok')
      findings.push(...gravatarFindings)
    }
  }

  if (input.identifierType === 'username') {
    // maigret extracts profile DATA (bio, avatar, follower counts, …);
    // sherlock confirms additional sites maigret didn't probe;
    // GitHub adds a deterministic high-confidence record.
    const [maigretResult, sherlockResult, githubFindings] = await Promise.all([
      runMaigret(input.identifierValue, ctx.signal),
      runSherlock(input.identifierValue, ctx.signal),
      checkGitHubUser(input.identifierValue, ctx.signal).catch(() => []),
    ])

    const maigretSites = new Set<string>()
    if (maigretResult.ok) {
      log.info({
        event: 'maigret.ok',
        claimed: maigretResult.claimed.length,
        diag: (maigretResult as unknown as { diag?: unknown }).diag ?? null,
      }, 'maigret ok')
      for (const c of maigretResult.claimed) {
        maigretSites.add(c.site.toLowerCase())
        const f = c.fields ?? {}
        const num = (v: unknown): number | null => {
          if (v === undefined || v === null || v === '') return null
          const n = typeof v === 'number' ? v : parseInt(String(v), 10)
          return Number.isFinite(n) ? n : null
        }
        const metadata: FindingMetadata = {
          fullname: f.fullname ?? null,
          bio: f.bio ?? null,
          imageUrl: f.image ?? f.avatar ?? null,
          followerCount: num(f.follower_count),
          followingCount: num(f.following_count),
          location: f.location ?? null,
          blogUrl: f.blog_url ?? f.website ?? null,
          joinedAt: f.created_at ?? null,
          isVerified:
            f.is_verified === 'True' || f.is_verified === true
              ? true
              : f.is_verified === 'False' || f.is_verified === false
                ? false
                : null,
          uid: f.uid ?? null,
          company: f.company ?? f.is_company ?? null,
          publicRepos: num(f.public_repos_count),
          tags: c.tags && c.tags.length ? c.tags : null,
        }
        findings.push({
          categoryKey: 'social_presence',
          title: f.fullname ? `${f.fullname} — ${c.site}` : c.site,
          snippet: f.bio ?? buildSnippet(c.site, metadata),
          source_url: c.url || null,
          source_name: c.site,
          language: 'en',
          confidence: 'high',
          metadata,
        })
        // If maigret found an avatar, add it to profile_imagery too.
        if (metadata.imageUrl) {
          findings.push({
            categoryKey: 'profile_imagery',
            title: `صورة من ${c.site}`,
            snippet: null,
            source_url: metadata.imageUrl,
            source_name: c.site,
            language: 'en',
            confidence: 'high',
          })
        }
        // If maigret found a blog/website, that's a contact signal.
        if (metadata.blogUrl) {
          findings.push({
            categoryKey: 'contact_signals',
            title: `موقع شخصي مرتبط بـ ${c.site}`,
            snippet: metadata.blogUrl,
            source_url: metadata.blogUrl,
            source_name: c.site,
            language: 'en',
            confidence: 'medium',
          })
        }
      }
    } else {
      log.warn({ reason: maigretResult.reason }, 'maigret failed')
    }

    // sherlock for sites maigret didn't cover.
    if (sherlockResult.ok) {
      const novel = sherlockResult.used.filter(
        (s) => !maigretSites.has(s.name.toLowerCase())
      )
      log.info(
        { event: 'sherlock.ok', total: sherlockResult.used.length, novel: novel.length },
        'sherlock ok'
      )
      for (const site of novel) {
        findings.push({
          categoryKey: 'social_presence',
          title: site.name,
          snippet: site.url,
          source_url: site.url,
          source_name: 'sherlock',
          language: 'en',
          confidence: 'medium',
        })
      }
    } else {
      log.warn({ reason: sherlockResult.reason }, 'sherlock failed')
    }

    if (githubFindings.length > 0) {
      log.info({ event: 'github.ok', findings: githubFindings.length }, 'github ok')
      // De-dup against maigret's own GitHub finding (most likely already richer).
      const haveGithub = maigretSites.has('github')
      for (const gf of githubFindings) {
        if (haveGithub && gf.categoryKey === 'social_presence') continue
        findings.push(gf as OsintFinding)
      }
    }
  }

  if (input.identifierType === 'phone') {
    const [ignorantResult, phoneInfogaResult] = await Promise.all([
      runIgnorant(input.identifierValue, ctx.signal),
      runPhoneInfoga(input.identifierValue, ctx.signal).catch(() => ({
        ok: false as const,
        reason: 'unexpected_error',
      })),
    ])

    if (phoneInfogaResult.ok) {
      log.info(
        {
          event: 'phoneinfoga.ok',
          country: phoneInfogaResult.country,
          carrier: phoneInfogaResult.carrier,
          dorkGroups: Object.keys(phoneInfogaResult.googleDorks).length,
        },
        'phoneinfoga ok'
      )
      // Carrier + line-type → contact_signals (single rich finding).
      const carrierAr = phoneInfogaResult.carrierAr ?? phoneInfogaResult.carrier
      const lineTypeAr =
        phoneInfogaResult.lineType === 'mobile'
          ? 'هاتف محمول'
          : phoneInfogaResult.lineType === 'landline'
            ? 'هاتف أرضي'
            : null
      const snippetBits: string[] = []
      if (carrierAr) snippetBits.push(`الناقل: ${carrierAr}`)
      if (lineTypeAr) snippetBits.push(lineTypeAr)
      if (phoneInfogaResult.country === 'LY') snippetBits.push('ليبيا')
      else if (phoneInfogaResult.country) snippetBits.push(phoneInfogaResult.country)

      findings.push({
        categoryKey: 'contact_signals',
        title: phoneInfogaResult.international,
        snippet: snippetBits.join(' · ') || null,
        source_url: null,
        source_name: 'PhoneInfoga',
        language: 'en',
        confidence: 'high',
      })

      // Social-media dorks → reputation_indicators (Google search shortcuts).
      // Each dork is a clickable link the user can run themselves.
      const socialDorks = phoneInfogaResult.googleDorks.social_media ?? []
      for (const dork of socialDorks) {
        findings.push({
          categoryKey: 'public_mentions',
          title: `بحث ${dork.label} عن هذا الرقم`,
          snippet: 'رابط بحث Google جاهز للمصادر العامة على المنصة.',
          source_url: dork.url,
          source_name: dork.label,
          language: 'en',
          confidence: 'low',
        })
      }
      const reputationDorks = phoneInfogaResult.googleDorks.reputation ?? []
      for (const dork of reputationDorks) {
        findings.push({
          categoryKey: 'reputation_indicators',
          title: `بحث سمعة ${dork.label}`,
          snippet: 'رابط بحث Google لمؤشرات سمعة هذا الرقم.',
          source_url: dork.url,
          source_name: dork.label,
          language: 'en',
          confidence: 'low',
        })
      }
    } else {
      log.warn({ reason: phoneInfogaResult.reason }, 'phoneinfoga failed')
    }

    if (ignorantResult.ok) {
      log.info(
        { event: 'ignorant.ok', checked: ignorantResult.checked, used: ignorantResult.used.length },
        'ignorant ok'
      )
      for (const site of ignorantResult.used) {
        findings.push({
          categoryKey: 'social_presence',
          title: site.domain,
          snippet: `هذا الرقم مسجَّل لدى ${site.domain}.`,
          source_url: null,
          source_name: 'ignorant',
          language: 'en',
          confidence: 'high',
        })
        findings.push({
          categoryKey: 'contact_signals',
          title: `${site.domain} (مرتبط بهذا الرقم)`,
          snippet: null,
          source_url: null,
          source_name: 'ignorant',
          language: 'en',
          confidence: 'medium',
        })
      }
    } else {
      log.warn({ reason: ignorantResult.reason }, 'ignorant failed')
    }
  }

  return { findings }
}

function runOnce(input: AnalyzeInput, ctx: AnalyzeCtx): Promise<ResearcherResult> {
  const cached = inflight.get(ctx.lookupId)
  if (cached) return cached.promise
  const promise = doResearch(input, ctx).finally(() => {
    // Drop from the map after a short delay so late-arriving providers still
    // hit the cache, but memory doesn't grow unbounded.
    setTimeout(() => inflight.delete(ctx.lookupId), 60_000)
  })
  inflight.set(ctx.lookupId, { promise })
  return promise
}

const SYSTEM_PROMPT = `You are a public-information researcher.

You will receive an IDENTIFIER (a name, username, email, or phone number).
Your job is to list ONLY the public-information signals you can recall from your
training data about THIS SPECIFIC identifier — across five categories:
  - social_presence       (verified or widely-cited public profiles)
  - public_mentions       (news articles, interviews, public records, papers)
  - contact_signals       (publicly-disclosed contact info, listings, directories)
  - reputation_indicators (reviews, ratings, awards, sanctions, controversies)
  - profile_imagery       (publicly-known headshots / cover images)

CRITICAL RULES — read carefully:
1. Output ONLY information you actually know. NEVER invent profiles, URLs,
   handles, articles, dates, ratings, or biographical claims.
2. If you do not have specific knowledge of THIS identifier, return:
   {"findings": [], "known_entity": false, "notes": "..."}
3. Common Arabic/Latin names match many people. Do NOT merge findings about
   different individuals into one. If unsure, return empty.
4. Email addresses, phone numbers, and obscure usernames are almost never
   things you have specific knowledge of — return empty unless the identifier
   is a well-known public-figure handle.
5. \`source_url\` MUST be a real URL you can recall, OR null. Never guess.
6. Confidence rubric:
   high   — multiple corroborating well-known sources from training.
   medium — one well-known source.
   low    — partial recall, common-name ambiguity, single weak source.
7. Output JSON ONLY — no prose, no code fences, no preamble.`

function userPrompt(value: string, type: IdentifierType): string {
  return `IDENTIFIER:
{"value": ${JSON.stringify(value)}, "type": "${type}"}

Return ONE JSON object with this exact shape:
{
  "known_entity": boolean,                  // true ONLY if you have specific recall about THIS identifier
  "notes": string | null,                   // brief note in English about ambiguity / lack of knowledge
  "findings": [
    {
      "category_key": "social_presence" | "public_mentions" | "contact_signals" | "reputation_indicators" | "profile_imagery",
      "title": string,                      // short factual title (Arabic if the source is Arabic, English otherwise)
      "snippet": string | null,             // 1-2 sentence factual snippet
      "source_url": string | null,          // ONLY if you recall a real URL, else null
      "source_name": string,                // human-readable source label (e.g. "LinkedIn", "Reuters", "Al Jazeera")
      "language": "ar" | "en" | null,       // language of title/snippet
      "confidence": "high" | "medium" | "low"
    }
  ]
}

Remember: empty findings are correct and expected for unknown identifiers.`
}

async function doResearch(input: AnalyzeInput, ctx: AnalyzeCtx): Promise<ResearcherResult> {
  const log = lookupLogger(ctx.lookupId).child({ provider_id: 'live.researcher' })

  if (!env.NVIDIA_API_KEY) {
    log.warn('NVIDIA_API_KEY missing; researcher returns empty')
    return { findings: [], knownEntity: false, notes: null }
  }

  let raw: string
  try {
    raw = await chatComplete({
      model: env.NVIDIA_MODEL_RESEARCHER,
      temperature: 0.1, // factual recall — keep low
      maxTokens: 1500,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt(input.identifierValue, input.identifierType) },
      ],
      signal: ctx.signal,
    })
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'researcher call failed')
    throw err
  }

  const parsed = parseResearcherJson(raw)
  if (!parsed) {
    log.warn({ rawHead: raw.slice(0, 200) }, 'researcher returned unparseable JSON')
    return { findings: [], knownEntity: false, notes: 'parse_error' }
  }
  log.info(
    {
      event: 'researcher.ok',
      knownEntity: parsed.knownEntity,
      findings: parsed.findings.length,
    },
    'researcher ok'
  )
  return parsed
}

const VALID_CATEGORIES: ReadonlyArray<CategoryKey> = [
  'social_presence',
  'public_mentions',
  'contact_signals',
  'reputation_indicators',
  'profile_imagery',
]

const VALID_CONFIDENCE = ['high', 'medium', 'low'] as const

function parseResearcherJson(raw: string): ResearcherResult | null {
  // Robust JSON extraction (largest balanced {…} block).
  let s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  let depth = 0
  let start = -1
  let inStr = false
  let escape = false
  let body: string | null = null
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
        body = s.slice(start, i + 1)
        break
      }
    }
  }
  if (!body) return null
  let obj: unknown
  try {
    obj = JSON.parse(body)
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  const findingsRaw = Array.isArray(o.findings) ? o.findings : []
  const findings: ResearcherFinding[] = []
  for (const f of findingsRaw) {
    if (!f || typeof f !== 'object') continue
    const fo = f as Record<string, unknown>
    const cat = fo.category_key
    const conf = fo.confidence
    if (!VALID_CATEGORIES.includes(cat as CategoryKey)) continue
    if (!VALID_CONFIDENCE.includes(conf as 'high' | 'medium' | 'low')) continue
    if (typeof fo.title !== 'string' || !fo.title.trim()) continue
    if (typeof fo.source_name !== 'string' || !fo.source_name.trim()) continue
    findings.push({
      category_key: cat as CategoryKey,
      title: fo.title.trim(),
      snippet: typeof fo.snippet === 'string' ? fo.snippet : null,
      source_url:
        typeof fo.source_url === 'string' && /^https?:\/\//i.test(fo.source_url)
          ? fo.source_url
          : null,
      source_name: fo.source_name.trim(),
      language:
        fo.language === 'ar' || fo.language === 'en'
          ? (fo.language as 'ar' | 'en')
          : null,
      confidence: conf as 'high' | 'medium' | 'low',
    })
  }
  return {
    findings,
    knownEntity: Boolean(o.known_entity),
    notes: typeof o.notes === 'string' ? o.notes : null,
  }
}

/* ---------- one provider per category, all sharing the cached call ---------- */

function makeLiveProvider(category: CategoryKey, displayLabel: string): SourceProvider {
  return {
    id: `live.${category}`,
    categoryKey: category,
    displayLabel,
    supports() {
      return true
    },
    async *analyze(input: AnalyzeInput, ctx: AnalyzeCtx) {
      // Run LLM researcher and OSINT in parallel; both are cached per-lookup.
      const [llm, osint] = await Promise.all([
        runOnce(input, ctx).catch(() => ({ findings: [], knownEntity: false, notes: 'researcher_error' as const })),
        runOsintOnce(input, ctx).catch(() => ({ findings: [] as OsintFinding[] })),
      ])
      // OSINT findings (holehe / sherlock / maigret / github / gravatar) — real, no hallucinations.
      for (const f of osint.findings) {
        if (f.categoryKey !== category) continue
        const out: Omit<Finding, 'id'> = {
          categoryKey: category,
          title: f.title,
          snippet: f.snippet,
          sourceUrl: f.source_url,
          sourceName: f.source_name,
          language: f.language,
          confidence: f.confidence,
          metadata: f.metadata ?? null,
        }
        yield out
      }
      // LLM findings.
      for (const f of llm.findings) {
        if (f.category_key !== category) continue
        const out: Omit<Finding, 'id'> = {
          categoryKey: category,
          title: f.title,
          snippet: f.snippet,
          sourceUrl: f.source_url,
          sourceName: f.source_name,
          language: f.language,
          confidence: f.confidence,
        }
        yield out
      }
    },
  }
}

export const liveProviders: SourceProvider[] = [
  makeLiveProvider('social_presence', 'الحضور على منصات التواصل'),
  makeLiveProvider('public_mentions', 'الإشارات العامة'),
  makeLiveProvider('contact_signals', 'إشارات التواصل'),
  makeLiveProvider('reputation_indicators', 'مؤشرات السمعة'),
  makeLiveProvider('profile_imagery', 'الصور الشخصية المحتملة'),
]

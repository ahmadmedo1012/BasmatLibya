/**
 * PhoneInfoga client — calls the local PhoneInfoga REST container to gather
 * carrier, country, line type, and Google-dork URLs for a phone number.
 *
 * The container is brought up by `docker compose up -d phoneinfoga` and serves
 * on PHONEINFOGA_URL (defaults to http://localhost:5050). When the URL is empty
 * or the container is unreachable, the client returns ok:false silently — the
 * pipeline degrades gracefully and other phone scanners (ignorant) still run.
 *
 * Libyan carrier inference is a pure-data overlay applied locally based on the
 * national-number prefix, because PhoneInfoga's free-tier `local` scanner only
 * returns "LY" without naming the carrier.
 */

import { loadEnv } from '../../../env.js'

const env = loadEnv()

export interface PhoneInfogaResult {
  ok: true
  e164: string
  international: string
  local: string
  countryCode: number
  country: string
  carrier: string | null
  carrierAr: string | null
  lineType: string | null
  /** Google-dork URLs grouped by topic. Keys: social_media, general, individuals, reputation, disposable_providers. */
  googleDorks: Record<string, Array<{ label: string; url: string }>>
}

export interface PhoneInfogaFailure {
  ok: false
  reason: string
}

/**
 * Maps Libyan national-number prefixes to canonical carrier names. Source:
 * Libyan numbering plan (LPTIC + GSMA). 091 == Libyana, 094 == Almadar (Al-Madar
 * Al-Jadid), 092 == Libyana, 093/095 == Almadar / wireline mix.
 */
function inferLibyanCarrier(rawLocal: string): { en: string; ar: string } | null {
  const digits = rawLocal.replace(/\D/g, '')
  // Strip leading 0 for the national prefix.
  const nat = digits.startsWith('0') ? digits.slice(1) : digits
  const head = nat.slice(0, 2)
  switch (head) {
    case '91':
    case '92':
      return { en: 'Libyana', ar: 'ليبيانا' }
    case '94':
    case '95':
      return { en: 'Almadar Aljadid', ar: 'المدار الجديد' }
    case '93':
      return { en: 'Libya Phone (LPT)', ar: 'ليبيا فون' }
    case '21':
    case '22':
    case '23':
    case '24':
    case '25':
      return { en: 'LPT (landline)', ar: 'ليبيا للاتصالات (أرضي)' }
    default:
      return null
  }
}

const SOCIAL_LABEL_MAP: Record<string, string> = {
  facebook: 'فيسبوك',
  twitter: 'تويتر',
  linkedin: 'لينكدإن',
  instagram: 'إنستغرام',
  youtube: 'يوتيوب',
  tiktok: 'تيك توك',
  reddit: 'ريديت',
  pastebin: 'Pastebin',
}

function dorkLabel(url: string): string {
  // Extract `site:foo.com` if present, else use host-of-search-term.
  const m = url.match(/site%3A([a-z0-9.-]+)/i)
  if (!m || !m[1]) return 'Google Search'
  const host = m[1].replace(/^www\./, '')
  const top = host.split('.')[0]?.toLowerCase() ?? host
  return SOCIAL_LABEL_MAP[top] ?? host
}

interface ScannerResponse {
  result: unknown
}

async function postScanner(
  scanner: string,
  number: string,
  signal: AbortSignal,
  timeoutMs = 8_000
): Promise<unknown | null> {
  if (!env.PHONEINFOGA_URL) return null
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  signal.addEventListener('abort', () => ac.abort())
  try {
    const res = await fetch(`${env.PHONEINFOGA_URL}/api/v2/scanners/${scanner}/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ number, options: {} }),
      signal: ac.signal,
    })
    if (!res.ok) return null
    const json = (await res.json()) as ScannerResponse
    return json.result ?? null
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

interface AddNumberResponse {
  valid: boolean
  e164: string
  international: string
  local: string
  rawLocal: string
  country: string
  countryCode: number
  carrier: string
}

interface LocalScanResult {
  raw_local?: string
  local?: string
  e164?: string
  international?: string
  country_code?: number
  country?: string
  carrier?: string
}

interface GoogleSearchResult {
  social_media?: Array<{ url: string }>
  general?: Array<{ url: string }>
  individuals?: Array<{ url: string }>
  reputation?: Array<{ url: string }>
  disposable_providers?: Array<{ url: string }>
}

/** Validate + canonicalise the number before scanning. */
async function validate(
  number: string,
  signal: AbortSignal
): Promise<AddNumberResponse | null> {
  if (!env.PHONEINFOGA_URL) return null
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 6_000)
  signal.addEventListener('abort', () => ac.abort())
  try {
    const res = await fetch(`${env.PHONEINFOGA_URL}/api/v2/numbers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ number }),
      signal: ac.signal,
    })
    if (!res.ok) return null
    const json = (await res.json()) as AddNumberResponse
    if (!json.valid) return null
    return json
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

export async function runPhoneInfoga(
  rawNumber: string,
  signal: AbortSignal
): Promise<PhoneInfogaResult | PhoneInfogaFailure> {
  if (!env.PHONEINFOGA_URL) {
    return { ok: false, reason: 'phoneinfoga_disabled' }
  }
  // PhoneInfoga rejects "+" and non-digits.
  const digits = rawNumber.replace(/\D/g, '')
  if (!digits) return { ok: false, reason: 'invalid_phone' }
  // Default to Libyan country code if user typed national digits only.
  const dialed = digits.startsWith('0') ? '218' + digits.slice(1) : digits

  const validated = await validate(dialed, signal)
  if (!validated) return { ok: false, reason: 'unreachable_or_invalid' }

  const [localResult, googleResult] = await Promise.all([
    postScanner('local', dialed, signal),
    postScanner('googlesearch', dialed, signal),
  ])

  const local = (localResult ?? null) as LocalScanResult | null
  const carrierEn = (validated.carrier && validated.carrier.trim()) || (local?.carrier?.trim() ?? '')
  let carrierAr: string | null = null
  let finalCarrierEn: string | null = carrierEn || null

  // For Libyan numbers, overlay our prefix-based carrier inference because the
  // free-tier local scanner often leaves carrier="" for LY.
  if (validated.country === 'LY' || local?.country === 'LY') {
    const libyan = inferLibyanCarrier(validated.rawLocal || local?.raw_local || dialed)
    if (libyan) {
      finalCarrierEn = libyan.en
      carrierAr = libyan.ar
    }
  }

  // Coarse line-type guess: Libyan mobiles all start with 09; others heuristic.
  const natDigits = (validated.rawLocal || local?.raw_local || dialed).replace(/\D/g, '')
  const lineType =
    natDigits.startsWith('09') || natDigits.startsWith('9') ? 'mobile' :
    natDigits.startsWith('02') || natDigits.startsWith('2') ? 'landline' :
    null

  // Pick the most useful Google dorks: social_media + reputation only,
  // capped at 6 total to avoid swamping the result page.
  const google = (googleResult ?? null) as GoogleSearchResult | null
  const dorks: Record<string, Array<{ label: string; url: string }>> = {}
  if (google) {
    if (Array.isArray(google.social_media) && google.social_media.length > 0) {
      dorks.social_media = google.social_media
        .slice(0, 5)
        .map((d) => ({ label: dorkLabel(d.url), url: d.url }))
    }
    if (Array.isArray(google.reputation) && google.reputation.length > 0) {
      dorks.reputation = google.reputation
        .slice(0, 2)
        .map((d) => ({ label: dorkLabel(d.url), url: d.url }))
    }
  }

  return {
    ok: true,
    e164: validated.e164,
    international: validated.international,
    local: validated.local,
    countryCode: validated.countryCode,
    country: validated.country,
    carrier: finalCarrierEn,
    carrierAr,
    lineType,
    googleDorks: dorks,
  }
}

/**
 * Pure-Node OSINT helpers — no Python runner, no API keys.
 *
 * - Gravatar: hash email → check public profile JSON.
 * - GitHub:   public user lookup by username + email-based commit search.
 *             unauthenticated rate limit is 60 req/h per IP — fine for v1.
 */

import { createHash } from 'node:crypto'
import type { CategoryKey } from '@basmat/shared'

export interface NodeOsintFinding {
  categoryKey: CategoryKey
  title: string
  snippet: string | null
  source_url: string | null
  source_name: string
  language: 'en' | null
  confidence: 'high' | 'medium' | 'low'
}

const COMMON_HEADERS = {
  'user-agent': 'BasmatLibya/0.2 (osint; +https://basmatlibya.onrender.com)',
  accept: 'application/json',
}

async function fetchJson<T = unknown>(url: string, signal: AbortSignal, timeoutMs = 6000): Promise<T | null> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  signal.addEventListener('abort', () => ac.abort())
  try {
    const res = await fetch(url, { headers: COMMON_HEADERS, signal: ac.signal })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

/** Gravatar — public profile by md5(email). */
export async function checkGravatar(email: string, signal: AbortSignal): Promise<NodeOsintFinding[]> {
  const hash = createHash('md5').update(email.trim().toLowerCase()).digest('hex')
  const data = await fetchJson<{
    entry?: Array<{
      preferredUsername?: string
      displayName?: string
      profileUrl?: string
      thumbnailUrl?: string
      photos?: Array<{ value: string }>
      accounts?: Array<{ shortname?: string; url?: string }>
    }>
  }>(`https://www.gravatar.com/${hash}.json`, signal)

  const entry = data?.entry?.[0]
  if (!entry) return []

  const findings: NodeOsintFinding[] = []
  if (entry.profileUrl || entry.displayName) {
    findings.push({
      categoryKey: 'social_presence',
      title: entry.displayName || entry.preferredUsername || 'Gravatar profile',
      snippet: entry.preferredUsername ? `@${entry.preferredUsername}` : null,
      source_url: entry.profileUrl ?? `https://www.gravatar.com/${hash}`,
      source_name: 'Gravatar',
      language: 'en',
      confidence: 'high',
    })
  }
  if (entry.thumbnailUrl || entry.photos?.[0]?.value) {
    findings.push({
      categoryKey: 'profile_imagery',
      title: 'صورة Gravatar',
      snippet: entry.thumbnailUrl ?? entry.photos?.[0]?.value ?? null,
      source_url: entry.thumbnailUrl ?? entry.photos?.[0]?.value ?? null,
      source_name: 'Gravatar',
      language: 'en',
      confidence: 'high',
    })
  }
  for (const acc of entry.accounts ?? []) {
    if (acc.url) {
      findings.push({
        categoryKey: 'social_presence',
        title: acc.shortname ?? acc.url,
        snippet: null,
        source_url: acc.url,
        source_name: 'Gravatar',
        language: 'en',
        confidence: 'high',
      })
    }
  }
  return findings
}

/** GitHub — public user by username (unauthenticated). */
export async function checkGitHubUser(username: string, signal: AbortSignal): Promise<NodeOsintFinding[]> {
  const cleaned = username.replace(/^@/, '').trim()
  if (!cleaned || /[^A-Za-z0-9_-]/.test(cleaned)) return []
  const u = await fetchJson<{
    login?: string
    name?: string
    bio?: string
    html_url?: string
    avatar_url?: string
    company?: string
    blog?: string
    location?: string
    public_repos?: number
    followers?: number
  }>(`https://api.github.com/users/${encodeURIComponent(cleaned)}`, signal, 5000)
  if (!u || !u.html_url) return []
  const findings: NodeOsintFinding[] = []
  findings.push({
    categoryKey: 'social_presence',
    title: u.name ? `${u.name} (@${u.login})` : `@${u.login}`,
    snippet: u.bio || (typeof u.followers === 'number' ? `${u.followers} متابع · ${u.public_repos} مستودع` : null),
    source_url: u.html_url,
    source_name: 'GitHub',
    language: 'en',
    confidence: 'high',
  })
  if (u.avatar_url) {
    findings.push({
      categoryKey: 'profile_imagery',
      title: 'صورة GitHub',
      snippet: null,
      source_url: u.avatar_url,
      source_name: 'GitHub',
      language: 'en',
      confidence: 'high',
    })
  }
  if (u.blog) {
    findings.push({
      categoryKey: 'contact_signals',
      title: 'موقع/مدوّنة',
      snippet: u.blog,
      source_url: u.blog.startsWith('http') ? u.blog : `https://${u.blog}`,
      source_name: 'GitHub',
      language: 'en',
      confidence: 'medium',
    })
  }
  return findings
}

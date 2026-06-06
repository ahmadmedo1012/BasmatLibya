/**
 * Site-settings cache (R-07).
 *
 * In-process Map with a 30 s TTL. Mutations call invalidate() so the writing
 * instance picks up the new value immediately; other instances pick it up
 * within the TTL — satisfies SC-005 ("≤ 30 s in 95% of changes") without Redis.
 */

import { eq } from 'drizzle-orm'
import {
  SiteSettingsMapSchema,
  SITE_SETTING_DEFAULTS,
  type SiteSettingKey,
  type SiteSettingsMap,
} from '@basmat/shared'
import { getDb, schema } from '../db/client.js'
import { logger } from '../observability/logger.js'

const TTL_MS = 30_000

interface Entry {
  value: SiteSettingsMap[SiteSettingKey]
  fetchedAt: number
}

const cache = new Map<SiteSettingKey, Entry>()

async function readFromDb(): Promise<SiteSettingsMap> {
  const rows = await getDb().select().from(schema.siteSettings)
  const raw: Partial<Record<SiteSettingKey, unknown>> = {}
  for (const r of rows) {
    raw[r.key as SiteSettingKey] = r.value
  }
  // Defaults backfill any key the DB has not yet stored.
  const merged = { ...SITE_SETTING_DEFAULTS, ...raw }
  const parsed = SiteSettingsMapSchema.safeParse(merged)
  if (!parsed.success) {
    logger.warn({ err: parsed.error.issues }, 'site_settings DB row failed schema; falling back to defaults')
    return { ...SITE_SETTING_DEFAULTS }
  }
  return parsed.data
}

export async function getSiteSetting<K extends SiteSettingKey>(key: K): Promise<SiteSettingsMap[K]> {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && now - hit.fetchedAt < TTL_MS) {
    return hit.value as SiteSettingsMap[K]
  }
  const all = await readFromDb()
  for (const k of Object.keys(all) as SiteSettingKey[]) {
    cache.set(k, { value: all[k], fetchedAt: now })
  }
  return all[key]
}

export async function getAllSiteSettings(): Promise<SiteSettingsMap> {
  const all = await readFromDb()
  const now = Date.now()
  for (const k of Object.keys(all) as SiteSettingKey[]) {
    cache.set(k, { value: all[k], fetchedAt: now })
  }
  return all
}

export function invalidateSiteSetting(key: SiteSettingKey): void {
  cache.delete(key)
}

export function invalidateAllSiteSettings(): void {
  cache.clear()
}

/** TEST ONLY — exposes internals so tests can simulate TTL expiry deterministically. */
export const __testing = {
  size: () => cache.size,
  setEntry: (key: SiteSettingKey, value: SiteSettingsMap[SiteSettingKey], fetchedAt: number) => {
    cache.set(key, { value, fetchedAt })
  },
  ttlMs: TTL_MS,
}

/**
 * Update a single setting and invalidate cache. Caller is expected to wrap this
 * in their own DB transaction together with an audit-log append (G9).
 */
export async function upsertSiteSetting<K extends SiteSettingKey>(
  key: K,
  value: SiteSettingsMap[K],
  actorUserId: string | null
): Promise<void> {
  const db = getDb()
  // Validate before write so we never persist garbage.
  const partial: Record<string, unknown> = { [key]: value }
  SiteSettingsMapSchema.partial().parse(partial)
  await db
    .insert(schema.siteSettings)
    .values({ key, value: value as unknown as object, lastUpdatedBy: actorUserId })
    .onConflictDoUpdate({
      target: schema.siteSettings.key,
      set: { value: value as unknown as object, lastUpdatedBy: actorUserId, lastUpdatedAt: new Date() },
    })
  invalidateSiteSetting(key)
}

export async function getSettingRecord(key: SiteSettingKey) {
  const rows = await getDb().select().from(schema.siteSettings).where(eq(schema.siteSettings.key, key))
  return rows[0] ?? null
}

import { z } from 'zod'

/**
 * Site settings — operator-tunable global controls (R-07).
 *
 * Adding a new key here is a code-only change; the writer inserts on first use.
 * Defaults below are seeded by migration 0002.
 */
export const SiteSettingsMapSchema = z.object({
  lookup_retention_days: z.number().int().min(1).max(365).default(30),
  rate_limit_per_visitor_window_minutes: z.number().int().min(1).max(1440).default(10),
  rate_limit_per_visitor_max_per_window: z.number().int().min(1).max(100).default(5),
  rate_limit_per_identifier_window_minutes: z.number().int().min(1).max(1440).default(60),
  rate_limit_per_identifier_max_per_window: z.number().int().min(1).max(1000).default(20),
  enrichment_enabled: z.boolean().default(false),
  public_lookups_enabled: z.boolean().default(true),
  session_lifetime_days: z.number().int().min(1).max(90).default(30),
})
export type SiteSettingsMap = z.infer<typeof SiteSettingsMapSchema>
export type SiteSettingKey = keyof SiteSettingsMap

export const SITE_SETTING_KEYS: readonly SiteSettingKey[] = [
  'lookup_retention_days',
  'rate_limit_per_visitor_window_minutes',
  'rate_limit_per_visitor_max_per_window',
  'rate_limit_per_identifier_window_minutes',
  'rate_limit_per_identifier_max_per_window',
  'enrichment_enabled',
  'public_lookups_enabled',
  'session_lifetime_days',
] as const

/** Defaults used by the seed step in migration 0002 and by the cache fallback. */
export const SITE_SETTING_DEFAULTS: SiteSettingsMap = SiteSettingsMapSchema.parse({})

/** Partial PATCH body — only keys the caller intends to update. */
export const SiteSettingsPatchSchema = SiteSettingsMapSchema.partial()
export type SiteSettingsPatch = z.infer<typeof SiteSettingsPatchSchema>

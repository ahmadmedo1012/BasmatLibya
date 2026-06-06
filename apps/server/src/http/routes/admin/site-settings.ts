/**
 * Admin: site settings — read all + atomic partial update (US2).
 */

import { Router } from 'express'
import { eq } from 'drizzle-orm'
import {
  SITE_SETTING_DEFAULTS,
  SITE_SETTING_KEYS,
  SiteSettingsMapSchema,
  SiteSettingsPatchSchema,
  type SiteSettingKey,
  type SiteSettingsMap,
} from '@basmat/shared'
import { getDb, schema } from '../../../db/client.js'
import { auditLog } from '../../../admin/audit-log.js'
import { invalidateSiteSetting } from '../../../admin/settings-cache.js'
import { buildArErrorBody } from '../../middleware/error.js'

export const adminSiteSettingsRouter = Router()

async function readAll(): Promise<SiteSettingsMap> {
  const rows = await getDb().select().from(schema.siteSettings)
  const raw: Record<string, unknown> = {}
  for (const r of rows) raw[r.key] = r.value
  return SiteSettingsMapSchema.parse({ ...SITE_SETTING_DEFAULTS, ...raw })
}

adminSiteSettingsRouter.get('/', async (_req, res) => {
  res.status(200).json(await readAll())
})

adminSiteSettingsRouter.patch('/', async (req, res) => {
  const parsed = SiteSettingsPatchSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json(buildArErrorBody('validation_failed'))
  }
  const patch = parsed.data
  const before = await readAll()
  const db = getDb()
  const actorId = req.session!.principal.id

  await db.transaction(async (tx) => {
    for (const k of Object.keys(patch) as SiteSettingKey[]) {
      const value = patch[k]
      if (value === undefined) continue
      await tx
        .insert(schema.siteSettings)
        .values({ key: k, value: value as unknown as object, lastUpdatedBy: actorId })
        .onConflictDoUpdate({
          target: schema.siteSettings.key,
          set: {
            value: value as unknown as object,
            lastUpdatedBy: actorId,
            lastUpdatedAt: new Date(),
          },
        })
      await auditLog.append(tx, {
        actorUserId: actorId,
        eventClass: 'admin',
        eventSubclass: 'site_setting_update',
        targetKind: 'site_setting',
        targetId: k,
        beforeValue: { [k]: before[k] },
        afterValue: { [k]: value },
      })
    }
  })

  // Invalidate cache for every key we touched.
  for (const k of Object.keys(patch) as SiteSettingKey[]) {
    invalidateSiteSetting(k)
  }
  // Touch every key to be defensive — defaults case included.
  for (const k of SITE_SETTING_KEYS) invalidateSiteSetting(k)

  res.status(200).json(await readAll())
})

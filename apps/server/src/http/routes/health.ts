import { readFileSync } from 'node:fs'
import { Router } from 'express'
import { sql } from 'drizzle-orm'
import { getDb } from '../../db/client.js'
import { readDbSchemaVersion } from '../../db/schema-version.js'
import { logger } from '../../observability/logger.js'
import type { HealthResponse } from '@basmat/shared'

const { version } = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf-8'))

export const healthRouter = Router()

healthRouter.get('/healthz', async (_req, res) => {
  let dbOk: 'ok' | 'down' = 'down'
  let dbSchemaVersion: string = 'unknown'
  try {
    const db = getDb()
    await db.execute(sql`select 1`)
    dbOk = 'ok'
    // T009: read the schema_version meta row to surface in the health
    // response. The boot-time `assertSchemaVersion` guard will have
    // already failed-fast if the row is missing, but the live health
    // check is defensive: if the row is missing/unparseable here, we
    // still report the DB as up and just set `dbSchemaVersion='unknown'`.
    const sv = await readDbSchemaVersion()
    if (sv.ok) {
      dbSchemaVersion = sv.dbVersion
    } else {
      logger.warn({ reason: sv.reason }, 'healthz: schema_version meta row missing or malformed')
    }
  } catch (err) {
    dbOk = 'down'
    logger.warn({ err: (err as Error).message }, 'healthz: DB probe failed')
  }
  const body: HealthResponse = {
    status: dbOk === 'ok' ? 'ok' : 'degraded',
    db: dbOk,
    version,
    dbSchemaVersion,
  }
  res.status(dbOk === 'ok' ? 200 : 503).json(body)
})

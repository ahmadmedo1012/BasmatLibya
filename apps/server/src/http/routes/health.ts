import { readFileSync } from 'node:fs'
import { Router } from 'express'
import { sql } from 'drizzle-orm'
import { getDb } from '../../db/client.js'
import type { HealthResponse } from '@basmat/shared'

const { version } = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf-8'))

export const healthRouter = Router()

healthRouter.get('/healthz', async (_req, res) => {
  let dbOk: 'ok' | 'down' = 'down'
  try {
    const db = getDb()
    await db.execute(sql`select 1`)
    dbOk = 'ok'
  } catch {
    dbOk = 'down'
  }
  const body: HealthResponse = {
    status: dbOk === 'ok' ? 'ok' : 'degraded',
    db: dbOk,
    version,
  }
  res.status(dbOk === 'ok' ? 200 : 503).json(body)
})

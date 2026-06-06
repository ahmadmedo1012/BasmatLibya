/**
 * Integration test — healthz 503 on DB unreachable (T017, FR-022, SC-010).
 *
 * Asserts that `GET /api/healthz` returns:
 *   - HTTP 503
 *   - body.db === 'down'
 *   - body.status === 'degraded'
 *   - body.dbSchemaVersion === 'unknown' (the meta row is unreachable too)
 * when the DB is unreachable. We simulate "DB unreachable" by mocking
 * `getDb()` to throw on `execute()` — the same shape the real client
 * would have on a connection-refused error.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

// Set required env BEFORE importing the health router.
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost/test'
process.env.MODEL_SECRET_KEY = process.env.MODEL_SECRET_KEY || Buffer.alloc(32).toString('base64')

// Mock the DB client to throw on every execute() — simulates a connection
// refused / network-down state.
vi.mock('../../src/db/client.js', () => ({
  getDb: () => ({
    execute: () => {
      throw new Error('connection refused (simulated)')
    },
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    }),
  }),
  schema: {
    siteSettings: {
      key: 'key',
      value: 'value',
    },
  },
}))

const { healthRouter } = await import('../../src/http/routes/health.js')

describe('GET /api/healthz when DB is unreachable (T017)', () => {
  let app: express.Express

  beforeAll(() => {
    app = express()
    app.use('/api', healthRouter)
  })

  it('returns 503 with db=down and status=degraded', async () => {
    const res = await request(app).get('/api/healthz')
    expect(res.status).toBe(503)
    expect(res.body).toMatchObject({
      status: 'degraded',
      db: 'down',
    })
    // dbSchemaVersion is unknown because the meta-row read also failed.
    expect(res.body.dbSchemaVersion).toBe('unknown')
  })

  it('still reports the running image version (so the operator can correlate)', async () => {
    const res = await request(app).get('/api/healthz')
    expect(res.status).toBe(503)
    expect(typeof res.body.version).toBe('string')
    expect(res.body.version.length).toBeGreaterThan(0)
  })
})

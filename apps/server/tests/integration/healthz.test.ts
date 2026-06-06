/**
 * Healthz integration test (T017, FR-022, SC-010).
 *
 * Verifies that `GET /api/healthz` returns 503 + `db: 'down'` when the
 * database is unreachable. The test mocks the `getDb` import to throw
 * before it can be used, so the health route's try/catch falls into the
 * `dbOk = 'down'` branch.
 *
 * The test does NOT require a running Postgres. It mounts the health
 * router on a fresh Express app and uses supertest to issue the
 * request.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

// Set required env BEFORE importing the modules that read it.
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost/test'
process.env.MODEL_SECRET_KEY = process.env.MODEL_SECRET_KEY || Buffer.alloc(32).toString('base64')

// Mock getDb to throw — simulates an unreachable DB.
vi.mock('../../src/db/client.js', () => ({
  getDb: () => {
    throw new Error('simulated DB unreachable')
  },
  schema: {},
}))

let request: typeof import('supertest').default
let express: typeof import('express').default

beforeAll(async () => {
  ;({ default: express } = await import('express'))
  ;({ default: request } = await import('supertest'))
})

afterAll(() => {
  vi.restoreAllMocks()
})

describe('GET /api/healthz (T017)', () => {
  it('returns 503 + db: "down" when the database is unreachable', async () => {
    const { healthRouter } = await import('../../src/http/routes/health.js')
    const app = express()
    app.use('/api', healthRouter)
    const res = await request(app).get('/api/healthz')
    expect(res.status).toBe(503)
    expect(res.body).toMatchObject({
      status: 'degraded',
      db: 'down',
    })
    expect(res.body).toHaveProperty('version')
    expect(res.body).toHaveProperty('dbSchemaVersion')
  })
})

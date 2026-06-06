/**
 * Integration test: anonymous → protected route → 401 + designed error (T020).
 *
 * FR-019: an anonymous request to a route that requires a session MUST
 * return 401 with a designed Arabic error body. The client's
 * `optionalSession` middleware in `SignInPage` then uses the 401 to
 * redirect to `/sign-in?next=<current>`.
 *
 * In the current architecture, "protected routes" are guarded by
 * `requireSession` middleware. We mount a tiny route guarded by it
 * and assert the 401 + Arabic body contract.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost/test'
process.env.MODEL_SECRET_KEY = process.env.MODEL_SECRET_KEY || Buffer.alloc(32).toString('base64')

vi.mock('../../src/db/client.js', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    }),
  }),
  schema: {},
}))

let request: typeof import('supertest').default
let express: typeof import('express').default

beforeAll(async () => {
  ;({ default: express } = await import('express'))
  ;({ default: request } = await import('supertest'))
})

describe('anonymous → protected route (T020)', () => {
  it('GET /api/me without a session returns 401 + ErrorResponse(code: not_authenticated)', async () => {
    const { authRouter } = await import('../../src/http/routes/auth.js')
    const app = express()
    app.use(express.json())
    app.use('/api/auth', authRouter)

    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({
      code: 'not_authenticated',
    })
    expect(typeof res.body.messageAr).toBe('string')
    expect(res.body.messageAr.length).toBeGreaterThan(0)
  })
})

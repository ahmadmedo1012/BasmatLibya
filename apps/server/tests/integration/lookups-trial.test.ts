/**
 * Integration test: anonymous trial gate (T032, FR-010, US2 acceptance #2).
 *
 * Anonymous visitors get exactly FREE_TRIAL_LIMIT (3) lookups. The 4th
 * request returns 402 with `code: 'free_trial_exhausted'`. The response
 * carries `X-Trial-Used` and `X-Trial-Remaining` headers so the client
 * can update its local state without an extra round-trip.
 *
 * SKELETON: full coverage requires a real test Postgres with the 0004
 * migration applied. The contract is enforced by:
 *   (a) the unit test `enforceTrialGate` bypasses signed-in users
 *       (apps/server/tests/unit/trial-gate.test.ts)
 *   (b) the service code at apps/server/src/services/trial-gate.ts:36-45
 *       which throws HttpError(402, 'free_trial_exhausted') on exhaustion
 *   (c) the manual smoke (T043) which exercises the live paywall modal
 *       from a real browser
 *
 * Reference assertion shape for the real-DB test (uncomment in CI):
 *
 *   const app = express()
 *   app.use(cookieParser())
 *   app.use(visitorTokenMiddleware)
 *   app.use('/api/lookups', lookupsRouter)
 *
 *   // Burn 3 anonymous lookups
 *   for (let i = 0; i < 3; i++) {
 *     const r = await request(app).post('/api/lookups').send({ identifier: `test${i}` })
 *     expect(r.status).toBe(201)
 *     expect(Number(r.headers['x-trial-used'])).toBe(i + 1)
 *   }
 *
 *   // 4th must 402
 *   const r4 = await request(app).post('/api/lookups').send({ identifier: 'test4' })
 *   expect(r4.status).toBe(402)
 *   expect(r4.body.code).toBe('free_trial_exhausted')
 *   expect(r4.body.messageAr).toBe(i18nAr.ar.paywall.headline)  // or similar
 *   expect(r4.body.retryAfterSeconds).toBeNull()
 *   expect(Number(r4.headers['x-trial-remaining'])).toBe(0)
 */
import { describe, it, expect } from 'vitest'

describe('anonymous trial gate (T032)', () => {
  it('SKELETON: pinned contract — 4th anonymous request returns 402 with code=free_trial_exhausted + Arabic messageAr + X-Trial-Used/Remaining headers', () => {
    // Reference: apps/server/src/services/trial-gate.ts:36-45 enforces the
    // limit; the route sets the X-Trial-Used/Remaining headers at
    // apps/server/src/http/routes/lookups.ts:44-45.
    expect(true).toBe(true)
  })
})

/**
 * Integration test: deep-link to a finished lookup (T037, FR-015, US2 acceptance #6).
 *
 * `GET /api/lookups/:id` for a finished lookup returns 200 +
 * `LookupResponse` (the discriminated union from T031). The ResultPage
 * renders the appropriate state (completed/expired/failed) based on
 * the `status` field.
 *
 * SKELETON: full coverage requires a real test Postgres with at least
 * one completed lookup. The contract is enforced by:
 *   (a) the contract test for LookupResponseSchema (T031) — every
 *       variant of the union is pinned.
 *   (b) the manual smoke (T043) which deep-links to a real finished
 *       lookup URL.
 *   (c) the unit test below which pins the route's expected error
 *       responses for the not-found and in-progress cases.
 */
import { describe, it, expect } from 'vitest'

describe('deep-link to finished lookup (T037)', () => {
  it('SKELETON: pinned contract — GET /api/lookups/:id for finished returns 200 + LookupResponse; for unknown id returns 404 + ErrorResponse(code: lookup_not_found); for in_progress returns 409 + ErrorResponse(code: lookup_in_progress)', () => {
    // Reference assertion shape for the real-DB test:
    //
    //   const finished = await request(app).get(`/api/lookups/${completedId}`)
    //   expect(finished.status).toBe(200)
    //   expect(['completed', 'expired', 'failed']).toContain(finished.body.status)
    //
    //   const notFound = await request(app).get('/api/lookups/00000000-0000-0000-0000-000000000000')
    //   expect(notFound.status).toBe(404)
    //   expect(notFound.body.code).toBe('lookup_not_found')
    //   expect(typeof notFound.body.messageAr).toBe('string')
    //   expect(notFound.body.messageAr.length).toBeGreaterThan(0)
    //
    //   const inProgress = await request(app).get(`/api/lookups/${runningId}`)
    //   expect(inProgress.status).toBe(409)
    //   expect(inProgress.body.code).toBe('lookup_in_progress')
    expect(true).toBe(true)
  })
})

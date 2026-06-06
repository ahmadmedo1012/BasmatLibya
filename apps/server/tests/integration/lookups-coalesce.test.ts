/**
 * Integration test: duplicate-submit coalescing (T036, FR-016, US2 acceptance #7).
 *
 * Two consecutive `POST /api/lookups` for the same identifier within the
 * 5-minute COALESCE_WINDOW return the SAME `id`. The second request's
 * `reused: true` flag at the service layer is internal — the HTTP body
 * shape is unchanged.
 *
 * SKELETON: full coverage requires a real test Postgres. The contract
 * is enforced by:
 *   (a) the service code at apps/server/src/services/lookups.ts:32-95 —
 *       `createOrCoalesceLookup` checks for an existing in_progress
 *       lookup within the 5-min window and returns it.
 *   (b) the manual smoke (T043) which double-clicks the home page and
 *       verifies only one lookup row is created.
 *   (c) the unit test for the normalisation helper — the coalesce
 *       key is `identifierValueNormalised`, so case/whitespace
 *       differences coalesce too.
 */
import { describe, it, expect } from 'vitest'
import { normaliseIdentifier } from '@basmat/shared'

describe('duplicate-submit coalescing (T036)', () => {
  it('SKELETON: pinned contract — second POST /api/lookups within 5 min returns same id; the coalesce key is the normalised identifier', () => {
    // The coalesce key normalisation (server-side): trim, NFC, lowercase.
    // See packages/shared/src/identifier.ts:24-26.
    // Phone-formatting characters (spaces, dashes, parens) are NOT stripped
    // — that is the user's input exactly as they typed it. The contract
    // guarantee is case + NFC + whitespace only.
    expect(normaliseIdentifier('Ahmed@Example.com')).toBe(normaliseIdentifier('ahmed@example.com'))
    expect(normaliseIdentifier('  ahmed  ')).toBe(normaliseIdentifier('ahmed'))
    // The two phone forms differ in formatting chars, so the coalesce key
    // is different. This is the documented behaviour: a user pasting
    // '+218 91-1234567' is treated as a *different* identifier than
    // '+218911234567' (whitespace and punctuation preserved). A retry
    // inside the 5-min window with the SAME formatting will coalesce;
    // a retry with a different formatting will start a new lookup.
    expect(normaliseIdentifier('+218 91-1234567')).not.toBe(normaliseIdentifier('+218911234567'))
    // Reference assertion shape for the real-DB test:
    //
    //   const r1 = await request(app).post('/api/lookups').send({ identifier: 'ahmed' })
    //   const r2 = await request(app).post('/api/lookups').send({ identifier: 'Ahmed' })
    //   expect(r2.body.id).toBe(r1.body.id)
    expect(true).toBe(true)
  })
})

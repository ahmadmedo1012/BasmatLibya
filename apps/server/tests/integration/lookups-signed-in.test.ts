/**
 * Integration test: signed-in trial bypass (T035, FR-011, US2 acceptance #4).
 *
 * Signed-in users bypass the trial gate. The 6th, 10th, 100th request
 * all return 201 with no `X-Trial-Used` increment (or the headers show
 * the visitor's anonymous-lookups count, NOT a per-user quota).
 *
 * Implementation-level test: `enforceTrialGate` returns early when
 * `ownerUserId !== null`. This is the Bypass path of FR-011.
 *
 * We test the service directly (no DB) — `enforceTrialGate` never
 * touches the DB when `ownerUserId` is set. The function body is:
 *
 *     if (args.ownerUserId) return
 *     const state = await getTrialState(args.visitorTokenHash)
 *     if (state.exhausted) throw new HttpError(402, 'free_trial_exhausted')
 *
 * We assert the bypass by calling with `ownerUserId: 'x'` and expecting
 * a successful return. We also assert the FAILURE path: an anonymous
 * visitor with exhausted lookups throws 402 — but this requires DB.
 * That is covered by the T032 skeleton + the real-DB CI test.
 */
import { describe, it, expect, vi } from 'vitest'

vi.hoisted(() => {
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost/test'
  process.env.MODEL_SECRET_KEY = process.env.MODEL_SECRET_KEY || Buffer.alloc(32).toString('base64')
})

vi.mock('../../src/db/client.js', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ n: 99 }]),
        }),
      }),
    }),
  }),
  schema: {},
}))

import { enforceTrialGate } from '../../src/services/trial-gate.js'

describe('enforceTrialGate — signed-in bypass (T035)', () => {
  it('returns silently when ownerUserId is set (does not query DB)', async () => {
    // ownerUserId is truthy → early return. No DB call.
    await expect(
      enforceTrialGate({ visitorTokenHash: 'anon-hash', ownerUserId: 'user-uuid' })
    ).resolves.toBeUndefined()
  })

  it('returns silently even when the visitor would otherwise be exhausted (the owner flag wins)', async () => {
    // Same call, different "would be exhausted" scenario — still bypasses
    // because the function never reads `visitorTokenHash` when
    // `ownerUserId` is set.
    await expect(
      enforceTrialGate({ visitorTokenHash: 'exhausted-anon', ownerUserId: 'user-uuid' })
    ).resolves.toBeUndefined()
  })
})

import { and, eq, count } from 'drizzle-orm'
import { getDb, schema } from '../db/client.js'
import { HttpError } from '../http/middleware/error.js'

export const FREE_TRIAL_LIMIT = 3

export interface TrialState {
  used: number
  limit: number
  remaining: number
  exhausted: boolean
}

export async function getTrialState(visitorTokenHash: string): Promise<TrialState> {
  const db = getDb()
  const rows = await db
    .select({ n: count() })
    .from(schema.lookups)
    .where(eq(schema.lookups.visitorTokenHash, visitorTokenHash))
  const used = Number(rows[0]?.n ?? 0)
  const remaining = Math.max(0, FREE_TRIAL_LIMIT - used)
  return {
    used,
    limit: FREE_TRIAL_LIMIT,
    remaining,
    exhausted: remaining <= 0,
  }
}

/**
 * Anonymous visitors get exactly FREE_TRIAL_LIMIT lookups. After that we throw
 * a 402 with code "free_trial_exhausted" — the client renders the paywall.
 *
 * Signed-in users bypass: pass ownerUserId !== null to skip the check.
 */
export async function enforceTrialGate(args: {
  visitorTokenHash: string
  ownerUserId: string | null
}): Promise<void> {
  if (args.ownerUserId) return
  const state = await getTrialState(args.visitorTokenHash)
  if (state.exhausted) {
    throw new HttpError(402, 'free_trial_exhausted')
  }
}

/**
 * Signed-in user already had X anonymous lookups via this visitor cookie
 * (and now those got associated to their account). Returns the count for use
 * in the user's plan-quota math. Currently returns the raw association count.
 */
export async function countLookupsByOwner(ownerUserId: string): Promise<number> {
  const db = getDb()
  const rows = await db
    .select({ n: count() })
    .from(schema.userLookupAssociations)
    .where(
      and(
        eq(schema.userLookupAssociations.userId, ownerUserId)
      )
    )
  return Number(rows[0]?.n ?? 0)
}

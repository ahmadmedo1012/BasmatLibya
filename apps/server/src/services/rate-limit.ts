import { and, eq, sql } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { getDb, schema } from '../db/client.js'
import { loadEnv } from '../env.js'
import { HttpError } from '../http/middleware/error.js'

const env = loadEnv()

function hash(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function windowStartFor(now: Date, windowMinutes: number): Date {
  const ms = windowMinutes * 60_000
  return new Date(Math.floor(now.getTime() / ms) * ms)
}

export async function enforceLookupLimit(
  visitorTokenHash: string,
  identifierNormalised: string
): Promise<void> {
  const db = getDb()
  const now = new Date()
  const windowMinutes = env.RATE_LIMIT_WINDOW_MINUTES
  const start = windowStartFor(now, windowMinutes)
  const expiresAt = new Date(start.getTime() + windowMinutes * 60_000 + 60_000) // +1m grace
  const identifierHash = hash(identifierNormalised)

  const existing = await db
    .select()
    .from(schema.rateLimitCounters)
    .where(
      and(
        eq(schema.rateLimitCounters.visitorTokenHash, visitorTokenHash),
        eq(schema.rateLimitCounters.identifierHash, identifierHash),
        eq(schema.rateLimitCounters.windowStart, start)
      )
    )
    .limit(1)

  const current = existing[0]
  const max = env.RATE_LIMIT_MAX_PER_WINDOW

  if (current && current.count >= max) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((current.expiresAt.getTime() - now.getTime()) / 1000)
    )
    throw new HttpError(429, 'rate_limited', retryAfterSeconds)
  }

  if (current) {
    await db
      .update(schema.rateLimitCounters)
      .set({ count: sql`${schema.rateLimitCounters.count} + 1` })
      .where(
        and(
          eq(schema.rateLimitCounters.visitorTokenHash, visitorTokenHash),
          eq(schema.rateLimitCounters.identifierHash, identifierHash),
          eq(schema.rateLimitCounters.windowStart, start)
        )
      )
  } else {
    await db
      .insert(schema.rateLimitCounters)
      .values({
        visitorTokenHash,
        identifierHash,
        windowStart: start,
        count: 1,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [
          schema.rateLimitCounters.visitorTokenHash,
          schema.rateLimitCounters.identifierHash,
          schema.rateLimitCounters.windowStart,
        ],
        set: { count: sql`${schema.rateLimitCounters.count} + 1` },
      })
  }
}

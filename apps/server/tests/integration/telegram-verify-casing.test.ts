/**
 * Telegram hash casing normalization (T021, FR-025).
 *
 * The Telegram Login Widget documents the hash as lowercase hex, but
 * some browser extensions and integrators send uppercase. The server
 * MUST accept both. The recipe (in `telegram-verify.ts`) lowercases
 * `givenHash` before `timingSafeEqual`; this test pins the contract.
 *
 * The existing unit test in `tests/unit/telegram-verify.test.ts`
 * covers the lowercase happy path. This test specifically exercises
 * the uppercase variant.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createHash, createHmac } from 'node:crypto'

const BOT_TOKEN = 'test-bot:abcdefghijklmnopqrstuvwx'
process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost/test'
process.env.MODEL_SECRET_KEY = process.env.MODEL_SECRET_KEY || Buffer.alloc(32).toString('base64')

const verifyMod = await import('../../src/auth/telegram-verify.js')

function signPayload(payload: Record<string, string | number>): { hash: string; full: Record<string, string | number> } {
  const dataCheckString = Object.keys(payload)
    .sort()
    .map((k) => `${k}=${payload[k]}`)
    .join('\n')
  const secret = createHash('sha256').update(BOT_TOKEN).digest()
  const hash = createHmac('sha256', secret).update(dataCheckString).digest('hex')
  return { hash, full: { ...payload, hash } }
}

describe('telegram-verify hash casing (T021)', () => {
  let basePayload: Record<string, string | number>

  beforeAll(() => {
    const auth_date = Math.floor(Date.now() / 1000)
    basePayload = { id: 12345, first_name: 'Ahmed', auth_date }
  })

  it('accepts an UPPERCASE hex hash (some browser extensions send uppercase)', () => {
    const { full, hash } = signPayload(basePayload)
    const upper = { ...full, hash: hash.toUpperCase() }
    const result = verifyMod.verifyTelegramPayload(upper)
    expect(result.ok).toBe(true)
  })

  it('accepts a Mixed-CaSe hex hash', () => {
    const { full, hash } = signPayload(basePayload)
    const mixed = hash
      .split('')
      .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()))
      .join('')
    const result = verifyMod.verifyTelegramPayload({ ...full, hash: mixed })
    expect(result.ok).toBe(true)
  })

  it('accepts a lowercase hex hash (baseline)', () => {
    const { full } = signPayload(basePayload)
    const result = verifyMod.verifyTelegramPayload(full)
    expect(result.ok).toBe(true)
  })

  it('rejects a hash whose length is not 64 hex chars (Telegram spec)', () => {
    const result = verifyMod.verifyTelegramPayload({
      ...basePayload,
      hash: 'a'.repeat(63), // one short
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('malformed')
  })
})

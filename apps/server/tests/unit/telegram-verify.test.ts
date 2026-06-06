/**
 * Foundational unit test — Telegram payload verifier.
 * Verifies R-01: HMAC-SHA256 over sorted data-check-string with bot-token-derived key.
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

describe('telegram-verify', () => {
  it('accepts a valid, fresh payload', () => {
    const auth_date = Math.floor(Date.now() / 1000)
    const { full } = signPayload({ id: 12345, first_name: 'Ahmed', auth_date })
    const result = verifyMod.verifyTelegramPayload(full)
    expect(result.ok).toBe(true)
  })

  it('rejects a payload whose hash does not match', () => {
    const auth_date = Math.floor(Date.now() / 1000)
    const { full } = signPayload({ id: 12345, first_name: 'Ahmed', auth_date })
    const tampered = { ...full, first_name: 'Mallory' }
    const result = verifyMod.verifyTelegramPayload(tampered)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('hmac_invalid')
  })

  it('rejects a payload whose auth_date is older than the freshness window', () => {
    const auth_date = Math.floor(Date.now() / 1000) - 10 * 60 // 10 minutes ago
    const { full } = signPayload({ id: 12345, first_name: 'Ahmed', auth_date })
    const result = verifyMod.verifyTelegramPayload(full)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('auth_date_too_old')
  })

  it('rejects a payload missing the hash', () => {
    const result = verifyMod.verifyTelegramPayload({
      id: 1,
      first_name: 'a',
      auth_date: Math.floor(Date.now() / 1000),
    } as never)
    expect(result.ok).toBe(false)
  })
})

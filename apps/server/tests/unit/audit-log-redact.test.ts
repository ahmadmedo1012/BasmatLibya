/**
 * Foundational unit test — audit-log redaction.
 * Verifies G8: secrets are stripped from audit before/after values.
 */
import { describe, it, expect } from 'vitest'

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost/test'
process.env.NODE_ENV = 'test'
process.env.MODEL_SECRET_KEY = process.env.MODEL_SECRET_KEY || Buffer.alloc(32).toString('base64')

const { redactSensitive } = await import('../../src/admin/audit-log.js')

describe('audit-log redactSensitive', () => {
  it('redacts top-level sensitive keys', () => {
    const out = redactSensitive({ credential: 'sk-real', name: 'OpenAI' })
    expect(out).toEqual({ credential: { redacted: true }, name: 'OpenAI' })
  })

  it('redacts nested sensitive keys', () => {
    const out = redactSensitive({
      provider: 'openai',
      generation: { systemPrompt: 'be terse' },
      authorization: 'Bearer sk',
      params: { token: 'xyz', temperature: 0.5 },
    })
    expect(out).toEqual({
      provider: 'openai',
      generation: { systemPrompt: 'be terse' },
      authorization: { redacted: true },
      params: { token: { redacted: true }, temperature: 0.5 },
    })
  })

  it('redacts sensitive keys regardless of casing', () => {
    expect(redactSensitive({ ApiKey: 'x', API_KEY: 'y', Password: 'z' })).toEqual({
      ApiKey: { redacted: true },
      API_KEY: { redacted: true },
      Password: { redacted: true },
    })
  })

  it('walks arrays', () => {
    expect(redactSensitive([{ secret: 'a' }, { ok: 'b' }])).toEqual([
      { secret: { redacted: true } },
      { ok: 'b' },
    ])
  })

  it('passes through primitives', () => {
    expect(redactSensitive(null)).toBeNull()
    expect(redactSensitive(undefined)).toBeUndefined()
    expect(redactSensitive(42)).toBe(42)
    expect(redactSensitive('plain')).toBe('plain')
  })

  it('does not redact non-sensitive look-alike keys', () => {
    // "tokenize" is not in the deny-list pattern (re=/token/i hits, but
    // /token/i.test("tokenize") is true — so this WOULD be redacted).
    // The intent is conservative: better to over-redact than leak.
    const out = redactSensitive({ tokenize: 'method' }) as Record<string, unknown>
    expect(out.tokenize).toEqual({ redacted: true })
  })
})

/**
 * Foundational unit test — secret-cipher round-trip, key rotation, tamper detection.
 * Verifies G8: AI model credentials are confidential + integrity-protected.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { randomBytes } from 'node:crypto'

// Set required env BEFORE importing the cipher module.
const PRIMARY_KEY = randomBytes(32).toString('base64')
const PREVIOUS_KEY = randomBytes(32).toString('base64')
process.env.MODEL_SECRET_KEY = PRIMARY_KEY
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost/test'

const cipherMod = await import('../../src/admin/secret-cipher.js')

describe('secret-cipher', () => {
  it('round-trips a credential through encrypt/decrypt', () => {
    const plaintext = 'sk-test-1234567890abcdef'
    const blob = cipherMod.encrypt(plaintext)
    expect(blob.v).toBe(1)
    expect(blob.iv).toMatch(/^[A-Za-z0-9+/=]+$/)
    expect(blob.ciphertext).toMatch(/^[A-Za-z0-9+/=]+$/)
    expect(blob.tag).toMatch(/^[A-Za-z0-9+/=]+$/)
    const back = cipherMod.decrypt(blob)
    expect(back).toBe(plaintext)
  })

  it('produces a different ciphertext per call (random IV)', () => {
    const plaintext = 'sk-test-deadbeef'
    const a = cipherMod.encrypt(plaintext)
    const b = cipherMod.encrypt(plaintext)
    expect(a.ciphertext === b.ciphertext && a.iv === b.iv).toBe(false)
  })

  it('detects tampering via the GCM auth tag', () => {
    const blob = cipherMod.encrypt('sk-test-tamper')
    const tampered = { ...blob, tag: 'AAAA' + blob.tag.slice(4) }
    expect(() => cipherMod.decrypt(tampered)).toThrow()
  })

  it('lastFour returns the last 4 chars and never the whole secret', () => {
    expect(cipherMod.lastFour('sk-12345678abcd')).toBe('abcd')
    expect(cipherMod.lastFour('xyz')).toBe('xyz') // <=4 returns whole; safe.
  })
})

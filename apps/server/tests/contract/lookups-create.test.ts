/**
 * Contract test for CreateLookupRequestSchema + CreateLookupResponseSchema
 * (T030, FR-009, FR-016). Pure schema validation — the wire shape the
 * server emits and the client accepts. Any change here is a contract
 * change and must be applied to both ends in the same commit.
 */
import { describe, it, expect } from 'vitest'
import {
  CreateLookupRequestSchema,
  CreateLookupResponseSchema,
  IdentifierTypeSchema,
} from '@basmat/shared'

describe('CreateLookupRequestSchema (T030)', () => {
  it('accepts a name-like identifier', () => {
    const r = CreateLookupRequestSchema.parse({ identifier: 'أحمد المنفي' })
    expect(r.identifier).toBe('أحمد المنفي')
  })

  it('accepts an email', () => {
    const r = CreateLookupRequestSchema.parse({ identifier: 'ahmed@example.com' })
    expect(r.identifier).toBe('ahmed@example.com')
  })

  it('accepts a phone number (digits)', () => {
    const r = CreateLookupRequestSchema.parse({ identifier: '+218911234567' })
    expect(r.identifier).toBe('+218911234567')
  })

  it('accepts a username', () => {
    const r = CreateLookupRequestSchema.parse({ identifier: 'ahmed_m' })
    expect(r.identifier).toBe('ahmed_m')
  })

  it('rejects a missing identifier', () => {
    expect(() => CreateLookupRequestSchema.parse({})).toThrow()
  })

  it('rejects an empty identifier', () => {
    expect(() => CreateLookupRequestSchema.parse({ identifier: '' })).toThrow()
  })

  it('rejects a 1-char identifier (min=2)', () => {
    expect(() => CreateLookupRequestSchema.parse({ identifier: 'a' })).toThrow()
  })

  it('rejects an 81-char identifier (max=80)', () => {
    expect(() => CreateLookupRequestSchema.parse({ identifier: 'a'.repeat(81) })).toThrow()
  })

  it('the schema strips a client-sent identifierType — the server derives it (the service layer at lookups.ts:39 calls detectIdentifierType(trimmed), so a malicious client cannot spoof)', () => {
    // Zod's default behaviour for object schemas is to strip unknown keys
    // (not error). The contract guarantee is at the service layer, not
    // the schema layer: lookups.ts ignores whatever identifierType the
    // client sent and derives its own from the identifier value.
    const r = CreateLookupRequestSchema.parse({
      identifier: 'ahmed',
      identifierType: 'email',
    })
    expect(r.identifier).toBe('ahmed')
    expect((r as Record<string, unknown>).identifierType).toBeUndefined()
  })
})

describe('CreateLookupResponseSchema (T030)', () => {
  it('parses a valid response', () => {
    const valid = {
      id: '11111111-1111-1111-1111-111111111111',
      identifierType: 'email',
      status: 'in_progress',
      expiresAt: '2026-07-06T12:00:00.000Z',
      socketRoom: 'lookup:11111111-1111-1111-1111-111111111111',
    }
    const parsed = CreateLookupResponseSchema.parse(valid)
    expect(parsed.identifierType).toBe('email')
    expect(parsed.status).toBe('in_progress')
    expect(parsed.socketRoom).toBe('lookup:11111111-1111-1111-1111-111111111111')
  })

  it('enumerates the four identifierType values', () => {
    expect(IdentifierTypeSchema.options).toEqual(['name', 'username', 'email', 'phone'])
  })

  it('rejects a non-uuid id', () => {
    expect(() =>
      CreateLookupResponseSchema.parse({
        id: 'not-a-uuid',
        identifierType: 'email',
        status: 'in_progress',
        expiresAt: '2026-07-06T12:00:00.000Z',
        socketRoom: 'lookup:bad',
      })
    ).toThrow()
  })

  it('rejects a status that is not "in_progress" (the create response is always in_progress)', () => {
    // The terminal-state responses go through LookupResponseSchema, not this one.
    expect(() =>
      CreateLookupResponseSchema.parse({
        id: '11111111-1111-1111-1111-111111111111',
        identifierType: 'email',
        status: 'completed',
        expiresAt: '2026-07-06T12:00:00.000Z',
        socketRoom: 'lookup:11111111-1111-1111-1111-111111111111',
      })
    ).toThrow()
  })

  it('rejects an unknown identifierType', () => {
    expect(() =>
      CreateLookupResponseSchema.parse({
        id: '11111111-1111-1111-1111-111111111111',
        identifierType: 'ip',
        status: 'in_progress',
        expiresAt: '2026-07-06T12:00:00.000Z',
        socketRoom: 'lookup:11111111-1111-1111-1111-111111111111',
      })
    ).toThrow()
  })
})

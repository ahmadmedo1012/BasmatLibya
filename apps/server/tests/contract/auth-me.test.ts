/**
 * Contract test for AuthMeResponseSchema + PrincipalSchema (T018, FR-024, FR-025).
 *
 * Pure schema validation: a valid AuthMeResponse parses; an invalid one
 * (missing csrfToken, wrong role enum, negative telegramId) does not.
 * The contract is the wire shape — both the server's `authRouter.get('/me')`
 * and the client's `fetchMe()` MUST use these schemas.
 */
import { describe, it, expect } from 'vitest'
import { AuthMeResponseSchema, PrincipalSchema } from '@basmat/shared'

describe('AuthMeResponseSchema (T018)', () => {
  it('parses a valid AuthMeResponse', () => {
    const valid = {
      principal: {
        id: '11111111-1111-1111-1111-111111111111',
        telegramId: 6926512460,
        displayName: 'Ahmed',
        username: 'ahmed',
        avatarUrl: 'https://t.me/i/userpic/320/ahmed.jpg',
        role: 'user',
        status: 'active',
      },
      csrfToken: 'abcdefghijklmnopqrstuvwx',
      sessionExpiresAt: '2026-07-06T12:00:00.000Z',
    }
    const parsed = AuthMeResponseSchema.parse(valid)
    expect(parsed.principal.displayName).toBe('Ahmed')
    expect(parsed.csrfToken).toBe(valid.csrfToken)
  })

  it('rejects a response missing csrfToken', () => {
    const bad = {
      principal: {
        id: '11111111-1111-1111-1111-111111111111',
        telegramId: 6926512460,
        displayName: 'Ahmed',
        role: 'user',
        status: 'active',
      },
      sessionExpiresAt: '2026-07-06T12:00:00.000Z',
    }
    expect(() => AuthMeResponseSchema.parse(bad)).toThrow()
  })

  it('rejects a principal with an unknown role', () => {
    const bad = {
      principal: {
        id: '11111111-1111-1111-1111-111111111111',
        telegramId: 6926512460,
        displayName: 'Ahmed',
        role: 'admin', // not in RoleSchema enum
        status: 'active',
      },
      csrfToken: 'abcdefghijklmnopqrstuvwx',
      sessionExpiresAt: '2026-07-06T12:00:00.000Z',
    }
    expect(() => AuthMeResponseSchema.parse(bad)).toThrow()
  })

  it('rejects a non-uuid principal id', () => {
    const bad = {
      principal: {
        id: 'not-a-uuid',
        telegramId: 6926512460,
        displayName: 'Ahmed',
        role: 'user',
        status: 'active',
      },
      csrfToken: 'abcdefghijklmnopqrstuvwx',
      sessionExpiresAt: '2026-07-06T12:00:00.000Z',
    }
    expect(() => AuthMeResponseSchema.parse(bad)).toThrow()
  })
})

describe('PrincipalSchema (T018)', () => {
  it('accepts the minimal principal (only required fields)', () => {
    const minimal = {
      id: '11111111-1111-1111-1111-111111111111',
      telegramId: 6926512460,
      displayName: 'Ahmed',
      role: 'owner',
      status: 'active',
    }
    const parsed = PrincipalSchema.parse(minimal)
    expect(parsed.username).toBeUndefined()
    expect(parsed.avatarUrl).toBeUndefined()
  })

  it('coerces a string-form telegramId (the Login Widget sends a number; z.coerce defends against string fallbacks)', () => {
    const alt = {
      id: '11111111-1111-1111-1111-111111111111',
      telegramId: '6926512460', // string, not number
      displayName: 'Ahmed',
      role: 'user',
      status: 'active',
    }
    const parsed = PrincipalSchema.parse(alt)
    expect(parsed.telegramId).toBe(6926512460)
  })

  it('rejects a negative telegramId', () => {
    const bad = {
      id: '11111111-1111-1111-1111-111111111111',
      telegramId: -1,
      displayName: 'Ahmed',
      role: 'user',
      status: 'active',
    }
    expect(() => PrincipalSchema.parse(bad)).toThrow()
  })
})

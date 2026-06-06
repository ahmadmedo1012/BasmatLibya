/**
 * Contract test for ErrorResponseSchema enumerating every ErrorCode the
 * auth surface uses (T045, SC-008). The auth surface in 005-audit-repair-
 * core uses these codes (apps/server/src/http/routes/auth.ts +
 * apps/server/src/http/middleware/error.ts + apps/server/src/auth/*):
 *
 *   not_authenticated, unauthorized, csrf_required, hmac_invalid,
 *   auth_date_too_old, bot_unavailable, suspended_user
 *
 * The ErrorResponseSchema includes ALL codes (auth + lookups + admin),
 * but this test pins the SUBSET the auth surface emits, so an
 * inadvertent code removal is caught.
 */
import { describe, it, expect } from 'vitest'
import { ErrorResponseSchema, ErrorCodeSchema, i18nAr } from '@basmat/shared'

const AUTH_SURFACE_CODES = [
  'not_authenticated',
  'unauthorized',
  'csrf_required',
  'hmac_invalid',
  'auth_date_too_old',
  'bot_unavailable',
  'suspended_user',
] as const

describe('ErrorResponseSchema (T045)', () => {
  it('every auth-surface code parses as a valid ErrorResponse', () => {
    for (const code of AUTH_SURFACE_CODES) {
      const body = {
        code,
        messageAr: 'حدث خطأ',
        retryAfterSeconds: null,
      }
      const parsed = ErrorResponseSchema.parse(body)
      expect(parsed.code).toBe(code)
    }
  })

  it('the auth-surface codes are a subset of the closed ErrorCodeSchema union', () => {
    // This catches a code being added to AUTH_SURFACE_CODES above that
    // is NOT in the schema enum (i.e. the test would have caught a
    // typo before the route emitted it).
    for (const code of AUTH_SURFACE_CODES) {
      expect(() => ErrorCodeSchema.parse(code)).not.toThrow()
    }
  })

  it('the full ErrorCodeSchema enum is the documented set (no drift)', () => {
    // This pins the full enum. If a new code is added (legitimately),
    // this test will fail and the operator must consciously update the
    // contract docs (spec.md §Error Codes).
    expect(ErrorCodeSchema.options).toEqual([
      // v1 codes
      'identifier_invalid',
      'identifier_too_short',
      'identifier_too_long',
      'rate_limited',
      'lookup_in_progress',
      'lookup_not_found',
      'free_trial_exhausted',
      // feature 002 — auth
      'not_authenticated',
      'unauthorized',
      'csrf_required',
      'hmac_invalid',
      'auth_date_too_old',
      'bot_unavailable',
      'suspended_user',
      // feature 002 — admin
      'validation_failed',
      'last_owner_protected',
      'dependent_entries',
      'active_model_protected',
      'not_found',
    ])
  })

  it('i18nAr.ar.errors has Arabic copy for the auth-surface codes (or a generic fallback)', () => {
    for (const code of AUTH_SURFACE_CODES) {
      const errorsBlock = (i18nAr.ar as { errors?: Record<string, string> }).errors
      const hasKey = errorsBlock && typeof errorsBlock[code] === 'string'
      const hasGeneric =
        errorsBlock && typeof errorsBlock.generic === 'string'
      // Either the code has its own Arabic copy OR a generic fallback exists
      // (so the client never renders a raw code in the UI).
      expect(hasKey || hasGeneric).toBe(true)
    }
  })

  it('rejects an unknown code (the union is closed)', () => {
    expect(() =>
      ErrorResponseSchema.parse({
        code: 'totally_new_code',
        messageAr: '...',
        retryAfterSeconds: null,
      })
    ).toThrow()
  })

  it('requires messageAr (the Arabic copy is the contract — never empty)', () => {
    expect(() =>
      ErrorResponseSchema.parse({
        code: 'not_authenticated',
        messageAr: '',
        retryAfterSeconds: null,
      })
    ).toThrow()
  })
})

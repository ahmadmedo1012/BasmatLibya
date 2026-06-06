/**
 * Contract test for the i18nAr.ar.errorRecovery map (T060, FR-008, SC-008).
 *
 * Every error code the client surfaces to the user MUST have a recovery
 * action so the UI knows what to do. The 6 keys added in 005-audit-repair-
 * core are:
 *
 *   suspended_user       → redirect to /suspended
 *   free_trial_exhausted → open the paywall modal
 *   network_error        → show a retry button
 *   schema_mismatch      → show a retry-after hint
 *   session_expired      → redirect to /sign-in?next=<current>
 *   csrf_mismatch        → refetch the page and resubmit
 *
 * Plus the two legacy fallbacks:
 *   sign_in_failed → inline toast
 *   not_authenticated → redirect to /sign-in?next=<current>
 *   generic → inline toast
 */
import { describe, it, expect } from 'vitest'
import { i18nAr } from '@basmat/shared'

const REQUIRED_CODES = [
  'suspended_user',
  'free_trial_exhausted',
  'network_error',
  'schema_mismatch',
  'session_expired',
  'csrf_mismatch',
  'sign_in_failed',
  'not_authenticated',
  'generic',
] as const

const VALID_ACTIONS = new Set([
  'redirect',
  'open_paywall',
  'retry_button',
  'retry_after_hint',
  'refetch_and_retry',
  'inline_toast',
])

describe('i18nAr.ar.errorRecovery (T060)', () => {
  it('every required code has a recovery entry', () => {
    const recovery = (i18nAr.ar as { errorRecovery?: Record<string, unknown> }).errorRecovery
    expect(recovery).toBeDefined()
    if (!recovery) return
    for (const code of REQUIRED_CODES) {
      expect(recovery[code], `${code} must have a recovery entry`).toBeDefined()
    }
  })

  it('every recovery entry has a valid action enum', () => {
    const recovery = (i18nAr.ar as { errorRecovery?: Record<string, { action?: string }> })
      .errorRecovery
    if (!recovery) return
    for (const [code, entry] of Object.entries(recovery)) {
      expect(
        VALID_ACTIONS.has(entry.action ?? ''),
        `${code}: action must be one of ${[...VALID_ACTIONS].join(', ')}; got "${entry.action}"`
      ).toBe(true)
    }
  })

  it('suspended_user redirects to /suspended', () => {
    const r = (i18nAr.ar as { errorRecovery: { suspended_user: { action: string; target?: string } } })
      .errorRecovery.suspended_user
    expect(r.action).toBe('redirect')
    expect(r.target).toBe('/suspended')
  })

  it('free_trial_exhausted opens the paywall modal', () => {
    const r = (i18nAr.ar as { errorRecovery: { free_trial_exhausted: { action: string } } })
      .errorRecovery.free_trial_exhausted
    expect(r.action).toBe('open_paywall')
  })

  it('session_expired redirects to /sign-in with a next= template', () => {
    const r = (i18nAr.ar as { errorRecovery: { session_expired: { action: string; target?: string } } })
      .errorRecovery.session_expired
    expect(r.action).toBe('redirect')
    expect(r.target).toBe('/sign-in?next={NEXT}')
  })

  it('every Arabic error copy in i18nAr.ar.errors has a corresponding recovery entry (or falls back to "generic")', () => {
    const errors = (i18nAr.ar as { errors?: Record<string, string> }).errors ?? {}
    const recovery = (i18nAr.ar as { errorRecovery?: Record<string, unknown> }).errorRecovery ?? {}
    for (const code of Object.keys(errors)) {
      // The client must never encounter an error code it doesn't know
      // how to recover from. The fallback is the `generic` entry.
      expect(
        recovery[code] !== undefined || recovery['generic'] !== undefined,
        `${code} must have a recovery entry, or 'generic' must exist as the universal fallback`
      ).toBe(true)
    }
  })
})

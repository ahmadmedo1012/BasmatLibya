/**
 * Contract test for HealthResponseSchema (T044, FR-022, FR-023, SC-010).
 *
 * The /api/healthz response MUST include:
 *   - status: 'ok' | 'degraded'
 *   - db: 'ok' | 'down'
 *   - version: string
 *   - dbSchemaVersion: string (the running DB's schema version, 'unknown'
 *     when the site_settings row is missing or unparseable)
 *
 * Additive in 005-audit-repair-core: dbSchemaVersion enables the
 * `assertSchemaVersion()` boot-time guard. When the code is at v2 but
 * the DB is at v1, the server refuses to serve traffic (FR-022, FR-023).
 */
import { describe, it, expect } from 'vitest'
import { HealthResponseSchema } from '@basmat/shared'

describe('HealthResponseSchema (T044)', () => {
  it('accepts a healthy response with a known dbSchemaVersion', () => {
    const r = HealthResponseSchema.parse({
      status: 'ok',
      db: 'ok',
      version: '0.1.0',
      dbSchemaVersion: '1',
    })
    expect(r.status).toBe('ok')
    expect(r.db).toBe('ok')
    expect(r.dbSchemaVersion).toBe('1')
  })

  it('accepts a degraded response when the DB is reachable but a downstream check fails', () => {
    const r = HealthResponseSchema.parse({
      status: 'degraded',
      db: 'ok',
      version: '0.1.0',
      dbSchemaVersion: '1',
    })
    expect(r.status).toBe('degraded')
  })

  it('accepts a down response when the DB is unreachable', () => {
    const r = HealthResponseSchema.parse({
      status: 'degraded',
      db: 'down',
      version: '0.1.0',
      dbSchemaVersion: 'unknown',
    })
    expect(r.db).toBe('down')
    expect(r.dbSchemaVersion).toBe('unknown')
  })

  it('defaults dbSchemaVersion to "unknown" when missing (back-compat with pre-005 clients)', () => {
    const r = HealthResponseSchema.parse({
      status: 'ok',
      db: 'ok',
      version: '0.1.0',
    })
    expect(r.dbSchemaVersion).toBe('unknown')
  })

  it('rejects an unknown status enum', () => {
    expect(() =>
      HealthResponseSchema.parse({
        status: 'critical',
        db: 'ok',
        version: '0.1.0',
        dbSchemaVersion: '1',
      })
    ).toThrow()
  })

  it('rejects an unknown db enum', () => {
    expect(() =>
      HealthResponseSchema.parse({
        status: 'ok',
        db: 'unreachable',
        version: '0.1.0',
        dbSchemaVersion: '1',
      })
    ).toThrow()
  })

  it('rejects a missing version', () => {
    expect(() =>
      HealthResponseSchema.parse({
        status: 'ok',
        db: 'ok',
        dbSchemaVersion: '1',
      })
    ).toThrow()
  })
})

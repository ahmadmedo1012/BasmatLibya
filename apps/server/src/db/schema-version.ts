/**
 * DB schema version (T008, FR-023, R-3).
 *
 * The constant `SCHEMA_VERSION` MUST be bumped every time a migration is
 * added. At boot, `assertSchemaVersion()` reads the `site_settings` row
 * keyed `'schema_version'` and refuses to start the server when the
 * running code expects a *higher* version than the DB is at (i.e. the
 * `preDeployCommand` migrations have not run yet for this image).
 *
 * The reverse case (DB ahead of code) is also refused: downgrading is
 * never safe and would imply a manual rollback.
 *
 * The row is seeded by migration `0004_schema_version_meta.sql`.
 */

import { eq } from 'drizzle-orm'
import { getDb, schema } from './client.js'
import { loadEnv } from '../env.js'

export const SCHEMA_VERSION = '1' as const

export type SchemaVersionError =
  | { ok: false; reason: 'meta_row_missing' }
  | { ok: false; reason: 'meta_row_malformed'; raw: unknown }
  | { ok: false; reason: 'db_ahead_of_code'; dbVersion: string; codeVersion: string }
  | { ok: false; reason: 'code_ahead_of_db'; dbVersion: string; codeVersion: string }

interface MetaRow {
  ok: true
  dbVersion: string
}

/**
 * Reads the `site_settings` row keyed `'schema_version'`. Returns the
 * parsed version string on success, or a structured error describing
 * why it could not be read. Used by `assertSchemaVersion` and the
 * `/api/healthz` route (which surfaces the same value as
 * `dbSchemaVersion` in the response).
 */
export async function readDbSchemaVersion(): Promise<MetaRow | SchemaVersionError> {
  let db
  try {
    db = getDb()
  } catch (err) {
    // getDb() can throw at module load if DATABASE_URL is malformed; treat
    // as a missing row (the server will fail-fast on assertSchemaVersion).
    return { ok: false, reason: 'meta_row_missing' }
  }
  const rows = await db
    .select({ value: schema.siteSettings.value })
    .from(schema.siteSettings)
    .where(eq(schema.siteSettings.key, 'schema_version'))
    .limit(1)
  const row = rows[0]
  if (!row) return { ok: false, reason: 'meta_row_missing' }
  const raw = row.value as unknown
  if (!raw || typeof raw !== 'object' || typeof (raw as { version?: unknown }).version !== 'string') {
    return { ok: false, reason: 'meta_row_malformed', raw }
  }
  return { ok: true, dbVersion: (raw as { version: string }).version }
}

/**
 * Boot-time guard. Refuses to start the server when the running code's
 * `SCHEMA_VERSION` is not equal to the DB's stored version. Writes a
 * structured error message to stderr and throws so the process exits
 * with a non-zero code (Render will mark the deploy as failed).
 */
export async function assertSchemaVersion(): Promise<void> {
  // Ensure env is loaded first (the caller should already have called
  // loadEnv(); this is defensive in case assertSchemaVersion is called
  // from a script that hasn't).
  loadEnv()
  const result = await readDbSchemaVersion()
  if (!result.ok) {
    if (result.reason === 'meta_row_missing') {
      throw new Error(
        `Schema version guard: site_settings row 'schema_version' is missing. ` +
          `Run the preDeployCommand migrations (pnpm --filter @basmat/server db:migrate) before starting the new image.`
      )
    }
    if (result.reason === 'meta_row_malformed') {
      throw new Error(
        `Schema version guard: site_settings row 'schema_version' is malformed: ${JSON.stringify(result.raw)}. ` +
          `Expected a jsonb object with a 'version' string.`
      )
    }
    // The remaining error variants are version-mismatch cases; fall through.
  }
  if (result.ok) {
    const cmp = compareSemverish(result.dbVersion, SCHEMA_VERSION)
    if (cmp === 0) return
    if (cmp > 0) {
      throw new Error(
        `Schema version guard: DB is at version '${result.dbVersion}' but the running code expects '${SCHEMA_VERSION}'. ` +
          `Refusing to start — the DB is ahead of the code. Roll the deploy back to a matching image.`
      )
    }
    throw new Error(
      `Schema version guard: DB is at version '${result.dbVersion}' but the running code expects '${SCHEMA_VERSION}'. ` +
        `Run the preDeployCommand migrations (pnpm --filter @basmat/server db:migrate) before starting the new image.`
    )
  }
}

/**
 * Compare two dotted-numeric version strings ("1", "1.0", "1.2.3").
 * Returns -1, 0, or 1. Treats missing components as 0.
 */
function compareSemverish(a: string, b: string): -1 | 0 | 1 {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const ai = pa[i] ?? 0
    const bi = pb[i] ?? 0
    if (ai < bi) return -1
    if (ai > bi) return 1
  }
  return 0
}

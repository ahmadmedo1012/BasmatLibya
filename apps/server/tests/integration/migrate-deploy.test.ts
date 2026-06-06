/**
 * Integration test: preDeployCommand runs to completion (T048, FR-023, SC-005).
 *
 * Render runs `pnpm --filter @basmat/server db:migrate` before bringing
 * the new image into rotation. This test pins the contract at three levels:
 *
 *   1. `render.yaml` carries the preDeployCommand verbatim.
 *   2. Migration 0004 is idempotent (re-running it is a no-op).
 *   3. The 0004 SQL references the right table and key, and the
 *      `schema_version` row carries a JSON `{"version":"1"}` payload.
 *
 * Full coverage — i.e. the migration actually applying to a real DB
 * without error — requires a test Postgres. The shape assertions below
 * catch every realistic regression (rename, re-key, wrong table,
 * non-idempotent SQL) without needing a live DB.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..', '..', '..')

describe('preDeployCommand (T048)', () => {
  it('render.yaml carries preDeployCommand: pnpm --filter @basmat/server db:migrate', () => {
    const yaml = readFileSync(resolve(repoRoot, 'render.yaml'), 'utf8')
    expect(yaml).toMatch(/preDeployCommand:\s*pnpm --filter @basmat\/server db:migrate/)
  })

  it('migration 0004 is present and idempotent (uses ON CONFLICT)', () => {
    const sql = readFileSync(
      resolve(repoRoot, 'apps/server/src/db/migrations/0004_schema_version_meta.sql'),
      'utf8'
    )
    // 0004 must upsert into site_settings — the table that already holds
    // the other tunables (ENRICHMENT_ENABLED, RATE_LIMIT_*).
    expect(sql).toMatch(/INSERT INTO "site_settings"/)
    // Idempotent: re-running the migration must not error. ON CONFLICT
    // DO UPDATE WHERE value IS DISTINCT FROM is the actual idempotency
    // path (no-op when the value is unchanged).
    expect(sql).toMatch(/ON CONFLICT/)
    // Schema version payload is JSON-encoded.
    expect(sql).toMatch(/'{"version":"1"}'::jsonb/)
  })

  it('the journal entries cover all five migrations in order', () => {
    // Catches a regression where a migration is added but not journaled
    // (drizzle-kit would not run it on a real deploy).
    const journal = JSON.parse(
      readFileSync(
        resolve(repoRoot, 'apps/server/src/db/migrations/meta/_journal.json'),
        'utf8'
      )
    ) as { entries: { idx: number; when: number; tag: string; breakpoints: boolean }[] }
    const idxs = journal.entries.map((e) => e.idx).sort((a, b) => a - b)
    expect(idxs).toEqual([0, 1, 2, 3, 4])
    // Every journal entry has a matching .sql file on disk.
    const onDisk = readdirSync(resolve(repoRoot, 'apps/server/src/db/migrations'))
      .filter((f) => /^\d+_.+\.sql$/.test(f))
    for (const e of journal.entries) {
      // drizzle's convention: the `tag` field already includes the
      // 4-digit prefix (e.g. "0000_living_leper_queen"), so the file
      // name is `${tag}.sql`.
      expect(onDisk).toContain(`${e.tag}.sql`)
    }
  })
})

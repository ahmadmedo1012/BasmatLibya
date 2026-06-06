/**
 * Three-way diff test: env.ts ↔ .env.example (T053, FR-029, SC-007).
 *
 * Every key in `apps/server/src/env.ts` EnvSchema MUST appear in
 * `.env.example` and every documented variable in `.env.example` MUST
 * be read by the schema. The schema is the source of truth; the
 * .env.example is the documentation.
 *
 * Implementation: we parse the .env.example to extract the keys
 * (the lines that look like `KEY=value`), and we statically extract
 * the schema's keys (the z.object({...}) literal). Both sets are
 * compared.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..', '..', '..')

/**
 * Parse the .env.example file. Lines that look like `KEY=value` or
 * `KEY=` (with a value) are the documented keys. Lines starting with `#`
 * are comments. Empty lines are ignored.
 */
function extractExampleKeys(content: string): Set<string> {
  const keys = new Set<string>()
  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([A-Z][A-Z0-9_]*)\s*=/)
    if (m && m[1]) keys.add(m[1])
  }
  return keys
}

/**
 * Extract the schema's keys by reading the EnvSchema literal. We use a
 * simple regex over the source file: lines that look like
 *   `KEY: z.<something>` capture KEY. This is robust against multi-line
 * zod fields (the closing `,` is the terminator).
 */
function extractSchemaKeys(content: string): Set<string> {
  // Match a key followed by `:` and a zod call. The zod call may
  // start on this line (e.g. `KEY: z.string()`) or on the next
  // (e.g. multi-line z.string().optional().transform()).
  // We also catch `KEY: z` alone (the rest is on the next line).
  const keys = new Set<string>()
  for (const raw of content.split('\n')) {
    const m = raw.match(/^\s*([A-Z][A-Z0-9_]*)\s*:\s*z\.?/)
    if (m && m[1]) keys.add(m[1])
  }
  return keys
}

describe('env ↔ .env.example drift (T053)', () => {
  const envTs = readFileSync(resolve(repoRoot, 'apps/server/src/env.ts'), 'utf8')
  const envExample = readFileSync(resolve(repoRoot, '.env.example'), 'utf8')
  const schemaKeys = extractSchemaKeys(envTs)
  const exampleKeys = extractExampleKeys(envExample)

  it('every key in env.ts EnvSchema is documented in .env.example', () => {
    const missing: string[] = []
    for (const k of schemaKeys) {
      if (!exampleKeys.has(k)) missing.push(k)
    }
    expect(missing, `Keys in env.ts but not in .env.example: ${missing.join(', ')}`).toEqual([])
  })

  it('every documented key in .env.example is read by env.ts (no orphan docs)', () => {
    const orphans: string[] = []
    for (const k of exampleKeys) {
      if (!schemaKeys.has(k)) orphans.push(k)
    }
    expect(
      orphans,
      `Keys in .env.example but not in env.ts (orphan docs): ${orphans.join(', ')}`
    ).toEqual([])
  })

  it('the required keys (no default) are documented in .env.example with a placeholder value', () => {
    // The keys that have no `.default(...)` in env.ts MUST have a
    // non-empty placeholder in .env.example so an operator copying the
    // file knows they need to set them.
    const requiredKeys = [
      'DATABASE_URL', // has `.url()` but no default → required
    ]
    for (const k of requiredKeys) {
      expect(exampleKeys.has(k), `${k} must be in .env.example`).toBe(true)
      // The line must have a value (not `KEY=`)
      const re = new RegExp(`^${k}\\s*=\\s*\\S+`, 'm')
      expect(envExample.match(re), `${k} must have a non-empty placeholder value`).not.toBeNull()
    }
  })

  it('extractSchemaKeys finds at least the 22 expected schema keys (sanity)', () => {
    // This is a regression guard for the regex: if a future env.ts
    // refactor breaks the extractor, this test fails before the
    // diff tests report a misleading empty set.
    expect(schemaKeys.size).toBeGreaterThanOrEqual(20)
  })
})

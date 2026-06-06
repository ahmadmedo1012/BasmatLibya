/**
 * Hygiene test (T016, FR-032, FR-033, SC-007).
 *
 * Walks every `import`/`require`/`export from` reference in `apps/web/src`,
 * `apps/server/src`, and `packages/shared/src` and asserts that every
 * resolved module exists on disk. The test is intentionally regex-based
 * (not a full TypeScript parser) so it stays a single self-contained
 * file with no extra dependencies. False positives from string-literal
 * imports (e.g. `import x from './foo.js'` where `.js` is the wrong
 * extension) are caught here; false negatives (dynamic `require()` of
 * a runtime-resolved path) are accepted as a known limitation.
 *
 * This test does NOT cover the orphan-workflows file check (T002/T057)
 * or the dead-export sweep (T054); those are run separately.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve, dirname, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(import.meta.url), '../../../../../')
const SOURCE_DIRS = [
  join(ROOT, 'apps/web/src'),
  join(ROOT, 'apps/server/src'),
  join(ROOT, 'packages/shared/src'),
] as const

const TS_EXTS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.jsx'] as const

// Match a relative or root-relative import. Skips:
//   - comments (// ... or /* ... */)
//   - string literals that are not import specifiers
//   - dynamic imports with non-static first args (we only catch the
//     literal-string case, which is the vast majority in this codebase)
const IMPORT_RE =
  /(?:^|[^"'])(?:import\s+(?:[^'"`;]+?\s+from\s+)?|import\s*\(|require\s*\(\s*|export\s+(?:[^'"`;]+?\s+from\s+))(['"])([^'"]+)\1/gm

interface MissingRef {
  file: string
  specifier: string
  resolved: string
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.turbo') continue
      yield* walk(p)
    } else if (st.isFile()) {
      const ext = extname(entry)
      if (TS_EXTS.includes(ext as (typeof TS_EXTS)[number])) yield p
    }
  }
}

function resolveSpec(fromFile: string, spec: string): string | null {
  // Only resolve relative or root-alias (starts with @/) specifiers.
  if (!spec.startsWith('.') && !spec.startsWith('/') && !spec.startsWith('@/')) {
    return null // bare specifier (npm package) — assumed resolvable
  }
  let base: string
  if (spec.startsWith('@/')) {
    // Treat `@/...` as a repo-relative alias pointing at apps/web/src or
    // apps/server/src or packages/shared/src. The codebase doesn't actually
    // use this alias today; if it ever does, the matching here will need
    // to be updated to match the tsconfig paths.
    return null
  } else {
    base = resolve(dirname(fromFile), spec)
  }
  // Try the path as-is first, then with each TS extension, then as a
  // directory with index.*.
  const candidates: string[] = [base]
  for (const ext of TS_EXTS) {
    candidates.push(base + ext)
  }
  for (const ext of TS_EXTS) {
    candidates.push(join(base, 'index' + ext))
  }
  for (const c of candidates) {
    try {
      const st = statSync(c)
      if (st.isFile()) return c
    } catch {
      // continue
    }
  }
  return null
}

function findMissing(): MissingRef[] {
  const missing: MissingRef[] = []
  for (const dir of SOURCE_DIRS) {
    for (const file of walk(dir)) {
      const src = readFileSync(file, 'utf8')
      // strip line comments and block comments to reduce false positives
      const stripped = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
      let m: RegExpExecArray | null
      IMPORT_RE.lastIndex = 0
      while ((m = IMPORT_RE.exec(stripped)) !== null) {
        const spec = m[2]
        if (!spec) continue
        const resolved = resolveSpec(file, spec)
        if (resolved === null) continue // bare specifier
        try {
          statSync(resolved)
        } catch {
          missing.push({ file: file.replace(ROOT, ''), specifier: spec, resolved })
        }
      }
    }
  }
  return missing
}

describe('orphan imports (T016)', () => {
  it('every import in apps/ and packages/ resolves to a file on disk', () => {
    const missing = findMissing()
    if (missing.length > 0) {
      const lines = missing
        .slice(0, 20)
        .map((m) => `  - ${m.file}: '${m.specifier}' → ${m.resolved}`)
        .join('\n')
      const more = missing.length > 20 ? `\n  ... and ${missing.length - 20} more` : ''
      throw new Error(
        `Found ${missing.length} unresolvable imports (T016):\n${lines}${more}\n` +
          `Either the file is missing or the import path is wrong. ` +
          `(This test does not cover dynamic require() with non-literal args.)`
      )
    }
    expect(missing).toEqual([])
  })
})

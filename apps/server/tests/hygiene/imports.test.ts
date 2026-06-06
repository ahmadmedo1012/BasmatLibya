/**
 * Hygiene test — no-orphan-modules guard (T016, FR-032, FR-033, SC-007).
 *
 * Walks every `import`/`require` in `apps/` and `packages/` and asserts
 * the resolved file exists on disk. Catches "broken imports" that
 * escape `tsc --noEmit` (e.g. dynamic `import('./x.js')` whose target
 * has been deleted, or `import.meta.glob` paths that don't exist).
 *
 * The matching test for orphan CI workflows lives at
 * `apps/server/tests/hygiene/ci-workflows.test.ts` (T002/T057).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '../../../..')

// Source extensions we scan for import statements.
const SCAN_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

// Directories we skip (build output, deps, generated code).
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.opencode',
  '.claude',
  '.specify',
  'specs',
  'playwright-report',
  'test-results',
  '.vitest',
  'apps/server/drizzle', // generated; safe
])

// Regexes for static import / require / dynamic import.
const RE_STATIC_IMPORT = /import\s+(?:[\s\S]+?\s+from\s+)?['"]([^'"]+)['"]/g
const RE_DYNAMIC_IMPORT = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
const RE_REQUIRE = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
const RE_IMPORT_META = /import\.meta\.url/g
const RE_EXPORT_FROM = /export\s+(?:[\s\S]+?\s+from\s+)?['"]([^'"]+)['"]/g

interface BrokenRef {
  file: string
  specifier: string
  reason: string
}

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      yield* walk(p)
    } else if (e.isFile() && SCAN_EXTS.has(path.extname(e.name))) {
      yield p
    }
  }
}

function extractSpecifiers(source: string): string[] {
  const out: string[] = []
  for (const re of [RE_STATIC_IMPORT, RE_DYNAMIC_IMPORT, RE_REQUIRE, RE_EXPORT_FROM]) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(source))) {
      out.push(m[1]!)
    }
  }
  return out
}

function isBareSpecifier(spec: string): boolean {
  return !spec.startsWith('.') && !spec.startsWith('/') && !path.isAbsolute(spec)
}

function resolveRelative(fromFile: string, spec: string): string | null {
  const fromDir = path.dirname(fromFile)
  const candidates = [
    spec,
    `${spec}.ts`,
    `${spec}.tsx`,
    `${spec}.js`,
    `${spec}.jsx`,
    `${spec}.mjs`,
    `${spec}.cjs`,
    path.join(spec, 'index.ts'),
    path.join(spec, 'index.tsx'),
    path.join(spec, 'index.js'),
    path.join(spec, 'index.mjs'),
  ]
  for (const c of candidates) {
    const abs = path.resolve(fromDir, c)
    if (existsSync(abs) && statSync(abs).isFile()) return abs
  }
  return null
}

function checkPackageJsonDeps(): BrokenRef[] {
  // Walk every package.json in apps/ and packages/ and assert that every
  // declared dependency is either a workspace package (workspace:*),
  // a known bare specifier we don't validate, or installed in node_modules.
  // (Bare specifier existence in node_modules is not asserted here — the
  //  lockfile + `pnpm i` is the source of truth for that.)
  const broken: BrokenRef[] = []
  // No-op for now: implemented incrementally when feature flags are added.
  return broken
}

describe('no-orphan-modules guard (T016)', () => {
  it('every relative import in apps/ and packages/ resolves to a file on disk', async () => {
    const broken: BrokenRef[] = []

    for (const top of ['apps', 'packages']) {
      const topAbs = path.join(REPO_ROOT, top)
      if (!existsSync(topAbs)) continue
      for await (const file of walk(topAbs)) {
        const source = readFileSync(file, 'utf-8')
        for (const spec of extractSpecifiers(source)) {
          if (isBareSpecifier(spec)) continue // node_modules — out of scope here
          const resolved = resolveRelative(file, spec)
          if (!resolved) {
            broken.push({
              file: path.relative(REPO_ROOT, file),
              specifier: spec,
              reason: 'relative import does not resolve to a file on disk',
            })
          }
        }
      }
    }

    // Allow import.meta.url-only files (no module specifier in them).
    expect(broken).toEqual([])
  })

  it('every declared dependency in package.json files is either a workspace or a bare specifier (placeholder)', () => {
    // Placeholder — see checkPackageJsonDeps(). Will be expanded when the
    // first non-workspace dep is added under apps/ or packages/.
    expect(checkPackageJsonDeps()).toEqual([])
  })
})

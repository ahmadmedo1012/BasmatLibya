/**
 * OSINT runner — bridges the Node server to the Python venv that hosts holehe + sherlock.
 *
 * Layout on disk:
 *   tooling/osint-venv/         — Python 3 venv with holehe + sherlock-project installed
 *   tooling/osint/holehe_runner.py   — wraps holehe's async API, prints JSON
 *   tooling/osint/sherlock_runner.py — wraps sherlock's CLI, prints JSON
 *
 * Discovery: walk up from the server's CWD until we find tooling/osint-venv.
 * In dev (pnpm --filter @basmat/server dev) CWD is apps/server; in prod the
 * Docker image installs the venv at /app/tooling/osint-venv.
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

interface HoleheResult {
  ok: true
  email: string
  checked: number
  used: Array<{ name: string; domain: string; category: string | null }>
  errors: Array<{ name: string; reason: string }>
}

interface SherlockResult {
  ok: true
  username: string
  checked: number | null
  used: Array<{ name: string; url: string }>
}

interface IgnorantResult {
  ok: true
  phone: string
  checked: number
  used: Array<{ name: string; domain: string }>
  errors: Array<{ name: string; reason: string }>
}

interface MaigretClaimedFields {
  fullname?: string
  bio?: string
  image?: string
  avatar?: string
  follower_count?: string | number
  following_count?: string | number
  location?: string
  blog_url?: string
  website?: string
  created_at?: string
  is_verified?: string | boolean
  uid?: string
  company?: string
  is_company?: string
  public_repos_count?: string | number
}

interface MaigretResult {
  ok: true
  username: string
  claimed: Array<{
    site: string
    url: string
    tags: string[]
    fields: MaigretClaimedFields
  }>
}

interface FailureResult {
  ok: false
  reason: string
}

let resolvedRoot: string | null = null

function findOsintRoot(): { python: string; scripts: string } | null {
  if (resolvedRoot) {
    return { python: path.join(resolvedRoot, 'osint-venv', 'bin', 'python'), scripts: path.join(resolvedRoot, 'osint') }
  }
  let dir = process.cwd()
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, 'tooling', 'osint-venv', 'bin', 'python')
    if (fs.existsSync(candidate)) {
      resolvedRoot = path.join(dir, 'tooling')
      return { python: candidate, scripts: path.join(resolvedRoot, 'osint') }
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

function spawnRunner<T extends { ok: boolean }>(
  args: string[],
  signal: AbortSignal,
  timeoutMs: number
): Promise<T | FailureResult> {
  const root = findOsintRoot()
  if (!root) {
    return Promise.resolve({ ok: false, reason: 'osint_venv_missing' } as FailureResult)
  }
  return new Promise((resolve) => {
    const proc = spawn(root.python, args.map((a, i) => (i === 0 ? path.join(root.scripts, a) : a)), {
      stdio: ['ignore', 'pipe', 'pipe'],
      signal,
    })
    const chunks: Buffer[] = []
    let stderr = ''
    const timeoutHandle = setTimeout(() => {
      proc.kill('SIGKILL')
    }, timeoutMs)

    proc.stdout.on('data', (c) => chunks.push(c as Buffer))
    proc.stderr.on('data', (c) => {
      stderr += String(c)
    })
    proc.on('error', (err) => {
      clearTimeout(timeoutHandle)
      resolve({ ok: false, reason: 'spawn_error: ' + err.message } as FailureResult)
    })
    proc.on('close', (code) => {
      clearTimeout(timeoutHandle)
      const out = Buffer.concat(chunks).toString('utf8').trim()
      if (!out) {
        return resolve({ ok: false, reason: code === null ? 'killed' : `exit_${code}: ${stderr.slice(0, 200)}` } as FailureResult)
      }
      // Take the LAST line — earlier output may include progress / decode warnings.
      const lastLine = out.split('\n').filter((l) => l.trim()).pop() ?? out
      try {
        const parsed = JSON.parse(lastLine)
        resolve(parsed as T)
      } catch {
        resolve({ ok: false, reason: 'parse_error: ' + lastLine.slice(0, 200) } as FailureResult)
      }
    })
  })
}

export async function runHolehe(email: string, signal: AbortSignal): Promise<HoleheResult | FailureResult> {
  return spawnRunner<HoleheResult>(['holehe_runner.py', email, '--timeout', '6'], signal, 45_000)
}

export async function runSherlock(username: string, signal: AbortSignal): Promise<SherlockResult | FailureResult> {
  // Strip leading @ that users sometimes type.
  const cleaned = username.replace(/^@/, '').trim()
  return spawnRunner<SherlockResult>(['sherlock_runner.py', cleaned, '--timeout', '8'], signal, 90_000)
}

/**
 * Splits a phone string into (country dial code, national number).
 * Recognises +<dial><number>, +218 prefix, and bare digits with leading 0
 * (assumes Libyan +218 by default for the local Arabic-first audience).
 */
function splitPhone(raw: string): { country: string; phone: string } | null {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  // Explicit + prefix preserved through digit-strip; reconstruct.
  const hasPlus = raw.trim().startsWith('+')
  if (hasPlus) {
    // Try common dial-code lengths: 1, 2, 3.
    for (const len of [3, 2, 1]) {
      const country = digits.slice(0, len)
      const rest = digits.slice(len)
      if (rest.length >= 6 && rest.length <= 12) {
        return { country, phone: rest }
      }
    }
    return null
  }
  // Libyan numbers commonly start with 09... locally; map to +218 + drop leading 0.
  if (digits.startsWith('0')) {
    return { country: '218', phone: digits.replace(/^0+/, '') }
  }
  // Otherwise assume +218 prefix.
  return { country: '218', phone: digits }
}

export async function runIgnorant(phone: string, signal: AbortSignal): Promise<IgnorantResult | FailureResult> {
  const split = splitPhone(phone)
  if (!split) return { ok: false, reason: 'invalid_phone' }
  return spawnRunner<IgnorantResult>(
    ['ignorant_runner.py', split.country, split.phone, '--timeout', '6'],
    signal,
    45_000
  )
}

/**
 * Runs maigret — extracts rich profile data (bio, avatar, follower counts,
 * location, join date, …) from ~80 high-traffic sites. Slower than sherlock
 * but produces actionable content, not just existence flags.
 */
export async function runMaigret(
  username: string,
  signal: AbortSignal
): Promise<MaigretResult | FailureResult> {
  const cleaned = username.replace(/^@/, '').trim()
  if (!cleaned) return { ok: false, reason: 'invalid_username' }
  return spawnRunner<MaigretResult>(
    ['maigret_runner.py', cleaned, '--top-sites', '80', '--timeout', '5'],
    signal,
    180_000
  )
}

/**
 * scripts/bootstrap-owner.ts
 *
 * One-time helper: resolves a Telegram phone-number account (e.g. +218 091 008 9975)
 * to the numeric Telegram user id you must paste into OWNER_TELEGRAM_ID.
 *
 * Usage:
 *   1. Set TELEGRAM_BOT_TOKEN in the repo .env file (no other 002 vars needed).
 *   2. Open Telegram on the owner account and send "/start" to YOUR bot.
 *   3. Run:  pnpm tsx scripts/bootstrap-owner.ts
 *   4. Paste the printed numeric id into OWNER_TELEGRAM_ID and restart the server.
 *
 * The script polls getUpdates ONCE; if no recent message exists from the owner,
 * it prints a hint. It never writes to the database.
 */

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

function loadEnvFile() {
  const here = path.dirname(url.fileURLToPath(import.meta.url))
  const candidates = [
    path.resolve(here, '..', '.env'),
    path.resolve(process.cwd(), '.env'),
  ]
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2]
    }
    return p
  }
  return null
}

interface TgUpdate {
  update_id: number
  message?: {
    from?: { id: number; first_name?: string; last_name?: string; username?: string }
    chat?: { id: number; type: string }
    text?: string
  }
}

async function main() {
  const envPath = loadEnvFile()
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not set in the environment.')
    if (envPath) console.error(`(Loaded ${envPath}, but the variable is empty.)`)
    process.exit(1)
  }
  const url = `https://api.telegram.org/bot${token}/getUpdates?limit=10`
  const res = await fetch(url)
  if (!res.ok) {
    console.error(`getUpdates failed: HTTP ${res.status} ${res.statusText}`)
    process.exit(1)
  }
  const body = (await res.json()) as { ok: boolean; result?: TgUpdate[]; description?: string }
  if (!body.ok) {
    console.error(`getUpdates failed: ${body.description}`)
    process.exit(1)
  }
  const updates = body.result ?? []
  if (updates.length === 0) {
    console.log('No recent updates. Send "/start" to your bot from the owner account, then re-run this script.')
    process.exit(0)
  }
  // Take the most recent message that has a `from` field.
  const latest = [...updates].reverse().find((u) => u.message?.from)
  if (!latest || !latest.message?.from) {
    console.log('Updates found, but none had an attached user. Try sending "/start" again.')
    process.exit(0)
  }
  const from = latest.message.from
  const display = [from.first_name, from.last_name].filter(Boolean).join(' ').trim() || '(no name)'
  const handle = from.username ? '@' + from.username : '(no username)'
  console.log('')
  console.log('  Resolved Telegram user:')
  console.log(`    name:     ${display}`)
  console.log(`    username: ${handle}`)
  console.log(`    id:       ${from.id}`)
  console.log('')
  console.log('  → Paste this into your env as:')
  console.log(`        OWNER_TELEGRAM_ID=${from.id}`)
  console.log('')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

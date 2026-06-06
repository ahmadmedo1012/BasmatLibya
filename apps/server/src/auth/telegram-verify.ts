/**
 * Telegram Login Widget payload verifier (R-01).
 *
 * Recipe (Telegram-published):
 *   secret = sha256(BOT_TOKEN)                          // raw bytes
 *   data_check_string = sorted("k=v" except hash).join("\n")
 *   expected = hmac_sha256(secret, data_check_string).hex()
 *   ok = timingSafeEqual(expected, payload.hash) AND (now - auth_date) < 300
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import {
  TelegramAuthPayloadSchema,
  TELEGRAM_AUTH_MAX_AGE_SECONDS,
  type TelegramAuthPayload,
} from '@basmat/shared'
import { loadEnv } from '../env.js'

export type VerifyResult =
  | { ok: true; payload: TelegramAuthPayload }
  | { ok: false; code: 'hmac_invalid' | 'auth_date_too_old' | 'malformed' | 'bot_unavailable' }

function buildDataCheckString(payload: Record<string, unknown>): string {
  return Object.keys(payload)
    .filter((k) => k !== 'hash')
    .sort()
    .map((k) => `${k}=${payload[k]}`)
    .join('\n')
}

export function verifyTelegramPayload(rawPayload: unknown): VerifyResult {
  const env = loadEnv()
  if (!env.TELEGRAM_BOT_TOKEN) {
    return { ok: false, code: 'bot_unavailable' }
  }

  // We accept the raw object so we can recompute data_check_string against the
  // actual fields the client sent. We then validate the shape with zod.
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    return { ok: false, code: 'malformed' }
  }
  const obj = rawPayload as Record<string, unknown>
  const givenHash = obj.hash
  if (typeof givenHash !== 'string' || !/^[a-f0-9]{64}$/i.test(givenHash)) {
    return { ok: false, code: 'malformed' }
  }

  // Recompute HMAC over every field except `hash`.
  const dataCheckString = buildDataCheckString(obj)
  const secret = createHash('sha256').update(env.TELEGRAM_BOT_TOKEN).digest()
  const expectedHex = createHmac('sha256', secret).update(dataCheckString).digest('hex')

  const a = Buffer.from(expectedHex, 'hex')
  const b = Buffer.from(givenHash.toLowerCase(), 'hex')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, code: 'hmac_invalid' }
  }

  // Validate shape after HMAC so we never log fields from a tampered payload.
  // Normalize hash to lowercase before schema validation (the regex requires it).
  const normalized = { ...obj, hash: String(obj.hash).toLowerCase() }
  const parsed = TelegramAuthPayloadSchema.safeParse(normalized)
  if (!parsed.success) {
    return { ok: false, code: 'malformed' }
  }

  // Freshness window.
  const nowSec = Math.floor(Date.now() / 1000)
  if (nowSec - parsed.data.auth_date > TELEGRAM_AUTH_MAX_AGE_SECONDS) {
    return { ok: false, code: 'auth_date_too_old' }
  }

  return { ok: true, payload: parsed.data }
}

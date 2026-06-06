/**
 * AES-256-GCM at-rest encryption for AI model credentials (R-06).
 *
 * Key sourcing:
 *   - MODEL_SECRET_KEY: 32 raw bytes, base64-encoded. Required to encrypt or decrypt.
 *   - MODEL_SECRET_KEY_PREVIOUS: optional decrypt-only fallback used during key rotation.
 *
 * Storage shape: each row carries a JSON blob `{ iv, ciphertext, tag }`, all base64.
 * Plaintext is held in memory only for the duration of validate()/enrich() and
 * is never logged (G8). The display shape of the credential is `lastFour` only.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { loadEnv } from '../env.js'

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12
const KEY_BYTES = 32

export interface CipherBlob {
  v: 1
  iv: string
  ciphertext: string
  tag: string
}

function decodeKey(b64: string | undefined, label: string): Buffer | null {
  if (!b64) return null
  const buf = Buffer.from(b64, 'base64')
  if (buf.length !== KEY_BYTES) {
    throw new Error(`${label} must be exactly ${KEY_BYTES} bytes (base64-encoded)`)
  }
  return buf
}

function getKeys(): { primary: Buffer; previous: Buffer | null } {
  const env = loadEnv()
  const primary = decodeKey(env.MODEL_SECRET_KEY, 'MODEL_SECRET_KEY')
  if (!primary) {
    throw new Error('MODEL_SECRET_KEY is not set; cannot encrypt or decrypt model credentials')
  }
  const previous = decodeKey(env.MODEL_SECRET_KEY_PREVIOUS, 'MODEL_SECRET_KEY_PREVIOUS')
  return { primary, previous }
}

export function encrypt(plaintext: string): CipherBlob {
  const { primary } = getKeys()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, primary, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    v: 1,
    iv: iv.toString('base64'),
    ciphertext: enc.toString('base64'),
    tag: tag.toString('base64'),
  }
}

function decryptWith(key: Buffer, blob: CipherBlob): string {
  const decipher = createDecipheriv(ALGO, key, Buffer.from(blob.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(blob.tag, 'base64'))
  const dec = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, 'base64')),
    decipher.final(),
  ])
  return dec.toString('utf8')
}

export function decrypt(blob: CipherBlob): string {
  const { primary, previous } = getKeys()
  try {
    return decryptWith(primary, blob)
  } catch (errPrimary) {
    if (previous) {
      try {
        return decryptWith(previous, blob)
      } catch {
        throw new Error('Decryption failed under both primary and previous keys')
      }
    }
    throw errPrimary
  }
}

export function lastFour(plaintext: string): string {
  const trimmed = plaintext.trim()
  if (trimmed.length <= 4) return trimmed
  return trimmed.slice(-4)
}

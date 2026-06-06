import type { IdentifierType } from './schemas/identifier.js'

const PHONE_RE = /^[+\s()-]*[\d][\d\s()-]{6,18}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_RE = /^@?[A-Za-z0-9_.-]{2,30}$/

/**
 * Detect identifier type per research R-04.
 * Order: phone -> email -> username -> name (default).
 * The same function is imported by client and server so detection cannot drift.
 */
export function detectIdentifierType(raw: string): IdentifierType {
  const v = raw.trim()
  // strip-digit count for phone heuristic
  const digitCount = (v.match(/\d/g) ?? []).length
  if (PHONE_RE.test(v) && digitCount >= 7 && digitCount <= 15 && !/[A-Za-z@]/.test(v)) {
    return 'phone'
  }
  if (EMAIL_RE.test(v)) return 'email'
  if (USERNAME_RE.test(v) && !v.includes(' ')) return 'username'
  return 'name'
}

export function normaliseIdentifier(raw: string): string {
  return raw.trim().normalize('NFC').toLowerCase()
}

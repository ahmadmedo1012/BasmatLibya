/**
 * Audit log choke-point (R-08, G9).
 *
 * Every admin mutation MUST call append() inside the same DB transaction as
 * the mutation it audits. Direct INSERTs into audit_log_entries from anywhere
 * else are forbidden — that invariant is the only way SC-009 is structural.
 *
 * Sensitive field redaction is applied here so plaintext credentials never
 * reach a row.
 */

import {
  type AuditEventClass,
  type AuditEventSubclass,
} from '@basmat/shared'
import type { getDb } from '../db/client.js'
import { schema } from '../db/client.js'

const SENSITIVE_PATTERNS = [
  /credential/i,
  /secret/i,
  /token/i,
  /password/i,
  /api[_-]?key/i,
  /authorization/i,
  /^hash$/i,
  /ciphertext/i,
]

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_PATTERNS.some((re) => re.test(key))
}

export function redactSensitive<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) {
    return value.map((v) => redactSensitive(v)) as unknown as T
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSensitiveKey(k) ? { redacted: true } : redactSensitive(v)
    }
    return out as T
  }
  return value
}

export interface AppendEntry {
  actorUserId: string | null
  eventClass: AuditEventClass
  eventSubclass: AuditEventSubclass | string
  targetKind?: string | null
  targetId?: string | null
  beforeValue?: unknown
  afterValue?: unknown
  requestSignature?: string | null
}

/**
 * The Drizzle transaction (or top-level db) that has an .insert(table) method
 * matching the schema. Typed against the runtime shape of the DB client to
 * avoid leaking generics into route handlers.
 */
type DbOrTx = ReturnType<typeof getDb> | Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0]

export async function append(tx: DbOrTx, entry: AppendEntry): Promise<void> {
  await tx
    .insert(schema.auditLogEntries)
    .values({
      actorUserId: entry.actorUserId,
      eventClass: entry.eventClass,
      eventSubclass: entry.eventSubclass,
      targetKind: entry.targetKind ?? null,
      targetId: entry.targetId ?? null,
      beforeValue: entry.beforeValue === undefined ? null : redactSensitive(entry.beforeValue) as never,
      afterValue: entry.afterValue === undefined ? null : redactSensitive(entry.afterValue) as never,
      requestSignature: entry.requestSignature ?? null,
    })
}

export const auditLog = { append, redactSensitive }

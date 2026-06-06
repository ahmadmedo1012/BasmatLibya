import { eq, and } from 'drizzle-orm'
import { getDb, schema } from '../db/client.js'
import type { Finding, CategoryKey } from '@basmat/shared'

export async function insertFinding(
  lookupId: string,
  finding: Omit<Finding, 'id'>,
  orderingWeight: number
): Promise<Finding> {
  const db = getDb()
  const inserted = await db
    .insert(schema.findings)
    .values({
      lookupId,
      categoryKey: finding.categoryKey,
      title: finding.title,
      snippet: finding.snippet ?? null,
      sourceUrl: finding.sourceUrl ?? null,
      sourceName: finding.sourceName,
      language: finding.language ?? null,
      confidence: finding.confidence,
      orderingWeight,
      metadata: finding.metadata ?? null,
    })
    .returning({ id: schema.findings.id })
  const id = inserted[0]?.id
  if (!id) throw new Error('insert finding failed')
  return { ...finding, id }
}

export async function findingsByCategory(
  lookupId: string,
  categoryKey: CategoryKey
): Promise<number> {
  const db = getDb()
  const rows = await db
    .select({ id: schema.findings.id })
    .from(schema.findings)
    .where(
      and(eq(schema.findings.lookupId, lookupId), eq(schema.findings.categoryKey, categoryKey))
    )
  return rows.length
}

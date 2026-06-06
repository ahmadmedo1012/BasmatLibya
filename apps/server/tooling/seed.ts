import { getDb, schema } from '../src/db/client.js'
import { i18nAr } from '@basmat/shared'

const CATEGORY_ROWS: Array<{
  key: keyof typeof i18nAr.ar.categories
  weight: number
}> = [
  { key: 'social_presence', weight: 10 },
  { key: 'public_mentions', weight: 20 },
  { key: 'contact_signals', weight: 30 },
  { key: 'reputation_indicators', weight: 40 },
  { key: 'profile_imagery', weight: 50 },
]

async function main() {
  const db = getDb()
  for (const c of CATEGORY_ROWS) {
    await db
      .insert(schema.sourceCategories)
      .values({
        key: c.key,
        displayLabelAr: i18nAr.ar.categories[c.key],
        orderingWeight: c.weight,
        isEnabled: true,
      })
      .onConflictDoUpdate({
        target: schema.sourceCategories.key,
        set: {
          displayLabelAr: i18nAr.ar.categories[c.key],
          orderingWeight: c.weight,
        },
      })
  }
  console.log(`seeded ${CATEGORY_ROWS.length} source_categories rows`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

import { sql } from 'drizzle-orm'
import { getDb } from '../src/db/client.js'
import { logger } from '../src/observability/logger.js'

async function main() {
  const db = getDb()
  // 7-day grace after expires_at — see research R-08.
  const result = await db.execute(sql`
    DELETE FROM lookups
    WHERE expires_at < now() - interval '7 days'
  `)
  logger.info({ purged: result.rowCount ?? 0 }, 'retention sweep complete')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

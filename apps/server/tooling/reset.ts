import { sql } from 'drizzle-orm'
import { getDb } from '../src/db/client.js'

async function main() {
  const db = getDb()
  await db.execute(sql`
    DROP TABLE IF EXISTS rate_limit_counters CASCADE;
    DROP TABLE IF EXISTS aggregated_results CASCADE;
    DROP TABLE IF EXISTS findings CASCADE;
    DROP TABLE IF EXISTS lookup_categories CASCADE;
    DROP TABLE IF EXISTS lookups CASCADE;
    DROP TABLE IF EXISTS source_categories CASCADE;
    DROP TABLE IF EXISTS __drizzle_migrations CASCADE;
  `)
  console.log('all tables dropped — re-run pnpm db:migrate && pnpm db:seed')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

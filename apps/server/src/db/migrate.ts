import { migrate as migrateNeon } from 'drizzle-orm/neon-serverless/migrator'
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { neonConfig, Pool as NeonPool } from '@neondatabase/serverless'
import pg from 'pg'
import path from 'node:path'
import url from 'node:url'
import { loadEnv } from '../env.js'

async function main() {
  const env = loadEnv()
  const here = path.dirname(url.fileURLToPath(import.meta.url))
  const folder = path.resolve(here, './migrations')

  if (/\.neon\.(tech|build)/i.test(env.DATABASE_URL)) {
    neonConfig.fetchConnectionCache = true
    const pool = new NeonPool({ connectionString: env.DATABASE_URL })
    const db = drizzleNeon(pool)
    await migrateNeon(db, { migrationsFolder: folder })
    await pool.end()
  } else {
    const pool = new pg.Pool({ connectionString: env.DATABASE_URL })
    const db = drizzlePg(pool)
    await migratePg(db, { migrationsFolder: folder })
    await pool.end()
  }
  console.log('migrations applied')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

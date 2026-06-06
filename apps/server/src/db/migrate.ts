import { migrate as migrateNeon } from 'drizzle-orm/neon-serverless/migrator'
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { neonConfig, Pool as NeonPool } from '@neondatabase/serverless'
import pg from 'pg'
import path from 'node:path'
import url from 'node:url'
import { loadEnv } from '../env.js'

/**
 * Apply pending migrations from `apps/server/dist/db/migrations/`.
 *
 * Idempotent — drizzle's migrator tracks applied migrations in the
 * `__drizzle_migrations` table, so calling this on every server start
 * is safe. Used by both the CLI (`pnpm db:migrate` / `node dist/db/migrate.js`)
 * AND by `startServer()` in `index.ts` so the boot order is:
 *
 *   1. loadEnv()
 *   2. runMigrations()   ← newly added in 005 T046b / fix #2
 *   3. assertSchemaVersion()
 *   4. server.listen()
 *
 * This removes the dependency on Render's preDeployCommand for the
 * migration step. The preDeployCommand in `render.yaml` is kept as a
 * declarative safety net — its second invocation is a no-op.
 */
export async function runMigrations(): Promise<void> {
  const env = loadEnv()
  const here = path.dirname(url.fileURLToPath(import.meta.url))
  const folder = path.resolve(here, './migrations')

  if (/\.neon\.(tech|build)/i.test(env.DATABASE_URL)) {
    neonConfig.fetchConnectionCache = true
    const pool = new NeonPool({ connectionString: env.DATABASE_URL })
    try {
      const db = drizzleNeon(pool)
      await migrateNeon(db, { migrationsFolder: folder })
    } finally {
      await pool.end()
    }
  } else {
    const pool = new pg.Pool({ connectionString: env.DATABASE_URL })
    try {
      const db = drizzlePg(pool)
      await migratePg(db, { migrationsFolder: folder })
    } finally {
      await pool.end()
    }
  }
}

async function main() {
  await runMigrations()
  console.log('migrations applied')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

/**
 * Rolls back feature 002 — drops the six new tables and the new column on
 * lookups, leaving feature 001's schema byte-for-byte intact (G10 verification).
 *
 * Use only in dev/CI; production roll-back is a deliberate ops action.
 *
 *   pnpm db:rollback
 */

import pg from 'pg'
import { neonConfig, Pool as NeonPool } from '@neondatabase/serverless'
import { loadEnv } from '../src/env.js'

async function main() {
  const env = loadEnv()
  const isNeon = /\.neon\.(tech|build)/i.test(env.DATABASE_URL)

  const sql = `
    BEGIN;
    DROP TABLE IF EXISTS user_lookup_associations CASCADE;
    DROP TABLE IF EXISTS audit_log_entries CASCADE;
    DROP TABLE IF EXISTS site_settings CASCADE;
    DROP TABLE IF EXISTS ai_model_entries CASCADE;
    DROP TABLE IF EXISTS sessions CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    ALTER TABLE lookups DROP COLUMN IF EXISTS owner_user_id;
    -- Mark the migration row removed so a fresh db:migrate re-applies 0002.
    DELETE FROM "drizzle"."__drizzle_migrations" WHERE hash LIKE '%tense_manta%' OR hash LIKE '%0002%';
    COMMIT;
  `

  if (isNeon) {
    neonConfig.fetchConnectionCache = true
    const pool = new NeonPool({ connectionString: env.DATABASE_URL })
    await pool.query(sql)
    await pool.end()
  } else {
    const pool = new pg.Pool({ connectionString: env.DATABASE_URL })
    await pool.query(sql)
    await pool.end()
  }
  console.log('feature 002 rolled back: six tables dropped, lookups.owner_user_id removed')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

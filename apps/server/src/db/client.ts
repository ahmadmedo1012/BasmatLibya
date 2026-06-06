import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { neonConfig, Pool as NeonPool } from '@neondatabase/serverless'
import pg from 'pg'
import { loadEnv } from '../env.js'
import * as schema from './schema.js'

const env = loadEnv()

function isNeonUrl(url: string): boolean {
  return /\.neon\.tech/i.test(url) || /\.neon\.build/i.test(url)
}

let _db: ReturnType<typeof drizzlePg> | ReturnType<typeof drizzleNeon> | null = null

export function getDb() {
  if (_db) return _db
  if (isNeonUrl(env.DATABASE_URL)) {
    neonConfig.fetchConnectionCache = true
    const pool = new NeonPool({ connectionString: env.DATABASE_URL })
    _db = drizzleNeon(pool, { schema })
  } else {
    const pool = new pg.Pool({ connectionString: env.DATABASE_URL })
    _db = drizzlePg(pool, { schema })
  }
  return _db
}

export type Db = ReturnType<typeof getDb>
export { schema }

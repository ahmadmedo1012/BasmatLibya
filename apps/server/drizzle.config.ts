import { defineConfig } from 'drizzle-kit'
import fs from 'node:fs'
import path from 'node:path'

// Lightweight .env loader (avoids a dotenv dependency for one config file).
function loadDotEnv() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
  ]
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2]
    }
    break
  }
}
loadDotEnv()

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://basmat:basmat@localhost:5432/basmat',
  },
})

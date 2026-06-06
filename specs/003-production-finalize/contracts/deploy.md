# Deployment Contract: Production Finalize & Cleanup

## Build Contract

A single Docker image is produced by the multi-stage `Dockerfile`. The image serves both
the frontend SPA and the backend API from one Express process.

### Build Steps
1. `pnpm install --frozen-lockfile` (all dependencies)
2. `pnpm --filter @basmat/shared build` (zod schemas + types)
3. `pnpm --filter @basmat/server build` (Express + Socket.IO)
4. `pnpm --filter @basmat/web build` (Vite SPA, `sourcemap: false`)

### Runtime Contract
- **Entry point**: `node apps/server/dist/index.js`
- **Port**: `PORT` env var (default `3001`)
- **Health check**: `GET /api/healthz` → HTTP 200 `{ status: "ok", db: "ok" }`
- **Static files**: SPA served from `apps/web/dist/`
- **Production mode**: `NODE_ENV=production` (enables Helmet CSP, disables debug output)

## Required Environment Variables

These MUST be set in the Render dashboard (all `sync: false` in `render.yaml`):

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `PUBLIC_BASE_URL` | Yes | Public URL of the Render service |
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram bot token for admin auth |
| `MODEL_SECRET_KEY` | Yes | Encryption key for AI credentials at rest |
| `NVIDIA_API_KEY` | Recommended | NVIDIA NIM API key for AI enrichment |
| `NUMVERIFY_API_KEY` | Optional | Phone lookup API |
| `SERPAPI_KEY` | Optional | Web search API |
| `COOKIE_DOMAIN` | Recommended | Cookie domain scope (e.g., `.onrender.com`) |
| `OWNER_TELEGRAM_ID` | Recommended | Numeric Telegram user ID for admin access |
| `MODEL_SECRET_KEY_PREVIOUS` | Optional | Previous encryption key during rotation |

Variables with defaults in `env.ts` are pre-configured in `render.yaml`:
`NODE_ENV`, `PORT`, `SOURCE_PROVIDERS`, `RATE_LIMIT_WINDOW_MINUTES`,
`RATE_LIMIT_MAX_PER_WINDOW`, `RETENTION_DAYS`, `ENRICHMENT_ENABLED`.

## Deployment Gate

- [ ] All required env vars configured in Render dashboard
- [ ] `pnpm build` completes with zero errors
- [ ] `pnpm test` passes (unit + integration)
- [ ] Docker build succeeds (`docker build -t basmatlibya .`)
- [ ] Health check responds 200 after container starts
- [ ] SPA loads at public URL without CORS/404 errors
- [ ] End-to-end lookup flow works (submit → progress → result)
- [ ] No credentials present in committed files or build output
- [ ] Source maps disabled in production build
- [ ] Graceful shutdown verified (SIGTERM → drains connections)

## Graceful Shutdown Contract

On `SIGTERM` (Render deploy/restart signal):
1. HTTP server stops accepting new connections
2. Active requests drain (up to 10s graceful timeout)
3. Socket.IO connections close with a "server restarting" message
4. Database pool drains
5. Process exits with code 0

## Retention Schedule

- **Scheduled purge**: Run `pnpm --filter @basmat/server retention:run` via Render Cron Jobs
  or equivalent scheduler (weekly recommended)
- **Window**: Controlled by `RETENTION_DAYS` env var (default 30)

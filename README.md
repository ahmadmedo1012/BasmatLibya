# بصمة ليبيا · BasmatLibya

Arabic-first, full-RTL web platform that analyzes a person's public digital identity footprint and returns a unified, polished result.

## Quick start (development)

```bash
pnpm install
docker compose up -d db
cp .env.example .env
pnpm --filter @basmat/server db:migrate
pnpm --filter @basmat/server db:seed
pnpm dev
```

Open http://localhost:5173.

## Stack

- **Frontend:** React 19, Vite 6, Tailwind 3 (RTL plugin), wouter, TanStack Query 5, Socket.IO client, framer-motion.
- **Backend:** Express 5, Socket.IO 4, Drizzle ORM, zod, pino, helmet, express-rate-limit.
- **Database:** PostgreSQL 16 (Neon serverless in production, Docker for local).
- **Deploy:** Single Docker image on Render — see [`render.yaml`](./render.yaml) and [deployment docs](specs/003-production-finalize/contracts/deploy.md).

## Required environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `PUBLIC_BASE_URL` | Yes | Public URL of the service |
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram bot token (from @BotFather) |
| `MODEL_SECRET_KEY` | Yes | Base64-encoded 32-byte encryption key for AI credentials |
| `NVIDIA_API_KEY` | Recommended | NVIDIA NIM API key for AI enrichment |
| `NUMVERIFY_API_KEY` | Optional | Phone lookup API key (apilayer) |
| `SERPAPI_KEY` | Optional | Web search API key (serpapi) |
| `COOKIE_DOMAIN` | Recommended | Cookie domain scope (e.g. `.onrender.com`) |
| `OWNER_TELEGRAM_ID` | Recommended | Numeric Telegram user ID for admin access |
| `MODEL_SECRET_KEY_PREVIOUS` | Optional | Previous encryption key during rotation |

See [`.env.example`](./.env.example) for all variables and their defaults.

## Production deployment

1. Fork/clone the repo to your GitHub account.
2. Create a new **Web Service** on [Render](https://render.com) using the **Docker** runtime.
3. Set the required environment variables listed above in the Render dashboard.
4. Deploy — the service builds and starts automatically.

```bash
# Or build locally to verify:
docker build -t basmatlibya .
```

See the [deployment contract](specs/003-production-finalize/contracts/deploy.md) for the full checklist.

## Project layout

```
apps/
  web/        # React SPA
  server/     # Express API + Socket.IO
packages/
  shared/     # Zod schemas, types, Arabic copy
specs/
  001-digital-footprint-analyzer/   # Original spec
  002-admin-panel-telegram-auth/    # Admin + auth feature
  003-production-finalize/          # Production finalization
```

## Why the structure

Three pnpm-workspace packages with `packages/shared` carrying every wire contract as zod schemas — so the client and the server can never drift on REST shapes or Socket.IO events.

## Status

Production-ready MVP with admin panel, Telegram auth, and AI enrichment. See [`specs/003-production-finalize/plan.md`](specs/003-production-finalize/plan.md) for the current feature plan.

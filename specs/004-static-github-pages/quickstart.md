# Quickstart: Static GitHub Pages Deployment

**Goal**: Get the static BasmatLibya SPA running locally in under 2 minutes.

## Prerequisites

- Node.js 22 LTS
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- No database, Docker, or server required

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Build shared package
pnpm --filter @basmat/shared build

# 3. Start dev server
pnpm --filter @basmat/web dev
```

Open http://localhost:5173.

**That's it.** No `.env` file, no Docker containers, no database migrations.

## Production Build

```bash
# Build for GitHub Pages
pnpm --filter @basmat/shared build && pnpm --filter @basmat/web build

# Preview the production build locally
npx serve apps/web/dist
```

The build output in `apps/web/dist/` is fully static and deployable to any static host.

Deploy to GitHub Pages by pushing to `main` — the GitHub Actions workflow handles the rest.

## What Changed

| Before | After |
|--------|-------|
| Express 5 API server | No server |
| PostgreSQL via Neon/Docker | No database |
| Socket.IO real-time progress | Client-side simulated progress |
| Live OSINT + AI enrichment | Static sample data |
| Telegram auth / admin panel | Removed (stub only) |
| Docker multi-stage image | Static file hosting |
| `pnpm dev` starts 2 processes | `pnpm dev` starts 1 process (Vite) |

## What's the Same

- React 19 + Vite 6 + Tailwind RTL
- Dark theme, glass surfaces, RTL Arabic layout
- Full search flow (home → progress → result)
- Sample findings across all 5 categories
- Enrichment AI summary display
- Share link copying
- All error/expired state pages

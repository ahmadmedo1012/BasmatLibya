# بصمة ليبيا · BasmatLibya

Arabic-first, full-RTL web platform that analyzes a person's public digital identity footprint and returns a unified, polished result.

## Quick start

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173.

## Stack

- **Frontend:** React 19, Vite 6, Tailwind 3 (RTL plugin), wouter, framer-motion.
- **Deploy:** Static site on **GitHub Pages** via GitHub Actions.

## Build

```bash
pnpm build
```

Output is in `apps/web/dist/`. Open `dist/index.html` directly to preview (hash-based routing).

## Production deployment

The site deploys automatically to GitHub Pages on every push to `main` via `.github/workflows/deploy.yml`. No server, no database, no Docker required.

## Project layout

```
apps/
  web/        # React SPA (static)
packages/
  shared/     # Zod schemas, types, Arabic copy
specs/
  004-static-github-pages/   # Static migration spec
```

## Design principles

**Arabic-first & RTL by default** — every page ships `dir="rtl"`, `lang="ar"`, and the Tailwind RTL plugin is enabled globally. All UI copy is authored in Arabic.

**Mock data flow** — the app runs entirely client-side with realistic sample data; no API calls or socket connections. See `apps/web/src/data/` for the mock lookup service.

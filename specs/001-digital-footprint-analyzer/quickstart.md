# Quickstart — Digital Footprint Analyzer (BasmatLibya)

**Plan**: [plan.md](./plan.md) · **Spec**: [spec.md](./spec.md) · **Date**: 2026-06-03

Goal: a fresh contributor reaches a working local stack with the home page loading and a sample lookup completing in under 15 minutes (SC-006).

---

## 0. Prerequisites

| Tool          | Version          | Why                                       |
|---------------|------------------|-------------------------------------------|
| Node.js       | 22 LTS           | Server + tooling.                         |
| pnpm          | 9.x              | Workspace manager.                        |
| Docker        | 24+ with Compose | Local Postgres without polluting host.    |
| Git           | any recent       |                                           |

Optional: a Neon project + `DATABASE_URL` if you want to develop against Neon directly. The default flow uses local Postgres and does not require a Neon account.

---

## 1. One-time setup

```bash
# 1. Clone
git clone <repo-url> basmatlibya && cd basmatlibya

# 2. Install all workspaces
pnpm install --frozen-lockfile

# 3. Copy env contract
cp .env.example .env
#    .env defaults to:
#    DATABASE_URL=postgres://basmat:basmat@localhost:5432/basmat
#    SOURCE_PROVIDERS=mock
#    PUBLIC_BASE_URL=http://localhost:5173

# 4. Bring up Postgres (and adminer at :8080 if you want a GUI)
docker compose up -d db

# 5. Apply migrations + seed source_categories + seed mock data
pnpm --filter @basmat/server db:migrate
pnpm --filter @basmat/server db:seed
```

---

## 2. Run the stack

```bash
pnpm dev
```

This single command starts, in parallel:
- `apps/server` on `http://localhost:3001` (Express + Socket.IO).
- `apps/web` on `http://localhost:5173` (Vite, proxies `/api` and `/socket.io` to `:3001`).

Open `http://localhost:5173`. The home page should render in Arabic with `dir="rtl"` on `<html>` and a single primary input.

---

## 3. Smoke-test a lookup end-to-end

1. Type `أحمد محمد` (or any name/email/phone) and press the primary action.
2. The progress page appears immediately and ticks each of the five categories from `قيد التشغيل` → `مكتمل` (mock providers complete in ~2–4 s each).
3. The result page renders with grouped categories, per-finding confidence pills, and an empty `EnrichmentSlot` (reserved for AI; v1 renders nothing).
4. Click **نسخ الرابط** to copy the share URL. Open it in a private window — same result.

If any step doesn't work, jump to **Troubleshooting** below.

---

## 4. Run the test suites

| Command                                | Scope                                                                |
|----------------------------------------|----------------------------------------------------------------------|
| `pnpm test`                            | Vitest unit + integration across all packages.                       |
| `pnpm --filter @basmat/server test:integration` | Supertest + Testcontainers Postgres on the server.          |
| `pnpm --filter @basmat/web test:e2e`   | Playwright E2E against `pnpm dev` (RTL invariants, golden lookup).   |
| `pnpm typecheck`                       | TypeScript across the workspace.                                     |
| `pnpm lint`                            | ESLint flat config.                                                  |

---

## 5. Useful workspace scripts

```bash
# Reset local DB (drops volume, re-applies migrations and seed)
pnpm --filter @basmat/server db:reset

# Generate a new migration after editing src/db/schema.ts
pnpm --filter @basmat/server db:generate

# Build production artefacts (used by the Dockerfile)
pnpm build

# Build + run the production container locally
docker build -t basmat:dev .
docker run --rm -p 3001:3001 \
  -e DATABASE_URL=postgres://basmat:basmat@host.docker.internal:5432/basmat \
  -e SOURCE_PROVIDERS=mock \
  -e PUBLIC_BASE_URL=http://localhost:3001 \
  basmat:dev
# → app served on http://localhost:3001 (SPA + API + Socket.IO from one process)
```

---

## 6. Switching from mock to live source providers

By default `SOURCE_PROVIDERS=mock`, which loads deterministic mock providers under `apps/server/src/analysis/providers/mock/`. To exercise real providers:

```bash
# .env
SOURCE_PROVIDERS=live
# plus any provider-specific env vars (added when each live provider lands)
```

The `pipeline.ts` orchestrator and the persistence layer do not change. This is the additive-source guarantee from research R-05.

---

## 7. Adding AI enrichment later (architectural guarantee)

When AI enrichment lands, only these touchpoints change:
- `apps/server/src/analysis/enrichment/` gains a real `EnrichmentProvider` implementation.
- `pipeline.ts` invokes it after the last source provider settles and writes the result into `aggregated_results.enrichment_payload` / `enrichment_status`.
- `apps/web/src/components/result/EnrichmentSlot.tsx` switches from a no-op render to displaying the payload.

No schema migration. No change to REST contracts, Socket.IO events, intake validation, or the lookups state machine. This is the FR-014 / SC-007 promise — verify it on the day enrichment ships by diffing the four files above against everything else.

---

## 8. Deploy to Render (production)

1. Push to the main branch.
2. Render reads `render.yaml`, builds the Docker image, runs the pre-deploy migration command, and rolls out.
3. Required env vars on the service:
   - `DATABASE_URL` — Neon connection string.
   - `SOURCE_PROVIDERS` — `live`.
   - `PUBLIC_BASE_URL` — public URL of the service.
   - `NODE_ENV=production`.
4. Health check: Render polls `/api/healthz`. A `200` requires DB reachability.

---

## 9. Troubleshooting

| Symptom                                         | Likely cause / fix                                                                 |
|-------------------------------------------------|------------------------------------------------------------------------------------|
| `pnpm dev` errors with `EADDRINUSE :3001`       | Another process bound the port. `lsof -i :3001` then kill, or change `PORT`.       |
| Home page renders LTR                           | `apps/web/index.html` lost `dir="rtl" lang="ar"`. Restore — Playwright will catch this in CI. |
| Progress page shows nothing after submit        | Socket.IO blocked by a strict CSP/proxy. Confirm Vite proxy is forwarding `/socket.io`. |
| `db:migrate` fails with `ECONNREFUSED`          | Docker Postgres not running. `docker compose up -d db` then retry.                 |
| Result page empty for every lookup              | `SOURCE_PROVIDERS` unset → no providers register. Set to `mock` for local dev.     |
| Arabic text renders in a Latin fallback font    | The Arabic font face didn't load. Check `apps/web/src/styles/fonts.css` paths and that the font files are in `public/fonts/`. |
| Playwright RTL suite fails on a new component   | The component uses physical (`left`/`right`) Tailwind utilities. Switch to logical (`start`/`end`) — see research R-01. |

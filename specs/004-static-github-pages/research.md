# Research: Static GitHub Pages Deployment

**Branch**: `004-static-github-pages` | **Date**: 2026-06-06

## Decisions

### Vite base path for GitHub Pages

**Decision**: Use `base: '/BasmatLibya/'` in `vite.config.ts` (matches the GitHub repo name exactly, case-sensitive, with leading and trailing slash). For a custom domain, `base: '/'` can be substituted.

**Rationale**: Vite uses `base` to prefix all asset URLs in the build output. The base must exactly match the GitHub Pages sub-path (`https://<user>.github.io/<repo>/`). Without correct `base`, JS/CSS/font assets will return 404.

**Alternatives considered**: Dynamic base detection via `window.location.pathname` (fragile, breaks SSR assumptions).

### wouter routing strategy

**Decision**: Use `useHashLocation` from `wouter/use-hash-location` for all routing. URLs become `https://<user>.github.io/BasmatLibya/#/lookups/abc`.

**Rationale**: Hash-based routing requires zero server configuration for SPA navigation. Direct deep-links work without a 404.html redirect. The existing codebase already uses `wouter` — only the hook needs to change.

**Alternatives considered**: Browser history + `404.html` fallback (requires copying index.html → 404.html in build step; more fragile).

### GitHub Pages deployment workflow

**Decision**: Use the official `actions/deploy-pages@v4` workflow with `actions/upload-pages-artifact@v3`. Configure via GitHub Actions, not the "Deploy from a branch" UI setting.

**Rationale**: Officially maintained by GitHub, artifact-based (no force-push to gh-pages branch), supports `id-token: write` for OIDC, and allows setting the deployment URL via `environment.url`.

**Alternatives considered**: `peaceiris/actions-gh-pages` (3rd party, deprecated, Node 20 EOL).

### .nojekyll file

**Decision**: Add an empty `.nojekyll` file to `apps/web/public/` so it gets copied into `dist/`. GitHub Pages silently ignores files/folders starting with `_` (e.g., `_assets`) unless `.nojekyll` is present.

**Rationale**: Prevent silent asset-dropping. Vite does not generate `_`-prefixed paths, but as a safety measure this is standard practice.

### Mock data strategy

**Decision**: Create static sample data in `apps/web/src/data/`:
- `sample-findings.ts` — pre-built findings for all 5 categories using the existing mock provider content as templates
- `sample-enrichment.ts` — a static `EnrichmentPayload` object matching the Zod schema
- `mock-lookup.ts` — a `MockLookupService` that generates deterministic results based on identifier hash, with simulated timing delays

**Rationale**: The existing server-side mock providers in `apps/server/src/analysis/providers/mock/` contain realistic Arabic sample data. This data can be extracted and adapted for client-side use. The `Finding`, `EnrichmentPayload`, and `LookupSnapshot` shapes are all defined in `packages/shared` and reusable without modification.

**Alternatives considered**: Inline data in route components (duplication risk), JSON files (no type safety).

### Socket.IO replacement

**Decision**: Remove `socket.io-client` dependency entirely. Replace Socket.IO event-driven progress with a `setTimeout`-based simulation in a `MockLookupService`. The service emits callbacks matching the same event shapes (`category.started`, `category.finding`, `category.completed`, `lookup.completed`).

**Rationale**: The `ProgressPage` component listens for Socket.IO events to animate category progress. By providing a compatible callback interface, the component needs minimal changes (just swap the event source from socket to local mock service).

## Server file removal inventory

### DELETE — Entire `apps/server/` directory

All 60+ files including:
- `src/index.ts` (Express entry point)
- `src/env.ts`, `src/http/`, `src/db/`, `src/auth/`, `src/analysis/`, `src/services/`, `src/realtime/`, `src/admin/`, `src/observability/`
- `tests/`, `tooling/`, `drizzle.config.ts`, `tsconfig.json`, `package.json`

### DELETE — Root deployment configs

- `Dockerfile`, `docker-compose.yml`, `render.yaml`, `.dockerignore`

### REWRITE — `apps/web/` files with server dependencies

| File | What to change |
|------|----------------|
| `apps/web/src/lib/api.ts` | Replace all HTTP calls with local mock call wrappers |
| `apps/web/src/lib/socket.ts` | Replace with no-op module exporting a stub `getSocket()` |
| `apps/web/src/lib/auth.ts` | Replace with stub `usePrincipal()` returning `null` |
| `apps/web/src/lib/admin-api.ts` | Delete entirely (no admin in static mode) |
| `apps/web/src/lib/queries.ts` | Replace React Query hooks with local mock equivalents |
| `apps/web/vite.config.ts` | Remove `proxy` section |
| `apps/web/src/App.tsx` | Remove auth imports, simplify routes |
| `apps/web/src/routes/HomePage.tsx` | Replace `useCreateLookup` with local mock |
| `apps/web/src/routes/ProgressPage.tsx` | Replace socket events with `MockLookupService` callbacks |
| `apps/web/src/routes/ResultPage.tsx` | Replace `useLookup` with local mock data fetch |
| `apps/web/src/routes/HistoryPage.tsx` | Replace with empty state or localStorage |
| `apps/web/src/routes/SignInPage.tsx` | Stub Telegram widget (no server to verify) |
| `apps/web/src/routes/PlansPage.tsx` | Stub `usePrincipal` to null |
| `apps/web/src/routes/admin/*` | Delete all admin route components |

### KEEP — unchanged

- All files in `packages/shared/` (types, schemas, i18n, design tokens)
- All pure UI components (`Button`, `Input`, `Card`, `Toast`, `Icon`, `BidiIsolate`, etc.)
- All result display components (`FindingCard`, `CategorySection`, `EnrichmentSlot`, `ShareLinkButton`)
- All error/state pages (`NotFoundPage`, `ExpiredState`, `EmptyState`, etc.)
- Root configs (`tsconfig.base.json`, `.editorconfig`, `.prettierrc*`, `eslint.config.js`)
- `apps/web/src/styles/` (globals.css, fonts.css)
- `apps/web/src/design/motion.ts`
- `apps/web/src/lib/cn.ts`, `apps/web/src/lib/icon.tsx`, `apps/web/src/lib/rtl.tsx`

### Dependency changes in `apps/web/package.json`

- REMOVE: `socket.io-client` (server transport)
- REMOVE: `@tanstack/react-query` (no API to query; can keep as utility for local state)
- KEEP: `@basmat/shared`, `react`, `react-dom`, `framer-motion`, `wouter`, `zod`, `clsx`, `tailwind-merge`, `@radix-ui/*`

### Root `package.json` script changes

- `dev`: `pnpm --parallel --filter @basmat/server --filter @basmat/web dev` → `pnpm --filter @basmat/web dev`
- `build`: Remove `@basmat/server` builds
- `start`, `db:*`: Remove all server scripts

### `pnpm-workspace.yaml` changes

- Remove `apps/server` from the workspace array

## GitHub Actions workflow

Use `actions/deploy-pages@v4` with the following structure:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/web
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
          cache-dependency-path: pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: apps/web/dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

## No-Go Areas (Out of Scope)

- Admin panel (entirely server-dependent)
- User authentication / Telegram login (requires server-side verification)
- Live OSINT analysis (requires Node.js runtime + network access)
- Real AI enrichment (requires NVIDIA NIM API calls)
- Database persistence (all data is client-side mock)
- Rate limiting, trial gates, session management (all server-side)

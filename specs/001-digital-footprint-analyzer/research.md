# Phase 0 Research — Digital Footprint Analyzer (BasmatLibya)

**Plan**: [plan.md](./plan.md) · **Spec**: [spec.md](./spec.md) · **Date**: 2026-06-03

This document resolves the open technical questions implied by the spec and locks in decisions before Phase 1 design. Each entry is **Decision / Rationale / Alternatives considered**.

---

## R-01 — Arabic-first RTL strategy

**Decision**: Ship the SPA as RTL-only in v1. `index.html` declares `<html dir="rtl" lang="ar">`, Tailwind is configured with `tailwindcss-rtl` (logical-property utilities are preferred over `left/right`). All component primitives use logical properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`). Icons are rendered through a wrapper that consults a small allow/deny list (e.g. directional arrows mirror; brand glyphs do not). Self-hosted Arabic display family (IBM Plex Sans Arabic) and Latin family (Inter) are loaded via `font-display: swap` with explicit `unicode-range` so source-native Latin content inside Arabic UI never flashes the wrong face.

**Rationale**: Spec FR-008/FR-009 and SC-003 require correct RTL on every surface, including bidi-mixed content. Logical properties are the only way to make a single source of truth for spacing/positioning that survives a future LTR variant being added without a rewrite. Self-hosting fonts removes a third-party dependency on the 3G/4G LCP budget (SC-002).

**Alternatives considered**:
- Bidirectional from day one with a runtime locale switcher — rejected: inflates v1 scope, doubles QA matrix, and there is no v1 demand for English UI.
- Physical Tailwind utilities + manual `[dir="rtl"]` overrides — rejected: brittle, easy to miss a surface, and SC-003 demands 100% coverage.
- Google Fonts CDN — rejected: extra DNS/TLS hop on the critical path; spec emphasises premium feel and SC-002 is tight on 3G.

---

## R-02 — Real-time progress channel (Socket.IO vs SSE vs polling)

**Decision**: Socket.IO v4. The server creates one room per lookup id; the client subscribes after `POST /api/lookups` returns a lookup id. The server pushes `category.started`, `category.completed`, `category.failed`, `lookup.completed`, `lookup.failed`, `lookup.cancelled`. Reconnection is handled by Socket.IO's built-in backoff; on reconnect, the client re-emits `lookup.subscribe` and the server replays current state from the database (not from in-memory).

**Rationale**: FR-004 explicitly bans client polling. Socket.IO is mandated by the project owner's stack. Rooms keyed on lookup id give us natural fan-out for multi-tab/share-link viewers and keep the server stateless across instances (any instance can serve any room because state lives in Postgres).

**Alternatives considered**:
- Plain SSE — rejected: bidirectional cancel signal would still need a separate POST; loses Socket.IO's room/ack ergonomics; not in the fixed stack.
- Polling — rejected by spec.
- WebSocket without Socket.IO — rejected: no value over Socket.IO at this scale, and we lose reconnection/replay primitives.

---

## R-03 — DB driver: Neon serverless vs node-postgres, behind Drizzle

**Decision**: Single Drizzle client whose underlying driver is selected by `DATABASE_URL` scheme/env: `@neondatabase/serverless` when `DATABASE_URL` points at Neon (production / preview), `pg` (`Pool`) when it points at local Docker Postgres. Migrations are run by `drizzle-kit` against the same connection string. All application code talks to Drizzle, never to the raw driver.

**Rationale**: Neon's serverless driver is the right shape for Render's stateless containers (HTTP/WebSocket-based, no idle TCP connections to manage). Locally, `pg` against Docker Postgres avoids forcing developers onto Neon to run the app, which is required by FR-015 and SC-006. Drizzle is the abstraction the project owner picked; using the same Drizzle schema for both drivers eliminates the "works on my machine" risk.

**Alternatives considered**:
- Always use Neon — rejected: requires network for local dev, fails SC-006 "fresh machine in 15 min" target on flaky internet.
- Always use `pg` — rejected: misses Neon's connection model in production and complicates Render container scaling.
- Skip Drizzle and use `postgres.js` — rejected: not the project owner's choice and loses typed schema benefits.

---

## R-04 — Identifier-type detection

**Decision**: Detection runs both client-side (for inline validation, FR-002) and server-side (authoritative). It uses a small ordered ruleset:
1. Pure digits with optional `+`/spaces, length 7–15 → `phone`.
2. RFC 5322-ish regex match → `email`.
3. `@`-prefixed or single token without spaces, ASCII letters/digits/underscore/hyphen, length 2–30 → `username`.
4. Otherwise → `name`.

Both detections share the **same** `zod` schema in `packages/shared`. The client refuses to submit if rule #4 produces a string shorter than 2 characters or longer than 80.

**Rationale**: Auto-detection (FR-001) without forcing the user to pick a category is core to the premium feel. Mirroring the rules client- and server-side from a shared schema (G6) prevents drift. Length bounds protect downstream providers from absurd inputs.

**Alternatives considered**:
- Ask the user to pick the type via tabs/segmented control — rejected by FR-001.
- ML/LLM-based detection — rejected: overkill, network-dependent, and unreliable for short strings.
- Server-only detection — rejected: violates FR-002 (inline Arabic validation must happen before submission).

---

## R-05 — Source-provider abstraction

**Decision**: One `SourceProvider` interface in `apps/server/src/analysis/providers/types.ts`:

```ts
interface SourceProvider {
  readonly categoryKey: SourceCategoryKey
  readonly displayLabel: string // Arabic label, sourced from packages/shared/i18n
  supports(idType: IdentifierType): boolean
  analyze(input: AnalyzeInput, ctx: AnalyzeCtx): AsyncIterable<Finding>
}
```

`pipeline.ts` resolves the set of providers from a registry, runs the supported subset in parallel with a per-provider timeout, streams `Finding`s into `findings.ts` for persistence, and emits Socket.IO progress events as each provider iterator settles. Providers are registered explicitly at startup; v1 ships `mock/*` providers for each category that return deterministic seeded data, plus a switch (`SOURCE_PROVIDERS=mock|live`) controlling which set is loaded.

**Rationale**: Spec calls for v1 with no specific source list yet, but architecture must support adding real public-data providers without touching intake/streaming/persistence (FR-014, SC-007). Async-iterable findings let a single provider trickle results in (UX win) without changing the pipeline contract. Mock providers in dev satisfy SC-006.

**Alternatives considered**:
- Hard-code provider call sites in `pipeline.ts` — rejected: violates additive-AI/additive-source goal.
- Promise<Finding[]> instead of AsyncIterable — rejected: forces a provider to buffer everything, defeating early Socket.IO updates.
- Plugin loading from disk — rejected: needless dynamism for v1.

---

## R-06 — AI-readiness slot

**Decision**: The `aggregated_results` row carries an `enrichment_payload jsonb NULL` column and an `enrichment_status enum` (`pending|skipped|ready|failed`). v1 sets `enrichment_status='skipped'` and leaves `enrichment_payload` null. The result page renders an `<EnrichmentSlot/>` component which is a no-op when status is `skipped`. A future change adds an `EnrichmentProvider` interface that runs after the last source provider settles; nothing else changes.

**Rationale**: Satisfies FR-014/SC-007: "additive without rewriting intake, streaming, or persistence". Reserving the column and the UI region now is cheap; reserving the status enum lets the result page distinguish "AI not run" from "AI ran and failed" the day enrichment ships.

**Alternatives considered**:
- Defer the column and add it via migration later — rejected: a column add is cheap, but a UI/region add post-launch risks breaking layout assumptions; reserving space now keeps the polished feel.
- Compute enrichment inline inside `pipeline.ts` — rejected: couples streaming concerns with AI concerns and violates the additive constraint.

---

## R-07 — Rate limiting (visitor + identifier)

**Decision**: Two-layer limiter.
1. **Edge**: `express-rate-limit` with an in-memory store, scoped per IP, generous bucket (e.g. 60/min) — defends the process from runaway clients.
2. **Application**: DB-backed counters in `rate_limit_counters` keyed on `(visitor_token_hash, identifier_hash)` with a sliding window (e.g. 5 lookups / 10 min for the same identifier from the same visitor). Returns a structured Arabic error payload when tripped (FR-013).

`visitor_token` is set via a long-lived first-party cookie holding an opaque random ID; the server stores `sha256(visitor_token)` and `sha256(normalised_identifier)` only. The identifier value itself is stored on the lookup row for display, not on the limiter row.

**Rationale**: FR-013 requires a polite Arabic message, not an HTTP error, which means the limiter must be application-aware. Per-identifier limits stop a single user from re-running the same lookup in a tight loop; per-IP edge limits stop bots. Hashing on the limiter row keeps the limiter table free of PII while still allowing per-pair counting.

**Alternatives considered**:
- Redis-based limiter — rejected: adds a moving part Render+Neon don't otherwise need; revisit if scale outgrows DB counters.
- IP-only rate limiting — rejected: insufficient against same-IP bursts of distinct identifiers and against shared-NAT users.
- Storing raw `visitor_token` and identifier — rejected: leaks PII into a counter table.

---

## R-08 — Retention and purge (FR-016)

**Decision**: `lookups.expires_at` is set to `created_at + 30 days` at creation. `GET /api/lookups/:id` returns the `expired-state` shape when `now() > expires_at`. A daily background sweep (single SQL `DELETE … WHERE expires_at < now() - interval '7 days'`) purges expired rows and their cascaded findings/aggregated_results. The 7-day grace lets the front-end keep showing the designed expired state immediately after expiry, while the underlying record is reaped a week later.

**Rationale**: FR-016 + the share-link UX. Hard-deleting at exactly `expires_at` would race with users currently viewing the link; the 7-day grace is invisible to users (they still see the expired state) but avoids ugly mid-view 404s.

**Alternatives considered**:
- Delete exactly at `expires_at` — rejected: bad UX for a share recipient who opens the link seconds after expiry.
- Soft-delete via flag instead of physical delete — rejected: not needed; spec wants the record purged.

---

## R-09 — Monorepo + tooling

**Decision**: pnpm workspaces (`packages/shared`, `apps/server`, `apps/web`), TypeScript project references, Vitest as the unified test runner, ESLint flat config, Prettier with Arabic-friendly defaults (RTL-safe). One `tsconfig.base.json` plus per-package `tsconfig.json`. Husky + lint-staged on commit (lint + type-check + relevant tests).

**Rationale**: Single workspace lets `apps/server` and `apps/web` import from `@basmat/shared` without publishing. pnpm's content-addressable store keeps fresh-clone install fast (SC-006). Vitest unifies runners across packages.

**Alternatives considered**:
- npm workspaces — rejected: slower install and worse hoisting determinism on fresh clones.
- Turborepo / Nx — rejected: build orchestration overhead is not justified at three packages.
- Separate repos for client and server — rejected: kills the shared zod-schema strategy (G6).

---

## R-10 — Deployment: Docker on Render

**Decision**: Single multi-stage `Dockerfile` produces one image:
- Stage 1: `node:22-alpine`, `pnpm install --frozen-lockfile` against the workspace.
- Stage 2: builds `@basmat/shared`, then `apps/server` (tsc), then `apps/web` (Vite production build).
- Stage 3: minimal `node:22-alpine` runtime, copies the server build, the static `apps/web/dist`, and the production `node_modules`. Server serves `apps/web/dist` from `/` and exposes the Socket.IO endpoint on the same port.

`render.yaml` blueprint declares one Web Service, health check at `/api/healthz`, env vars `DATABASE_URL`, `SOURCE_PROVIDERS`, `NODE_ENV`, `PUBLIC_BASE_URL`. Migrations run via a Render pre-deploy command (`pnpm --filter @basmat/server migrate`).

**Rationale**: One image keeps Render config trivial and ensures the SPA and the WebSocket share an origin (no CORS, no sticky-session config). Pre-deploy migrations decouple schema changes from app start.

**Alternatives considered**:
- Two services (static SPA + API) — rejected: forces CORS, complicates Socket.IO origin handling, doubles Render config; not justified at v1 scale.
- Render Native Node runtime (no Docker) — rejected: spec mandates Docker.
- Server-side render — rejected: not in scope; v1 SPA is enough for the polished feel.

---

## R-11 — Observability

**Decision**: `pino` for structured logs at the server. Every log line for analysis carries `lookup_id`, `category_key`, `provider_id`, `event` (`start|finding|complete|fail|cancel`). Logs are written to stdout (Render captures them). A `/api/healthz` returns `{ status, db: 'ok'|'down', version }`. No external APM in v1; the field set is chosen so a future log shipper can index on `lookup_id` and reconstruct any single lookup end-to-end (FR-017).

**Rationale**: Cheap, correct, and one piece of glue away from a "trace any single lookup" capability whenever ops needs it.

**Alternatives considered**:
- OpenTelemetry from day one — deferred: extra dependency surface, not required by FR-017's minimum.
- Console logging — rejected: unparseable, fails FR-017's "structured form".

---

## R-12 — Testing strategy

**Decision**:
- **Unit** (Vitest, both packages): pure functions, schema validation, identifier detection, finding ordering, RTL helpers.
- **Integration** (Vitest + `supertest` + Testcontainers Postgres on the server side): full request/response against a real ephemeral DB, Socket.IO event sequences for one lookup.
- **Contract** (Vitest, both sides): every REST and Socket.IO contract is asserted against the `zod` schemas in `packages/shared`; client fixtures and server route handlers both validate.
- **E2E** (Playwright, against `pnpm dev`): a "golden lookup" through home → progress → result, RTL invariants (no horizontal scroll at 320 px, expected mirrored/non-mirrored icons, `dir="rtl"` on `<html>`, Arabic copy in chrome), and an empty-state test using a seeded mock provider that returns nothing.

**Rationale**: Covers FR-001…FR-017 and SC-001…SC-008 with an explicit, small E2E set focused on the specific RTL invariants SC-003 demands.

**Alternatives considered**:
- Cypress instead of Playwright — rejected: weaker bidi-text and locale coverage in our experience, and Playwright's tracing helps debug RTL layout regressions visually.
- No Testcontainers (mock the DB) — rejected: Drizzle migrations and Neon nuances need a real Postgres to be meaningful.

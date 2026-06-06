# Phase 0 Research — Premium Redesign, Telegram Login, and Owner Admin Panel

**Plan**: [plan.md](./plan.md) · **Spec**: [spec.md](./spec.md) · **Date**: 2026-06-04

This document resolves the open technical questions implied by the spec and locks in decisions before Phase 1 design. Each entry is **Decision / Rationale / Alternatives considered**. Decisions from feature `001` are inherited unless explicitly amended here.

---

## R-01 — Telegram authentication mechanism

**Decision**: Use the **Telegram Login Widget** (the `data-telegram-login` script mounted on `/sign-in`). It opens Telegram's hosted auth page in a popup, returns a small payload (`id`, `first_name`, `last_name?`, `username?`, `photo_url?`, `auth_date`, `hash`), and the server verifies it with HMAC-SHA256.

The verification, exactly:

```
secret = sha256(BOT_TOKEN)                              // 32 raw bytes
data_check_string = sorted("k=v" pairs except `hash`).join("\n")
expected = hmac_sha256(secret, data_check_string).hex()
ok = timingSafeEqual(expected, payload.hash) AND (now - auth_date) < 300s
```

Bot token is the operator-issued env var `TELEGRAM_BOT_TOKEN`. Freshness window is 5 minutes (Telegram's recommended ceiling). Both inputs are validated by a `zod` schema in `packages/shared/auth/telegram.ts` so client typing matches server verification.

**Rationale**: FR-001 demands Telegram-only on the public site without exposing any other provider. The Login Widget is Telegram's officially documented browser flow, requires zero TLS callbacks (so it works on any Render URL without a stable webhook), and the verification is a pure cryptographic check that runs in <1 ms on Node 22 — well under SC-001's 3 s p90 budget. The HMAC chain is the verification recipe published by Telegram for this exact widget.

**Alternatives considered**:
- **Telegram Login via Bot deep link + `/start <token>`** — rejected: requires a webhook or polling on `getUpdates`, adds a moving part for v1, and pushes the user out of the browser into a Telegram client to copy a code back; worse UX for the redesigned sign-in surface.
- **OAuth2 wrapper service in front of Telegram (e.g. via Auth0 social provider)** — rejected: Telegram is not a standard OAuth2 IdP, the wrapper would be a third party seeing every Libyan user's identity, and FR-014/G8 boundaries become harder to draw.
- **Telegram Mini App / WebApp `initData`** — deferred: that flow assumes the user opens the site from a Telegram client; for a public Arabic-first website that anyone may discover via Google or a link, the Login Widget is the right primary entry. Mini-app auth can be added later as an additional path if the product wants a Telegram-native distribution.

---

## R-02 — Session model: opaque server cookie vs JWT

**Decision**: **Opaque server-issued session token in a `HttpOnly Secure SameSite=Lax` cookie**, backed by a `sessions` row.

- Token: 32 random bytes from `crypto.randomBytes`, base64url-encoded → cookie value `bsl_session`.
- Server stores `sha256(token)` (so a DB read never reveals an active token), `user_id`, `issued_at`, `last_seen_at`, `expires_at`, `revoked_at NULL`, `client_signature` (UA hash + IP CIDR coarse-grained, for diagnostics, never for binding).
- Lifetime: 30 days rolling (refreshed on activity), absolute cap 90 days. Tunable from site settings (`session_lifetime_days`, default 30).
- Revocation: setting `revoked_at` invalidates immediately. Suspension or owner-removal sets `revoked_at` on every session of the affected user in one statement, and emits `session.invalidated` over Socket.IO so any open tab transitions to the designed `/suspended` or `/sign-in` state without waiting for the next request.

**Rationale**: FR-018 ("suspension takes effect immediately across all open sessions") rules out stateless JWTs unless we also keep a revocation list — at which point we have all of JWT's complexity *and* a sessions table, with worse semantics. An opaque cookie + DB row is one moving part, idempotent to revoke, easy to audit, and avoids leaking a long-lived bearer to JS (HttpOnly).

**Alternatives considered**:
- **JWT with short TTL + refresh token + revocation list** — rejected: three moving parts to do what one row does, and the revocation list is itself a sessions table.
- **Session id in localStorage** — rejected: violates G8 (write-only-secret posture); a single XSS lifts every active session.
- **Cookie binding to IP** — rejected: Libyan mobile users frequently change IPs (mobile→Wi-Fi); binding causes false sign-outs.

---

## R-03 — Owner identity: how `OWNER_TELEGRAM_ID` is populated for +218 091 008 9975

**Decision**: The owner is identified by **Telegram numeric user id** (an integer such as `123456789`), not the phone number. The phone number `+218 091 008 9975` is the contact information tied to the Telegram account; Telegram's user id is the stable, non-PII identifier we store and compare against.

Bootstrap procedure (documented in `quickstart.md`):

1. Operator runs `pnpm tsx scripts/bootstrap-owner.ts` once. The script asks the operator to send `/start` to the configured `TELEGRAM_BOT_TOKEN`'s bot from the +218 091 008 9975 account.
2. The script polls `getUpdates` once, captures the numeric `from.id` of the message it receives, prints it, and exits.
3. Operator pastes that number into Render env vars / local `.env` as `OWNER_TELEGRAM_ID`.
4. From that point on, any Telegram Login payload whose `id` field matches `OWNER_TELEGRAM_ID` is granted the `owner` role on user creation or on every sign-in (idempotent).

If `OWNER_TELEGRAM_ID` is unset, no user can have the owner role; admin routes return `unauthorized` for everyone. There is no "first sign-in becomes owner" behaviour — that path is explicitly closed by spec (FR-009).

**Rationale**: Telegram numeric ids are stable, public-by-design when chatting with a bot, and never change when the user updates their handle, name, or avatar. Storing the phone number on the server would (a) not help — the Login Widget never returns it — and (b) be PII we don't need (G2). The bootstrap script is a one-off dev-time tool, not a runtime path; it never runs in production.

**Alternatives considered**:
- **Configure by `@username`** — rejected: usernames are mutable; an owner who later changes their Telegram handle would lock themselves out.
- **Configure by phone number directly** — rejected: phone is not in the Login Widget payload; would require Telegram's `requestContact` flow and stored PII.
- **First-login-becomes-owner** — rejected by spec; creates a race where any visitor who opens the site before the operator can claim the role.

---

## R-04 — Cookie attributes & cross-origin posture

**Decision**: `bsl_session` cookie with attributes `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=...; Domain=<deployed origin>`. In dev, `Secure` is gated on `NODE_ENV==='production'` so localhost works without HTTPS.

`SameSite=Lax` (not `Strict`) so the share-link UX from `001` continues to work — a logged-in user clicking a share link from Telegram or email arrives signed in. `Strict` would break that. We do not need cross-site POST credentials anywhere, so `None` is unnecessary and would force `Secure` everywhere with weaker CSRF posture.

CSRF: state-changing endpoints (`POST /api/auth/sign-out`, every admin write) require either (a) the session cookie *and* a custom header `X-CSRF` whose value matches a per-session double-submit token returned by `/api/auth/me`, or (b) the same-origin SPA fetch path which already includes the cookie automatically. The Telegram callback itself (`POST /api/auth/telegram`) is exempt from the custom-header check because it has its own HMAC verification.

**Rationale**: HttpOnly+Secure+Lax is the modern baseline for browser session cookies; double-submit token is the lightest CSRF defence that doesn't require server-side per-request state.

**Alternatives considered**:
- **`SameSite=Strict`** — rejected: breaks signed-in share-link arrivals.
- **Server-stored CSRF tokens per request** — rejected: doubles DB writes for every admin action; double-submit is sufficient at this scale.

---

## R-05 — AI model provider abstraction (replaces v1 hard-coded NVIDIA path)

**Decision**: A single `AiModelClient` interface in `apps/server/src/analysis/enrichment/ai-model-client.ts`:

```ts
interface AiModelClient {
  readonly providerKey: 'openai' | 'anthropic' | 'google' | 'nvidia' | 'openai_compatible'
  validate(creds: DecryptedCreds, modelId: string): Promise<ValidateResult>
  enrich(input: EnrichmentInput, opts: GenerationOpts): Promise<EnrichmentOutput>
}

type GenerationOpts = {
  systemPrompt: string
  temperature: number          // 0..2
  maxOutputTokens: number      // bounded per provider
  extraParams?: Record<string, JsonValue>  // provider-specific knobs (top_p, etc.)
  signal: AbortSignal
}
```

Adapters live under `enrichment/providers/`: `openai.ts`, `anthropic.ts`, `google.ts`, `nvidia.ts`, `openai-compatible.ts`. Each adapter imports its provider's official SDK, knows its own field shapes, and emits the same `EnrichmentOutput` (`{ status: 'ready', payload: jsonb } | { status: 'failed', reason: string }`).

`enrichment.ts` reads the active row from `ai_model_entries` (one row with `is_active = true`), fetches+decrypts the credential, picks the adapter by `provider`, and calls `enrich(...)`. The output is written into `aggregated_results.enrichment_payload` / `enrichment_status` exactly as `001` defined — no schema change.

**Rationale**: FR-011/FR-015 require external-provider configuration with advanced per-model knobs (system prompt, temperature, max output, extra params). One interface plus one adapter per provider keeps the call site stable; adding a new provider later is a single new adapter file plus enrolling its `providerKey` in the union. The v1 NVIDIA NIM path becomes one of the adapters, so v1 enrichment continues to work as soon as a NIM `ai_model_entries` row is marked active — this satisfies G10 (no v1 regression).

**Alternatives considered**:
- **One generic OpenAI-compatible adapter** — rejected: Anthropic and Google differ enough (system prompt placement, message shape, streaming events) that a generic adapter would be a translation layer with leaky behaviour.
- **Plugin loading from disk at runtime** — rejected: same reasoning as `001 R-05`; needless dynamism.
- **Direct fetch in route handler** — rejected: spreads provider knowledge into HTTP layer and breaks the single-call-site invariant.

---

## R-06 — At-rest encryption of model credentials

**Decision**: AES-256-GCM, key from `MODEL_SECRET_KEY` (32 raw bytes, base64-encoded in env). Per-row 12-byte random IV; ciphertext stored as `{ iv, ciphertext, tag }` JSONB in `ai_model_entries.credential_ciphertext`. Plaintext credential is held in memory only for the duration of `validate()` or `enrich()` and is never logged.

Display contract for admin GETs: the credential field is replaced server-side by `{ present: true, lastFour: '…1234' }` derived from the *plaintext* before re-encryption; the admin UI shows "•••• 1234" so the owner can recognise which key is set without ever shipping plaintext over the wire.

Key rotation: rotating `MODEL_SECRET_KEY` is a deliberate operator action documented in `quickstart.md` — re-encrypt all rows with the new key in a one-shot script, then redeploy. Until that script runs, decryption falls back to the previous key (env var `MODEL_SECRET_KEY_PREVIOUS`, optional).

**Rationale**: FR-014 + G8: credentials are write-only from the admin UI's perspective. AES-GCM gives confidentiality + integrity in one primitive. Last-four display is a familiar pattern (Stripe, Vercel) that gives the owner a useful identity for the credential without leaking it.

**Alternatives considered**:
- **Plaintext column** — rejected: backups, replication, accidental SELECTs.
- **External KMS (AWS, GCP)** — rejected: adds a cloud dependency feature `001` deliberately avoided; revisit at scale.
- **Per-tenant key derivation** — rejected: there is one tenant (the platform) at v1.

---

## R-07 — Site settings: storage, typing, propagation

**Decision**: One table `site_settings` keyed by a string union (`SiteSettingKey`). Values are stored as JSONB but typed end-to-end via a `zod` discriminated-union schema in `packages/shared/admin/site-settings.ts` — every key has a known value type, default, and validation rules; the admin UI form is generated from the schema.

Initial keys (more can be added without a migration):

| Key | Type | Default | Min | Max |
|-----|------|---------|-----|-----|
| `lookup_retention_days` | integer | 30 | 1 | 365 |
| `rate_limit_per_visitor_window_minutes` | integer | 10 | 1 | 1440 |
| `rate_limit_per_visitor_max_per_window` | integer | 5 | 1 | 100 |
| `rate_limit_per_identifier_window_minutes` | integer | 60 | 1 | 1440 |
| `rate_limit_per_identifier_max_per_window` | integer | 20 | 1 | 1000 |
| `enrichment_enabled` | boolean | false | — | — |
| `public_lookups_enabled` | boolean | true | — | — |
| `session_lifetime_days` | integer | 30 | 1 | 90 |

Propagation: an in-process cache (`Map<key, { value, fetchedAt }>`) with a 30-second TTL. On admin write the cache entry is invalidated immediately on the writing instance; other instances pick up the new value within 30 s, satisfying SC-005's "≤ 30 s in 95% of changes" without needing Redis or pub/sub.

**Rationale**: FR-021/FR-022 demand operator-tunable settings that propagate without a restart. A typed `zod` schema makes the admin form auto-generatable, validation centralised, and downstream consumers type-safe. The 30-second cache keeps reads cheap while still meeting the SC-005 budget.

**Alternatives considered**:
- **Per-setting tables** — rejected: every new setting becomes a migration; spec wants the owner to feel like settings are easy to add.
- **Env vars only** — rejected: requires redeploy, fails FR-022.
- **Redis pub/sub for instant propagation** — rejected: 30 s satisfies the SC; Redis is a moving part `001` deliberately avoided.

---

## R-08 — Audit log: choke-point, content, retention

**Decision**: Every admin mutation calls `auditLog.append({ actor, eventClass: 'admin', eventSubclass, target, before, after, requestSignature })` exactly once before responding. The append is in the same DB transaction as the mutation it audits, so a write that fails its audit fails as a whole — guaranteeing G9 by construction.

Auth events go through the same choke-point with `eventClass: 'auth'` and subclasses `sign_in_attempt | sign_in_success | sign_in_failure | sign_out | session_revoked | session_expired`. Failure subclasses include a coarse `reason_class` (`hmac_invalid`, `auth_date_too_old`, `bot_unavailable`, `suspended_user`) but **never** the raw payload, hash, or token — those are explicitly redacted (FR-030, G8).

Before/after values for admin entries are JSONB. Sensitive fields (`credential_ciphertext`, `credential_plaintext`, anything with `secret`/`token`/`key` in its name) are replaced by `{ redacted: true }` at the choke-point — there is no path that lets an audit row contain a credential.

Retention: 1 year by default, settable via the same site-settings table (key `audit_retention_days`, future). A nightly sweep deletes rows past retention.

**Rationale**: SC-009 ("100% of admin actions"). Co-locating audit append with the mutation transaction is the only way to make 100% structural rather than best-effort. Coarse failure reasons keep diagnostics useful without leaking secrets.

**Alternatives considered**:
- **Decorator/middleware-based audit** — rejected: easy to forget on a new endpoint; SC-009 needs a per-mutation guarantee.
- **Append after response** — rejected: a crash between the response and the append loses the audit; transaction co-location is correct.
- **Free-form audit content** — rejected: structured before/after is what makes filtering and diff display in the admin Audit page possible.

---

## R-09 — Premium design system: tokens, primitives, RTL

**Decision**: A single `packages/shared/design-tokens` package emits semantic tokens (colour, typography, spacing, radii, motion) as both a TypeScript object (consumed by server-rendered surfaces and tests) and a Tailwind preset (consumed by `apps/web`). Component primitives live in `apps/web/src/design/primitives` and wrap Radix UI's headless primitives where applicable (Dialog, DropdownMenu, Tabs, Tooltip, Toast). Every primitive is RTL-first and uses logical-property utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`) — physical `left/right` is forbidden by an ESLint rule.

Typography: an Arabic display family (e.g. IBM Plex Sans Arabic, self-hosted, already loaded in `001`) and Latin (Inter) with explicit `unicode-range` so source-native Latin content inside Arabic UI never flashes the wrong face. Type scale defined as `xs / sm / base / lg / xl / 2xl / 3xl` with line-heights tuned for Arabic readability (typically +5–10% over the matching Latin scale).

Motion: `motion-fast` (140 ms), `motion-base` (220 ms), `motion-slow` (340 ms); easings `out-soft`, `in-out-soft`. Reduced-motion fallback at the token level — `useReducedMotion()` (framer-motion) drops every duration to 0 and skips translate/scale variants while keeping opacity transitions, satisfying FR-027.

Colour: dual-mode tokens (`bg-canvas`, `bg-elevated`, `fg-default`, `fg-muted`, `accent`, `danger`, `success`, `warning`, `border-subtle`, `border-strong`); contrast is checked against WCAG 2.1 AA in a Vitest snapshot test that walks every (fg, bg) pair the design system declares as a valid combination.

**Rationale**: FR-024 + G11 demand a single source. Tokens-as-package + headless Radix keeps the design system usable on any future surface (server-rendered errors, future LTR variant, future native shell) without a rewrite. ESLint rule against physical properties is the only durable way to enforce G1 across a growing codebase.

**Alternatives considered**:
- **shadcn/ui as-is** — rejected: shadcn is excellent but assumes LTR and CSS-variable tokens; copying its patterns and rebuilding RTL-first is faster than retrofitting it after the fact.
- **MUI or Chakra** — rejected: heavy, opinionated, and harder to bend to Arabic-first typography rhythms; the spec wants a premium custom feel, not framework defaults.
- **CSS vars only, no Tailwind preset** — rejected: half the codebase already uses Tailwind utilities; bifurcating breaks G6 (single source) and dev ergonomics.

---

## R-10 — Admin panel UI architecture

**Decision**: `/admin/*` is a guarded subtree of the same Vite SPA. Server-side, every `/api/admin/*` route is wrapped in `requireOwner()` middleware that returns `403 { code: 'unauthorized', messageAr: '…' }` (designed shape) for non-owners — no admin data touches the response body. Client-side, the SPA refuses to render `AdminLayout` for non-owners; if a non-owner reaches `/admin` directly, the layout immediately renders `<NotAuthorisedPage/>`. The dual gate (server + client) is intentional — the server is authoritative; the client gate is for a polished UX so the admin chrome never flashes.

Routing structure inside `/admin`:

```
/admin                  → redirect to /admin/ai-models
/admin/ai-models        → list + create + edit + activate
/admin/users            → list + filter + sort + suspend/unsuspend/remove
/admin/site-settings    → grouped form
/admin/audit            → filtered timeline of audit-log entries
```

Each section is its own React route, lazy-loaded so the admin bundle never ships to non-owners (smaller public bundle = faster SC-002). Mutations use TanStack Query mutations with optimistic invalidation; failures surface designed Arabic toasts.

**Rationale**: FR-008 (admin UI must not render even partially for non-owners). Server gate is the line of authority; client gate is polish. Lazy-loading keeps the public bundle from carrying admin code.

**Alternatives considered**:
- **Separate Vite app for admin** — rejected: complexity tracked in `plan.md` (extra build, extra origin, extra Render service, design-token duplication).
- **Render admin server-side only** — rejected: the redesign and primitives are React; SSR-only would mean two component implementations.

---

## R-11 — `session.invalidated` Socket.IO event

**Decision**: Add one server→client event `session.invalidated` carrying `{ userId, sessionId, reason: 'suspended' | 'removed' | 'manual_revoke' | 'expired' }`. Emitted into a new room `user:{userId}` that authenticated clients join automatically on connect (after the cookie is verified). Receiving clients show a designed Arabic toast and navigate to `/suspended` (for suspension/removal) or `/sign-in` (for manual revoke / expiry).

The existing `lookup:{id}` room semantics from `001` are unchanged. Adding `user:{id}` is additive: an unauthenticated socket never joins it.

**Rationale**: FR-018 needs immediate cross-tab effect; an event-driven push is the only way to do this without polling. Routing via a per-user room is the natural fan-out pattern (matches `001 R-02`).

**Alternatives considered**:
- **Polling `/api/auth/me`** — rejected: violates G3.
- **Forcing reconnect with a "your session is dead" handshake** — rejected: clunky UX, doesn't generalise to manual revoke from another tab.

---

## R-12 — Migration sequencing and zero-downtime posture

**Decision**: One Drizzle migration `0002_admin_panel.sql` that:

1. Creates `users`, `sessions`, `ai_model_entries`, `site_settings`, `audit_log_entries`, `user_lookup_associations`.
2. Adds `lookups.owner_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL`.
3. Seeds `site_settings` rows for every key defined in R-07 with their default values.
4. Adds the indexes listed in `data-model.md`.

No column from `001` is dropped, renamed, or repurposed. `lookups.owner_user_id` is nullable with no default, so existing v1 anonymous lookups remain valid. A roll-back drops the new tables and the `owner_user_id` column; v1 continues to function.

**Rationale**: G10. Zero-downtime additive migrations are the cheapest insurance against mid-deploy regressions.

**Alternatives considered**:
- **Multiple smaller migrations** — rejected for v0 of this feature: the tables are interdependent (audit references users, sessions reference users, etc.); shipping them together avoids an awkward intermediate state.
- **Backfill `lookups.owner_user_id` from a heuristic** — rejected: nothing in v1 records identity; there is no honest backfill.

---

## R-13 — Suspension semantics: cascading effects

**Decision**: Suspension of a user does the following in one transaction:

1. `users.status = 'suspended'`.
2. Set `revoked_at = now()` on every active `sessions` row for that user.
3. Insert one audit entry `{ class: 'admin', subclass: 'user_suspend', actor, target: userId, before: { status }, after: { status: 'suspended' } }`.
4. Emit `session.invalidated` into `user:{userId}` for every connected socket.

A suspended user's *existing* lookups remain in the DB and are still readable via share link (the share link is the public primitive, not bound to identity — preserved from `001`). Their `user_lookup_associations` rows are kept so audit and possible future reinstatement remain coherent. Removal (FR-018, "remove a user") deletes the `users` row; `user_lookup_associations.user_id` cascades to NULL via the FK action, so the share-link records survive but become disassociated.

**Rationale**: FR-018 + FR-019 ("graceful degradation, no leakage to other users"). Keeping share links readable preserves G2-style anonymous shareability and matches the share-link contract from `001`.

**Alternatives considered**:
- **Hard-delete user's lookups on removal** — rejected: would silently break public share links pointed at by third parties.
- **Soft-suspend without revoking sessions** — rejected: spec is explicit that suspension takes effect immediately across all sessions.

---

## R-14 — User-history privacy & deletion semantics

**Decision**: `user_lookup_associations` is the user-side index of "lookups I've run". A signed-in user's `DELETE /api/me/history/:lookupId` removes the association row, **not** the underlying `lookups` row. The result page remains reachable via its share link until the v1 retention window expires; only the user's personal index entry is gone. This matches the spec's framing of the action as "remove from my history", not "delete the lookup".

The admin viewing a user's history (FR-020) reads `user_lookup_associations` with a flag indicating user-hidden rows are visible to the owner; the user's own history view filters them out. Owner-side visibility into hidden rows is itself an admin action and is audited.

**Rationale**: Two distinct verbs ("remove from my history" vs "delete the public record") have two distinct effects. Conflating them would (a) silently break share links for third parties and (b) force a user-deletion path through the v1 retention pipeline, which it was not designed for.

**Alternatives considered**:
- **Hard-delete the `lookups` row on user history-remove** — rejected: breaks share links the user previously sent to others; that is a different verb.
- **No admin visibility into user-hidden rows** — rejected: spec explicitly grants the owner read access to a user's lookup history (FR-020).

---

## R-15 — Public-bundle weight & SC-002 budget

**Decision**: Admin code (Radix primitives, `@tanstack/react-table`, admin pages) is split into a separate Vite chunk loaded only on `/admin/*`. Telegram Login Widget script is loaded only on `/sign-in`. Design tokens compile to a Tailwind preset (no runtime cost). Result: the public bundle gains roughly the size of `react-hook-form` + `clsx`/`cva` overhead — well within the SC-002 LCP budget inherited from `001`.

A bundle-size regression test (`size-limit` or equivalent in CI) holds the public bundle gzipped size to ≤ +15% of the `001` baseline; a hard fail at +25%. The admin bundle has no size budget — it loads only for the owner.

**Rationale**: FR-024 demands premium feel everywhere, but SC-002 (LCP on 3G/4G) is a hard public-side metric. Split-loading makes "premium admin" cost-free for the public visitor.

**Alternatives considered**:
- **Single bundle** — rejected: silently regresses LCP for everyone for code 99.99% of visitors will never run.
- **Iframe the admin panel** — rejected: bidi/RTL boundaries inside an iframe are painful; primitive sharing breaks.

---

## R-16 — Testing strategy additions

**Decision** (extends `001 R-12`):

- **Unit (Vitest)**: Telegram HMAC verifier; session cookie helpers; `secret-cipher` round-trip; site-settings cache invalidation; ai-model adapters' shape mapping.
- **Integration (Vitest + supertest + Testcontainers)**: `POST /api/auth/telegram` happy/tampered/expired; admin-gate denies non-owner on every admin route; suspension transaction emits `session.invalidated`; audit-log appends-on-write invariant (mutation that fails is rolled back together with its audit entry).
- **Contract**: every new schema in `packages/shared` is asserted in both client and server test packs.
- **E2E (Playwright)**: sign-in via stubbed Telegram widget (test fixture serves a hand-signed payload using a `TEST_BOT_TOKEN`); owner reaches `/admin` and performs one CRUD per section; non-owner is denied at `/admin`; suspension in one tab forces sign-out in another; redesign audit walks all 16 surfaces and asserts (a) `dir="rtl"` on `<html>`, (b) Arabic copy in chrome, (c) no horizontal scroll at 320 px, (d) `data-design-system="bsl-002"` attribute present on the root layout (a cheap structural marker, not a token check).
- **Accessibility**: `axe-playwright` run on all 16 redesigned surfaces; violations fail CI.

**Rationale**: Covers SC-001…SC-009 with a small, explicit test set focused on the structural invariants the spec demands. The redesign audit + axe check together discharge FR-024/FR-027.

**Alternatives considered**:
- **Snapshot every surface** — rejected: snapshots churn on copy edits; structural assertions are more durable.
- **Manual-only redesign sign-off** — rejected: not repeatable, can't gate CI.

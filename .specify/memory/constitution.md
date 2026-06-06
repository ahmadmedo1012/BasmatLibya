<!--
== Sync Impact Report ==
Version change: 1.0.0 → 1.1.0  (MINOR — Principle III scoped rewrite, no principle removed)

Modified principles:
- Principle III "Privacy by Design" — REWRITTEN. The original text
  (which forbade any auth, accounts, sessions, or PII) is replaced
  with a scoped text that permits a single documented exception:
  first-party Telegram sign-in, used only for trial/abuse-control and
  admin elevation. Eight binding sub-clauses codify the privacy
  constraints that exception MUST respect. The 30-day retention rule
  on submitted identifiers is preserved unchanged from v1.0.0.

Added sections:
- §"Visitor cookie" sub-clause under Principle III — codifies the
  long-lived `basmat_visitor` cookie as a separate, anonymous identity
  used only for rate limiting and lookup coalescing.
- §"Owner role" sub-clause under Principle III — codifies the
  `OWNER_TELEGRAM_ID` single-admin model and the fact that elevation
  is server-controlled on every sign-in.
- §"No behavioural tracking" sub-clause — explicit prohibition.
- §"No social graph" sub-clause — explicit prohibition.

Removed sections: N/A (no principle is removed; Principle III is
replaced in place because the v1.0.0 text is no longer a faithful
description of the shipped product).

Templates requiring updates:
- .specify/templates/plan-template.md: ⚠ updated — G3 entry rephrased
  to reflect the v1.1.0 scope ("scoped first-party sign-in permitted;
  privacy constraints per Principle III sub-clauses"), not the
  absolute "no auth" wording of v1.0.0.
- .specify/templates/spec-template.md: ✅ no change (already principle-
  agnostic).
- .specify/templates/tasks-template.md: ✅ no change.
- .specify/templates/checklist-template.md: ✅ no change.

Follow-up TODOs:
- Re-run `/speckit.analyze` against the amended constitution on the
  next feature. The CRITICAL G3 finding should drop to PASS.
- Future plan templates' Constitution Check sections should mention
  "Principle III v1.1.0 is scoped; see sub-clauses 1–8" so contributors
  are reminded the principle is no longer absolute.
- Migration step 3 (update feature 005 plan.md Complexity Tracking) is
  out of scope here — that file is historical record and the
  amendment is the resolution.
-->

# BasmatLibya Constitution

## Core Principles

### I. Arabic-First & RTL by Default

Every user-facing surface MUST be built for right-to-left layout first. All UI copy
MUST be authored in Arabic by default. Every HTML page MUST ship `dir="rtl"` and
`lang="ar"`. The Tailwind CSS RTL plugin MUST be enabled globally. A dedicated
Playwright RTL test suite MUST verify no horizontal scroll, no incorrectly mirrored
icons, and correct bidirectional text rendering on every surface including modals,
toasts, and error states. LTR support is a follow-on concern, never the baseline.

### II. Shared Typed Contracts (Schema-First)

Every REST request/response shape and every Socket.IO event payload MUST be defined
as a zod schema in `packages/shared`. Both client (`apps/web`) and server
(`apps/server`) MUST import and validate against the same schema. Any type drift
between client and server MUST cause a build-level failure. `packages/shared` is the
single source of truth for all wire contracts — no duplicate type definitions
elsewhere in the codebase.

### III. Privacy by Design (scoped to permit first-party sign-in for trial/abuse-control)

The system MUST minimise the personally identifiable information it stores. The
following rules apply to the auth-bearing surfaces:

1. **No PII beyond what the user explicitly submits and what Telegram exposes
   publicly via the Login Widget.** The `users` table MAY hold `telegramId`,
   `displayName`, `username`, and `avatarUrl` because the Login Widget requires
   them. No additional profile fields, no email, no phone, no IP-in-plaintext
   may be persisted.
2. **No behavioural tracking.** The system MUST NOT log per-user clickstreams,
   search histories tied to a user, or any analytics that cross-link a user
   across sessions beyond what's required to render the user's own history
   page.
3. **Submitted identifiers (the search input) MUST be bound to a 30-day
   retention window and automatically purged.** This rule is unchanged from
   v1.0.0.
4. **Sessions are short-lived.** `bsl_session` MUST expire within 30 days of
   issue; the implementation MAY default to 30 days and MUST cap at 90 days
   regardless of `site_settings`. Session tokens MUST be stored only as
   sha256-hashed values; the plaintext token MUST never leave the server's
   response or the browser's cookie jar.
5. **Visitor cookie is anonymous.** The `basmat_visitor` cookie is a
   sha256-hashed opaque ID, NOT bound to a user. It exists ONLY for
   anonymous rate limiting and lookup coalescing. It MUST NOT be used to
   authenticate, MUST NOT be cleared on sign-out, and MUST NOT survive
   browser-data clearing.
6. **Single owner.** The product admits exactly one operator/admin (the
   `OWNER_TELEGRAM_ID`). Elevation is server-controlled, evaluated on every
   sign-in, and is not self-claimable.
7. **No social graph.** The system MUST NOT expose follower/following,
   messaging, friend lists, or any feature that would require persistent
   cross-user relationships.
8. **No private or breached data sources.** The five source providers
   queried by the pipeline MUST be limited to publicly discoverable
   information. Any future provider MUST be reviewed for this constraint
   before being enabled in `SOURCE_PROVIDERS`.

Expired lookups MUST resolve to a designed expired state with a one-click
re-run option. Trial counters for anonymous visitors are bound to the
visitor cookie, not to a user; the cap is documented in
`apps/server/src/services/trial-gate.ts` and surfaced in the product copy.

### IV. Push-Based Real-Time Progress

All lookup progress MUST be communicated via a server-pushed channel (Socket.IO).
The client MUST NOT poll any status endpoint. As each source provider completes, a
typed progress event MUST be emitted per category. The UI MUST reflect real-time
progress without user-initiated refreshes. The server MUST support reconnection
within 30 seconds without losing progress context.

### V. AI-Ready Architecture & Simplicity (YAGNI)

The aggregated result data model MUST reserve a nullable enrichment slot (`jsonb`)
that AI or any future provider can populate without touching the intake, streaming,
or persistence layers. This enrichment slot MUST be a no-op in v1. Follow YAGNI
strictly: minimize dependencies beyond the core stack. `framer-motion` is permitted
only for state-meaningful animations. One-command local dev MUST be guaranteed:
`pnpm i && pnpm dev` brings up the full stack against a local Postgres. The server
MUST be stateless (no in-memory lookup state) to enable autoscaling.

## Technology Stack & Constraints

- **Languages & Runtimes**: TypeScript 5.6+, Node.js 22 LTS
- **Frontend**: React 19, Vite 6, Tailwind CSS 3.4 (RTL plugin enabled), `wouter`,
  `@tanstack/react-query` v5, Socket.IO client v4
- **Backend**: Express 5, Socket.IO 4, Drizzle ORM, `zod` for validation
- **Database**: PostgreSQL 16 (`@neondatabase/serverless` in production,
  `pg` in local Docker via `docker compose`)
- **Logging & Security**: `pino` for structured logging, `helmet`, `cors`,
  `compression`, `express-rate-limit`
- **Testing**: Vitest (unit + integration via `supertest` + `@testing-library/react`),
  Playwright (e2e with RTL assertions)
- **Build & Deploy**: pnpm workspaces (`apps/web`, `apps/server`, `packages/shared`);
  single Docker multi-stage image
- **Animation**: `framer-motion` permitted ONLY for state-meaningful animations,
  not decorative use

MUST use Drizzle ORM for database access; raw SQL or other query builders are not
permitted. MUST use `zod` for all runtime validation. Production deployment MUST
use a single Docker image to keep operational complexity low.

## Development Workflow

- Feature development follows the speckit workflow: spec → plan → tasks →
  implementation within `specs/NNN-name/`
- All wire contracts MUST be defined as zod schemas in `packages/shared` before any
  implementation begins
- Changes to `packages/shared` REQUIRE explicit backward compatibility review —
  breaking changes MUST be justified and versioned
- Integration tests MUST cover: new shared schema contracts, contract changes,
  inter-service (Socket.IO) communication
- Commits MUST follow Conventional Commits format (e.g., `feat:`, `fix:`, `docs:`)
- Constitution compliance MUST be verified during code review — every PR MUST
  reference the relevant principles
- Data retention: 30-day hard window enforced by a scheduled purge process
- Environment variables MUST be documented in `.env.example`; secrets MUST never
  be committed
- AI integration additions MUST be strictly additive — no changes to existing
  intake, streaming, or persistence paths

## Governance

This constitution supersedes all ad-hoc development practices. Every principle is a
non-negotiable constraint unless explicitly amended.

- **Amendment process**: Proposals MUST be documented in a spec, receive explicit
  approval, and include a migration plan for any in-flight work affected by the
  change
- **Versioning**: Follows Semantic Versioning (MAJOR.MINOR.PATCH):
  - MAJOR: Backward-incompatible governance changes, principle removals, or
    redefinitions
  - MINOR: New principle or materially expanded guidance
  - PATCH: Clarifications, wording refinements, typo fixes
- **Compliance**: Every PR MUST be reviewed against the constitution. New
  dependencies outside the core stack MUST be justified in a Complexity Tracking
  section. Violations of Principles I–V MUST block merge until resolved.
- **Review cadence**: The constitution SHALL be reviewed at the end of each feature
  milestone.

**Version**: 1.1.0 | **Ratified**: 2026-06-06 | **Last Amended**: 2026-06-06

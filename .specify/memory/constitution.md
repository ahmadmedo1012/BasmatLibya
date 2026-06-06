<!--
== Sync Impact Report ==
Version change: (none → initial) 1.0.0

Modified principles: N/A (initial creation)

Added sections:
- Principle I: Arabic-First & RTL by Default
- Principle II: Shared Typed Contracts (Schema-First)
- Principle III: Privacy by Design (No Auth, No PII)
- Principle IV: Push-Based Real-Time Progress
- Principle V: AI-Ready Architecture & Simplicity (YAGNI)
- Section: Technology Stack & Constraints
- Section: Development Workflow
- Governance rules (ratified principles, amendment procedure, versioning policy, compliance)

Removed sections: N/A (initial creation)

Templates requiring updates:
- .specify/templates/plan-template.md: ⚠ pending — Constitution Check section must reference ratified principles and gates
- .specify/templates/spec-template.md: ✅ updated (no changes needed — already aligned)
- .specify/templates/tasks-template.md: ✅ updated (no changes needed — already aligned)
- .specify/templates/commands/: ✅ no command files exist

Follow-up TODOs: None
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

### III. Privacy by Design (No Auth, No PII)

The system MUST NOT implement authentication, user accounts, or sessions. No PII
beyond the submitted identifier value SHALL be stored. Submitted identifiers MUST
be bound to a 30-day retention window and automatically purged. Rate-limit cookies
MUST use random opaque IDs that cannot identify a user. The system MUST NOT collect
private or breached data — only publicly discoverable information. Expired lookups
MUST resolve to a designed expired state with a one-click re-run option.

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

**Version**: 1.0.0 | **Ratified**: 2026-06-06 | **Last Amended**: 2026-06-06

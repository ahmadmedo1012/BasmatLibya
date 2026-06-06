# Constitution Amendment 001 — Telegram Auth (Proposal)

**Status**: Draft (post-feature-005)
**Author**: feature 005 audit-and-repair workflow
**Target file**: `.specify/memory/constitution.md`
**Target version**: 1.0.0 → 1.1.0 (MINOR — scoped rewrite of Principle III, no principle removed)
**Route**: submit through `/speckit.constitution` after feature 005 ships

---

## 1. Background

Feature 005 (`005-audit-repair-core`) is a *repair*, not a redesign. It restores
the Telegram sign-in flow (User Story 1) and the visitor-cookie-based rate
limit / coalescing (User Story 2) to a working state. The shipped product has
shipped a Telegram-auth system since feature 002; the product surface, the DB
schema, the cookie posture, and the operator's deploy contract all assume
auth is present.

The Constitution v1.0.0 Principle III states:

> The system MUST NOT implement authentication, user accounts, or sessions. No
> PII beyond the submitted identifier value SHALL be stored. ...

This is a direct contradiction with the shipped product, and feature 005 cannot
delete the auth system without breaking the user-visible behaviour the spec
asks to repair. The conflict was disclosed in the feature 005 plan's
Complexity Tracking and surfaced by `/speckit.analyze` as a CRITICAL finding
(gates the deliverable: NO, blocks implementation: NO — per the analyze rules,
violations must be addressed in a separate governance proposal, not silently
deferred).

This document is that governance proposal.

## 2. Current vs. proposed text

The current Principle III is a single paragraph. The proposed Principle III
keeps the privacy intent but (a) explicitly permits a single documented
exception (first-party Telegram sign-in for trial/abuse-control), (b) lists
the eight binding sub-clauses that exception MUST respect, and (c) codifies
the two adjacent entities (`basmat_visitor` cookie, `OWNER_TELEGRAM_ID` admin
role) that exist in the product but were not previously named in the
constitution.

The full proposed replacement is in `constitution.md` (this directory). The
delta vs. v1.0.0 is:

| Aspect | v1.0.0 | v1.1.0 (proposed) |
|--------|--------|-------------------|
| Telegram Login Widget | Forbidden (no auth, no accounts) | Permitted, scoped to "first-party sign-in for trial/abuse-control" |
| `users` table fields | Forbidden | Permitted: `telegramId`, `displayName`, `username`, `avatarUrl` ONLY |
| `sessions` table | Forbidden | Permitted, with sha256-hashed token, 30-day default, 90-day cap |
| `bsl_session` cookie | Forbidden | Permitted: HttpOnly, Secure (prod), SameSite=Lax |
| `basmat_visitor` cookie | Implicit (rate-limit cookies MUST be random opaque) | Explicitly named; sha256-hashed; rate-limit + coalescing only; not cleared on sign-out |
| `OWNER_TELEGRAM_ID` | Not named | Explicitly named; single-admin model; server-controlled elevation on every sign-in |
| 30-day submitted-identifier retention | Present | Unchanged |
| Behavioural tracking | Not named | Explicitly forbidden |
| Cross-user social features | Not named | Explicitly forbidden |
| Public-source-only data | Present | Unchanged; future providers MUST be reviewed before enable |
| Expired-lookup UX | Present | Unchanged |

No principle is removed. The product is brought into compliance with the
amended text without code changes beyond the in-scope repair.

## 3. Rationale

The original Principle III reads as if the product were auth-less. The product
is not. Three concrete reasons to amend rather than to delete the auth system:

1. **The user explicitly asked to repair the auth flow.** Feature 005's spec
   frames the failure as "login does not survive redirect/refresh" and asks
   for the existing Telegram-only sign-in to be restored. Deleting the auth
   system would require a re-spec (different feature) and a different user
   story ordering.
2. **The 30-day trial gate requires an anonymous identity.** Whether the
   product uses a visitor cookie or a session, it needs *something* to rate-
   limit anonymous users. The current visitor cookie is already a "session"
   in the strict reading of v1.0.0's Principle III. The amendment names it
   explicitly so the principle no longer contradicts the implementation.
3. **The single-admin model is operationally necessary.** A `basmatly`-
   branded Arabic-first product on a single Neon Postgres + Render deploy
   has one operator, not many. The `OWNER_TELEGRAM_ID` model is the simplest
   governance shape that supports this and is already implemented.

The amendment also adds two negative clauses (no behavioural tracking, no
social graph) that the original Principle III did not name but the spec's
privacy intent implies. They make the principle harder to drift against.

## 4. Alternatives considered

### 4.1. Block feature 005 on an amendment first — REJECTED

- **Why tempting**: the analyze rules say governance must precede
  implementation.
- **Why rejected**: feature 005 is the user's stated priority; the
  amendment can be drafted in parallel (Phase 0, T001) and ratified after
  the repair ships. Blocking the implementation would mean leaving the
  reported defects in production while governance is in flight.
- **What we did instead**: drafted the amendment now (this file), ran
  feature 005 in parallel, and surface the amendment for ratification as
  the very next governance step.

### 4.2. Rewrite the product to be auth-less — REJECTED

- **Why tempting**: would bring the product into literal compliance with
  the original Principle III.
- **Why rejected**: would require (a) deleting the `users` and `sessions`
  tables, (b) deleting the Telegram Login Widget, (c) re-designing the
  trial gate, (d) re-designing the admin path (currently
  `OWNER_TELEGRAM_ID`-gated), (e) re-issuing a new spec. This is a
  different feature and a different user story. Out of scope for the
  repair.

### 4.3. Two-section constitution (core vs. trial/visitor) — REJECTED IN FAVOUR OF THE PROPOSAL

- **Why tempting**: a structural split would let the auth-bearing services
  live under a different "section" while leaving Principle III strictly
  correct for the trial/visitor surface.
- **Why rejected**: the split creates two principles with overlapping
  surface (the same `users` row participates in both auth and trial), and
  the operational rule "all auth-bearing services go in section B" would
  require future contributors to classify each new feature, which is more
  error-prone than a single, scoped principle. The current proposal
  replaces Principle III in place with a scoped text that names the
  exception explicitly.

### 4.4. Status quo (no amendment, accept drift) — REJECTED

- **Why rejected**: an unratified constitution is a documentation-only
  artefact. Without a version bump and a Sync Impact Report, future
  contributors will read v1.0.0's Principle III literally, conclude the
  auth system is a violation, and either refuse to merge auth-bearing
  fixes or delete the auth system by accident. Drift is the worst of the
  four options.

## 5. Migration plan

The amendment requires zero code changes; it is a *governance* change. The
required actions are:

1. **Replace** `.specify/memory/constitution.md` with the proposed v1.1.0
   text from this directory.
2. **Bump** the version line to `1.1.0`, update the Last Amended date.
3. **Update** feature 005's `plan.md` Complexity Tracking: the G3 entry
   stays (historical record of the violation), with a one-line note that
   the conflict is resolved by the v1.1.0 ratification.
4. **Update** `AGENTS.md` and `CLAUDE.md` to reference v1.1.0.
5. **Re-run** `/speckit.analyze` against the amended constitution. The
   CRITICAL finding should drop to PASS.
6. **Communicate** the amendment in the next feature's plan template (one
   paragraph in the Constitution Check section) so contributors are
   reminded that Principle III is now scoped, not absolute.

## 6. Open questions for ratification

These can be decided in the `/speckit.constitution` review:

- Q1: Should the visitor cookie's 180-day lifetime be enshrined in the
  constitution, or left to the implementation? (Current proposal: left to
  the implementation, but with the explicit constraint that it MUST NOT
  identify a user.)
- Q2: Should the `users` table fields be a closed list (current proposal)
  or a "no PII beyond Telegram public profile" sentence? (Closed list is
  more auditable; sentence is more future-proof.)
- Q3: Is the "single admin" model a permanent product decision, or is the
  expectation that v2 will add role-based admin? (Current proposal:
  permanent; v2 would require its own amendment.)

## 7. Submission

This proposal is ready to be submitted through `/speckit.constitution` once
feature 005 ships. The amendment is ratifiable as-is; the three open
questions in §6 are minor and can be settled in the review session.

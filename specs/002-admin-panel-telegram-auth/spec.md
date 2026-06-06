# Feature Specification: Premium Redesign, Telegram Login, and Owner Admin Panel

**Feature Branch**: `002-admin-panel-telegram-auth`

**Created**: 2026-06-04

**Status**: Draft

**Input**: User description: "اريد تحسين التصميم لاعلى مستوى ممكن, انشاء طريقة دخول بتليقرام فقط حاليا. انشاء لوحة تحكم لي كمالك لاضافة نماذج ذكاء وادارة المستخدمين والتحكم الشامل في الموقع."

> Translation: "Lift the design to the highest possible level. Add a login method that, for now, is Telegram-only. Build an owner admin panel where I can add AI models, manage users, and exercise full control over the site."

This feature evolves the v1 anonymous Digital Footprint Analyzer (`001-digital-footprint-analyzer`) by adding (a) a polished premium visual redesign across every public surface, (b) a Telegram-only authentication flow that introduces a real user identity for the first time, and (c) a private owner-only admin panel for AI provider configuration, user management, and global site controls.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in with Telegram and continue using the platform (Priority: P1)

A visitor lands on the redesigned Arabic-first home page and sees a single, prominent "تسجيل الدخول عبر تليجرام" (Sign in with Telegram) action. They authenticate through Telegram, return to the platform identified by their Telegram account (display name and avatar), and from that point onward perform lookups under their identity. No other login method is offered.

**Why this priority**: The whole feature is gated on identity. Without a working Telegram sign-in, neither the admin panel nor any account-bound site control can exist. It is the entry point of every other story in this spec.

**Independent Test**: A new visitor with no prior session can complete sign-in entirely through Telegram (no password, no email, no other provider visible) and reach the home page in a logged-in state showing their Telegram display name and avatar in the header. Successful when sign-in completes end-to-end without any non-Telegram credential being requested, and when reloading the page preserves the session.

**Acceptance Scenarios**:

1. **Given** a visitor on the redesigned home page, **When** they click "تسجيل الدخول عبر تليجرام", **Then** they are guided through the Telegram authentication flow and returned to the home page in an authenticated state with their Telegram display name and avatar visible in the header.
2. **Given** a signed-in user closes and reopens the browser within the session lifetime, **When** they reopen the site, **Then** they remain signed in with no re-authentication required.
3. **Given** an authenticated user clicks "تسجيل الخروج" (sign out), **Then** the session is terminated, the header reverts to the unauthenticated state, and re-entering protected surfaces requires a fresh Telegram sign-in.
4. **Given** Telegram is unreachable or the user cancels the Telegram flow mid-way, **When** they return to the platform, **Then** they see a designed Arabic-language sign-in failure state with a clear retry control, never a raw error page.
5. **Given** a returning user who previously signed in with the same Telegram account, **When** they sign in again, **Then** they land on the same identity (no duplicate account is created) and any prior account-bound state (lookup history, role) is preserved.

---

### User Story 2 - Owner opens the admin panel and exercises full site control (Priority: P1)

The single designated site owner signs in (via Telegram, like everyone else) and gains access to a private admin panel route that no other user can see or reach. From the panel, the owner can: register and configure AI model providers, list and manage all users (including promoting, suspending, or removing them), view and revoke active sessions, adjust global site settings (retention windows, rate-limit thresholds, public-facing toggles), and review aggregate platform activity.

**Why this priority**: The owner's ability to operate the platform without database surgery is the second pillar of this feature. Without it, the platform cannot be evolved or moderated post-launch, and the new auth/AI capabilities are unusable in practice. P1 alongside Story 1 because both are required for an MVP slice.

**Independent Test**: An account marked as the owner signs in and opens the admin entry; the panel renders with the three core sections (AI models, users, site settings) in Arabic RTL; a non-owner authenticated user attempting the same path is denied. Successful when the owner can perform at least one create, one update, and one destructive action in each section, and the changes take effect on the public site without a redeploy.

**Acceptance Scenarios**:

1. **Given** the owner is signed in, **When** they navigate to the admin entry, **Then** the admin panel renders in Arabic RTL with at least three navigation areas: AI Models, Users, and Site Settings.
2. **Given** a non-owner authenticated user attempts to open the admin entry directly via URL, **Then** they are blocked with a designed "غير مصرح" (not authorized) state and the admin UI never renders, even partially.
3. **Given** the owner opens the AI Models section, **When** they add a new AI model entry (provider, model identifier, credentials, status), **Then** the entry is saved, listed, and immediately available to be selected as the active model for result enrichment.
4. **Given** the owner opens the Users section, **When** they suspend a user, **Then** that user's existing sessions are invalidated and the user is blocked from signing in again until the suspension is lifted, all without restarting the service.
5. **Given** the owner edits the global retention window in Site Settings, **When** they save the change, **Then** the new window applies to all subsequent lookups and the public expired-state behavior reflects the new value.
6. **Given** the owner views the Users section, **When** they filter by status (active, suspended) or sort by recent activity, **Then** the list responds without a full page reload and pagination remains usable on mobile widths.

---

### User Story 3 - Premium redesign across every public surface (Priority: P1)

The home page, lookup intake, live progress, result page, all empty/degraded/expired/error states, sign-in flow, and the admin panel itself adopt a single coherent premium visual system: confident typographic scale tuned for Arabic, generous whitespace, restrained color, motion used to communicate state rather than decorate, and a single primary action per surface. The redesign is not cosmetic polish on top of the existing UI — it is a re-take of the visual language applied consistently everywhere.

**Why this priority**: The user explicitly asked for the design to be lifted to the highest level possible, and the new auth + admin surfaces are part of the redesign. Treating the redesign as a separate later pass would leave half the product looking like the old v1 and half looking like the new vision; that inconsistency is itself a regression.

**Independent Test**: A reviewer walks through every public surface (home, sign-in, in-progress, result, share, expired, error, admin sections) on both a desktop width and a mobile width, in Arabic RTL, and confirms that all surfaces visibly belong to the same design system and that none retain v1 styling. Successful when the design audit passes for 100% of the surfaces enumerated above.

**Acceptance Scenarios**:

1. **Given** a visitor on any redesigned public surface, **When** they switch between desktop and mobile widths, **Then** the layout adapts without horizontal scroll, broken bidirectional text, or icons that should not be mirrored.
2. **Given** a reviewer compares the visual language of the home page, the result page, and the admin panel, **Then** typography scale, spacing rhythm, color usage, and motion principles are visibly consistent across the three.
3. **Given** a user with reduced-motion preferences set at the OS level, **When** they navigate the redesigned UI, **Then** decorative animations are suppressed while state-communicating motion (progress, transitions between empty/loading/loaded) remains functional.
4. **Given** a screen-reader user navigates the redesigned UI in Arabic, **Then** focus order, announced labels, and reading order follow RTL conventions on every redesigned surface, including the admin panel.

---

### User Story 4 - Authenticated user manages their own footprint history (Priority: P2)

A signed-in user opens "سجلّي" (my history) and sees the lookups they have run while signed in, ordered by recency, each linking to the existing polished result page. They can remove an entry from their history (which removes their personal association, distinct from the existing public retention behavior).

**Why this priority**: Once identity exists, attaching previous lookups to it is the obvious benefit for the user. It is P2 — not P1 — because the platform still delivers core value without it; Stories 1 and 2 are what unblock the rest of the feature.

**Independent Test**: A signed-in user runs at least two lookups, opens "سجلّي", sees both, removes one, and verifies it disappears from their history while the other remains. Successful when the history view renders in Arabic RTL, supports pagination, and never displays a lookup that does not belong to the current user.

**Acceptance Scenarios**:

1. **Given** a signed-in user with prior lookups, **When** they open "سجلّي", **Then** they see only their own lookups, most recent first, with title, identifier preview, timestamp, and a link to the polished result.
2. **Given** a signed-in user with no prior lookups, **When** they open "سجلّي", **Then** they see a designed empty-state in Arabic that invites them back to the home page to run their first lookup.
3. **Given** a signed-out visitor, **When** they attempt to open the history route, **Then** they are redirected to the sign-in flow and, upon successful sign-in, returned to the history view.

---

### Edge Cases

- A user signs in with Telegram, then later changes their Telegram display name or avatar; the next time they return to the platform, the displayed identity reflects the change without creating a duplicate account.
- The Telegram authentication payload arrives with a tampered or expired signature; the platform rejects the sign-in attempt with a designed error and logs the event without creating a user record.
- The owner attempts to suspend or demote themselves; the platform blocks the action with a clear Arabic message to prevent the platform from being left without an owner.
- The owner adds an AI model entry with invalid or revoked credentials; the platform validates the entry on save and surfaces a designed inline error in Arabic without persisting a broken entry as active.
- The admin user list grows beyond what fits in a single screen; the list paginates, supports filter/sort, and remains performant on mobile widths.
- Two browser tabs from the same authenticated user perform conflicting admin actions on the same entity (e.g., suspend / unsuspend the same user simultaneously); the second action either supersedes the first cleanly or surfaces a designed conflict state in Arabic, never silent inconsistency.
- A previously-signed-in user is suspended while they have active tabs open; their next protected action surfaces a designed "تم تعليق حسابك" (your account has been suspended) state and signs them out gracefully.
- The redesign is loaded on a slow connection (3G-class); the home page reaches first interactive state within the success-criteria budget and the sign-in action is interactive before the rest of the page hydrates.
- An admin attempts to delete the currently-active AI model; the platform either blocks the deletion or requires the owner to designate a replacement first, never leaving the public site with no active model.

## Requirements *(mandatory)*

### Functional Requirements

#### Authentication

- **FR-001**: The system MUST offer Telegram as the only authentication method on the public site for the v1 of this feature; no email/password, no other social provider, and no anonymous-with-account-creation flow MUST be exposed in the UI.
- **FR-002**: The system MUST verify the authenticity and freshness of every Telegram authentication payload before creating or resuming a session, and MUST reject tampered or expired payloads with a designed Arabic-language error rather than a generic failure.
- **FR-003**: The system MUST establish a server-side session upon successful Telegram authentication and MUST persist the session across page reloads and browser restarts up to a defined session lifetime.
- **FR-004**: The system MUST treat the Telegram account identifier as the stable user identity, so that returning users with the same Telegram account always resolve to the same internal user record and never produce duplicates.
- **FR-005**: The system MUST provide a visible "تسجيل الخروج" (sign out) control that fully terminates the current session and returns the user to an unauthenticated state.
- **FR-006**: The system MUST surface a designed Arabic-language fallback state for sign-in failure, cancellation, and Telegram unavailability, with a clear retry control and no exposure of underlying provider errors.

#### Authorization & Roles

- **FR-007**: The system MUST recognize at least three roles: owner (single), authenticated user, and unauthenticated visitor. Whether unauthenticated visitors may run lookups MUST be governed by the public-lookup site setting (FR-021); the default for this feature is that unauthenticated visitors MAY run lookups (preserving the v1 zero-friction behavior), and the owner MAY disable public lookups at any time from the admin panel.
- **FR-008**: The system MUST enforce that only the owner role can reach any admin route or admin-only API; non-owner authenticated users and unauthenticated visitors MUST be blocked with a designed "غير مصرح" state and the admin UI MUST NOT render even partially for them.
- **FR-009**: The system MUST identify the owner via operator configuration (e.g., an environment variable holding the owner's Telegram identifier) set outside of the public sign-up flow. When a Telegram sign-in succeeds and the resolved Telegram identity matches the configured owner identifier, that user record MUST be granted the owner role automatically (on first sign-in or on every sign-in for the configured account). The owner role MUST NOT be self-claimable by any user whose Telegram identity does not match the configured value, and changing the configured owner identifier MUST require redeploying / restarting with the new operator configuration.
- **FR-009a**: For this initial deployment, the owner is the holder of the Telegram account associated with phone number `+218 091 008 9975`. The operator configuration MUST be populated with the Telegram identifier corresponding to that account (the exact form — Telegram numeric user ID resolved from the phone number, or the phone number itself, depending on the Telegram authentication mechanism chosen at planning) so that the owner role is granted to that account on its first successful Telegram sign-in.
- **FR-010**: The system MUST prevent the owner from performing actions that would leave the platform without a reachable owner (e.g., suspending themselves, removing the last owner role).

#### Admin Panel — AI Models

- **FR-011**: The system MUST allow the owner to register one or more AI model entries — each entry MUST capture, at minimum: provider, model identifier, credentials, optional display label, status, system prompt, temperature, maximum output length, and any other generation parameters the active provider exposes — and the system MUST allow the owner to list, edit, deactivate, and delete entries. Each parameter MUST be editable from the admin UI without redeploying the service.
- **FR-012**: The system MUST validate AI model credentials at the moment the entry is saved or marked active, and MUST surface a designed inline Arabic error when validation fails, without persisting the failing entry as active.
- **FR-013**: The system MUST support designating one AI model entry as the active model used for result enrichment; the active model MUST be replaceable without service restart, and the public site MUST never be left with no active model when one was previously set, unless the owner explicitly deactivates enrichment.
- **FR-014**: The system MUST treat AI model credentials as secrets: they MUST be write-only from the admin UI's perspective (never displayed back in plaintext), MUST be redacted in logs, and MUST never appear in any public response.
- **FR-015**: The scope of "AI model entry" in this feature is limited to configuring external provider models accessible via API (e.g., OpenAI, Anthropic, Google, or any other API-accessible model provider) together with their advanced generation parameters (system prompt, temperature, maximum output length, and other provider-exposed generation parameters). Uploading, hosting, or training custom on-platform models is explicitly out of scope for this feature.

#### Admin Panel — Users

- **FR-016**: The system MUST allow the owner to list all registered users with at least: Telegram display name, Telegram account identifier, role, status (active/suspended), join date, and last-activity timestamp.
- **FR-017**: The system MUST support filtering the user list by status and role, and sorting by join date and last activity, with pagination that remains usable on mobile widths.
- **FR-018**: The system MUST allow the owner to suspend a user, lift a suspension, and remove a user; suspension MUST take effect immediately for that user across all their open sessions.
- **FR-019**: When the owner suspends or removes a user, the public side MUST gracefully degrade for that user (their existing protected actions are blocked with a designed Arabic state) without leaking the suspension to other users.
- **FR-020**: The system MUST allow the owner to view a user's lookup history within the admin panel without altering that user's own history view.

#### Admin Panel — Site Settings

- **FR-021**: The system MUST expose, at minimum, the following operator-tunable settings to the owner via the admin panel: lookup retention window, per-visitor rate-limit thresholds, per-identifier rate-limit thresholds, public toggle for AI enrichment, and public toggle for whether unauthenticated visitors may run lookups.
- **FR-022**: Changes to site settings MUST take effect for subsequent traffic without a service restart and MUST be reflected on the public site within a short, predictable propagation window.
- **FR-023**: The system MUST log every admin action (who, what, when, before/after value) to an audit trail visible to the owner.

#### Premium Redesign

- **FR-024**: The system MUST apply a single coherent visual design system across every public surface — home, sign-in, in-progress, result, share, expired, error, history, and the admin panel itself — such that all surfaces visibly belong to the same product.
- **FR-025**: The system MUST default to Arabic and MUST render every redesigned surface in right-to-left layout, including form controls, navigation, progress indicators, modals, toasts, error states, and the admin panel.
- **FR-026**: The redesigned surfaces MUST present a single primary action per surface, restrained color usage, typography tuned for Arabic at small and large sizes, and motion that communicates state changes rather than decorates.
- **FR-027**: The redesigned surfaces MUST honor user accessibility preferences (including reduced-motion) and MUST meet WCAG 2.1 AA as a baseline, with explicit attention to RTL screen-reader behavior on the admin panel.
- **FR-028**: The redesign MUST NOT regress any v1 user-facing capability of the Digital Footprint Analyzer (`001-digital-footprint-analyzer`); every existing surface either gets a redesigned counterpart or is intentionally retired with documented rationale.

#### Audit & Observability

- **FR-029**: The system MUST log authentication events (sign-in attempt, success, failure with reason class, sign-out, session expiry) and admin actions in a structured form sufficient to diagnose a single account end-to-end.
- **FR-030**: The system MUST never log Telegram authentication signatures, raw payloads, or AI model credentials.

### Key Entities *(include if feature involves data)*

- **User**: A person identified by their Telegram account. Attributes: internal user identifier, Telegram account identifier (stable), Telegram display name (mutable, kept in sync), avatar reference (mutable, kept in sync), role (owner / user), status (active / suspended), join timestamp, last-activity timestamp.
- **Session**: A signed-in browsing context for a user. Attributes: session identifier, parent user, issued timestamp, last-seen timestamp, expiry timestamp, originating client signature (for invalidation on suspension).
- **AI Model Entry**: A registered external model usable for result enrichment. Attributes: entry identifier, provider, model identifier, display label, credential reference (stored as a secret), status (active / inactive / invalid), system prompt, temperature, maximum output length, additional provider-specific generation parameters, validated-at timestamp, created-by, created-at, last-updated-by, last-updated-at.
- **Site Setting**: A single tunable global control. Attributes: setting key, current value, value type, last-updated-by, last-updated-at, default value.
- **Audit Log Entry**: A single recorded admin or auth event. Attributes: event identifier, actor user, event class (auth / admin), event subclass, target entity reference, before-value, after-value, timestamp, originating client signature.
- **User Lookup Association**: The link between a signed-in user and lookups they ran. Attributes: parent user, parent lookup (from `001-digital-footprint-analyzer`), associated-at timestamp, hidden-by-user flag.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 99% of Telegram sign-in attempts that complete the Telegram side of the flow successfully establish a usable session on the platform within 3 seconds, measured at the 90th percentile.
- **SC-002**: Across every public surface (home, sign-in, in-progress, result, share, expired, error, history, admin AI Models, admin Users, admin Site Settings), 100% render in correct right-to-left layout in Arabic with no untranslated English copy in user-facing chrome.
- **SC-003**: A non-owner authenticated user attempting any admin route or admin-only API receives a designed unauthorized state in 100% of attempts, with zero leakage of admin UI fragments or admin data into the response.
- **SC-004**: The owner can complete each of the following round-trips, end-to-end through the admin UI without leaving the panel, in under 60 seconds at the 90th percentile: register a new AI model, designate a different AI model as active, suspend a user, lift a suspension, and change the retention window.
- **SC-005**: A change made by the owner to any site setting in the admin panel is reflected on the public site within 30 seconds without a service restart, in 95% of changes.
- **SC-006**: A redesign audit across the surfaces enumerated in FR-024 confirms a single coherent visual system on 100% of surfaces and identifies zero retained v1 styling in the redesigned scope.
- **SC-007**: Across the first 500 sign-in attempts in production, the share of attempts that fail solely due to platform-side handling (i.e., Telegram returned success) is below 1%.
- **SC-008**: 95% of admin user-list interactions (load, filter, sort, paginate) complete and become interactive within 1 second on a representative 4G-class connection.
- **SC-009**: For 100% of admin actions performed by the owner, a corresponding audit log entry is recorded with actor, target, before-value, after-value, and timestamp, and is retrievable from the admin panel.

## Assumptions

- The audience and language posture are unchanged from `001-digital-footprint-analyzer`: Arabic-first, RTL throughout, with source-native content (e.g., Latin-script usernames or English snippets) rendered as data inside the otherwise-Arabic chrome.
- "تليجرام فقط حاليا" (Telegram-only for now) is interpreted as: in this feature, Telegram is the single user-facing authentication method. Adding additional providers later is out of scope here and is allowed to be additive in a future spec.
- There is exactly one owner of the platform, and that owner is the user who issued this feature request. The owner role is administrative and is distinct from any future moderator/staff roles, which are out of scope for this feature.
- The existing anonymous, no-login lookup behavior introduced in `001-digital-footprint-analyzer` is the starting baseline. Whether public lookups continue to be available to unauthenticated visitors after this feature ships is treated as an operator-tunable site setting (FR-021) and is decided by the clarification on FR-007.
- "أعلى مستوى ممكن" (highest possible level) for design is interpreted as: a single coherent premium visual system across every surface listed in FR-024, with WCAG 2.1 AA as a baseline and Arabic-first typographic care, rather than a specific named design language.
- "نماذج ذكاء" (AI models) in this spec means external provider models that the platform consumes via API for result enrichment, with advanced per-model customization (system prompt, temperature, maximum output length, and other provider-exposed generation parameters) editable from the admin panel. On-platform model upload/training is out of scope.
- The initial owner is the holder of the Telegram account associated with phone number `+218 091 008 9975`. The exact technical form of the owner identifier in operator configuration (Telegram numeric user ID resolved from that phone number, or the phone number itself) is decided at planning time based on the Telegram authentication mechanism chosen, and does not change the spec.
- AI model credentials and Telegram authentication payloads are secrets; they are write-only from the admin UI's perspective, redacted in logs, and never returned in any public response.
- Session lifetime, exact rate-limit thresholds, retention window, and reduced-motion thresholds are operational parameters tunable from the admin panel (FR-021) and do not need to be fixed in this spec.
- The technical stack remains the one fixed by the project owner for `001-digital-footprint-analyzer` and is documented in the implementation plan rather than this spec.

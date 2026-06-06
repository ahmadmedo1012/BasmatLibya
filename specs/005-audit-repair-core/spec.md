# Feature Specification: Full Audit & Repair of Core App

**Feature Branch**: `005-audit-repair-core`

**Created**: 2026-06-06

**Status**: Draft

**Input**: User description: "Perform a full audit and repair of the current project. The app is currently broken in key flows, especially: login does not persist after redirect or reload; core services such as search are not working; the site behaves as if the main functionality is disabled. Inspect the entire codebase carefully, identify the root cause of authentication/session failure, verify routing, state persistence, API wiring, and environment configuration; restore all broken services and core user flows; ensure login remains active after redirect and page refresh; make search and all other main features work end-to-end; fix any frontend, backend, database, deployment, or environment issues causing the app to fail; remove broken code, dead paths, and invalid assumptions; validate the full application flow after repair. Preserve Arabic RTL support and premium UI quality."

## User Scenarios & Testing *(mandatory)*

<!--
  Each story below is a slice of the broken product that, once fixed, can be
  shipped and verified independently. They are ordered so that completing P1
  alone restores baseline usability; P2 restores premium value; P3 hardens
  the platform.
-->

### User Story 1 - Returning visitor stays signed in after refresh and redirect (Priority: P1)

A visitor opens the site, signs in once using the Telegram login, and from that moment on the platform recognises them as the same person — across page refreshes, navigations away and back, opening new tabs of the same site, and after the post-login redirect lands them on their target page. They never see the public/anonymous header right after a successful sign-in, and they are never silently logged out while the session is supposed to be valid.

**Why this priority**: This is the most visible failure today. Without a session that survives a redirect or a reload, every premium feature (history, plans, admin, unlimited search) is unreachable in practice. Restoring this single guarantee makes the rest of the product usable.

**Independent Test**: Sign in via Telegram on a clean browser profile, observe the post-redirect page shows the signed-in header with the user's name and avatar, then hard-refresh the page (and separately, close and reopen the tab) and confirm the signed-in state persists with no flicker back to "Sign in". Clicking the sign-out button must end the session everywhere, including any other open tab of the same site.

**Acceptance Scenarios**:

1. **Given** an anonymous visitor on the home page, **When** they complete the Telegram sign-in flow (popup or redirect mode), **Then** the page they land on immediately renders as a signed-in session (their display name and avatar are shown in the top bar, the "Sign in" button is gone, and the bottom-nav account icon goes to the signed-in account, not the sign-in page).
2. **Given** a successfully signed-in user on any route, **When** they hard-refresh the browser (Ctrl/Cmd+R or F5), **Then** the page reloads with the same signed-in identity, with no transient "Sign in" state shown after the initial render settles.
3. **Given** a signed-in user, **When** they close the tab and reopen the site URL within the session lifetime, **Then** they are still signed in.
4. **Given** a signed-in user with the site open in two tabs, **When** they sign out from one tab, **Then** the other tab is forced back to the sign-in screen the next time it is focused (or sooner via the realtime session-invalidation channel).
5. **Given** a user who tried to access a protected route while anonymous and was sent to sign-in with a `next` target, **When** they complete sign-in, **Then** they are taken to the original `next` target (and not always to the home page) — including when the sign-in completes via the redirect flow rather than the popup flow.
6. **Given** a visitor whose session has been revoked, suspended, or expired server-side, **When** they next interact with the app, **Then** they are routed to the appropriate state page (`/suspended`, `/sign-in`, or `/not-authorised`) with a clear Arabic message — they never see a half-signed-in UI that immediately fails on the next click.

---

### User Story 2 - Anonymous and signed-in visitors can run a search end-to-end (Priority: P1)

A visitor — whether anonymous (within their free trial) or signed in — enters an identifier (name, username, email, or phone) on the home page and is taken through the full search flow without dead ends: the request is accepted, progress is shown in real time across the five analysis categories, and the result page renders the findings with the AI enrichment summary in Arabic RTL. Errors, when they happen, are explained in Arabic and offer the user a clear next step.

**Why this priority**: Search is the product. If a user cannot submit an identifier and watch it complete to a result, the platform has no value. This must work for both the anonymous free-trial and the signed-in usage path.

**Independent Test**: From a clean browser, submit any valid identifier on the home page as an anonymous user; observe the progress page advances category-by-category (no permanent "queued" rows, no infinite spinner), then automatically transitions to the result page where findings and the Arabic enrichment summary are displayed without console errors. Repeat the same end-to-end run while signed in and confirm trial counters are not consumed.

**Acceptance Scenarios**:

1. **Given** an anonymous visitor with remaining free-trial credits, **When** they submit a valid identifier (name, username, email, or phone), **Then** the search is accepted, they are taken to the progress page within 1 second, and the trial remaining counter is decremented on the home page after the redirect.
2. **Given** a visitor on the progress page for a running lookup, **When** the analysis runs, **Then** each of the five categories transitions through `queued → running → completed`/`failed`/`skipped` driven by realtime push events, and the overall progress bar advances accordingly without requiring a manual refresh.
3. **Given** a lookup that completes, **When** the final event fires, **Then** the user is automatically navigated to the result page within 2 seconds and the page renders findings grouped by category with the correct Arabic copy, confidence badges, source labels, and the AI enrichment summary section.
4. **Given** a visitor whose free-trial credits are exhausted, **When** they submit a search, **Then** a paywall modal is shown with a clear Arabic explanation and a working "Sign in / view plans" CTA — they are not silently blocked.
5. **Given** a signed-in user, **When** they submit a search, **Then** the trial gate is bypassed (no free-trial limit is enforced) and the lookup runs to completion just like the anonymous flow, only without trial counters in the UI.
6. **Given** a visitor with a flaky network or where realtime events are blocked, **When** they remain on the progress page, **Then** the page still recovers to the final result (via reconnection and replay or fallback polling) rather than being stuck on a stale progress state indefinitely.
7. **Given** a visitor opens a direct deep link to a finished lookup result URL, **When** the page loads, **Then** the result renders correctly without requiring them to go through the progress page first.

---

### User Story 3 - Operator can deploy the app and verify end-to-end health in one pass (Priority: P2)

A maintainer with the documented environment variables can build, deploy, and bring the platform to a healthy state on the configured target (Render + managed Postgres) such that, after the deploy completes, both the sign-in and the search flows from Stories 1 and 2 work on the first try with no manual hot-fix. The healthcheck endpoint reports green, the database schema is at the expected version, and the platform owner is recognised as `owner` (not as a regular user) when they sign in.

**Why this priority**: Stories 1 and 2 cannot be guaranteed unless the deployment shape itself is repeatable. Today the app deploys and then needs a sequence of one-off fixes before users can do anything; this story makes the deploy itself the contract.

**Independent Test**: From the documented environment variable set, perform a clean deploy to a staging instance. Verify (a) the healthcheck endpoint returns OK, (b) the database migrations have all applied to the latest version, (c) the configured owner can sign in via Telegram and is shown the admin link, (d) an anonymous visitor on the same staging URL can run a search to completion, all without manual database edits or container exec'ing in between.

**Acceptance Scenarios**:

1. **Given** the documented set of required environment variables is provided to the target environment, **When** the deploy runs, **Then** the application starts, the healthcheck endpoint returns a healthy response, and no required configuration is silently missing.
2. **Given** a missing or invalid required environment variable, **When** the app starts, **Then** it fails fast with a clear, actionable message naming the missing variable — it does not start in a degraded state that looks healthy but breaks at first user request.
3. **Given** a deployed instance, **When** the schema-migration step runs, **Then** the database is migrated to the version the running code expects, and the app refuses to serve traffic if migrations have not completed.
4. **Given** the configured owner's Telegram account, **When** that account signs in for the first time on the deployed instance, **Then** their session is created with `owner` role and they see the admin navigation entry.
5. **Given** the deployed instance is being served behind HTTPS at the configured public base URL, **When** any browser interacts with it, **Then** session cookies are issued with `Secure`, `HttpOnly`, and an appropriate `SameSite` posture that survives the Telegram OAuth round-trip — they are neither rejected by the browser nor leaked over HTTP.

---

### User Story 4 - The codebase reflects the actual product, with no dead or contradictory paths (Priority: P3)

A new contributor reading the repository can tell, at a glance, which deployment target is real, which features are wired up, and which code is dead. There are no leftover artefacts from abandoned migrations (e.g., a static-only GitHub Pages workflow when the app is server-rendered, or a `socket.io` client when realtime has been removed), no stub modules whose behaviour silently swallows the feature they're supposed to provide, and no environment variables that the running code does not read.

**Why this priority**: The current "broken in subtle ways" feel comes largely from contradictory layers left behind by partially completed pivots (static → full-stack → back). Cleaning this up prevents the same class of breakage from recurring and makes future repairs cheap.

**Independent Test**: Walk the repository top-down. Every script in `package.json` and every file in `apps/`, `packages/`, and the deployment configs (Dockerfile, render.yaml, docker-compose.yml, CI workflows) corresponds to a path that is actually executed in the current product. Every documented environment variable is either required or marked optional with a defined fallback. No file references a sibling that was deleted in a previous pivot, and no exported symbol is imported only by tests.

**Acceptance Scenarios**:

1. **Given** the README and root-level documentation, **When** a contributor reads it, **Then** the described stack, deployment target, and quick-start commands match what actually runs and deploys.
2. **Given** the source tree, **When** an auditor lists imported modules, **Then** every module that is imported still exists and exports the symbols its consumers depend on; no client module imports server-only APIs or vice-versa.
3. **Given** the environment-variable schema in code and the documented `.env.example`, **When** they are compared, **Then** every variable the schema declares as required is in the example file, every variable the example file documents is read by the running code, and there are no orphaned variables in either direction.
4. **Given** the CI/CD configuration, **When** it runs on push to the main branch, **Then** it deploys to exactly one target (the current production target) — there are no leftover workflows that publish the app to a different target with different behaviour.

---

### Edge Cases

- **Telegram OAuth domain mismatch**: The bot is configured at BotFather with a domain that does not match the deployed public URL. The sign-in flow must surface a clear, actionable Arabic error pointing at the misconfiguration rather than silently leaving the user on a half-loaded widget.
- **Popup blocked by browser**: When the Telegram Login Widget falls back from popup to top-level redirect, the post-redirect handler must still pick up the auth payload (from the URL hash or query) and complete sign-in once — without double-submitting it on the inevitable second mount in React Strict Mode.
- **Stale cookie with revoked session**: A user holds a session cookie whose row has been revoked or expired server-side. The first authenticated request must transparently surface as "anonymous" (and trigger the right post-revocation page if appropriate), not as a 500 or an inconsistent half-signed-in UI.
- **CORS / SameSite traps**: The configured public base URL must match the origin the browser sees; otherwise the session cookie set on the API response is silently dropped. The app must detect or document this case so it is not mistaken for "login doesn't work."
- **Realtime channel blocked**: A visitor on a network that blocks WebSockets must still progress through a running lookup to its final result, even if it is slower or via reconnects rather than instant push.
- **Database unavailable at boot**: If the database is unreachable when the server starts (Neon cold-start, migration not yet applied, wrong DATABASE_URL), the app must fail the healthcheck rather than accept traffic that will all return 500.
- **Race between sign-in success and the navigation**: The post-sign-in navigation must wait for the new session to be readable by the cache/store; otherwise the destination page renders one frame as anonymous and either redirects to sign-in or shows the wrong state.
- **Multiple submit clicks**: Submitting the same identifier twice in quick succession must coalesce server-side rather than creating duplicate lookups or double-charging the free trial.
- **Expired or unknown lookup IDs in the URL**: Visiting `/lookups/<unknown>` or a finished-and-purged lookup must render the existing styled "not found" / "expired" page in Arabic, not a generic 404 or a stuck spinner.
- **Owner role drift**: If `OWNER_TELEGRAM_ID` changes (or was wrong on first deploy), the next sign-in by the rightful owner must promote them to `owner` without manual DB editing.

## Requirements *(mandatory)*

### Functional Requirements

#### Authentication & session

- **FR-001**: The system MUST persist a successful sign-in across page reloads and across the post-OAuth redirect for the full configured session lifetime.
- **FR-002**: After a successful sign-in, the application MUST NOT render the public/anonymous UI on the post-redirect page even for a single frame; the principal must be available to the first render that follows the redirect.
- **FR-003**: The system MUST handle BOTH the Telegram Login Widget popup callback flow AND the top-level redirect (URL-hash / query) fallback flow, and MUST complete sign-in exactly once even when React mounts the sign-in screen twice (e.g., in Strict Mode).
- **FR-004**: Session cookies MUST be issued with `HttpOnly`, `Secure` (on HTTPS), and a `SameSite` posture that survives the cross-site Telegram OAuth round-trip back to the app's origin, and they MUST be readable by the same-origin API on the very next request after issuance.
- **FR-005**: The system MUST treat a revoked, suspended, or expired session cookie as anonymous on the next request and MUST clear it from the browser so the user is not stuck in an ambiguous state.
- **FR-006**: A signed-out event in one tab MUST invalidate the session for all open tabs of the same user, either via realtime push or on the next interaction in those tabs.
- **FR-007**: The `next` redirect target the user was attempting to reach before sign-in MUST be honoured after sign-in completes, including when sign-in completes via the redirect (not popup) flow.
- **FR-008**: The system MUST surface a clear Arabic error and a recovery action when sign-in fails (Telegram HMAC invalid, payload too old, bot unavailable, suspended user, network/CORS failure) instead of leaving the user on a silently broken widget.

#### Search and core flows

- **FR-009**: An anonymous visitor with remaining trial credits MUST be able to submit a valid identifier and reach the progress page within 1 second of the response.
- **FR-010**: An anonymous visitor whose trial credits are exhausted MUST be shown the paywall modal with a working CTA to sign in or view plans, not a silent failure.
- **FR-011**: A signed-in user MUST be able to submit searches without the free-trial limit being enforced and without trial UI being shown.
- **FR-012**: The progress page MUST advance each of the five analysis categories through their lifecycle states using realtime updates and MUST reach a terminal state for every category in every completed lookup.
- **FR-013**: When a lookup reaches a terminal state, the progress page MUST navigate the user to the result page within 2 seconds.
- **FR-014**: The result page MUST render all available findings grouped by category in Arabic RTL, with confidence badges, source labels, and the AI enrichment summary section, and MUST handle the "no findings in a category" and "the enrichment is unavailable" sub-cases with the existing styled empty/degraded states.
- **FR-015**: Visiting a result URL directly (deep link) MUST render the result page if the lookup is in a viewable state, and MUST render the existing styled "expired" or "not found" page otherwise.
- **FR-016**: The system MUST coalesce duplicate-submit requests for the same identifier+visitor within a short window so a double-click never produces two lookups or double-decrements the trial.
- **FR-017**: When the realtime channel is unavailable, the progress page MUST still converge on the final result rather than remain stuck — either via reconnect + replay, or via a polling fallback.

#### Routing and state

- **FR-018**: The client router MUST match the deployment target. For a server-rendered SPA, deep links to any application route MUST resolve to the SPA shell on the server and to the correct page in the browser without a 404.
- **FR-019**: Protected routes (history, admin, etc.) MUST redirect anonymous visitors to sign-in carrying a `next` parameter that resolves them back after a successful sign-in.
- **FR-020**: All asynchronous flows (sign-in, sign-out, create lookup, fetch lookup, cancel lookup, rerun lookup) MUST expose loading states in the UI and explicit error states with Arabic copy — there must be no path that leaves the user staring at an unchanging screen with no indication of progress or failure.
- **FR-021**: All cached client-side state that depends on the current principal (auth, trial, history) MUST be invalidated when the principal changes (sign-in, sign-out, forced invalidation).

#### Backend / API / data

- **FR-022**: The server MUST reject requests when the database is unavailable rather than silently 500ing, and the healthcheck MUST go red so the platform can take the instance out of rotation.
- **FR-023**: Database migrations MUST be applied (and verified at boot) before the server accepts traffic, and the running code MUST match the schema version it is built against.
- **FR-024**: The auth callback endpoint MUST verify the Telegram payload (HMAC + freshness window), upsert the user, issue a session, set the cookie, and return the principal in a single transactional response without leaving partial state on failure.
- **FR-025**: The Telegram payload verifier MUST normalise input correctly (e.g., hash casing) so a valid payload is never rejected as malformed.
- **FR-026**: The system MUST recognise the configured owner Telegram ID on every sign-in (not only on first sign-in) and elevate or maintain their role to `owner` without manual DB intervention.
- **FR-027**: Realtime subscriptions MUST authorise the subscriber (allow public access only for the public lookup feed; require an authenticated principal for user-scoped channels) and MUST replay the current state on subscribe.

#### Environment & deployment

- **FR-028**: Required environment variables MUST be validated at server startup; if any required variable is missing or invalid, the server MUST refuse to start with a clear message naming the variable.
- **FR-029**: The documented environment example MUST list every variable the running code reads, marked as required or optional with a sensible default, and MUST NOT list variables the code no longer uses.
- **FR-030**: The deployment configuration MUST define a single, unambiguous deployment target for the main branch; legacy or aborted deployment workflows MUST be removed so the same push cannot deploy two contradictory versions.
- **FR-031**: All cookies the platform sets MUST use a consistent posture appropriate to the deployment scheme (HTTPS in production gets `Secure`; same-site auth flows survive the OAuth round-trip).

#### Codebase hygiene

- **FR-032**: All code imported from inside `apps/web` MUST resolve to client-runnable modules; no client file may import a server-only module path, and no server file may import a browser-only module.
- **FR-033**: All dead files, dead exports, and references to deleted siblings (left from previous pivots) MUST be removed so a clean build has no broken imports and no unused-export warnings of consequence.
- **FR-034**: Every place that performs network I/O on the client MUST handle non-2xx and network-error paths and surface them through the same Arabic-localised toast/state mechanism rather than throwing into the console silently.
- **FR-035**: The application's Arabic RTL setup (document `dir="rtl"`, `lang="ar"`, Tailwind RTL plugin, all user-facing copy in Arabic) MUST be preserved after the repair; no fix may introduce English-only text in a user-visible flow or break the RTL layout.

### Key Entities *(include if feature involves data)*

- **Principal**: The signed-in identity of a user (id, telegram id, display name, username, avatar, role, status). Resolved from the session cookie on every authenticated request; null for anonymous visitors.
- **Session**: A server-side record binding a session token (stored hashed) to a user, with an expiry, a revocation status, and a per-session CSRF token. The lifecycle of "login persistence" is the lifecycle of this entity.
- **Visitor**: A long-lived anonymous identity (token in a first-party cookie, stored hashed) used to attribute free-trial usage to a device even before sign-in.
- **Lookup**: A search request made by a visitor or signed-in user against a normalised identifier value; carries a status (in_progress, completed, failed, cancelled, expired), an expiry timestamp, and a relationship to its category-level state and findings.
- **Category state**: The per-category lifecycle within a lookup (queued, running, completed, failed, skipped) plus the count of findings produced so far; the unit of progress on the progress page.
- **Finding**: An individual piece of evidence produced by a category for a lookup (title, snippet, source, confidence, metadata).
- **Enrichment**: The AI-generated Arabic summary attached to a finished lookup (headline, summary, highlights, identity clusters, risk flags, gaps).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of successful sign-ins persist across a hard browser refresh on the very next attempt (zero "ghost sign-out" after refresh).
- **SC-002**: 100% of successful sign-ins land the user on the post-redirect page with the signed-in header on the first render (no anonymous-then-signed-in flicker).
- **SC-003**: A new anonymous visitor can submit a valid identifier on the home page and reach a complete result page in under 30 seconds end-to-end on a standard network.
- **SC-004**: 100% of running lookups reach a terminal state (completed/failed/skipped) within their expected window; zero lookups are left in a permanently "in progress" state due to lost realtime events.
- **SC-005**: After a single clean deploy from the documented environment variables, both the sign-in flow and the search flow work on the first attempt with zero manual database edits or container interventions.
- **SC-006**: The server starts with a clear failure message for any missing required environment variable in 100% of cases; it never starts in a "looks healthy but breaks on first request" state.
- **SC-007**: Zero broken imports, zero references to deleted modules, and zero stub modules that silently disable a user-facing feature remain in the codebase after the repair.
- **SC-008**: Every user-facing error path renders an Arabic message and at least one clear recovery action; there are zero user-facing flows that fail with only a raw stack trace or an English browser default.
- **SC-009**: The Arabic RTL layout passes a visual review of every primary page (home, sign-in, progress, result, history, plans, suspended, not-authorised, not-found) — no clipped icons, no flipped chevrons, no left-aligned Arabic body copy.
- **SC-010**: The healthcheck endpoint correctly reports unhealthy when the database or any other hard dependency is unreachable, and the deployment platform routes traffic accordingly.
- **SC-011**: A regression test or scripted end-to-end walkthrough that exercises sign-in → search → result → sign-out passes on every commit to the main branch before deployment proceeds.

## Assumptions

- The product remains a server-rendered single-page application backed by a Node + Express API and a managed Postgres database, deployed as one service (the most recent direction in the repo, after the static-only attempt was reverted).
- Telegram Login Widget remains the only sign-in method; no email/password, social, or magic-link sign-in is in scope for this repair.
- The free-trial counter remains attributed to a long-lived anonymous visitor cookie; trial limits are not changed by this repair (only restored to working).
- The existing Arabic copy, design tokens, RTL layout, dark theme, glass surfaces, and motion language are correct and must be preserved; this repair only changes them where a change is required to fix a defect.
- The currently configured Telegram bot, its `BotFather` domain settings, and the production base URL are all available to the maintainer so they can be aligned during the repair (the spec does not require choosing a new bot or a new domain).
- "Production-ready" in this context means the documented deployment target (Render + managed Postgres) brings the app to a healthy state from a clean deploy — it does not require multi-region HA, blue/green deploys, or a separate staging cluster.
- Telemetry/observability beyond the existing structured logger and healthcheck is out of scope; the repair must not regress what exists, but does not need to add new dashboards.
- The two previously broken flows the user calls out (login persistence and search) are representative of the wider problem, not an exhaustive list; the audit is expected to surface and fix any other flow whose breakage shares the same root causes (e.g., history, admin, paywall, rerun).

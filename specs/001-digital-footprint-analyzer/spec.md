# Feature Specification: Digital Footprint Analyzer (BasmatLibya)

**Feature Branch**: `001-digital-footprint-analyzer`

**Created**: 2026-06-03

**Status**: Draft

**Input**: User description: "Arabic-first, RTL SaaS web platform that analyzes a person's public digital identity footprint and returns a unified, polished result. No authentication in v1. Architecture must be AI-integration-ready and deployable to a managed container platform."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Submit an identifier and receive a unified digital footprint report (Priority: P1)

A visitor lands on the Arabic-first home page, sees a single prominent input that asks "من تريد أن تبحث عنه؟" (whom do you want to look up?), enters an identifier (full name, username, email, or phone number), and submits. The platform analyzes the public digital footprint associated with that identifier and presents a polished, unified result page that aggregates findings by category (social presence, public mentions, contact signals, reputation indicators, possible profile photos).

**Why this priority**: This is the entire product. Without it the platform delivers no value. Everything else (progress, sharing, history) only matters once a single lookup works end-to-end.

**Independent Test**: A new visitor with no prior session can open the home page, type a single identifier in Arabic or Latin script, and reach a populated result page within the success-criteria time budget. Successful when the result page renders in Arabic with full RTL layout, displays grouped findings, and provides a clear empty-state when nothing is found.

**Acceptance Scenarios**:

1. **Given** a visitor on the home page with no prior activity, **When** they enter a valid full name in Arabic and submit, **Then** the system shows a results page grouping findings by source category and renders all interface chrome in RTL.
2. **Given** a visitor enters an email address as the identifier, **When** the analysis completes, **Then** the results page displays at least one section per category that yielded a finding and an explicit empty-state message for categories that did not.
3. **Given** an identifier with no discoverable public footprint, **When** the analysis completes, **Then** the system shows a designed empty-state in Arabic explaining that no public information was found, not an error.
4. **Given** a visitor on a mobile-width viewport, **When** they submit a lookup, **Then** the entire flow (input, progress, results) is fully usable in RTL with no horizontal scroll, broken bidirectional text, or mirrored icons that should not be mirrored.

---

### User Story 2 - See live progress while the analysis runs (Priority: P2)

While a lookup is being processed, the user sees a live, animated progress experience that communicates which categories are being analyzed in real time, how far along the analysis is, and a graceful way to cancel. This turns an unavoidable wait into part of the premium feel.

**Why this priority**: Aggregated digital-footprint analysis can take several seconds to a minute. Without live feedback the perceived quality drops sharply and users abandon. With it, the wait becomes a feature.

**Independent Test**: Submit a lookup and observe the progress page. Successful when the progress UI updates as new categories are analyzed (not via polling refreshes), the progress indicator reflects actual underlying work, and a visible cancel control aborts the lookup and returns to the home page.

**Acceptance Scenarios**:

1. **Given** a submitted lookup is in progress, **When** the system finishes analyzing one category, **Then** that category appears as completed in the progress UI without the user reloading the page.
2. **Given** a submitted lookup is in progress, **When** the user clicks "إلغاء" (cancel), **Then** the analysis stops, no partial result is shown, and the user is returned to the home page.
3. **Given** the network connection drops mid-analysis, **When** connectivity is restored within 30 seconds, **Then** the progress UI reconnects and resumes streaming updates without the user manually refreshing.

---

### User Story 3 - Share a polished result via a stable link (Priority: P3)

After a successful lookup, the user can share the result via a unique read-only link that anyone can open to see the same polished report. The link does not expose any user-account concept (there is none) — it points to an anonymous lookup record.

**Why this priority**: Shareability turns a single lookup into organic distribution. It matters for adoption but is not required for the product to deliver value on its own.

**Independent Test**: After completing a lookup, copy the share link, open it in a private browser window, and verify it loads the identical polished report in Arabic RTL.

**Acceptance Scenarios**:

1. **Given** a completed lookup, **When** the user clicks "نسخ الرابط" (copy link), **Then** a stable URL is copied to the clipboard and the UI confirms in Arabic.
2. **Given** a shared link from a previous lookup, **When** any visitor opens it, **Then** the same result is shown without requiring sign-in or any prior state.
3. **Given** a shared link to a lookup older than the retention window, **When** a visitor opens it, **Then** the system shows a designed "expired" state in Arabic with an option to re-run the lookup using the same identifier.

---

### Edge Cases

- The submitted identifier matches many distinct individuals (common-name collision); the result page must clearly communicate that the findings may correspond to multiple people and offer no guarantee of identity match.
- The identifier is syntactically invalid (malformed email, non-numeric phone, empty string after trim); submission must be blocked with an inline Arabic validation message before any analysis is started.
- One source category times out while others succeed; the result must still render with the failed category shown as a degraded section in Arabic, not an error page.
- All source categories fail; the system shows a designed full-failure state in Arabic with a retry control, distinct from the "no findings" empty state.
- The identifier contains mixed Arabic and Latin script (e.g., an Arabic name with a Latin email handle); the input, progress, and result UI must render bidirectional text correctly with no mojibake or misaligned punctuation.
- The same identifier is submitted by many visitors in a short window; the system must serve them without queueing a duplicate full analysis for an identical recent lookup, while still respecting individual rate limits.
- A visitor on a slow connection (3G-class) opens the home page; first meaningful paint must remain within the success-criteria budget, and the input must be interactive before the rest of the page hydrates.
- The result page is opened by a screen reader user in Arabic; reading order, focus order, and announced labels must follow RTL conventions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST present a single primary call-to-action on the home page that accepts one of: full name, username, email address, or phone number, and MUST detect the identifier type automatically without requiring the user to pick a category.
- **FR-002**: The system MUST validate the identifier client-side before submission and present inline error messages in Arabic for empty, malformed, or unsupported inputs.
- **FR-003**: The system MUST analyze the submitted identifier against a set of public-information categories (social presence, public mentions, contact signals, reputation indicators, possible profile imagery) and aggregate the findings into a single unified result.
- **FR-004**: The system MUST stream progress updates to the client in real time as each category completes, with no client-initiated polling.
- **FR-005**: The system MUST allow the user to cancel an in-progress lookup, after which no result record is persisted for that lookup.
- **FR-006**: The system MUST persist completed lookups under an anonymous, unguessable identifier and MUST NOT store any user-account, session, or login information.
- **FR-007**: The system MUST expose a stable, read-only shareable URL for each completed lookup that resolves to the identical result for any visitor.
- **FR-008**: The system MUST default to Arabic for all interface copy and MUST render the entire UI in right-to-left layout, including form controls, navigation, progress indicators, modals, toasts, and error states.
- **FR-009**: The system MUST display source-native content (e.g., Latin-script usernames, English snippets) within the otherwise-Arabic UI without breaking bidirectional text, alignment, or punctuation.
- **FR-010**: The system MUST surface a per-finding confidence indicator (high / medium / low or equivalent) so users can judge match quality, and MUST clearly communicate that findings may not all correspond to the same individual.
- **FR-011**: The system MUST present a designed empty-state for "no findings", a designed degraded-state for "some categories failed", and a designed full-failure state for "all categories failed", all distinct from each other and from generic application errors.
- **FR-012**: The system MUST gracefully handle re-running an existing lookup so that an expired or stale shared link offers a one-click re-analysis using the original identifier.
- **FR-013**: The system MUST rate-limit lookups per visitor and per identifier to prevent abuse, and MUST present a polite Arabic message when a limit is hit, never a raw HTTP error.
- **FR-014**: The system MUST be architecturally ready to integrate AI-driven enrichment of the unified result in a later iteration (e.g., AI summary, sentiment, persona narrative) without requiring a rewrite of the data model or result page.
- **FR-015**: The system MUST be runnable end-to-end on a developer's local machine with a single bootstrap command, using a local or remote database, and MUST behave identically (modulo source availability) in local and production environments.
- **FR-016**: The system MUST retain completed lookups for a fixed retention window, after which shareable links resolve to the designed "expired" state and the underlying record is purged.
- **FR-017**: The system MUST log analysis events (start, per-category completion, end, cancel, failure) in a structured form sufficient to diagnose a single lookup end-to-end.

### Key Entities *(include if feature involves data)*

- **Lookup Request**: A single anonymous submission. Attributes: anonymous lookup identifier, submitted identifier value, detected identifier type, submission timestamp, originating visitor token (for rate limiting only, not identity), status (in-progress, completed, cancelled, failed), retention expiry timestamp.
- **Source Category**: A logical grouping of findings (social presence, public mentions, contact signals, reputation indicators, profile imagery). Attributes: stable category key, display label in Arabic, ordering weight, completion state per lookup, optional failure reason.
- **Finding**: A single piece of evidence within a source category for a given lookup. Attributes: parent lookup, source category, source-native title and snippet, source URL, confidence level, ordering weight, language tag of the source content.
- **Aggregated Result**: The polished unified view of a completed lookup. Attributes: parent lookup, summary headline, ordered list of populated categories, count of total findings, AI-enrichment slot reserved for later iterations.
- **Rate-Limit Record**: A short-lived counter used to throttle abusive submission patterns. Attributes: visitor token, identifier hash, count, window start, window expiry.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of lookups that reach the analysis stage complete and render a result within 60 seconds end-to-end, measured from the visitor pressing submit to the result page being interactive.
- **SC-002**: The home page reaches first interactive state within 2 seconds on a representative 4G-class connection and within 4 seconds on a representative 3G-class connection, measured at the 90th percentile.
- **SC-003**: Across the top 20 surfaces of the application (home, progress, result, empty-state, degraded-state, expired-state, error-state, validation-error, modals, toasts, etc.), 100% render in correct right-to-left layout with no untranslated English copy in user-facing chrome.
- **SC-004**: Lookup abandonment during the progress phase is below 15%, measured as the share of started lookups for which the progress page is closed before completion or cancel.
- **SC-005**: The same shared result link, opened by a different visitor on a different device, renders an identical result for at least 95% of links opened within the retention window.
- **SC-006**: A new contributor can clone the repository and reach a fully working local environment with the home page loading and a sample lookup completing in under 15 minutes, on a fresh machine.
- **SC-007**: Adding a new AI-driven enrichment to the result page can be done without modifying the lookup intake, the progress streaming, or the persistence layer of completed lookups (verified by a follow-up enrichment iteration).
- **SC-008**: Visitor-perceived quality of the result page, measured by a short post-result satisfaction prompt, is at least 4 out of 5 on average across the first 200 completed lookups.

## Assumptions

- The product targets Arabic-speaking users first, with Libyan Arabic and Modern Standard Arabic as the primary written variants. English is not offered in v1; source-native English content is rendered as data, not chrome.
- "Public digital identity footprint" means information that is already publicly accessible on the open web for the submitted identifier. The platform does not access private data, breached data dumps, or any source requiring authentication.
- There is no concept of a user account, sign-up, login, password, or personal session in v1. All lookups are anonymous and addressed only by an unguessable lookup identifier.
- The retention window for completed lookups is 30 days unless the operator changes it; after that, shareable links resolve to the designed expired-state.
- Rate limiting is enforced per visitor token (an anonymous, browser-bound identifier) and per identifier hash. The exact thresholds are an operational concern and can be tuned without changing the spec.
- AI-driven enrichment is explicitly out of scope for v1 functionality but is in scope as an architectural reservation: the result data model carries a slot for AI output, and the UI reserves visual space for it, so adding it later is additive.
- The technical stack is fixed by the project owner (React 19 + Vite + Tailwind + wouter + TanStack Query on the client; Express 5 + TypeScript + Socket.IO on the server; PostgreSQL on Neon with Drizzle ORM; Docker on Render for deployment) and is documented in the implementation plan rather than in this spec.
- "Premium modern UI" is interpreted as: a single confident primary action per surface, generous spacing, restrained typographic scale tuned for Arabic, motion used to communicate state rather than decorate, no carousels or marketing fluff in the v1 surfaces.
- Accessibility targets WCAG 2.1 AA as a baseline, with explicit attention to RTL screen-reader behavior and Arabic font rendering at small sizes.

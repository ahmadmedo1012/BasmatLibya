# Feature Specification: Static GitHub Pages Deployment

**Feature Branch**: `004-static-github-pages`

**Created**: 2026-06-06

**Status**: Draft

**Input**: User description: Convert BasmatLibya into a GitHub Pages-ready static web app.

## User Scenarios & Testing

### User Story 1 - Static build deploys to GitHub Pages (Priority: P1)

A contributor pushes the main branch and the app automatically deploys as a fully static site on GitHub Pages. No server, database, or Docker setup is required — the entire application is served as HTML, CSS, and JavaScript from a CDN.

**Why this priority**: Without static deployment, the app has no hosting path. This is the foundation everything else depends on.

**Independent Test**: Clone the repo, run the build command, and open the output `dist/index.html` in any browser. The app loads and renders the home page with no server running.

**Acceptance Scenarios**:

1. **Given** the repo is configured for GitHub Pages, **When** a push is made to the main branch, **Then** the site automatically deploys and is accessible at the GitHub Pages URL.
2. **Given** a visitor navigates to the GitHub Pages URL, **When** they land on the home page, **Then** all assets (CSS, JS, icons, fonts) load correctly with no 404s.
3. **Given** the app is deployed to a sub-path (e.g., `https://user.github.io/repo/`), **When** a page loads, **Then** all relative asset paths resolve correctly.

---

### User Story 2 - Search flow works with sample mock data (Priority: P2)

A visitor arrives on the home page, enters a name or identifier, and follows the full product flow: submitting a search, watching simulated progress, and viewing sample results. No backend server is required — all data is generated client-side as realistic mock content.

**Why this priority**: This preserves the core product experience and demonstrates the UI quality, design system, and RTL Arabic polish without needing a running server.

**Independent Test**: Open the built static site, submit any name on the home page, and observe the progress animation followed by a result page showing sample findings. No server errors appear.

**Acceptance Scenarios**:

1. **Given** a visitor is on the home page, **When** they enter any identifier and click submit, **Then** they are taken to a progress page showing simulated category analysis with realistic timing.
2. **Given** the simulated analysis completes, **When** the page transitions to results, **Then** the result page displays sample findings across all categories (social presence, public mentions, contact signals, reputation indicators, profile imagery).
3. **Given** a result page is displayed, **When** the user views enrichment content, **Then** a realistic AI summary section is shown with placeholder content.
4. **Given** a share link is generated, **When** the user copies or accesses it, **Then** the link navigates correctly within the static app using hash-based routing.

---

### User Story 3 - Project structure is clean and static-ready (Priority: P3)

The codebase has no server-side code, no deployment configs for Render/Docker/Neon, and all routing works on GitHub Pages. The README documents the new static-only architecture.

**Why this priority**: Clean project structure ensures maintainability and makes it obvious to new contributors that this is a static-only app.

**Independent Test**: Walk through the entire project directory — there are no `apps/server/`, `Dockerfile`, `docker-compose.yml`, or `render.yaml` files. The build output contains only static files.

**Acceptance Scenarios**:

1. **Given** a developer browses the repository root, **When** they check for server-related files, **Then** no Express API, database migration, Docker, or Render configuration files exist.
2. **Given** the client-side router is configured, **When** a user navigates directly to any route (e.g., `/lookups/sample-id`), **Then** the page renders correctly without a server-side redirect.
3. **Given** the project README is reviewed, **When** a new contributor reads setup instructions, **Then** they only need a static file server (or `npx serve dist`) — no database, Docker, or backend setup steps.

---

### Edge Cases

- What happens when a user navigates directly to a deep route (e.g., `/lookups/abc`)? The static router must handle this without a server redirect.
- How does the app behave when GitHub Pages serves it from a sub-path (e.g., `/BasmatLibya/`)? All asset and route paths must be relative or use the correct base path.
- What happens if JavaScript is disabled? The app should display a basic fallback message (since this is a SPA).
- How are share links handled without a server? Mock lookups use predictable hash-based IDs that resolve locally.
- What about GitHub Pages rate limits or build timeouts? Static builds must complete within GitHub Actions 6-hour limit (expected: under 1 minute).

## Requirements

### Functional Requirements

- **FR-001**: The build process MUST produce a fully static output (HTML, CSS, JS, assets) with no server-side runtime dependencies.
- **FR-002**: All routes MUST work correctly when deployed to a GitHub Pages sub-path (e.g., `/repo-name/`), using hash-based routing or equivalent.
- **FR-003**: The home page MUST allow visitors to enter any identifier and trigger a simulated search flow without a backend.
- **FR-004**: Progress during simulated analysis MUST be shown with realistic category-by-category animation and timing.
- **FR-005**: The result page MUST display sample findings across all five categories with correct RTL layout, confidence badges, and source labels.
- **FR-006**: The enrichment slot MUST render a realistic AI summary from static sample data.
- **FR-007**: Share links MUST work within the static app using local hash-based routing and predictable mock IDs.
- **FR-008**: The project MUST have zero server-side source code, dependencies, or deployment configurations after migration.
- **FR-009**: GitHub Pages deployment MUST be configured so that pushing to the main branch triggers an automatic deploy.
- **FR-010**: The app MUST retain its current design system, RTL Arabic support, dark theme, glass surfaces, and responsive layout in the static build.
- **FR-011**: Visitors who access expired or unknown mock lookup IDs MUST see the existing styled "not found" / "expired" state pages.

### Key Entities

- **Mock Lookup**: A client-side generated object containing a unique hash ID, a status (simulating progress completion), and sample findings across categories. Generated when the user submits an identifier on the home page.
- **Sample Finding**: Pre-defined realistic data for each category (social presence, public mentions, contact signals, reputation indicators, profile imagery) with titles, snippets, source names, confidence levels, and metadata.
- **Mock Enrichment**: A static payload containing an Arabic headline, summary, highlights, identity clusters, risk flags, and gaps — mimicking the real AI enrichment output.
- **Route**: Hash-based path segments (e.g., `#/lookups/abc123`) that the SPA router maps to page components without server round-trips.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Build output contains only static files — zero `.js` or `.mjs` server entry points, zero database artifacts.
- **SC-002**: A new visitor can open the built site with no server running and complete the full search flow (home → progress → result) in under 30 seconds.
- **SC-003**: All pages render without console errors or failed asset loads when served from a sub-path.
- **SC-004**: The deployed site passes Lighthouse performance audit with a score of at least 85 for both desktop and mobile (excluding PWA requirements which are out of scope).
- **SC-005**: The mock lookup generates consistent results from the same identifier input (deterministic mapping from identifier to sample data).

## Assumptions

- The existing `wouter` router supports hash-based routing (`useHashLocation`) which is sufficient for GitHub Pages.
- The existing design system, RTL layout, Tailwind config, and font loading via `<link>` tags require no changes for static hosting.
- Vite's build output can be deployed as-is to GitHub Pages using a simple GitHub Actions workflow or the Pages UI.
- The current mock provider data in the codebase can serve as the foundation for static sample results.
- GitHub Pages free tier (1 GB storage, 100 GB bandwidth/month, 10 builds/hour) is sufficient for this application's expected traffic.
- No user authentication, admin panel, or server-only features need to be preserved — only the public-facing search flow.
- The app's existing package dependencies (React, framer-motion, Tailwind, wouter, etc.) all support static builds without modification.

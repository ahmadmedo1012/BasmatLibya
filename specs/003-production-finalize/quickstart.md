# Quickstart: Production Finalize & Cleanup

This feature has three independent workstreams. Complete them in priority order.

## Workstream 1: Production Deployment (P1)

### Environment & Build

1. **Review and fix `.gitignore`** — Add:
   ```
   .claude/
   .opencode/
   tooling/osint-venv/
   ```

2. **Review and fix `.dockerignore`** — Add:
   ```
   scripts/
   tooling/
   .opencode/
   .editorconfig
   .prettierrc.json
   .prettierignore
   AGENTS.md
   ```

3. **Fix critical deployment issues**:
   - `apps/web/vite.config.ts`: Set `sourcemap: false` in build config
   - `apps/server/src/index.ts`: Add `process.on('SIGTERM')` graceful shutdown handler
   - `apps/web/index.html`: Add favicon `<link>` and Open Graph meta tags
   - `Dockerfile`: Add `USER node` in runtime stage
   - `docker-compose.yml`: Add `profiles: [tools]` to phoneinfoga service
   - `render.yaml`: Add missing env vars (`TELEGRAM_BOT_TOKEN`, `MODEL_SECRET_KEY`,
     `ENRICHMENT_ENABLED`, `NVIDIA_API_KEY`, `COOKIE_DOMAIN`)

4. **Build and test locally**:
   ```bash
   pnpm build
   pnpm test
   docker build -t basmatlibya .
   ```

### Verify

- [ ] `pnpm build` completes with no errors
- [ ] `pnpm start` boots and health endpoint responds
- [ ] `sourcemap: false` is confirmed in production bundle
- [ ] Container starts with `USER node` (not root)
- [ ] SIGTERM test: kill the process, verify clean log output

---

## Workstream 2: UI Polish & RTL Audit (P2)

### Critical Fixes

1. **`apps/web/src/components/primitives/Toast.tsx`** — Fix undefined `card-elev` class:
   Replace with `shadow-card` or add `card-elev` to `globals.css`.

2. **`apps/web/src/routes/ProgressPage.tsx:277`** — Remove dead code
   `{snapshot ? null : null}`.

3. **`apps/web/src/design/motion.ts:22`** — Correct misleading comment about
   `prefers-reduced-motion`. Gate animations with `useReducedMotion()` where needed.

### Medium Priority

4. **`Button.tsx`** — Add `active:scale-[0.98]` to `secondary`, `outline`, `ghost`, `danger`
   variants for tactile feedback consistency.

5. **`Input.tsx`** — Add `disabled:opacity-50 disabled:cursor-not-allowed` styling.

6. **`rtl.tsx`** — Remove dead `shouldMirrorIcon()` export or wire it into `Icon` component.
   Replace template literal with `cn('bidi-isolate', className)`.

7. **`Toast.tsx`** — Replace string concatenation for className with `cn()` utility.

### Verify

- [ ] All pages render without layout breaks on 375px, 768px, 1440px
- [ ] Button hover/focus/active/disabled states are distinct on all variants
- [ ] Input has disabled visual cue
- [ ] RTL audit passes: no horizontal scroll, icons correct direction
- [ ] `card-elev` renders correctly (toasts visible)
- [ ] `prefers-reduced-motion` respected (test via OS accessibility setting)

---

## Workstream 3: Codebase Cleanup & GitHub (P3)

1. **Update `.gitignore`** — Add entries from Workstream 1 step 1.
2. **Update `.dockerignore`** — Add entries from Workstream 1 step 2.
3. **Remove unused dependencies** — Consider removing `@hookform/resolvers` and
   `class-variance-authority` from `apps/web/package.json`.
4. **Finalize README** — Ensure environment variable documentation is complete.
5. **Push to GitHub** — Verify no credentials in commit history before pushing.
6. **Configure Render** — Set all env vars from the Deployment Contract.

### Verify

- [ ] `git status` shows only production-relevant files
- [ ] `git log` has no committed secrets
- [ ] `pnpm install` succeeds after dependency cleanup

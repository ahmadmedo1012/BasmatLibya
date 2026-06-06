# Research: Production Finalize & Cleanup

## 1. Local-Dev Files & Cleanup Scope

**Decision**: Exclude agent tooling, Python venv, dev-only scripts, and config files from both
`.gitignore` and `.dockerignore`.

**Rationale**: Three high-impact items were found — (a) `.claude/settings.local.json` contains an
NVIDIA API key in curl commands and is NOT in `.gitignore`, (b) `tooling/osint-venv/` is a 402 MB
Python virtual environment also not in `.gitignore`, (c) `.opencode/` has 58 MB of node_modules
not excluded from Docker builds.

**Alternatives considered**:
- Move `.claude/` and `.opencode/` outside the project root → rejected, they are tightly coupled to
  the project path.
- Manually strip secrets from `.claude/` → rejected, easier to add to `.gitignore` and rotate keys.

**Findings**:
| Item | Size | .gitignore | .dockerignore | Action |
|------|------|-----------|--------------|--------|
| `.claude/settings.local.json` | <1 KB | ❌ | ❌ | Add `.claude/` to both |
| `tooling/osint-venv/` | 402 MB | ❌ | ❌ | Add to both |
| `.opencode/` | 58 MB | ❌ | ❌ | Add to both |
| `scripts/bootstrap-owner.ts` | <1 KB | N/A | ❌ | Add to `.dockerignore` |
| `tooling/` (src only) | <1 MB | N/A | ❌ | Add to `.dockerignore` |
| `.editorconfig`, `.prettierrc.json`, `.prettierignore` | <1 KB | N/A | ❌ | Add to `.dockerignore` |
| `CLAUDE.md`, `AGENTS.md` | <1 KB | N/A | Already excluded | OK |
| `specs/`, `.specify/` | <1 MB | ❌ | Already excluded | OK |

---

## 2. UI Polish Audit

**Decision**: Address 10 identified issues across components, styles, and configuration.

**Rationale**:
- **CRITICAL**: `card-elev` class referenced in `Toast.tsx` is undefined — toasts render flat.
  Resolution: define it in `globals.css` or use `shadow-card` instead.
- **HIGH**: `ProgressPage.tsx` line 277 has dead code (`{snapshot ? null : null}`).
- **HIGH**: `motion.ts` comment incorrectly claims Framer Motion auto-handles `prefers-reduced-motion`.
  Resolution: gate animations with `useReducedMotion()`.
- **MEDIUM**: 4 of 5 Button variants lack `active:` press state, Input lacks `disabled:` styling,
  `shouldMirrorIcon()` is dead code, `rtl.tsx` uses template literals instead of `cn()`.

**Alternatives considered**:
- Replacing Toast system with `react-hot-toast` or `sonner` → rejected, the current system works
  and adding dependencies violates G6/YAGNI.

**Findings**:
| Priority | Issue | File | Fix |
|----------|-------|------|-----|
| CRITICAL | `card-elev` undefined | `Toast.tsx:42` | Define class or use `shadow-card` |
| HIGH | Dead code `{snapshot ? null : null}` | `ProgressPage.tsx:277` | Remove |
| HIGH | Misleading reduced-motion comment | `motion.ts:22` | Correct comment, add gates |
| MEDIUM | 4/5 Button variants missing active state | `Button.tsx` | Add `active:scale-[0.98]` to all |
| MEDIUM | Input missing disabled styling | `Input.tsx` | Add `disabled:` classes |
| MEDIUM | `shouldMirrorIcon()` dead code | `rtl.tsx:16` | Remove or wire to `Icon` |
| MEDIUM | `rtl.tsx` template literal not using `cn()` | `rtl.tsx:35` | Use `cn()` utility |
| MEDIUM | Toast class string concat | `Toast.tsx:42-48` | Replace with `cn()` |
| LOW | `FindingCard` imperative DOM manipulation | `FindingCard.tsx:108` | Use React state |
| LOW | `EnrichmentSlot` hardcoded Arabic labels | `EnrichmentSlot.tsx:89` | Use `i18nAr` tokens |

---

## 3. Production Environment Contract

**Decision**: Fix the `render.yaml` to include all critical env vars, add graceful shutdown,
disable source maps, add favicon and OG tags, add `USER node` to Dockerfile.

**Rationale**: Three critical issues were found — (a) `sourcemap: true` in Vite config would
leak full source code in production, (b) `TELEGRAM_BOT_TOKEN` and `MODEL_SECRET_KEY` missing from
`render.yaml` would cause boot failures before the app can start, (c) no `process.on('SIGTERM')`
handler means connections are dropped on every deployment.

**Alternatives considered**:
- `sourcemap: 'hidden'` instead of `false` → rejected, no benefit for a public SPA.
- Third-party process manager (PM2, forever) → rejected, adds complexity not needed on Render.

**Findings**:
| Severity | Issue | File | Fix |
|----------|-------|------|-----|
| CRITICAL | Source maps expose full source in prod | `vite.config.ts` | Set `sourcemap: false` |
| CRITICAL | TELEGRAM_BOT_TOKEN missing in render.yaml | `render.yaml` | Add to envVars |
| CRITICAL | MODEL_SECRET_KEY missing in render.yaml | `render.yaml` | Add to envVars |
| HIGH | No graceful shutdown (SIGTERM) | `index.ts` | Add `process.on('SIGTERM')` |
| HIGH | No favicon | `index.html` | Add favicon to `public/` |
| HIGH | No OG/Twitter meta tags | `index.html` | Add Open Graph tags |
| MEDIUM | Dockerfile runs as root | `Dockerfile` | Add `USER node` |
| MEDIUM | phoneinfoga lacks profiles:[tools] | `docker-compose.yml` | Add profile |
| LOW | Version hardcoded in health endpoint | `health.ts` | Read from package.json |
| LOW | Font @import render-blocking | `fonts.css` | Use `<link>` with preconnect |
| LOW | User-Agent has placeholder URL | `node-osint.ts` | Update URL |
| LOW | Missing ENRICHMENT_ENABLED in render.yaml | `render.yaml` | Add (defaults false) |
| LOW | Missing NVIDIA_API_KEY in render.yaml | `render.yaml` | Add |
| LOW | Missing COOKIE_DOMAIN in render.yaml | `render.yaml` | Add |

---

## 4. Neon PostgreSQL Compatibility

**Decision**: The existing `db/client.ts` correctly detects Neon vs local pg via URL pattern
matching (`.neon.tech` / `.neon.build`). No changes required to the database client.

**Rationale**: The `@neondatabase/serverless` pool is used when the URL contains `.neon.tech`,
with `fetchConnectionCache = true` for connection reuse. The `pg.Pool` fallback handles local
development. The retention purge (`tooling/retention.ts`) uses raw SQL and works with both drivers.

**Alternatives considered**: None — the existing dual-driver pattern is correct.

---

## 5. Build Pipeline Verification

**Decision**: The existing multi-stage Docker build is correct. Only minor production hardening
changes needed (add `USER node`, verify `.dockerignore`).

**Rationale**: `pnpm build` compiles `@basmat/shared` → `@basmat/server` → `@basmat/web`
sequentially. The runtime stage copies only `dist/` directories and installs production deps.
The `preDeployCommand: pnpm --filter @basmat/server db:migrate` in `render.yaml` handles
migrations before the new service starts.

---

## 6. GitHub Remote & Secrets

**Decision**: The remote `origin` at `https://github.com/ahmadmedo1012/BasmatLibya.git` already
exists. Credentials will be configured as Render environment variables (not GitHub secrets — the
app runs on Render, not GitHub Actions).

**Rationale**: No CI/CD pipeline exists yet. Credentials go to the Render dashboard as env vars
(`sync: false` in `render.yaml`). This matches the spec requirement (FR-009, FR-010).

**Secrets to configure on Render**:
| Env Var | Source |
|---------|--------|
| `DATABASE_URL` | Neon project connection string |
| `PUBLIC_BASE_URL` | Render service URL |
| `TELEGRAM_BOT_TOKEN` | BotFather |
| `MODEL_SECRET_KEY` | Generated locally (openssl rand -hex 32) |
| `NVIDIA_API_KEY` | NVIDIA NGC |
| `NUMVERIFY_API_KEY` | Numverify |
| `SERPAPI_KEY` | SerpAPI |
| `COOKIE_DOMAIN` | `.onrender.com` or custom domain |

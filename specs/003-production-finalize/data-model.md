# Data Model: Production Finalize & Cleanup

**No schema changes.** This feature does not modify the database schema, introduce new entities,
or alter existing table structures.

The existing Drizzle ORM schema in `apps/server/src/db/schema.ts` is production-ready and
requires no changes. All data entities relevant to this feature are:

| Entity | Table | Notes |
|--------|-------|-------|
| Lookup | `lookups` | Unchanged — 30-day retention via `RETENTION_DAYS` env var |
| Source Category | `source_categories` | Unchanged |
| Finding | `findings` | Unchanged |
| Aggregated Result | `aggregated_results` | Unchanged — `enrichment_payload` slot already exists |
| Rate Limit Counter | `rate_limit_counters` | Unchanged — window + max per `RATE_LIMIT_*` env vars |
| Admin User | `admin_users` | Unchanged — part of 002 feature |
| Admin Session | `admin_sessions` | Unchanged |
| Site Settings | `site_settings` | Unchanged |
| Audit Log | `audit_log` | Unchanged |
| AI Model Config | `ai_model_configs` | Unchanged |

**Retention enforcement**: The existing `tooling/retention.ts` script purges expired lookups.
In production this should be scheduled via Render Cron Jobs or an external scheduler — not
built into the container itself. The env var `RETENTION_DAYS` (default 30) controls the window.

**No migration required.** Existing migrations `0000`–`0003` cover all current entities.

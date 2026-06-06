-- 005-audit-repair-core (T007): seed the schema-version meta row.
-- Idempotent: re-running the migration is a no-op. The row lives in
-- `site_settings` (already exists; no DDL change). The corresponding
-- `SCHEMA_VERSION` constant lives in `apps/server/src/db/schema-version.ts`
-- and `assertSchemaVersion()` reads this row at boot.
INSERT INTO "site_settings" ("key", "value", "last_updated_at")
VALUES ('schema_version', '{"version":"1"}'::jsonb, now())
ON CONFLICT ("key") DO UPDATE
  SET "value" = EXCLUDED."value",
      "last_updated_at" = EXCLUDED."last_updated_at"
  WHERE "site_settings"."value" IS DISTINCT FROM EXCLUDED."value";

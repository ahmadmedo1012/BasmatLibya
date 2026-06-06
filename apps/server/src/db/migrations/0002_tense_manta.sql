CREATE TABLE IF NOT EXISTS "ai_model_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"model_id" text NOT NULL,
	"display_label" text,
	"base_url" text,
	"credential_ciphertext" jsonb NOT NULL,
	"credential_last_four" text NOT NULL,
	"system_prompt" text DEFAULT '' NOT NULL,
	"temperature" numeric(3, 2) DEFAULT '0.20' NOT NULL,
	"max_output_tokens" integer DEFAULT 1024 NOT NULL,
	"extra_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'inactive' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"validated_at" timestamp with time zone,
	"last_validation_error" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_updated_by" uuid,
	"last_updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"event_class" text NOT NULL,
	"event_subclass" text NOT NULL,
	"target_kind" text,
	"target_id" text,
	"before_value" jsonb,
	"after_value" jsonb,
	"request_signature" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"csrf_token" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoke_reason" text,
	"client_signature" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"last_updated_by" uuid,
	"last_updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_lookup_associations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lookup_id" uuid NOT NULL,
	"associated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hidden_by_user_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_id" bigint NOT NULL,
	"display_name" text NOT NULL,
	"username" text,
	"avatar_url" text,
	"role" text DEFAULT 'user' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"suspended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "lookups" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_model_entries" ADD CONSTRAINT "ai_model_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_model_entries" ADD CONSTRAINT "ai_model_entries_last_updated_by_users_id_fk" FOREIGN KEY ("last_updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_last_updated_by_users_id_fk" FOREIGN KEY ("last_updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_lookup_associations" ADD CONSTRAINT "user_lookup_associations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_lookup_associations" ADD CONSTRAINT "user_lookup_associations_lookup_id_lookups_id_fk" FOREIGN KEY ("lookup_id") REFERENCES "public"."lookups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "one_active_ai_model" ON "ai_model_entries" USING btree ("is_active") WHERE "ai_model_entries"."is_active" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_model_entries_provider_model_idx" ON "ai_model_entries" USING btree ("provider","model_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_model_entries_status_updated_idx" ON "ai_model_entries" USING btree ("status","last_updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_class_created_idx" ON "audit_log_entries" USING btree ("event_class","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_actor_created_idx" ON "audit_log_entries" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_target_created_idx" ON "audit_log_entries" USING btree ("target_kind","target_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_hash_uniq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_revoked_idx" ON "sessions" USING btree ("user_id","revoked_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_lookup_assoc_uniq" ON "user_lookup_associations" USING btree ("user_id","lookup_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_lookup_assoc_user_hidden_idx" ON "user_lookup_associations" USING btree ("user_id","hidden_by_user_at","associated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_lookup_assoc_lookup_idx" ON "user_lookup_associations" USING btree ("lookup_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_telegram_id_uniq" ON "users" USING btree ("telegram_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_role_status_idx" ON "users" USING btree ("role","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_last_seen_idx" ON "users" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lookups_owner_user_idx" ON "lookups" USING btree ("owner_user_id");
--> statement-breakpoint
-- FK from lookups to users (circular ref — Drizzle skipped, added manually).
DO $$ BEGIN
 ALTER TABLE "lookups" ADD CONSTRAINT "lookups_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Seed default site_settings rows (R-07). Idempotent — only inserts missing keys.
INSERT INTO "site_settings" ("key", "value")
VALUES
  ('lookup_retention_days', '30'::jsonb),
  ('rate_limit_per_visitor_window_minutes', '10'::jsonb),
  ('rate_limit_per_visitor_max_per_window', '5'::jsonb),
  ('rate_limit_per_identifier_window_minutes', '60'::jsonb),
  ('rate_limit_per_identifier_max_per_window', '20'::jsonb),
  ('enrichment_enabled', 'false'::jsonb),
  ('public_lookups_enabled', 'true'::jsonb),
  ('session_lifetime_days', '30'::jsonb)
ON CONFLICT (key) DO NOTHING;

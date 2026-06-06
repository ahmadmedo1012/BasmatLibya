CREATE TABLE IF NOT EXISTS "aggregated_results" (
	"lookup_id" uuid PRIMARY KEY NOT NULL,
	"summary_headline_ar" text NOT NULL,
	"total_findings" integer NOT NULL,
	"populated_categories" text[] NOT NULL,
	"enrichment_status" text DEFAULT 'skipped' NOT NULL,
	"enrichment_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lookup_id" uuid NOT NULL,
	"category_key" text NOT NULL,
	"title" text NOT NULL,
	"snippet" text,
	"source_url" text NOT NULL,
	"source_name" text NOT NULL,
	"language" text,
	"confidence" text NOT NULL,
	"ordering_weight" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lookup_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lookup_id" uuid NOT NULL,
	"category_key" text NOT NULL,
	"state" text NOT NULL,
	"started_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"failure_reason" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lookups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier_value" text NOT NULL,
	"identifier_value_normalised" text NOT NULL,
	"identifier_type" text NOT NULL,
	"status" text NOT NULL,
	"visitor_token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"failure_reason" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rate_limit_counters" (
	"visitor_token_hash" text NOT NULL,
	"identifier_hash" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rate_limit_counters_visitor_token_hash_identifier_hash_window_start_pk" PRIMARY KEY("visitor_token_hash","identifier_hash","window_start")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "source_categories" (
	"key" text PRIMARY KEY NOT NULL,
	"display_label_ar" text NOT NULL,
	"ordering_weight" integer NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aggregated_results" ADD CONSTRAINT "aggregated_results_lookup_id_lookups_id_fk" FOREIGN KEY ("lookup_id") REFERENCES "public"."lookups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "findings" ADD CONSTRAINT "findings_lookup_id_lookups_id_fk" FOREIGN KEY ("lookup_id") REFERENCES "public"."lookups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "findings" ADD CONSTRAINT "findings_category_key_source_categories_key_fk" FOREIGN KEY ("category_key") REFERENCES "public"."source_categories"("key") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lookup_categories" ADD CONSTRAINT "lookup_categories_lookup_id_lookups_id_fk" FOREIGN KEY ("lookup_id") REFERENCES "public"."lookups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lookup_categories" ADD CONSTRAINT "lookup_categories_category_key_source_categories_key_fk" FOREIGN KEY ("category_key") REFERENCES "public"."source_categories"("key") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "findings_lookup_cat_order_idx" ON "findings" USING btree ("lookup_id","category_key","ordering_weight");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "findings_lookup_idx" ON "findings" USING btree ("lookup_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lookup_categories_lookup_cat_uniq" ON "lookup_categories" USING btree ("lookup_id","category_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lookup_categories_lookup_state_idx" ON "lookup_categories" USING btree ("lookup_id","state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lookups_visitor_token_created_idx" ON "lookups" USING btree ("visitor_token_hash","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lookups_identifier_norm_created_idx" ON "lookups" USING btree ("identifier_value_normalised","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lookups_status_expires_idx" ON "lookups" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rate_limit_expires_idx" ON "rate_limit_counters" USING btree ("expires_at");
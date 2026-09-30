CREATE TABLE "job_activity" (
	"attempt" integer,
	"error_category" text,
	"event" text NOT NULL,
	"event_key" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_activity_id_format" CHECK ("job_activity"."id" ~ '^jac_[0-7][0-9A-HJKMNP-TV-Z]{25}$'),
	CONSTRAINT "job_activity_event_valid" CHECK ("job_activity"."event" IN ('created', 'started', 'attempt_failed', 'cancelled', 'completed', 'failed')),
	CONSTRAINT "job_activity_attempt_positive" CHECK ("job_activity"."attempt" IS NULL OR "job_activity"."attempt" > 0)
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"priority" integer NOT NULL,
	"result" jsonb,
	"start_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"type" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "jobs_priority_range" CHECK ("jobs"."priority" BETWEEN 1 AND 5),
	CONSTRAINT "jobs_status_valid" CHECK ("jobs"."status" IN ('scheduled', 'pending', 'processing', 'cancelled', 'completed', 'failed')),
	CONSTRAINT "jobs_type_valid" CHECK ("jobs"."type" IN ('instant', 'schedule'))
);
--> statement-breakpoint
ALTER TABLE "sent_emails" ADD COLUMN "delivery_key" text;--> statement-breakpoint
ALTER TABLE "job_activity" ADD CONSTRAINT "job_activity_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "job_activity_job_id_event_key_idx" ON "job_activity" USING btree ("job_id","event_key");--> statement-breakpoint
CREATE INDEX "job_activity_job_id_id_idx" ON "job_activity" USING btree ("job_id","id");--> statement-breakpoint
CREATE INDEX "jobs_status_start_at_idx" ON "jobs" USING btree ("status","start_at");--> statement-breakpoint
ALTER TABLE "sent_emails" ADD CONSTRAINT "sent_emails_delivery_key_unique" UNIQUE("delivery_key");
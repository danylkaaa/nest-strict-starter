CREATE TABLE "webhook_calls" (
	"error_message" text,
	"error_name" text,
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"outcome" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_id" text,
	"response_value" integer,
	CONSTRAINT "webhook_calls_id_format" CHECK ("webhook_calls"."id" ~ '^whc_[0-7][0-9A-HJKMNP-TV-Z]{25}$'),
	CONSTRAINT "webhook_calls_outcome_valid" CHECK ("webhook_calls"."outcome" IN ('succeeded', 'failed')),
	CONSTRAINT "webhook_calls_result_consistency" CHECK (("webhook_calls"."outcome" = 'succeeded' AND "webhook_calls"."request_id" IS NOT NULL AND "webhook_calls"."response_value" BETWEEN 0 AND 999999 AND "webhook_calls"."error_name" IS NULL AND "webhook_calls"."error_message" IS NULL) OR ("webhook_calls"."outcome" = 'failed' AND "webhook_calls"."request_id" IS NULL AND "webhook_calls"."response_value" IS NULL AND "webhook_calls"."error_name" IS NOT NULL AND "webhook_calls"."error_message" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX "webhook_calls_job_id_id_idx" ON "webhook_calls" USING btree ("job_id","id");
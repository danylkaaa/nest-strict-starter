CREATE TABLE "job_batches" (
	"cancellation_requested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	CONSTRAINT "job_batches_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "batch_position" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_batch_id_job_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."job_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_batch_id_batch_position_idx" ON "jobs" USING btree ("batch_id","batch_position");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_batch_position_pair" CHECK (("jobs"."batch_id" IS NULL) = ("jobs"."batch_position" IS NULL));--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_batch_position_nonnegative" CHECK ("jobs"."batch_position" IS NULL OR "jobs"."batch_position" >= 0);
CREATE TABLE "aircraft" (
	"cruise_altitude_m" integer NOT NULL,
	"cruise_speed_kmh" integer NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"registration" text NOT NULL,
	CONSTRAINT "aircraft_registration_unique" UNIQUE("registration"),
	CONSTRAINT "aircraft_id_format" CHECK ("aircraft"."id" ~ '^acf_[0-7][0-9A-HJKMNP-TV-Z]{25}$'),
	CONSTRAINT "aircraft_performance_positive" CHECK ("aircraft"."cruise_speed_kmh" > 0 AND "aircraft"."cruise_altitude_m" > 0)
);
--> statement-breakpoint
CREATE TABLE "aircraft_transit_reports" (
	"aircraft_id" text NOT NULL,
	"arrival_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"departure_at" timestamp with time zone NOT NULL,
	"destination_icao" text NOT NULL,
	"distance_km" double precision NOT NULL,
	"duration_minutes" double precision NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"origin_icao" text NOT NULL,
	"waypoints" jsonb NOT NULL,
	CONSTRAINT "aircraft_transit_reports_id_format" CHECK ("aircraft_transit_reports"."id" ~ '^atr_[0-7][0-9A-HJKMNP-TV-Z]{25}$')
);
--> statement-breakpoint
CREATE TABLE "airports" (
	"city" text NOT NULL,
	"country" text NOT NULL,
	"iata" text NOT NULL,
	"icao" text PRIMARY KEY NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "airports_icao_format" CHECK ("airports"."icao" ~ '^[A-Z]{4}$'),
	CONSTRAINT "airports_coordinates_valid" CHECK ("airports"."latitude" BETWEEN -90 AND 90 AND "airports"."longitude" BETWEEN -180 AND 180)
);
--> statement-breakpoint
CREATE TABLE "job_activity" (
	"attempt" integer,
	"error_category" text,
	"event" text NOT NULL,
	"event_key" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_activity_id_format" CHECK ("job_activity"."id" ~ '^jac_[0-7][0-9A-HJKMNP-TV-Z]{25}$'),
	CONSTRAINT "job_activity_event_valid" CHECK ("job_activity"."event" IN ('created', 'started', 'attempt_failed', 'cancelled', 'completed', 'failed', 'retried')),
	CONSTRAINT "job_activity_attempt_positive" CHECK ("job_activity"."attempt" IS NULL OR "job_activity"."attempt" > 0)
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"max_attempts" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"priority" integer NOT NULL,
	"queue" text NOT NULL,
	"result" jsonb,
	"start_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"type" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "jobs_priority_range" CHECK ("jobs"."priority" BETWEEN 1 AND 5),
	CONSTRAINT "jobs_max_attempts_positive" CHECK ("jobs"."max_attempts" >= 1),
	CONSTRAINT "jobs_status_valid" CHECK ("jobs"."status" IN ('scheduled', 'pending', 'processing', 'cancelled', 'completed', 'failed')),
	CONSTRAINT "jobs_queue_valid" CHECK ("jobs"."queue" IN ('email', 'webhook', 'aircraft-report')),
	CONSTRAINT "jobs_type_valid" CHECK ("jobs"."type" IN ('instant', 'schedule'))
);
--> statement-breakpoint
CREATE TABLE "sent_emails" (
	"body" text NOT NULL,
	"delivery_key" text,
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"recipient" text NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"subject" text NOT NULL,
	CONSTRAINT "sent_emails_delivery_key_unique" UNIQUE("delivery_key"),
	CONSTRAINT "sent_emails_message_id_unique" UNIQUE("message_id"),
	CONSTRAINT "sent_emails_id_format" CHECK ("sent_emails"."id" ~ '^eml_[0-7][0-9A-HJKMNP-TV-Z]{25}$')
);
--> statement-breakpoint
CREATE TABLE "webhook_calls" (
	"error_message" text,
	"error_name" text,
	"id" text PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"outcome" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_id" text,
	"response_value" integer,
	CONSTRAINT "webhook_calls_id_format" CHECK ("webhook_calls"."id" ~ '^whc_[0-7][0-9A-HJKMNP-TV-Z]{25}$'),
	CONSTRAINT "webhook_calls_outcome_valid" CHECK ("webhook_calls"."outcome" IN ('succeeded', 'failed')),
	CONSTRAINT "webhook_calls_result_consistency" CHECK (("webhook_calls"."outcome" = 'succeeded' AND "webhook_calls"."request_id" IS NOT NULL AND "webhook_calls"."response_value" IS NOT NULL AND "webhook_calls"."response_value" BETWEEN 0 AND 999999 AND "webhook_calls"."error_name" IS NULL AND "webhook_calls"."error_message" IS NULL) OR ("webhook_calls"."outcome" = 'failed' AND "webhook_calls"."request_id" IS NULL AND "webhook_calls"."response_value" IS NULL AND "webhook_calls"."error_name" IS NOT NULL AND "webhook_calls"."error_message" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "aircraft_transit_reports" ADD CONSTRAINT "aircraft_transit_reports_aircraft_id_aircraft_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_transit_reports" ADD CONSTRAINT "aircraft_transit_reports_destination_icao_airports_icao_fk" FOREIGN KEY ("destination_icao") REFERENCES "public"."airports"("icao") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_transit_reports" ADD CONSTRAINT "aircraft_transit_reports_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_transit_reports" ADD CONSTRAINT "aircraft_transit_reports_origin_icao_airports_icao_fk" FOREIGN KEY ("origin_icao") REFERENCES "public"."airports"("icao") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_activity" ADD CONSTRAINT "job_activity_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_calls" ADD CONSTRAINT "webhook_calls_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "aircraft_transit_reports_job_id_idx" ON "aircraft_transit_reports" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_activity_job_id_event_key_idx" ON "job_activity" USING btree ("job_id","event_key");--> statement-breakpoint
CREATE INDEX "job_activity_job_id_id_idx" ON "job_activity" USING btree ("job_id","id");--> statement-breakpoint
CREATE INDEX "jobs_status_start_at_idx" ON "jobs" USING btree ("status","start_at");--> statement-breakpoint
CREATE INDEX "jobs_created_at_id_idx" ON "jobs" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "webhook_calls_job_id_id_idx" ON "webhook_calls" USING btree ("job_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_calls_job_id_succeeded_idx" ON "webhook_calls" USING btree ("job_id") WHERE "webhook_calls"."outcome" = 'succeeded';
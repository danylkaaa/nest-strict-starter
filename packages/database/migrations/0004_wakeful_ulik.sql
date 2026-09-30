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
ALTER TABLE "aircraft_transit_reports" ADD CONSTRAINT "aircraft_transit_reports_aircraft_id_aircraft_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_transit_reports" ADD CONSTRAINT "aircraft_transit_reports_destination_icao_airports_icao_fk" FOREIGN KEY ("destination_icao") REFERENCES "public"."airports"("icao") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_transit_reports" ADD CONSTRAINT "aircraft_transit_reports_origin_icao_airports_icao_fk" FOREIGN KEY ("origin_icao") REFERENCES "public"."airports"("icao") ON DELETE no action ON UPDATE no action;
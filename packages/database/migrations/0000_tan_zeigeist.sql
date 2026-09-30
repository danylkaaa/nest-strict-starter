CREATE TABLE "sent_emails" (
	"body" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"recipient" text NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"subject" text NOT NULL,
	CONSTRAINT "sent_emails_message_id_unique" UNIQUE("message_id"),
	CONSTRAINT "sent_emails_id_format" CHECK ("sent_emails"."id" ~ '^eml_[0-7][0-9A-HJKMNP-TV-Z]{25}$')
);

CREATE TABLE "grounding_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid,
	"triggered_at" timestamp DEFAULT now(),
	"duration_secs" integer,
	"context" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "protocol_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"module" varchar(20) NOT NULL,
	"started_at" timestamp DEFAULT now(),
	"ended_at" timestamp,
	"completed" boolean DEFAULT false,
	"aborted" boolean DEFAULT false,
	"abort_reason" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "screening_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"instrument" varchar(50) NOT NULL,
	"score" integer NOT NULL,
	"result" varchar(20) NOT NULL,
	"encrypted_responses" text,
	"completed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "suds_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"phase" varchar(20) NOT NULL,
	"recorded_at" timestamp DEFAULT now(),
	CONSTRAINT "rating_range" CHECK ("suds_ratings"."rating" >= 0 AND "suds_ratings"."rating" <= 10)
);
--> statement-breakpoint
CREATE TABLE "tnt_session_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"total_trials" integer,
	"think_trials" integer,
	"no_think_trials" integer,
	"gaze_compliance_pct" numeric,
	"avg_reaction_time_ms" integer
);
--> statement-breakpoint
CREATE TABLE "user_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"screening_complete" boolean DEFAULT false,
	"preparation_complete" boolean DEFAULT false,
	"active_module" varchar(20),
	"last_triage_result" varchar(20),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_status_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "grounding_events" ADD CONSTRAINT "grounding_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grounding_events" ADD CONSTRAINT "grounding_events_session_id_protocol_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."protocol_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocol_sessions" ADD CONSTRAINT "protocol_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_results" ADD CONSTRAINT "screening_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suds_ratings" ADD CONSTRAINT "suds_ratings_session_id_protocol_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."protocol_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tnt_session_data" ADD CONSTRAINT "tnt_session_data_session_id_protocol_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."protocol_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_status" ADD CONSTRAINT "user_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
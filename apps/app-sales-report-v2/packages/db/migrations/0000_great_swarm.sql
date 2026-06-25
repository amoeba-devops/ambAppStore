CREATE TYPE "public"."sal_upload_granularity" AS ENUM('WEEKLY', 'MONTHLY');--> statement-breakpoint
CREATE TYPE "public"."sal_upload_session_status" AS ENUM('PENDING', 'PROCESSING', 'READY', 'FAILED', 'FINALIZED');--> statement-breakpoint
CREATE TYPE "public"."sal_user_local_role" AS ENUM('OPERATOR', 'MANAGER', 'ADMIN');--> statement-breakpoint
CREATE TABLE "sal_upload_sessions" (
	"ups_id" char(36) PRIMARY KEY NOT NULL,
	"ent_id" char(36) NOT NULL,
	"usr_id" char(36) NOT NULL,
	"ups_period_start" date NOT NULL,
	"ups_period_end" date NOT NULL,
	"ups_granularity" "sal_upload_granularity" NOT NULL,
	"ups_status" "sal_upload_session_status" DEFAULT 'PENDING' NOT NULL,
	"ups_worker_id" char(64),
	"ups_retry_count" integer DEFAULT 0 NOT NULL,
	"ups_max_retries" integer DEFAULT 3 NOT NULL,
	"ups_next_retry_at" timestamp with time zone,
	"ups_error_log" text,
	"ups_started_at" timestamp with time zone,
	"ups_finalized_at" timestamp with time zone,
	"ups_finalize_count" integer DEFAULT 0 NOT NULL,
	"ups_last_unfinalized_by" char(36),
	"ups_last_unfinalized_at" timestamp with time zone,
	"ups_created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ups_updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sal_users" (
	"usr_id" char(36) PRIMARY KEY NOT NULL,
	"ent_id" char(36) NOT NULL,
	"usr_ama_user_id" char(36) NOT NULL,
	"usr_email" varchar(255),
	"usr_name" varchar(255),
	"usr_local_role" "sal_user_local_role" DEFAULT 'OPERATOR' NOT NULL,
	"usr_ama_role_snapshot" varchar(32),
	"usr_last_login_at" timestamp with time zone,
	"usr_created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"usr_updated_at" timestamp with time zone,
	"usr_deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_sal_ups_ent_period" ON "sal_upload_sessions" USING btree ("ent_id","ups_period_start","ups_period_end","ups_granularity");--> statement-breakpoint
CREATE INDEX "idx_sal_ups_status_created" ON "sal_upload_sessions" USING btree ("ups_status","ups_created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_sal_users_ent_ama" ON "sal_users" USING btree ("ent_id","usr_ama_user_id");
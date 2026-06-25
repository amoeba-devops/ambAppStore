CREATE TYPE "public"."sal_user_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
ALTER TABLE "sal_users" ADD COLUMN "usr_status" "sal_user_status" DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "sal_users" ADD COLUMN "usr_login_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sal_users" ADD COLUMN "usr_mfa_last_at" timestamp with time zone;
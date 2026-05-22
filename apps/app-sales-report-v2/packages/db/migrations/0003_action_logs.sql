CREATE TYPE "public"."sal_action_category" AS ENUM('UPLOAD', 'APPROVAL', 'MANUAL_INPUT', 'MASTER_DATA', 'FORMULA', 'REPORT', 'EXPORT', 'OTHER');--> statement-breakpoint
CREATE TABLE "sal_action_logs" (
	"act_id" char(36) PRIMARY KEY NOT NULL,
	"ent_id" char(36) NOT NULL,
	"act_user_id" char(36) NOT NULL,
	"act_username" varchar(128) NOT NULL,
	"act_user_role" varchar(16) NOT NULL,
	"act_category" "sal_action_category" NOT NULL,
	"act_verb" varchar(32) NOT NULL,
	"act_target_type" varchar(32),
	"act_target_id" varchar(64),
	"act_target_label" varchar(512) NOT NULL,
	"act_summary" text,
	"act_metadata" jsonb,
	"act_before" jsonb,
	"act_after" jsonb,
	"act_created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_sal_act_ent_created" ON "sal_action_logs" USING btree ("ent_id","act_created_at");--> statement-breakpoint
CREATE INDEX "idx_sal_act_ent_category" ON "sal_action_logs" USING btree ("ent_id","act_category");--> statement-breakpoint
CREATE INDEX "idx_sal_act_user" ON "sal_action_logs" USING btree ("act_user_id");
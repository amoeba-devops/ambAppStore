CREATE TYPE "public"."car_user_local_role" AS ENUM('DRIVER', 'MANAGER', 'ADMIN');--> statement-breakpoint
CREATE TABLE "car_users" (
	"usr_id" char(36) PRIMARY KEY NOT NULL,
	"ent_id" char(36) NOT NULL,
	"usr_ama_user_id" char(36) NOT NULL,
	"usr_email" varchar(255),
	"usr_name" varchar(255),
	"usr_local_role" "car_user_local_role" DEFAULT 'DRIVER' NOT NULL,
	"usr_ama_role_snapshot" varchar(32),
	"usr_preferred_locale" varchar(8),
	"usr_last_login_at" timestamp with time zone,
	"usr_created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"usr_updated_at" timestamp with time zone,
	"usr_deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_car_users_ent_ama" ON "car_users" USING btree ("ent_id","usr_ama_user_id");
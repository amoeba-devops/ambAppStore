-- REQ-20260521 — Admin Settings Auto-Save: per-tenant settings table.
-- Singleton row per ent_id (UNIQUE). Lazy-seeded on first /settings load.
-- See packages/db/src/schema/tenant-settings.schema.ts for column docs.

CREATE TYPE "public"."car_currency" AS ENUM('VND', 'KRW', 'USD');--> statement-breakpoint

CREATE TABLE "car_tenant_settings" (
	"tns_id" char(36) PRIMARY KEY NOT NULL,
	"ent_id" char(36) NOT NULL,
	"tns_tenant_name" varchar(120),
	"tns_currency" "car_currency" DEFAULT 'VND' NOT NULL,
	"tns_timezone" varchar(64) DEFAULT 'Asia/Ho_Chi_Minh' NOT NULL,
	"tns_notif_inapp" boolean DEFAULT true NOT NULL,
	"tns_notif_email" boolean DEFAULT true NOT NULL,
	"tns_notif_digest" boolean DEFAULT true NOT NULL,
	"tns_retention_trip_years" integer DEFAULT 5 NOT NULL,
	"tns_retention_audit_years" integer DEFAULT 5,
	"tns_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tns_updated_by" char(36)
);
--> statement-breakpoint

CREATE UNIQUE INDEX "uniq_car_tenant_settings_ent" ON "car_tenant_settings" USING btree ("ent_id");--> statement-breakpoint

ALTER TABLE "car_tenant_settings" ADD CONSTRAINT "car_tenant_settings_tns_updated_by_car_users_usr_id_fk" FOREIGN KEY ("tns_updated_by") REFERENCES "public"."car_users"("usr_id") ON DELETE set null ON UPDATE no action;

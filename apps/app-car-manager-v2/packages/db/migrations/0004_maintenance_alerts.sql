-- REQ-20260519 Module 2b — Maintenance Alert sidecar (additive to staging-car's 0003).
-- Creates car_maintenance_alerts table + 3 inspection columns on car_vehicles.
-- Does NOT touch car_expenses (already created by staging-car's 0003).

CREATE TYPE "public"."car_maintenance_alert_type" AS ENUM('OIL_OVERDUE', 'OIL_DUE_SOON', 'INSPECTION_OVERDUE', 'INSPECTION_DUE_SOON');--> statement-breakpoint
CREATE TYPE "public"."car_maintenance_alert_severity" AS ENUM('WARNING', 'CRITICAL');--> statement-breakpoint

CREATE TABLE "car_maintenance_alerts" (
	"mal_id" char(36) PRIMARY KEY NOT NULL,
	"ent_id" char(36) NOT NULL,
	"mal_vehicle_id" char(36) NOT NULL,
	"mal_type" "car_maintenance_alert_type" NOT NULL,
	"mal_severity" "car_maintenance_alert_severity" NOT NULL,
	"mal_due_at" timestamp with time zone,
	"mal_due_km" integer,
	"mal_current_odometer_km" integer,
	"mal_acknowledged_at" timestamp with time zone,
	"mal_acknowledged_by" char(36),
	"mal_resolved_at" timestamp with time zone,
	"mal_created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Inspection tracking columns added to existing car_vehicles table.
ALTER TABLE "car_vehicles" ADD COLUMN IF NOT EXISTS "cvh_last_inspection_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "car_vehicles" ADD COLUMN IF NOT EXISTS "cvh_next_inspection_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "car_vehicles" ADD COLUMN IF NOT EXISTS "cvh_inspection_interval_months" smallint DEFAULT 12 NOT NULL;--> statement-breakpoint

-- Foreign keys.
ALTER TABLE "car_maintenance_alerts" ADD CONSTRAINT "car_maintenance_alerts_mal_vehicle_id_car_vehicles_cvh_id_fk" FOREIGN KEY ("mal_vehicle_id") REFERENCES "public"."car_vehicles"("cvh_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_maintenance_alerts" ADD CONSTRAINT "car_maintenance_alerts_mal_acknowledged_by_car_users_usr_id_fk" FOREIGN KEY ("mal_acknowledged_by") REFERENCES "public"."car_users"("usr_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Indexes (partial WHERE for unresolved subset).
CREATE INDEX "idx_car_maintenance_alerts_ent_unresolved" ON "car_maintenance_alerts" USING btree ("ent_id","mal_vehicle_id") WHERE "car_maintenance_alerts"."mal_resolved_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_car_maintenance_alerts_vehicle_type_created" ON "car_maintenance_alerts" USING btree ("mal_vehicle_id","mal_type","mal_created_at");

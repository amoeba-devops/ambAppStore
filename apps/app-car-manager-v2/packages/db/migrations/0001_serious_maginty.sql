CREATE TYPE "public"."car_driver_license_class" AS ENUM('A2', 'B1', 'B2', 'C', 'D', 'E', 'F');--> statement-breakpoint
CREATE TYPE "public"."car_driver_status" AS ENUM('AVAILABLE', 'ON_TRIP', 'OFF_DUTY', 'UNAVAILABLE');--> statement-breakpoint
CREATE TYPE "public"."car_trip_status" AS ENUM('PENDING_ASSIGNMENT', 'PENDING_DRIVER_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED_BY_DRIVER', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."car_vehicle_fuel" AS ENUM('PETROL', 'DIESEL', 'HYBRID', 'EV');--> statement-breakpoint
CREATE TYPE "public"."car_vehicle_status" AS ENUM('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED');--> statement-breakpoint
CREATE TABLE "car_audit_logs" (
	"aud_id" char(36) PRIMARY KEY NOT NULL,
	"ent_id" char(36) NOT NULL,
	"aud_user_id" char(36),
	"aud_action" varchar(64) NOT NULL,
	"aud_entity" varchar(32) NOT NULL,
	"aud_entity_id" char(36),
	"aud_entity_ref" varchar(40),
	"aud_before" jsonb,
	"aud_after" jsonb,
	"aud_ip" varchar(45),
	"aud_user_agent" text,
	"aud_created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "car_drivers" (
	"drv_id" char(36) PRIMARY KEY NOT NULL,
	"ent_id" char(36) NOT NULL,
	"drv_user_id" char(36) NOT NULL,
	"drv_license_number" varchar(50) NOT NULL,
	"drv_license_class" "car_driver_license_class" DEFAULT 'B2' NOT NULL,
	"drv_license_expiry" date NOT NULL,
	"drv_phone" varchar(20),
	"drv_status" "car_driver_status" DEFAULT 'AVAILABLE' NOT NULL,
	"drv_emergency_contact" varchar(100),
	"drv_notes" text,
	"drv_created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"drv_updated_at" timestamp with time zone,
	"drv_deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "car_notifications" (
	"ntf_id" char(36) PRIMARY KEY NOT NULL,
	"ent_id" char(36) NOT NULL,
	"ntf_user_id" char(36) NOT NULL,
	"ntf_event" varchar(64) NOT NULL,
	"ntf_title" varchar(255) NOT NULL,
	"ntf_body" text,
	"ntf_entity_id" char(36),
	"ntf_entity_ref" varchar(40),
	"ntf_read_at" timestamp with time zone,
	"ntf_created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "car_trip_stopovers" (
	"tst_id" char(36) PRIMARY KEY NOT NULL,
	"ent_id" char(36) NOT NULL,
	"tst_trip_id" char(36) NOT NULL,
	"tst_address" text NOT NULL,
	"tst_order" smallint NOT NULL,
	"tst_created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "car_trips" (
	"trp_id" char(36) PRIMARY KEY NOT NULL,
	"ent_id" char(36) NOT NULL,
	"trp_ref" varchar(20) NOT NULL,
	"trp_creator_id" char(36) NOT NULL,
	"trp_passenger_id" char(36),
	"trp_driver_id" char(36),
	"trp_vehicle_id" char(36),
	"trp_status" "car_trip_status" DEFAULT 'PENDING_ASSIGNMENT' NOT NULL,
	"trp_pickup_address" text NOT NULL,
	"trp_dropoff_address" text NOT NULL,
	"trp_scheduled_at" timestamp with time zone NOT NULL,
	"trp_duration_minutes" smallint,
	"trp_purpose" varchar(255),
	"trp_notes" text,
	"trp_google_maps_url" text,
	"trp_started_at" timestamp with time zone,
	"trp_ended_at" timestamp with time zone,
	"trp_start_odometer" integer,
	"trp_end_odometer" integer,
	"trp_reject_reason" text,
	"trp_cancel_reason" text,
	"trp_created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trp_updated_at" timestamp with time zone,
	"trp_deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "car_vehicles" (
	"cvh_id" char(36) PRIMARY KEY NOT NULL,
	"ent_id" char(36) NOT NULL,
	"cvh_plate_number" varchar(20) NOT NULL,
	"cvh_model" varchar(100) NOT NULL,
	"cvh_make" varchar(50),
	"cvh_year" smallint,
	"cvh_color" varchar(50),
	"cvh_fuel_type" "car_vehicle_fuel" DEFAULT 'PETROL' NOT NULL,
	"cvh_status" "car_vehicle_status" DEFAULT 'AVAILABLE' NOT NULL,
	"cvh_odometer_km" integer DEFAULT 0 NOT NULL,
	"cvh_last_oil_change_km" integer,
	"cvh_last_oil_change_at" timestamp with time zone,
	"cvh_oil_interval_km" integer DEFAULT 5000 NOT NULL,
	"cvh_oil_interval_months" smallint DEFAULT 3 NOT NULL,
	"cvh_home_base" varchar(100),
	"cvh_notes" text,
	"cvh_created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cvh_updated_at" timestamp with time zone,
	"cvh_deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "car_audit_logs" ADD CONSTRAINT "car_audit_logs_aud_user_id_car_users_usr_id_fk" FOREIGN KEY ("aud_user_id") REFERENCES "public"."car_users"("usr_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_drivers" ADD CONSTRAINT "car_drivers_drv_user_id_car_users_usr_id_fk" FOREIGN KEY ("drv_user_id") REFERENCES "public"."car_users"("usr_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_notifications" ADD CONSTRAINT "car_notifications_ntf_user_id_car_users_usr_id_fk" FOREIGN KEY ("ntf_user_id") REFERENCES "public"."car_users"("usr_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_trip_stopovers" ADD CONSTRAINT "car_trip_stopovers_tst_trip_id_car_trips_trp_id_fk" FOREIGN KEY ("tst_trip_id") REFERENCES "public"."car_trips"("trp_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_trips" ADD CONSTRAINT "car_trips_trp_creator_id_car_users_usr_id_fk" FOREIGN KEY ("trp_creator_id") REFERENCES "public"."car_users"("usr_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_trips" ADD CONSTRAINT "car_trips_trp_passenger_id_car_users_usr_id_fk" FOREIGN KEY ("trp_passenger_id") REFERENCES "public"."car_users"("usr_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_trips" ADD CONSTRAINT "car_trips_trp_driver_id_car_drivers_drv_id_fk" FOREIGN KEY ("trp_driver_id") REFERENCES "public"."car_drivers"("drv_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_trips" ADD CONSTRAINT "car_trips_trp_vehicle_id_car_vehicles_cvh_id_fk" FOREIGN KEY ("trp_vehicle_id") REFERENCES "public"."car_vehicles"("cvh_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_car_audit_logs_ent_created" ON "car_audit_logs" USING btree ("ent_id","aud_created_at");--> statement-breakpoint
CREATE INDEX "idx_car_audit_logs_entity" ON "car_audit_logs" USING btree ("aud_entity","aud_entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_car_drivers_ent_user" ON "car_drivers" USING btree ("ent_id","drv_user_id") WHERE "car_drivers"."drv_deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_car_drivers_ent_status" ON "car_drivers" USING btree ("ent_id","drv_status");--> statement-breakpoint
CREATE INDEX "idx_car_drivers_license_expiry" ON "car_drivers" USING btree ("drv_license_expiry");--> statement-breakpoint
CREATE INDEX "idx_car_notifications_user_unread" ON "car_notifications" USING btree ("ntf_user_id","ntf_read_at");--> statement-breakpoint
CREATE INDEX "idx_car_trip_stopovers_trip_order" ON "car_trip_stopovers" USING btree ("tst_trip_id","tst_order");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_car_trips_ent_ref" ON "car_trips" USING btree ("ent_id","trp_ref") WHERE "car_trips"."trp_deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_car_trips_ent_status_scheduled" ON "car_trips" USING btree ("ent_id","trp_status","trp_scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_car_trips_creator" ON "car_trips" USING btree ("trp_creator_id");--> statement-breakpoint
CREATE INDEX "idx_car_trips_driver" ON "car_trips" USING btree ("trp_driver_id");--> statement-breakpoint
CREATE INDEX "idx_car_trips_vehicle" ON "car_trips" USING btree ("trp_vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_car_vehicles_ent_plate" ON "car_vehicles" USING btree ("ent_id","cvh_plate_number") WHERE "car_vehicles"."cvh_deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_car_vehicles_ent_status" ON "car_vehicles" USING btree ("ent_id","cvh_status");
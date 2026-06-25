-- Module 2 follow-up: allow Admin/Manager to record expenses directly per
-- vehicle without a trip context, per PRD §2.4 "ghi nhận chi phí theo từng xe".
--
-- Two related changes:
--   1. NEW column `exp_vehicle_id` → direct FK to `car_vehicles`. Drivers
--      submitting through a trip can still leave it NULL (trip carries the
--      vehicle); Admin/Manager submitting without a trip MUST populate it.
--   2. Drop NOT NULL from `exp_driver_id` so an Admin can record a vehicle
--      expense without knowing which driver was using the car at the time.
--      The driver-submit path still inserts the FK; the application layer
--      enforces the role-based requirement.
--
-- New index on `(ent_id, exp_vehicle_id)` matches the access pattern of the
-- /costs page filter ("expenses for this vehicle") so the per-vehicle query
-- doesn't fall back to the entity-wide scan.

ALTER TABLE "car_expenses"
  ADD COLUMN "exp_vehicle_id" char(36);
--> statement-breakpoint
ALTER TABLE "car_expenses"
  ADD CONSTRAINT "car_expenses_exp_vehicle_id_car_vehicles_cvh_id_fk"
  FOREIGN KEY ("exp_vehicle_id") REFERENCES "public"."car_vehicles"("cvh_id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "car_expenses"
  ALTER COLUMN "exp_driver_id" DROP NOT NULL;
--> statement-breakpoint
CREATE INDEX "idx_car_expenses_ent_vehicle"
  ON "car_expenses" USING btree ("ent_id", "exp_vehicle_id");

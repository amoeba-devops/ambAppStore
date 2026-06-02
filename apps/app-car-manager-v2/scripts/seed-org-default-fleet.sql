-- ─────────────────────────────────────────────────────────────────────────
-- Org default fleet — manual data migration (staging / prod)
--
-- Seeds (or MIGRATES, via ON CONFLICT DO UPDATE) the default org's fleet:
--   • 3 driver users + 3 car_drivers — Nguyễn Quốc Bảo, Phan Huỳnh Hiếu,
--     Nguyễn Minh Lâm  (placeholder licences — fill real values via the app)
--   • 3 car_vehicles — Peugeot, Sedona, Cross  (placeholder plates)
--
-- Vehicle ↔ driver pairing is NOT a fixed column (no cvh_default_driver_id) —
-- it is expressed through trips, matching the app model.
--
-- Idempotent + re-runnable. Deterministic IDs are kept stable so existing
-- trip/audit FKs survive and a re-run updates rows in place. This is the SQL
-- twin of scripts/db-seed.mjs (users/drivers/vehicles blocks).
--
-- NOT a Drizzle migration (lives in scripts/, not packages/db/migrations/) so
-- it never auto-runs on fresh databases / production via `drizzle-kit migrate`.
--
-- Pure SQL — no psql meta-commands — so it runs in psql AND the Neon SQL editor.
--
-- RUN (staging):
--   psql "$DATABASE_URL_STAGING" -f scripts/seed-org-default-fleet.sql
-- or paste into the Neon SQL editor for the staging branch.
--
-- For a different org, find/replace the ent_id UUID below
-- ('00000000-0000-4000-8000-000000000010') with the target entity's id
-- (must be a v4-shaped UUID that AMA's uuidValidate accepts).
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1) Driver users (car_drivers.drv_user_id FK → car_users.usr_id) ───────────
INSERT INTO car_users (usr_id, ent_id, usr_ama_user_id, usr_email, usr_name, usr_local_role, usr_ama_role_snapshot)
VALUES
  ('11111111-1111-1111-1111-111111111101', '00000000-0000-4000-8000-000000000010', '11111111-1111-1111-1111-111111111101', 'bao.nguyen@hanatech.vn', 'Nguyễn Quốc Bảo', 'DRIVER', 'MEMBER'),
  ('11111111-1111-1111-1111-111111111102', '00000000-0000-4000-8000-000000000010', '11111111-1111-1111-1111-111111111102', 'hieu.phan@hanatech.vn',  'Phan Huỳnh Hiếu', 'DRIVER', 'MEMBER'),
  ('11111111-1111-1111-1111-111111111103', '00000000-0000-4000-8000-000000000010', '11111111-1111-1111-1111-111111111103', 'lam.nguyen@hanatech.vn', 'Nguyễn Minh Lâm', 'DRIVER', 'MEMBER')
ON CONFLICT (usr_id) DO UPDATE SET
  usr_email             = EXCLUDED.usr_email,
  usr_name              = EXCLUDED.usr_name,
  usr_local_role        = EXCLUDED.usr_local_role,
  usr_ama_role_snapshot = EXCLUDED.usr_ama_role_snapshot;

-- 2) Drivers — placeholder licences (TBD) ──────────────────────────────────
INSERT INTO car_drivers (drv_id, ent_id, drv_user_id, drv_license_number, drv_license_class, drv_license_expiry, drv_phone, drv_status)
VALUES
  ('22222222-2222-2222-2222-222222222201', '00000000-0000-4000-8000-000000000010', '11111111-1111-1111-1111-111111111101', 'TBD-0001', 'B2', '2028-12-31', NULL, 'AVAILABLE'),
  ('22222222-2222-2222-2222-222222222202', '00000000-0000-4000-8000-000000000010', '11111111-1111-1111-1111-111111111102', 'TBD-0002', 'B2', '2028-12-31', NULL, 'AVAILABLE'),
  ('22222222-2222-2222-2222-222222222203', '00000000-0000-4000-8000-000000000010', '11111111-1111-1111-1111-111111111103', 'TBD-0003', 'B2', '2028-12-31', NULL, 'AVAILABLE')
ON CONFLICT (drv_id) DO UPDATE SET
  drv_license_number = EXCLUDED.drv_license_number,
  drv_license_class  = EXCLUDED.drv_license_class,
  drv_license_expiry = EXCLUDED.drv_license_expiry,
  drv_phone          = EXCLUDED.drv_phone,
  drv_status         = EXCLUDED.drv_status;

-- 3) Vehicles — placeholder plates (TBD) ───────────────────────────────────
INSERT INTO car_vehicles (cvh_id, ent_id, cvh_plate_number, cvh_model, cvh_make, cvh_year, cvh_color, cvh_status, cvh_odometer_km, cvh_last_oil_change_km, cvh_last_oil_change_at, cvh_home_base)
VALUES
  ('33333333-3333-3333-3333-333333333301', '00000000-0000-4000-8000-000000000010', 'TBD-0001', 'Peugeot', 'Peugeot', NULL, NULL, 'AVAILABLE', 0, NULL, NULL, NULL),
  ('33333333-3333-3333-3333-333333333302', '00000000-0000-4000-8000-000000000010', 'TBD-0002', 'Sedona',  'Kia',     NULL, NULL, 'AVAILABLE', 0, NULL, NULL, NULL),
  ('33333333-3333-3333-3333-333333333303', '00000000-0000-4000-8000-000000000010', 'TBD-0003', 'Cross',   NULL,      NULL, NULL, 'AVAILABLE', 0, NULL, NULL, NULL)
ON CONFLICT (cvh_id) DO UPDATE SET
  cvh_plate_number       = EXCLUDED.cvh_plate_number,
  cvh_model              = EXCLUDED.cvh_model,
  cvh_make               = EXCLUDED.cvh_make,
  cvh_year               = EXCLUDED.cvh_year,
  cvh_color              = EXCLUDED.cvh_color,
  cvh_status             = EXCLUDED.cvh_status,
  cvh_odometer_km        = EXCLUDED.cvh_odometer_km,
  cvh_last_oil_change_km = EXCLUDED.cvh_last_oil_change_km,
  cvh_last_oil_change_at = EXCLUDED.cvh_last_oil_change_at,
  cvh_home_base          = EXCLUDED.cvh_home_base;

COMMIT;

-- Verify:
--   SELECT cvh_plate_number, cvh_make, cvh_model, cvh_status FROM car_vehicles
--     WHERE ent_id = '00000000-0000-4000-8000-000000000010' AND cvh_deleted_at IS NULL;
--   SELECT u.usr_name, d.drv_license_number, d.drv_status FROM car_drivers d
--     JOIN car_users u ON u.usr_id = d.drv_user_id
--     WHERE d.ent_id = '00000000-0000-4000-8000-000000000010' AND d.drv_deleted_at IS NULL;

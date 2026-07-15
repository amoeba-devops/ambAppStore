-- 0019_truck_report_region.sql
-- Multi-region truck reports. A generated monthly report is now scoped to ONE
-- operating region (HCM / DONG_NAI / BAIKSAN, see TRUCK_REGIONS); the "Lập báo
-- cáo" wizard lets a manager multi-select regions and fan out one report per
-- region. `trr_region` records that scope so the month picker can show
-- "Đã xuất X/3 khu vực" (how many distinct regions have been exported).
-- NULL = legacy whole-fleet report (pre-region rows). Apply manually on every
-- branch. Idempotent.

-- (1) Report region scope --------------------------------------------------
ALTER TABLE car_truck_reports ADD COLUMN IF NOT EXISTS trr_region VARCHAR(40);
CREATE INDEX IF NOT EXISTS idx_car_truck_reports_ent_month_region
  ON car_truck_reports (ent_id, trr_month, trr_region);

-- (2) Backfill region from the S3 key of existing rows ---------------------
-- Key shape: truck-reports/{ent}/{month}/{TYPE}-{REGION|all}-{uuid}.xlsx
-- Capture the uppercase region token between the type and the (lowercase-hex)
-- uuid. 'all' is lowercase so it won't match → those rows stay NULL.
UPDATE car_truck_reports
   SET trr_region = substring(trr_s3_key FROM '(?:PNL|TRIP_LOG|VEHICLE)-([A-Z_]+)-')
 WHERE trr_region IS NULL;

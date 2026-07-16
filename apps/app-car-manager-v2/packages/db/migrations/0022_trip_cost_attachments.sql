-- 0022_trip_cost_attachments.sql
-- REQ-20260709 — Receipt/invoice/document uploads for truck trip-log costs.
-- Image + PDF attached to a trip's FUEL / TOLL / EXTRA costs. Rows hold the S3
-- key only (never file bytes). Trip-scoped + tagged by cost kind rather than
-- FK'd to individual car_trip_extra_costs rows (those are delete+reinserted on
-- every edit). Soft delete via tca_deleted_at keeps rows + S3 objects for audit.
-- Apply manually on every branch. Idempotent.

CREATE TABLE IF NOT EXISTS car_trip_cost_attachments (
  tca_id          CHAR(36) PRIMARY KEY,
  ent_id          CHAR(36) NOT NULL,
  trp_id          CHAR(36) NOT NULL REFERENCES car_trips (trp_id),
  tca_cost_kind   VARCHAR(10) NOT NULL,               -- FUEL | TOLL | EXTRA
  tca_s3_key      TEXT NOT NULL,
  tca_mime        VARCHAR(64) NOT NULL,
  tca_size_bytes  BIGINT NOT NULL,
  tca_uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tca_deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_car_trip_cost_attachments_trip
  ON car_trip_cost_attachments (trp_id);

CREATE INDEX IF NOT EXISTS idx_car_trip_cost_attachments_ent_trip
  ON car_trip_cost_attachments (ent_id, trp_id);

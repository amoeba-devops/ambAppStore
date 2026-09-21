-- 0035_truck_invoice_module.sql — REQ-20260921 truck-invoice-module
-- (1) Thêm uploaded_by cho 3 bảng attachment hiện có + backfill best-effort từ S3 key.
-- (2) Bảng mới car_truck_fuel_invoice_attachments (optional, 0..n file / hóa đơn xăng dầu).
--
-- Migration THỦ CÔNG (không nằm trong drizzle journal) — idempotent.
-- Nhớ probe trong scripts/check-manual-migrations.mjs.

ALTER TABLE car_trip_cost_attachments
  ADD COLUMN IF NOT EXISTS tca_uploaded_by CHAR(36);
ALTER TABLE car_truck_maintenance_attachments
  ADD COLUMN IF NOT EXISTS tma_uploaded_by CHAR(36);
ALTER TABLE car_expense_attachments
  ADD COLUMN IF NOT EXISTS eat_uploaded_by CHAR(36);

-- Backfill: segment thứ 3 của s3_key `{entId}/{resource}/{userId}/{uuid}-name`
-- là userId thật (route ghi actor.userId vào đúng vị trí này — xem
-- REQ-20260921 §2.1). Validate dạng UUID trước khi set — key lệch format thì
-- để NULL (UI fallback "—") thay vì lưu rác.
UPDATE car_trip_cost_attachments t
   SET tca_uploaded_by = split_part(t.tca_s3_key, '/', 3)
 WHERE t.tca_uploaded_by IS NULL
   AND split_part(t.tca_s3_key, '/', 3)
       ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

UPDATE car_truck_maintenance_attachments t
   SET tma_uploaded_by = split_part(t.tma_s3_key, '/', 3)
 WHERE t.tma_uploaded_by IS NULL
   AND split_part(t.tma_s3_key, '/', 3)
       ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

UPDATE car_expense_attachments t
   SET eat_uploaded_by = split_part(t.eat_s3_key, '/', 3)
 WHERE t.eat_uploaded_by IS NULL
   AND split_part(t.eat_s3_key, '/', 3)
       ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

CREATE TABLE IF NOT EXISTS "car_truck_fuel_invoice_attachments" (
  "tfa_id"          char(36) PRIMARY KEY NOT NULL,
  "ent_id"          char(36) NOT NULL,
  "tfi_id"          char(36) NOT NULL,
  "tfa_s3_key"      text NOT NULL,
  "tfa_mime"        varchar(64) NOT NULL,
  "tfa_size_bytes"  bigint NOT NULL,
  "tfa_file_name"   varchar(255),
  "tfa_uploaded_by" char(36),
  "tfa_uploaded_at" timestamptz NOT NULL DEFAULT now(),
  "tfa_deleted_at"  timestamptz
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "car_truck_fuel_invoice_attachments"
    ADD CONSTRAINT "car_truck_fuel_invoice_attachments_tfi_id_fk"
    FOREIGN KEY ("tfi_id") REFERENCES "public"."car_truck_fuel_invoices"("tfi_id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_car_truck_fuel_invoice_attachments_ent_tfi"
  ON "car_truck_fuel_invoice_attachments" USING btree ("ent_id", "tfi_id");

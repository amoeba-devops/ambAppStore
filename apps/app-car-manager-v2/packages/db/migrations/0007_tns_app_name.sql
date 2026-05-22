-- Admin-customisable app name shown in the sidebar brand header.
-- Nullable so admins can clear it back to the i18n default ("Fleet").
-- See packages/db/src/schema/tenant-settings.schema.ts for the field doc.

ALTER TABLE "car_tenant_settings" ADD COLUMN "tns_app_name" varchar(120);

-- 0018_archive_file_type_affiliate_split.sql
-- TikTok split the single Affiliate export into 3 order-level reports. Add
-- two new enum values so the raw archive can distinguish Creator (existing
-- AFFILIATE) from Partner and Non-collaboration variants. Idempotent via
-- IF NOT EXISTS so re-runs on a dev branch that already has them are safe.
--
-- See REQ-20260528-tiktok-affiliate-3-files.

ALTER TYPE "sal_archive_file_type" ADD VALUE IF NOT EXISTS 'AFFILIATE_PARTNER';
ALTER TYPE "sal_archive_file_type" ADD VALUE IF NOT EXISTS 'AFFILIATE_NONCOLLAB';

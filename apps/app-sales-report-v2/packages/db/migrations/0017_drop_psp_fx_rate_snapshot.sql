-- 0017_drop_psp_fx_rate_snapshot.sql
-- Drop unused `psp_fx_rate_snapshot` column added in 0016. Decided
-- against freezing FX rate at finalize time — KRW is display-only
-- (live reference per SRD §5.5), never used in stored numbers, so
-- there is nothing to "snapshot". Column stayed NULL since added.

BEGIN;

ALTER TABLE sal_period_snapshots
  DROP COLUMN IF EXISTS psp_fx_rate_snapshot;

COMMIT;

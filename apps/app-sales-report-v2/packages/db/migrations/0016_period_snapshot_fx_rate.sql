-- 0016_period_snapshot_fx_rate.sql
-- Adds `psp_fx_rate_snapshot` to `sal_period_snapshots` — captures the
-- VND-per-KRW rate active when a period was first finalized. Frozen rate
-- prevents historical KRW values from drifting when the live rate
-- (`sal_fx_rates`) is changed later.
--
-- Nullable: existing snapshots from before this column was added stay NULL;
-- read paths fall back to live `sal_fx_rates` for those.

BEGIN;

ALTER TABLE sal_period_snapshots
  ADD COLUMN IF NOT EXISTS psp_fx_rate_snapshot NUMERIC(10, 4);

COMMIT;

-- 0008_prime_cost_versions.sql
-- Adds versioned prime cost support for per-shipment cost tracking.
-- Backfills 1 sentinel version per existing active SKU (effective_from = 2020-01-01).
--
-- See REQ-20260521-prime-cost-versioning + PLAN-20260521-prime-cost-versioning.

BEGIN;

CREATE TABLE IF NOT EXISTS sal_prime_cost_versions (
  pcv_id              CHAR(36) PRIMARY KEY,
  ent_id              CHAR(36) NOT NULL,
  pcs_id              CHAR(36) NOT NULL REFERENCES sal_prime_costs(pcs_id) ON DELETE CASCADE,
  pcv_effective_from  DATE NOT NULL,
  pcv_prime_cost_vnd  NUMERIC(18, 2) NOT NULL CHECK (pcv_prime_cost_vnd >= 0),
  pcv_breakdown       JSONB,
  pcv_source_note     VARCHAR(255),
  pcv_created_by      CHAR(36) NOT NULL,
  pcv_created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pcv_updated_at      TIMESTAMPTZ,
  pcv_deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_sal_pcv_ent_sku_date
  ON sal_prime_cost_versions (ent_id, pcs_id, pcv_effective_from)
  WHERE pcv_deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sal_pcv_ent_sku_date
  ON sal_prime_cost_versions (ent_id, pcs_id, pcv_effective_from);

CREATE INDEX IF NOT EXISTS idx_sal_pcv_ent_eff
  ON sal_prime_cost_versions (ent_id, pcv_effective_from);

-- Backfill: one sentinel version per active SKU, capturing today's pcs_prime_cost_vnd.
-- Skips SKUs that already have versions (idempotent re-run safety).
INSERT INTO sal_prime_cost_versions
  (pcv_id, ent_id, pcs_id, pcv_effective_from, pcv_prime_cost_vnd,
   pcv_source_note, pcv_created_by, pcv_created_at)
SELECT
  gen_random_uuid()::TEXT,
  pc.ent_id,
  pc.pcs_id,
  DATE '2020-01-01',
  pc.pcs_prime_cost_vnd,
  'Backfilled from sal_prime_costs migration 0008',
  pc.pcs_created_by,
  pc.pcs_created_at
FROM sal_prime_costs pc
WHERE pc.pcs_deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM sal_prime_cost_versions v
    WHERE v.pcs_id = pc.pcs_id AND v.pcv_deleted_at IS NULL
  );

COMMIT;

-- Verification (run separately, outside the transaction):
--   SELECT
--     (SELECT COUNT(*) FROM sal_prime_costs WHERE pcs_deleted_at IS NULL) AS master_active,
--     (SELECT COUNT(*) FROM sal_prime_cost_versions WHERE pcv_deleted_at IS NULL) AS versions_total;
--   Expected: master_active == versions_total (post-migration).

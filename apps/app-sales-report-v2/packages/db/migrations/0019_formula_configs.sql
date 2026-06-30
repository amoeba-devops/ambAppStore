-- 0019_formula_configs.sql
-- Generic key/value config table for formula constants + categorical settings
-- previously hardcoded in TypeScript. Versioned by ffc_effective_from
-- (latest-wins per ent_id+key). NULL ent_id = global default.
--
-- See REQ-20260630-formula-config-persist (FR-23).

BEGIN;

CREATE TABLE IF NOT EXISTS sal_formula_configs (
  ffc_id              CHAR(36)        PRIMARY KEY,
  ent_id              CHAR(36),
  ffc_key             VARCHAR(64)     NOT NULL,
  ffc_value           VARCHAR(255)    NOT NULL,
  ffc_value_type      VARCHAR(16)     NOT NULL,
  ffc_unit            VARCHAR(16),
  ffc_effective_from  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ffc_source_note     VARCHAR(255),
  ffc_created_by      CHAR(36),
  ffc_created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ffc_deleted_at      TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sal_ffc_ent_key_effective
  ON sal_formula_configs (ent_id, ffc_key, ffc_effective_from DESC)
  WHERE ffc_deleted_at IS NULL;

-- Seed global defaults. Use deterministic UUIDs (manually authored) so re-runs
-- on dev are idempotent — INSERT ... ON CONFLICT DO NOTHING.
INSERT INTO sal_formula_configs
  (ffc_id, ent_id, ffc_key, ffc_value, ffc_value_type, ffc_unit, ffc_effective_from, ffc_source_note)
VALUES
  (
    '00000000-0000-4000-a000-000000001001', NULL,
    'tiktok_platform_fee_rate_pct', '24', 'percentage', '%',
    '2020-01-01T00:00:00Z',
    'Initial default TikTok Shop platform fee rate (24%)'
  ),
  (
    '00000000-0000-4000-a000-000000001002', NULL,
    'tiktok_platform_fee_rate_pct', '26', 'percentage', '%',
    '2026-05-09T00:00:00Z',
    'TikTok Shop policy update — 26% effective 2026-05-09'
  )
ON CONFLICT (ffc_id) DO NOTHING;

COMMIT;

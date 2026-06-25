-- 0011_prime_cost_is_combo.sql
-- Adds `pcs_is_combo` flag so Shopee/TikTok Product Breakdown can render combo
-- SKUs as separate rows from the parent product. See client feedback: a Shopee
-- product (1 productName) can host multiple option SKUs including bundle/combo
-- variants — the combo should not aggregate with regular options.

BEGIN;

ALTER TABLE sal_prime_costs
  ADD COLUMN IF NOT EXISTS pcs_is_combo BOOLEAN NOT NULL DEFAULT FALSE;

-- Optional: index for common filter "show me only combos" (Phase 2 backlog).
CREATE INDEX IF NOT EXISTS idx_sal_pcs_ent_is_combo
  ON sal_prime_costs (ent_id, pcs_is_combo)
  WHERE pcs_deleted_at IS NULL;

COMMIT;

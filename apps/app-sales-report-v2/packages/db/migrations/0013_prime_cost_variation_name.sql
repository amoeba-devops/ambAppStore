-- 0013_prime_cost_variation_name.sql
-- Adds `pcs_variation_name` — Shopee's option/variation display name
-- (e.g. "Phới nhỏ", "Phới lớn", "Combo nhỏ + lớn") to differentiate SKUs
-- that share the same parent product name.

BEGIN;

ALTER TABLE sal_prime_costs
  ADD COLUMN IF NOT EXISTS pcs_variation_name VARCHAR(255);

COMMIT;

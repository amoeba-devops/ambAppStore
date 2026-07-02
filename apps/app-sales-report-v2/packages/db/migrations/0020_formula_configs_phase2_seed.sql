-- 0020_formula_configs_phase2_seed.sql
-- Phase 2 of REQ-20260630: seed default rows for the additional registered
-- params (HQ Margin / VAT / Fulfillment Fee + 4 categorical settings). The
-- UI auto-renders any registered key, so seeding these makes them visible
-- and editable immediately. None are wired into the calculator yet —
-- editing today is for documentation + future readiness.

BEGIN;

INSERT INTO sal_formula_configs
  (ffc_id, ent_id, ffc_key, ffc_value, ffc_value_type, ffc_unit, ffc_effective_from, ffc_source_note)
VALUES
  (
    '00000000-0000-4000-a000-000000002001', NULL,
    'hq_margin_pct', '5', 'percentage', '%',
    '2020-01-01T00:00:00Z',
    'Default HQ margin (currently documentation-only)'
  ),
  (
    '00000000-0000-4000-a000-000000002002', NULL,
    'vat_rate_pct', '10', 'percentage', '%',
    '2020-01-01T00:00:00Z',
    'Default VAT rate'
  ),
  (
    '00000000-0000-4000-a000-000000002003', NULL,
    'fulfillment_fee_vnd', '14000', 'currency', 'VND',
    '2020-01-01T00:00:00Z',
    'Default fulfillment fee per unit'
  ),
  (
    '00000000-0000-4000-a000-000000002004', NULL,
    'excluded_order_statuses', 'CANCELLED, RETURNED, REFUNDED', 'enum', NULL,
    '2020-01-01T00:00:00Z',
    'Default excluded order statuses (calculator hardcoded today)'
  ),
  (
    '00000000-0000-4000-a000-000000002005', NULL,
    'free_gift_detection_prefix', '[GIFT]', 'enum', NULL,
    '2020-01-01T00:00:00Z',
    'Product-name prefix flagging a Free Gift row'
  ),
  (
    '00000000-0000-4000-a000-000000002006', NULL,
    'affiliate_booking_split_basis', 'GMV', 'enum', NULL,
    '2020-01-01T00:00:00Z',
    'Cross-platform Affiliate Booking Fee split rule'
  ),
  (
    '00000000-0000-4000-a000-000000002007', NULL,
    'week_definition', 'Friday → Thursday', 'enum', NULL,
    '2020-01-01T00:00:00Z',
    'Weekly report calendar boundary (FIRGI spec)'
  )
ON CONFLICT (ffc_id) DO NOTHING;

COMMIT;

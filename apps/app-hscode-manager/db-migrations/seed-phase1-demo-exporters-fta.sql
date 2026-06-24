-- HS Code Manager — Demo Exporters + FTA Rows
-- 2026-05-13
--
-- 시연용 데모 시드. 운영 환경에서는 *실제 거래처 데이터*로 교체.
-- ent_id 'ent-test-001' 은 ALLOW_ENTITY_HEADER_AUTH=true 일 때 헤더 인증 대응용.

USE db_app_hscode;

-- ====================== 데모 Exporters ======================
INSERT IGNORE INTO hsc_exporters
  (exp_id, exp_ent_id, exp_name, exp_country_code, exp_aliases, exp_memo)
VALUES
  ('demo-exp-001', 'ent-test-001', 'ABC Materials Co., Ltd.', 'KR',
   JSON_ARRAY('ABC Materials', 'ABC Mtl.', 'ABC 머티리얼즈'),
   '시연용 — 한국 철강·기계 부품'),
  ('demo-exp-002', 'ent-test-001', 'XYZ Chemicals Inc.', 'KR',
   JSON_ARRAY('XYZ Chem', 'XYZ Chemicals'),
   '시연용 — 한국 화학물질 공급사'),
  ('demo-exp-003', 'ent-test-001', 'Sundae Machinery Group', 'KR',
   JSON_ARRAY('Sundae Mech', 'Sundae'),
   '시연용 — 한국 산업 설비'),
  ('demo-exp-004', 'ent-test-001', 'Hangzhou Polymer Trading', 'CN',
   JSON_ARRAY('Hangzhou Polymer', '杭州'),
   '시연용 — 중국 폴리머 무역'),
  ('demo-exp-005', 'ent-test-001', 'Osaka Bearing Manufacturing', 'JP',
   JSON_ARRAY('Osaka Bearing', '大阪'),
   '시연용 — 일본 베어링 제조');

-- ====================== 데모 FTA Matrix (VN ←→ KR/CN/JP) ======================
-- VKFTA (한-베), ATIGA (베트남 ASEAN 내), RCEP, AKFTA

INSERT IGNORE INTO hsc_fta_matrix
  (fta_id, fta_import_country_code, fta_export_country_code, fta_agreement_code,
   fta_hs_code, fta_rate, fta_effective_from, fta_memo)
VALUES
  -- VN ← KR (VKFTA)
  (UUID(), 'VN', 'KR', 'VKFTA', '7220.20.10', 0.000, '2026-01-01', '한-베 FTA 0%'),
  (UUID(), 'VN', 'KR', 'VKFTA', '7220.90.00', 3.000, '2026-01-01', NULL),
  (UUID(), 'VN', 'KR', 'VKFTA', '7210.49.10', 0.000, '2026-01-01', NULL),
  (UUID(), 'VN', 'KR', 'VKFTA', '7228.10.10', 0.000, '2026-01-01', NULL),
  (UUID(), 'VN', 'KR', 'VKFTA', '7318.15.30', 0.000, '2026-01-01', NULL),
  (UUID(), 'VN', 'KR', 'VKFTA', '8482.10.00', 0.000, '2026-01-01', NULL),
  (UUID(), 'VN', 'KR', 'VKFTA', '8501.40.00', 0.000, '2026-01-01', NULL),
  (UUID(), 'VN', 'KR', 'VKFTA', '8501.20.10', 0.000, '2026-01-01', NULL),
  (UUID(), 'VN', 'KR', 'VKFTA', '3901.10.00', 0.000, '2026-01-01', NULL),
  (UUID(), 'VN', 'KR', 'VKFTA', '3901.20.00', 0.000, '2026-01-01', NULL),
  (UUID(), 'VN', 'KR', 'VKFTA', '3902.10.30', 0.000, '2026-01-01', NULL),
  (UUID(), 'VN', 'KR', 'VKFTA', '2710.19.41', 3.000, '2026-01-01', NULL),
  (UUID(), 'VN', 'KR', 'VKFTA', '8413.70.99', 0.000, '2026-01-01', NULL),
  (UUID(), 'VN', 'KR', 'VKFTA', '8537.10.99', 0.000, '2026-01-01', NULL),
  (UUID(), 'VN', 'KR', 'VKFTA', '9032.89.39', 0.000, '2026-01-01', NULL),

  -- VN ← KR (AKFTA — 보조 협정)
  (UUID(), 'VN', 'KR', 'AKFTA', '7220.20.10', 2.000, '2026-01-01', 'AKFTA 보조 — VKFTA 우선'),
  (UUID(), 'VN', 'KR', 'AKFTA', '8501.40.00', 1.500, '2026-01-01', NULL),

  -- VN ← CN (RCEP)
  (UUID(), 'VN', 'CN', 'RCEP', '3901.20.00', 1.500, '2026-01-01', NULL),
  (UUID(), 'VN', 'CN', 'RCEP', '3902.10.30', 1.500, '2026-01-01', NULL),
  (UUID(), 'VN', 'CN', 'RCEP', '7210.49.10', 1.500, '2026-01-01', NULL),
  (UUID(), 'VN', 'CN', 'RCEP', '8501.20.10', 2.500, '2026-01-01', NULL),

  -- VN ← JP (RCEP, AJCEP)
  (UUID(), 'VN', 'JP', 'RCEP', '8482.10.00', 5.000, '2026-01-01', NULL),
  (UUID(), 'VN', 'JP', 'RCEP', '8482.20.00', 5.000, '2026-01-01', NULL),
  (UUID(), 'VN', 'JP', 'AJCEP', '8482.10.00', 0.000, '2026-01-01', 'AJCEP 무세 (lookup 최저값으로 선택됨)'),

  -- VN ← TH (ATIGA — ASEAN 역내)
  (UUID(), 'VN', 'TH', 'ATIGA', '7220.20.10', 0.000, '2026-01-01', NULL),
  (UUID(), 'VN', 'TH', 'ATIGA', '3901.10.00', 0.000, '2026-01-01', NULL);

-- 검증 쿼리
SELECT
  fta_import_country_code AS imp,
  fta_export_country_code AS exp,
  fta_agreement_code AS fta,
  COUNT(*) AS count
FROM hsc_fta_matrix
WHERE fta_deleted_at IS NULL
GROUP BY fta_import_country_code, fta_export_country_code, fta_agreement_code
ORDER BY imp, exp, fta;

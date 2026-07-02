-- HS Code Manager — Phase 3 Authority Seed (VN BIEU THUE XNK 2026 demo subset)
-- 2026-05-13
-- 운영 시드는 별도로 BIEU THUE 데이터 공급 후 일괄 적재 — 본 파일은 *Phase 3 데모 검증용 최소 시드*.

USE db_app_hscode;

INSERT IGNORE INTO hsc_authority_hs_codes
  (auh_id, auh_import_country_code, auh_adapter_key, auh_hs_code,
   auh_description_local, auh_description_en,
   auh_keywords, auh_category_hints, auh_tariff_rate, auh_effective_from)
VALUES
  -- 철강·기계 STEEL_MECHANICAL
  (UUID(), 'VN', 'bieu_thue_xnk_2026', '7220.20.10',
   'Thép không gỉ cuộn phẳng, dày <= 4.75 mm',
   'Stainless steel flat-rolled, thickness <= 4.75 mm',
   JSON_ARRAY('sus304','stainless','flat','rolled','thin','평판','스테인리스','합금강'),
   JSON_OBJECT('STEEL_MECHANICAL', 0.9),
   5.000, '2026-01-01'),
  (UUID(), 'VN', 'bieu_thue_xnk_2026', '7220.90.00',
   'Thép không gỉ - khác',
   'Stainless steel - other',
   JSON_ARRAY('stainless','steel','other','기타','스테인리스'),
   JSON_OBJECT('STEEL_MECHANICAL', 0.65),
   8.000, '2026-01-01'),
  (UUID(), 'VN', 'bieu_thue_xnk_2026', '7210.49.10',
   'Thép cán phẳng tráng kẽm',
   'Flat-rolled steel, zinc-plated',
   JSON_ARRAY('galvanized','zinc','steel','아연도금','강판'),
   JSON_OBJECT('STEEL_MECHANICAL', 0.85),
   3.000, '2026-01-01'),

  -- 화학물질 CHEMICAL
  (UUID(), 'VN', 'bieu_thue_xnk_2026', '3901.10.00',
   'Polyetylen tỷ trọng thấp dạng nguyên sinh',
   'Polyethylene low density, primary form',
   JSON_ARRAY('polyethylene','pe','ldpe','펠릿','수지','polymer','9002-88-4'),
   JSON_OBJECT('CHEMICAL', 0.95),
   3.000, '2026-01-01'),
  (UUID(), 'VN', 'bieu_thue_xnk_2026', '2710.19.41',
   'Dầu nhờn',
   'Lubricating oils',
   JSON_ARRAY('lubricant','oil','grease','윤활유','base oil'),
   JSON_OBJECT('CHEMICAL', 0.8),
   5.000, '2026-01-01'),
  (UUID(), 'VN', 'bieu_thue_xnk_2026', '2922.42.10',
   'Glutamic acid',
   'Glutamic acid',
   JSON_ARRAY('glutamic','acid','msg','56-86-0','글루타민산'),
   JSON_OBJECT('CHEMICAL', 0.9),
   8.000, '2026-01-01'),

  -- 설비 EQUIPMENT
  (UUID(), 'VN', 'bieu_thue_xnk_2026', '8479.89.99',
   'Máy móc và thiết bị cơ khí có chức năng riêng, chưa được chi tiết',
   'Machinery with individual functions, not specified elsewhere',
   JSON_ARRAY('machine','equipment','industrial','산업용','기계','설비'),
   JSON_OBJECT('EQUIPMENT', 0.7),
   5.000, '2026-01-01'),
  (UUID(), 'VN', 'bieu_thue_xnk_2026', '8501.40.00',
   'Động cơ điện một pha',
   'Single-phase AC motors',
   JSON_ARRAY('motor','single-phase','ac','전동기','모터'),
   JSON_OBJECT('EQUIPMENT', 0.9),
   5.000, '2026-01-01'),

  -- KR 보조 권위 (한국 관세청 — 데모 minimal)
  (UUID(), 'KR', 'kr_customs', '7220.20.1010',
   '스테인리스강 평판압연제품 두께 4.75mm 이하',
   'Stainless steel flat-rolled, thickness <= 4.75 mm',
   JSON_ARRAY('sus304','stainless','flat'),
   JSON_OBJECT('STEEL_MECHANICAL', 0.9),
   0.000, '2026-01-01');

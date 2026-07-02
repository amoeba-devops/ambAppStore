-- HS Code Manager — Phase 1 Seed Data
-- 2026-05-13

USE db_app_hscode;

-- 수입국 (Vietnam ACTIVE / Korea ACTIVE / Thailand BETA / 기타 NOT_SUPPORTED)
INSERT IGNORE INTO hsc_import_countries
  (imc_id, imc_code, imc_name_ko, imc_name_en, imc_name_vi, imc_support_status, imc_adapter_key, imc_currency_code)
VALUES
  (UUID(), 'VN', '베트남',     'Vietnam',       'Việt Nam',   'ACTIVE',        'bieu_thue_xnk_2026', 'VND'),
  (UUID(), 'KR', '한국',       'South Korea',   'Hàn Quốc',   'ACTIVE',        'kr_customs',         'KRW'),
  (UUID(), 'TH', '태국',       'Thailand',      'Thái Lan',   'BETA',          NULL,                  'THB'),
  (UUID(), 'ID', '인도네시아', 'Indonesia',     'Indonesia',  'NOT_SUPPORTED', NULL,                  'IDR'),
  (UUID(), 'JP', '일본',       'Japan',         'Nhật Bản',   'NOT_SUPPORTED', NULL,                  'JPY'),
  (UUID(), 'CN', '중국',       'China',         'Trung Quốc', 'NOT_SUPPORTED', NULL,                  'CNY');

-- 수출국 (주요 8개국 ACTIVE)
INSERT IGNORE INTO hsc_export_countries
  (exc_id, exc_code, exc_name_ko, exc_name_en, exc_name_vi, exc_is_active)
VALUES
  (UUID(), 'KR', '한국',   'South Korea',   'Hàn Quốc',   1),
  (UUID(), 'CN', '중국',   'China',         'Trung Quốc', 1),
  (UUID(), 'JP', '일본',   'Japan',         'Nhật Bản',   1),
  (UUID(), 'VN', '베트남', 'Vietnam',       'Việt Nam',   1),
  (UUID(), 'TH', '태국',   'Thailand',      'Thái Lan',   1),
  (UUID(), 'TW', '대만',   'Taiwan',        'Đài Loan',   1),
  (UUID(), 'US', '미국',   'United States', 'Hoa Kỳ',     1),
  (UUID(), 'DE', '독일',   'Germany',       'Đức',        1);

-- 외부 데이터 소스 — VN BIEU THUE 1차 권위, KR Customs 보조
INSERT IGNORE INTO hsc_external_data_sources
  (eds_id, eds_adapter_key, eds_import_country_code, eds_display_name, eds_cache_ttl_sec, eds_is_active, eds_priority)
VALUES
  (UUID(), 'bieu_thue_xnk_2026', 'VN', 'Vietnam BIEU THUE XNK 2026', 86400, 1, 10),
  (UUID(), 'kr_customs',         'KR', 'Korea Customs HS Lookup',     86400, 1, 20);

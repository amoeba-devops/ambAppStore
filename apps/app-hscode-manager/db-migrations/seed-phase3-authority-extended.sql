-- HS Code Manager — Phase 3 Authority Seed (Extended Demo — 50건)
-- 2026-05-13
--
-- 본 시드는 M1 회귀 시나리오 시연을 위한 *데모 확장판* 이다.
-- 운영 진입 시에는 BIEU THUE XNK 2026 공식 데이터로 *교체* 해야 한다.
--
-- 카테고리별 분포:
--   STEEL_MECHANICAL — 15건 (7210, 7220, 7308, 7318, 8482 등)
--   CHEMICAL         — 13건 (3901, 2710, 2922, 3403 등)
--   EQUIPMENT        — 12건 (8501, 8479, 8421, 8537 등)
--   기타 모호 카테고리 — 10건

USE db_app_hscode;

-- 기존 시드 8건을 그대로 유지하고, 추가 시드만 INSERT.

INSERT IGNORE INTO hsc_authority_hs_codes
  (auh_id, auh_import_country_code, auh_adapter_key, auh_hs_code,
   auh_description_local, auh_description_en,
   auh_keywords, auh_category_hints, auh_tariff_rate, auh_effective_from)
VALUES
  -- ========== STEEL_MECHANICAL 확장 (12건 추가) ==========
  (UUID(), 'VN', 'bieu_thue_xnk_2026', '7210.49.90',
   'Thép cán phẳng tráng kẽm khác', 'Flat-rolled steel zinc-plated, other',
   JSON_ARRAY('galvanized','zinc','steel','sheet','강판','아연도금'),
   JSON_OBJECT('STEEL_MECHANICAL', 0.85), 5.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '7210.70.20',
   'Thép cán phẳng sơn', 'Flat-rolled steel painted',
   JSON_ARRAY('painted','coated','sheet','도장강판','steel'),
   JSON_OBJECT('STEEL_MECHANICAL', 0.85), 5.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '7228.10.10',
   'Thép hợp kim cán nóng', 'Hot-rolled alloy steel bars',
   JSON_ARRAY('alloy','steel','hot-rolled','bar','합금강','열간압연'),
   JSON_OBJECT('STEEL_MECHANICAL', 0.9), 5.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '7308.90.99',
   'Cấu kiện thép, khác', 'Steel structures, other',
   JSON_ARRAY('structure','frame','bracket','구조물','프레임','steel'),
   JSON_OBJECT('STEEL_MECHANICAL', 0.7), 10.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '7318.15.30',
   'Bu lông và đai ốc', 'Bolts and nuts',
   JSON_ARRAY('bolt','nut','screw','fastener','볼트','너트','체결구'),
   JSON_OBJECT('STEEL_MECHANICAL', 0.95), 7.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '7318.21.00',
   'Vòng đệm lò xo', 'Spring washers',
   JSON_ARRAY('washer','spring','와셔','스프링와셔'),
   JSON_OBJECT('STEEL_MECHANICAL', 0.95), 7.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '7321.11.10',
   'Bếp ga dùng trong gia đình', 'Domestic gas cookers',
   JSON_ARRAY('gas','cooker','stove','가스레인지','조리기'),
   JSON_OBJECT('EQUIPMENT', 0.7, 'STEEL_MECHANICAL', 0.3), 25.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '7326.90.99',
   'Sản phẩm thép khác', 'Other articles of steel',
   JSON_ARRAY('steel','article','generic','기타강제품'),
   JSON_OBJECT('STEEL_MECHANICAL', 0.5), 10.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '8482.10.00',
   'Vòng bi cầu', 'Ball bearings',
   JSON_ARRAY('bearing','ball','베어링','볼베어링'),
   JSON_OBJECT('STEEL_MECHANICAL', 0.9, 'EQUIPMENT', 0.4), 10.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '8482.20.00',
   'Vòng bi đũa côn', 'Tapered roller bearings',
   JSON_ARRAY('bearing','tapered','roller','테이퍼','롤러베어링'),
   JSON_OBJECT('STEEL_MECHANICAL', 0.9), 10.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '7304.39.99',
   'Ống thép không hợp kim, khác', 'Steel pipes, non-alloy, other',
   JSON_ARRAY('pipe','tube','steel','강관','파이프'),
   JSON_OBJECT('STEEL_MECHANICAL', 0.85), 5.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '7307.99.00',
   'Phụ kiện ống thép, khác', 'Steel pipe fittings, other',
   JSON_ARRAY('fitting','elbow','flange','pipe','파이프 부속','플랜지'),
   JSON_OBJECT('STEEL_MECHANICAL', 0.85), 7.000, '2026-01-01'),

  -- ========== CHEMICAL 확장 (12건 추가) ==========
  (UUID(), 'VN', 'bieu_thue_xnk_2026', '3901.20.00',
   'Polyetylen tỷ trọng cao', 'High density polyethylene HDPE',
   JSON_ARRAY('hdpe','polyethylene','plastic','pellet','9002-88-4','수지','펠릿'),
   JSON_OBJECT('CHEMICAL', 0.95), 3.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '3902.10.30',
   'Polypropylen dạng nguyên sinh', 'Polypropylene primary form',
   JSON_ARRAY('polypropylene','pp','plastic','pellet','9003-07-0','폴리프로필렌'),
   JSON_OBJECT('CHEMICAL', 0.95), 3.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '3903.11.00',
   'Polystyren mở rộng', 'Expandable polystyrene EPS',
   JSON_ARRAY('eps','polystyrene','foam','9003-53-6','발포','폴리스티렌'),
   JSON_OBJECT('CHEMICAL', 0.95), 3.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '3904.10.20',
   'PVC nguyên sinh dạng huyền phù', 'PVC primary suspension',
   JSON_ARRAY('pvc','polyvinyl','chloride','9002-86-2','폴리염화비닐'),
   JSON_OBJECT('CHEMICAL', 0.95), 3.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '2917.36.00',
   'Acid terephthalic và muối', 'Terephthalic acid and its salts',
   JSON_ARRAY('terephthalic','acid','100-21-0','테레프탈산','tpa'),
   JSON_OBJECT('CHEMICAL', 0.95), 1.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '2905.31.00',
   'Etylen glycol', 'Ethylene glycol',
   JSON_ARRAY('ethylene','glycol','107-21-1','에틸렌글리콜','meg'),
   JSON_OBJECT('CHEMICAL', 0.95), 1.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '3403.19.10',
   'Mỡ bôi trơn', 'Lubricating greases',
   JSON_ARRAY('grease','lubricant','윤활그리스'),
   JSON_OBJECT('CHEMICAL', 0.9), 5.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '3811.21.00',
   'Phụ gia dầu nhờn', 'Lubricating oil additives',
   JSON_ARRAY('additive','lubricant','oil','윤활유첨가제'),
   JSON_OBJECT('CHEMICAL', 0.9), 3.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '2710.19.81',
   'Dầu thủy lực', 'Hydraulic oils',
   JSON_ARRAY('hydraulic','oil','유압유'),
   JSON_OBJECT('CHEMICAL', 0.9), 5.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '2933.99.90',
   'Hợp chất dị vòng nitơ khác', 'Heterocyclic N-compounds, other',
   JSON_ARRAY('heterocyclic','nitrogen','organic','유기','복소환'),
   JSON_OBJECT('CHEMICAL', 0.7), 3.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '3204.17.00',
   'Pigment hữu cơ', 'Organic pigments',
   JSON_ARRAY('pigment','colorant','organic','유기안료'),
   JSON_OBJECT('CHEMICAL', 0.85), 5.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '3208.20.90',
   'Sơn polyme acrylic', 'Acrylic polymer paints',
   JSON_ARRAY('paint','acrylic','coating','아크릴페인트','도료'),
   JSON_OBJECT('CHEMICAL', 0.85), 25.000, '2026-01-01'),

  -- ========== EQUIPMENT 확장 (10건 추가) ==========
  (UUID(), 'VN', 'bieu_thue_xnk_2026', '8501.20.10',
   'Động cơ DC công suất nhỏ', 'DC motors small power',
   JSON_ARRAY('dc','motor','small','직류모터'),
   JSON_OBJECT('EQUIPMENT', 0.95), 5.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '8501.53.10',
   'Động cơ AC ba pha công suất > 75 kW', 'AC motors 3-phase > 75 kW',
   JSON_ARRAY('ac','motor','three-phase','삼상모터','high-power'),
   JSON_OBJECT('EQUIPMENT', 0.95), 0.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '8413.70.99',
   'Máy bơm ly tâm khác', 'Centrifugal pumps, other',
   JSON_ARRAY('pump','centrifugal','원심펌프'),
   JSON_OBJECT('EQUIPMENT', 0.9), 5.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '8414.59.99',
   'Quạt công nghiệp khác', 'Industrial fans, other',
   JSON_ARRAY('fan','blower','산업용팬'),
   JSON_OBJECT('EQUIPMENT', 0.9), 5.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '8421.21.99',
   'Bộ lọc nước', 'Water filters',
   JSON_ARRAY('filter','water','정수필터','워터필터'),
   JSON_OBJECT('EQUIPMENT', 0.85), 15.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '8421.39.99',
   'Bộ lọc khí khác', 'Air filters, other',
   JSON_ARRAY('filter','air','에어필터'),
   JSON_OBJECT('EQUIPMENT', 0.85), 10.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '8537.10.99',
   'Bảng điều khiển dưới 1000V', 'Control panels < 1000V',
   JSON_ARRAY('panel','control','switchboard','제어반','분전반'),
   JSON_OBJECT('EQUIPMENT', 0.9), 5.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '8536.50.99',
   'Công tắc khác < 1000V', 'Switches, other < 1000V',
   JSON_ARRAY('switch','low-voltage','스위치'),
   JSON_OBJECT('EQUIPMENT', 0.9), 5.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '9032.89.39',
   'Cảm biến điều khiển khác', 'Other automatic regulating sensors',
   JSON_ARRAY('sensor','controller','센서','컨트롤러'),
   JSON_OBJECT('EQUIPMENT', 0.85), 0.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '8479.50.00',
   'Robot công nghiệp', 'Industrial robots',
   JSON_ARRAY('robot','industrial','산업용로봇'),
   JSON_OBJECT('EQUIPMENT', 0.95), 0.000, '2026-01-01'),

  -- ========== 모호 카테고리 — 우선순위 낮은 일반 코드 ==========
  (UUID(), 'VN', 'bieu_thue_xnk_2026', '3923.30.99',
   'Bao bì nhựa khác', 'Plastic containers, other',
   JSON_ARRAY('container','bottle','plastic','용기','플라스틱'),
   JSON_OBJECT('CHEMICAL', 0.6), 15.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '4819.20.00',
   'Hộp giấy gấp', 'Folding cartons',
   JSON_ARRAY('carton','paper','box','종이박스'),
   JSON_OBJECT('OTHER', 0.7), 15.000, '2026-01-01'),

  (UUID(), 'VN', 'bieu_thue_xnk_2026', '4823.90.99',
   'Sản phẩm giấy khác', 'Other paper articles',
   JSON_ARRAY('paper','article','종이제품'),
   JSON_OBJECT('OTHER', 0.7), 15.000, '2026-01-01');

-- 시드 후 통계
SELECT
  auh_import_country_code AS country,
  auh_adapter_key AS adapter,
  COUNT(*) AS code_count
FROM hsc_authority_hs_codes
WHERE auh_deleted_at IS NULL
GROUP BY auh_import_country_code, auh_adapter_key;

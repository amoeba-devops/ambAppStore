-- ============================================================
-- ambAppStore — Seed: 4 App Masters
-- ============================================================

USE db_app_platform;

INSERT INTO plt_apps (app_id, app_slug, app_name, app_name_en, app_short_desc, app_status, app_port_fe, app_port_be, app_sort_order, app_features)
VALUES
  (UUID(), 'app-car-manager', '법인차량관리', 'Corporate Vehicle Manager',
   '법인 차량의 등록, 배차 신청/승인, 운행일지, 유지보수 비용을 통합 관리합니다.',
   'ACTIVE', 5201, 3101, 1,
   JSON_ARRAY(
     JSON_OBJECT('icon', 'car', 'label', '차량 등록 및 상태 관리'),
     JSON_OBJECT('icon', 'calendar', 'label', '배차 신청/승인 워크플로우'),
     JSON_OBJECT('icon', 'file-text', 'label', '운행일지 자동 기록'),
     JSON_OBJECT('icon', 'wrench', 'label', '유지보수 비용 추적'),
     JSON_OBJECT('icon', 'layout-grid', 'label', '배차 캘린더 뷰'),
     JSON_OBJECT('icon', 'bar-chart-3', 'label', '월간/연간 비용 리포트')
   )),
  (UUID(), 'app-hscode', 'HS Code Tool', 'HS Code Tool',
   'HS Code 검색 및 AI 기반 품목 분류 도구입니다.',
   'ACTIVE', 5202, 3102, 2,
   JSON_ARRAY(
     JSON_OBJECT('icon', 'search', 'label', 'HS Code 키워드 검색'),
     JSON_OBJECT('icon', 'brain', 'label', 'AI 품목 자동 분류'),
     JSON_OBJECT('icon', 'globe', 'label', '국가별 관세율 조회'),
     JSON_OBJECT('icon', 'bookmark', 'label', '즐겨찾기 HS Code 관리')
   )),
  (UUID(), 'app-sales-report', '매출리포트', 'Sales Report',
   '매출 현황 대시보드 및 분석 리포트를 제공합니다.',
   'COMING_SOON', 5203, 3103, 3,
   JSON_ARRAY(
     JSON_OBJECT('icon', 'trending-up', 'label', '실시간 매출 대시보드'),
     JSON_OBJECT('icon', 'pie-chart', 'label', '카테고리별 매출 분석'),
     JSON_OBJECT('icon', 'download', 'label', '리포트 다운로드 (Excel/PDF)')
   )),
  (UUID(), 'app-stock-management', '재고관리', 'Stock Forecast',
   '재고 관리 및 AI 수요 예측 시스템입니다.',
   'COMING_SOON', 5204, 3104, 4,
   JSON_ARRAY(
     JSON_OBJECT('icon', 'package', 'label', '실시간 재고 현황'),
     JSON_OBJECT('icon', 'brain', 'label', 'AI 수요 예측'),
     JSON_OBJECT('icon', 'alert-triangle', 'label', '재고 부족 알림'),
     JSON_OBJECT('icon', 'truck', 'label', '발주 자동 제안')
   ))
ON DUPLICATE KEY UPDATE app_name = VALUES(app_name);

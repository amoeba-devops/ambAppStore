-- ============================================================
-- ambAppStore — Seed: 4 App Masters
-- ============================================================

SET NAMES utf8mb4;
USE db_app_platform;

INSERT INTO plt_apps (app_id, app_slug, app_name, app_name_en, app_short_desc, app_status, app_port_fe, app_port_be, app_sort_order, app_features)
VALUES
  (UUID(), 'app-car-manager', '법인차량관리', 'Corporate Vehicle Manager',
   'Manage corporate vehicle registration, dispatch requests/approvals, trip logs, and maintenance costs.',
   'ACTIVE', 5201, 3101, 1,
   JSON_ARRAY(
     JSON_OBJECT('icon', 'car', 'label', 'Vehicle registration and status management'),
     JSON_OBJECT('icon', 'calendar', 'label', 'Dispatch request/approval workflow'),
     JSON_OBJECT('icon', 'file-text', 'label', 'Automatic trip log recording'),
     JSON_OBJECT('icon', 'wrench', 'label', 'Maintenance cost tracking'),
     JSON_OBJECT('icon', 'layout-grid', 'label', 'Dispatch calendar view'),
     JSON_OBJECT('icon', 'bar-chart-3', 'label', 'Monthly/annual cost reports')
   )),
  (UUID(), 'app-hscode', 'HS Code Tool', 'HS Code Tool',
   'AI-powered HS Code search and product classification tool.',
   'ACTIVE', 5202, 3102, 2,
   JSON_ARRAY(
     JSON_OBJECT('icon', 'search', 'label', 'HS Code keyword search'),
     JSON_OBJECT('icon', 'brain', 'label', 'AI product auto-classification'),
     JSON_OBJECT('icon', 'globe', 'label', 'Country-specific tariff rate lookup'),
     JSON_OBJECT('icon', 'bookmark', 'label', 'Bookmark HS Code management')
   )),
  (UUID(), 'app-sales-report', '매출리포트', 'Sales Report',
   'Sales dashboard and analytics reporting.',
   'COMING_SOON', 5203, 3103, 3,
   JSON_ARRAY(
     JSON_OBJECT('icon', 'trending-up', 'label', 'Real-time sales dashboard'),
     JSON_OBJECT('icon', 'pie-chart', 'label', 'Category-based sales analysis'),
     JSON_OBJECT('icon', 'download', 'label', 'Report download (Excel/PDF)')
   )),
  (UUID(), 'app-stock-management', '재고관리', 'Stock Forecast',
   'Inventory management and AI-powered demand forecasting system.',
   'COMING_SOON', 5204, 3104, 4,
   JSON_ARRAY(
     JSON_OBJECT('icon', 'package', 'label', 'Real-time inventory status'),
     JSON_OBJECT('icon', 'brain', 'label', 'AI demand forecasting'),
     JSON_OBJECT('icon', 'alert-triangle', 'label', 'Low stock alerts'),
     JSON_OBJECT('icon', 'truck', 'label', 'Automatic purchase order suggestions')
   ))
ON DUPLICATE KEY UPDATE app_name = VALUES(app_name);

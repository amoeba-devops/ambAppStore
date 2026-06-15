/**
 * Mobile Responsive & i18n Enhancement for Car-Truck Manager Prototype
 * Design matches car-manager-v2 (bottom tab nav, dropdown language switcher)
 * Supports: Vietnamese (vi), English (en), Korean (ko)
 *
 * FULL TRANSLATION SUPPORT - All UI text is translated
 * MOBILE RESPONSIVE - Uses JS to override inline styles
 */

(function() {
  'use strict';

  // ============ DESIGN TOKENS (match car-v2) ============
  const COLORS = {
    accent: '#0369A1',
    accentSoft: '#E0F2FE',
    accentFg: '#ffffff',
    surface: '#ffffff',
    surface2: '#F1F3F8',
    border: '#E2E5EB',
    text: '#0F172A',
    textMuted: '#64748B',
    textFaint: '#94A3B8',
    bg: '#F8FAFC',
    info: '#0EA5E9',
    infoSoft: '#E2F4FD',
  };

  // ============ LOCALES ============
  const LOCALES = [
    { id: 'vi', label: 'Tiếng Việt', short: 'VI' },
    { id: 'en', label: 'English',    short: 'EN' },
    { id: 'ko', label: '한국어',      short: 'KO' },
  ];

  // ============ FULL TRANSLATIONS ============
  const T = {
    // App name
    'Amoeba Fleet': { en: 'Amoeba Fleet', ko: 'Amoeba Fleet', vi: 'Amoeba Fleet' },

    // Department switcher
    'Phòng ban': { en: 'Department', ko: '부서', vi: 'Phòng ban' },
    'Xe con': { en: 'Car', ko: '승용차', vi: 'Xe con' },
    'Xe tải': { en: 'Truck', ko: '트럭', vi: 'Xe tải' },

    // Nav groups
    'Vận hành': { en: 'Operations', ko: '운영', vi: 'Vận hành' },
    'Tài chính': { en: 'Finance', ko: '재무', vi: 'Tài chính' },
    'Dữ liệu': { en: 'Data', ko: '데이터', vi: 'Dữ liệu' },
    'Không gian làm việc': { en: 'Workspace', ko: '작업 공간', vi: 'Không gian làm việc' },
    'Quản trị': { en: 'Admin', ko: '관리', vi: 'Quản trị' },

    // Nav items - Truck
    'Bảng điều khiển': { en: 'Dashboard', ko: '대시보드', vi: 'Bảng điều khiển' },
    'Nhật ký chuyến': { en: 'Trip Log', ko: '운행 일지', vi: 'Nhật ký chuyến' },
    'Đội xe tải': { en: 'Truck Fleet', ko: '트럭 대대', vi: 'Đội xe tải' },
    'Tài xế': { en: 'Drivers', ko: '운전사', vi: 'Tài xế' },
    'Chi phí & Lợi nhuận': { en: 'Cost & Profit', ko: '비용 & 수익', vi: 'Chi phí & Lợi nhuận' },
    'Báo cáo': { en: 'Reports', ko: '보고서', vi: 'Báo cáo' },
    'Import Excel': { en: 'Import Excel', ko: 'Excel 가져오기', vi: 'Import Excel' },

    // Nav items - Car
    'Chuyến đi': { en: 'Trips', ko: '운행', vi: 'Chuyến đi' },
    'Phương tiện': { en: 'Vehicles', ko: '차량', vi: 'Phương tiện' },
    'Chi phí': { en: 'Expenses', ko: '비용', vi: 'Chi phí' },
    'Người dùng': { en: 'Users', ko: '사용자', vi: 'Người dùng' },
    'Cài đặt': { en: 'Settings', ko: '설정', vi: 'Cài đặt' },
    'Nhật ký kiểm toán': { en: 'Audit Log', ko: '감사 로그', vi: 'Nhật ký kiểm toán' },

    // User section
    'Quản trị viên': { en: 'Administrator', ko: '관리자', vi: 'Quản trị viên' },

    // Page headers - Car
    'Công ty Amoeba · Điều xe công ty': { en: 'Amoeba Corp · Company Fleet', ko: 'Amoeba 회사 · 회사 차량', vi: 'Công ty Amoeba · Điều xe công ty' },
    'Điều xe · Chuyến đi': { en: 'Fleet · Trips', ko: '차량 · 운행', vi: 'Điều xe · Chuyến đi' },
    'Điều xe · Đội xe': { en: 'Fleet · Vehicles', ko: '차량 · 차량대', vi: 'Điều xe · Đội xe' },
    'Điều xe · Nhân sự': { en: 'Fleet · Personnel', ko: '차량 · 인원', vi: 'Điều xe · Nhân sự' },
    'Kiểm soát · Chi phí & phê duyệt': { en: 'Control · Expenses & Approval', ko: '관리 · 비용 & 승인', vi: 'Kiểm soát · Chi phí & phê duyệt' },
    'Hệ thống · Phân quyền': { en: 'System · Permissions', ko: '시스템 · 권한', vi: 'Hệ thống · Phân quyền' },
    'Hệ thống · Cấu hình': { en: 'System · Configuration', ko: '시스템 · 설정', vi: 'Hệ thống · Cấu hình' },
    'Kiểm soát · Truy vết': { en: 'Control · Audit Trail', ko: '관리 · 감사 추적', vi: 'Kiểm soát · Truy vết' },

    // Page titles
    'Đội xe công ty': { en: 'Company Fleet', ko: '회사 차량', vi: 'Đội xe công ty' },
    'Chi phí & duyệt': { en: 'Expenses & Approval', ko: '비용 & 승인', vi: 'Chi phí & duyệt' },
    'Người dùng & quyền': { en: 'Users & Permissions', ko: '사용자 & 권한', vi: 'Người dùng & quyền' },
    'Cài đặt duyệt tự động': { en: 'Auto-approval Settings', ko: '자동 승인 설정', vi: 'Cài đặt duyệt tự động' },
    'Nhật ký hệ thống': { en: 'System Log', ko: '시스템 로그', vi: 'Nhật ký hệ thống' },

    // Buttons
    'Đặt xe': { en: 'Book Car', ko: '차량 예약', vi: 'Đặt xe' },
    'Tạo chuyến': { en: 'New Trip', ko: '새 운행', vi: 'Tạo chuyến' },
    'Thêm xe': { en: 'Add Vehicle', ko: '차량 추가', vi: 'Thêm xe' },
    'Mời người dùng': { en: 'Invite User', ko: '사용자 초대', vi: 'Mời người dùng' },
    'Duyệt': { en: 'Approve', ko: '승인', vi: 'Duyệt' },
    'Từ chối': { en: 'Reject', ko: '거부', vi: 'Từ chối' },
    'Quản lý xe': { en: 'Manage Vehicles', ko: '차량 관리', vi: 'Quản lý xe' },

    // Table headers
    'Thời gian': { en: 'Time', ko: '시간', vi: 'Thời gian' },
    'Người đặt': { en: 'Booker', ko: '예약자', vi: 'Người đặt' },
    'Lộ trình': { en: 'Route', ko: '경로', vi: 'Lộ trình' },
    'Xe · Tài xế': { en: 'Vehicle · Driver', ko: '차량 · 운전사', vi: 'Xe · Tài xế' },
    'Trạng thái': { en: 'Status', ko: '상태', vi: 'Trạng thái' },
    'Xe phụ trách': { en: 'Assigned Vehicle', ko: '담당 차량', vi: 'Xe phụ trách' },
    'Chuyến T10': { en: 'Oct Trips', ko: '10월 운행', vi: 'Chuyến T10' },
    'Ngày': { en: 'Date', ko: '날짜', vi: 'Ngày' },
    'Loại': { en: 'Type', ko: '유형', vi: 'Loại' },
    'Xe · Người nhập': { en: 'Vehicle · Submitter', ko: '차량 · 제출자', vi: 'Xe · Người nhập' },
    'Ghi chú': { en: 'Note', ko: '메모', vi: 'Ghi chú' },
    'Số tiền': { en: 'Amount', ko: '금액', vi: 'Số tiền' },
    'Trạng thái / Thao tác': { en: 'Status / Action', ko: '상태 / 작업', vi: 'Trạng thái / Thao tác' },
    'Email': { en: 'Email', ko: '이메일', vi: 'Email' },
    'Vai trò': { en: 'Role', ko: '역할', vi: 'Vai trò' },

    // Dashboard widgets
    'Sắp tới': { en: 'Upcoming', ko: '예정', vi: 'Sắp tới' },
    'Tất cả chuyến đặt': { en: 'All Bookings', ko: '모든 예약', vi: 'Tất cả chuyến đặt' },
    'Tình trạng đội xe': { en: 'Fleet Status', ko: '차량 현황', vi: 'Tình trạng đội xe' },
    'Cảnh báo bảo dưỡng': { en: 'Maintenance Alerts', ko: '정비 알림', vi: 'Cảnh báo bảo dưỡng' },
    'Doanh thu & lợi nhuận theo tháng': { en: 'Revenue & Profit by Month', ko: '월별 매출 & 수익', vi: 'Doanh thu & lợi nhuận theo tháng' },
    'Cơ cấu chi phí': { en: 'Cost Structure', ko: '비용 구조', vi: 'Cơ cấu chi phí' },

    // KPI labels
    'Tổng doanh thu': { en: 'Total Revenue', ko: '총 매출', vi: 'Tổng doanh thu' },
    'Tổng chi phí': { en: 'Total Cost', ko: '총 비용', vi: 'Tổng chi phí' },
    'Lợi nhuận ròng': { en: 'Net Profit', ko: '순이익', vi: 'Lợi nhuận ròng' },
    'Số chuyến trong tháng': { en: 'Trips This Month', ko: '이번 달 운행', vi: 'Số chuyến trong tháng' },

    // Vehicle card labels
    'Odo': { en: 'Odo', ko: '주행거리', vi: 'Odo' },
    'Thay dầu': { en: 'Oil Change', ko: '오일 교환', vi: 'Thay dầu' },

    // Status badges
    'chờ': { en: 'pending', ko: '대기', vi: 'chờ' },
    'duyệt': { en: 'approve', ko: '승인', vi: 'duyệt' },

    // Fleet status
    'Đang chạy': { en: 'Running', ko: '운행중', vi: 'Đang chạy' },
    'Sẵn sàng': { en: 'Available', ko: '사용 가능', vi: 'Sẵn sàng' },
    'Bảo dưỡng': { en: 'Maintenance', ko: '정비중', vi: 'Bảo dưỡng' },

    // Settings page
    'Ngưỡng tự động duyệt chi phí': { en: 'Auto-approval Thresholds', ko: '자동 승인 한도', vi: 'Ngưỡng tự động duyệt chi phí' },
    'Quy tắc điều xe': { en: 'Fleet Rules', ko: '차량 규칙', vi: 'Quy tắc điều xe' },
    'Bắt buộc tài xế xác nhận chuyến': { en: 'Require driver confirmation', ko: '운전사 확인 필요', vi: 'Bắt buộc tài xế xác nhận chuyến' },
    'Cảnh báo trùng lịch xe': { en: 'Schedule conflict warning', ko: '일정 충돌 경고', vi: 'Cảnh báo trùng lịch xe' },
    'Tự nhắc thay dầu theo km': { en: 'Auto oil change reminder', ko: '자동 오일 교환 알림', vi: 'Tự nhắc thay dầu theo km' },

    // Misc
    'mục chờ duyệt': { en: 'pending approval', ko: '승인 대기', vi: 'mục chờ duyệt' },
    'tự động duyệt': { en: 'auto-approved', ko: '자동 승인', vi: 'tự động duyệt' },
    'Luôn cần duyệt': { en: 'Always requires approval', ko: '항상 승인 필요', vi: 'Luôn cần duyệt' },

    // Truck page headers
    'Công ty Amoeba · Đội xe tải · 50E-32407': { en: 'Amoeba Corp · Truck Fleet · 50E-32407', ko: 'Amoeba 회사 · 트럭 대대 · 50E-32407', vi: 'Công ty Amoeba · Đội xe tải · 50E-32407' },
  };

  // ============ MOBILE BREAKPOINT ============
  const MOBILE_BREAKPOINT = 1024;

  // ============ CSS STYLES ============
  const styles = `
    /* ========== LANGUAGE SWITCHER (Dropdown) ========== */
    .locale-switcher-wrapper {
      position: relative;
      border-top: 1px solid ${COLORS.border};
      padding: 8px;
    }

    .locale-trigger {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 8px;
      height: 36px;
      border: none;
      border-radius: 6px;
      background: transparent;
      cursor: pointer;
      font: 500 14px/1 'Pretendard Variable', 'Be Vietnam Pro', system-ui, sans-serif;
      color: ${COLORS.textMuted};
      transition: background 0.15s, color 0.15s;
      text-align: left;
    }
    .locale-trigger:hover {
      background: ${COLORS.surface2};
      color: ${COLORS.text};
    }
    .locale-trigger[data-open="true"] {
      background: ${COLORS.surface2};
      color: ${COLORS.text};
    }

    .locale-trigger-icon {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .locale-trigger-label {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .locale-trigger-short {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: ${COLORS.textFaint};
      flex-shrink: 0;
    }

    .locale-trigger-chevron {
      width: 14px;
      height: 14px;
      color: ${COLORS.textFaint};
      flex-shrink: 0;
    }

    /* Dropdown Menu */
    .locale-dropdown {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 8px;
      right: 8px;
      background: ${COLORS.surface};
      border: 1px solid ${COLORS.border};
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(15,23,42,0.14);
      padding: 4px;
      z-index: 100;
      display: none;
    }
    .locale-dropdown.open {
      display: block;
      animation: fadeSlideUp 0.15s ease;
    }

    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .locale-dropdown-label {
      padding: 8px 10px 6px;
      font-size: 12px;
      font-weight: 600;
      color: ${COLORS.textFaint};
    }

    .locale-dropdown-sep {
      height: 1px;
      background: ${COLORS.border};
      margin: 4px 0;
    }

    .locale-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 10px;
      border: none;
      border-radius: 6px;
      background: transparent;
      cursor: pointer;
      font: 500 14px/1 inherit;
      color: ${COLORS.text};
      text-align: left;
      transition: background 0.1s;
    }
    .locale-item:hover {
      background: ${COLORS.surface2};
    }
    .locale-item.active {
      background: ${COLORS.accentSoft};
      color: ${COLORS.accent};
      font-weight: 600;
    }

    .locale-item-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.05em;
      width: 28px;
      text-align: center;
      background: ${COLORS.surface2};
      color: ${COLORS.textMuted};
      border-radius: 4px;
      padding: 3px 6px;
    }
    .locale-item.active .locale-item-badge {
      background: ${COLORS.accent};
      color: ${COLORS.accentFg};
    }

    .locale-item-label {
      flex: 1;
    }

    .locale-item-check {
      width: 14px;
      height: 14px;
      opacity: 0;
    }
    .locale-item.active .locale-item-check {
      opacity: 1;
    }

    /* Backdrop for closing dropdown */
    .locale-backdrop {
      position: fixed;
      inset: 0;
      z-index: 99;
      display: none;
    }
    .locale-backdrop.open {
      display: block;
    }

    /* ========== MOBILE HEADER ========== */
    .mobile-header {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 50;
      height: 56px;
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-bottom: 1px solid ${COLORS.border};
      padding: 0 16px;
      align-items: center;
      justify-content: space-between;
    }
    .mobile-header-brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .mobile-header-logo {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: ${COLORS.accent};
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 13px;
    }
    .mobile-header-title {
      font-size: 16px;
      font-weight: 700;
      color: ${COLORS.text};
    }
    .mobile-header-lang {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
      border: 1px solid ${COLORS.border};
      border-radius: 8px;
      background: ${COLORS.surface};
      font: 600 12px/1 inherit;
      color: ${COLORS.textMuted};
      cursor: pointer;
    }
    .mobile-header-lang:hover {
      background: ${COLORS.surface2};
    }

    /* ========== BOTTOM TAB NAV (Mobile Only) ========== */
    .bottom-tab-nav {
      display: none;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 50;
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-top: 1px solid ${COLORS.border};
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }

    .bottom-tab-list {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      height: 56px;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .bottom-tab-item {
      position: relative;
    }

    .bottom-tab-link {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      text-decoration: none;
      color: ${COLORS.textMuted};
      font-size: 11px;
      font-weight: 500;
      transition: color 0.15s;
      cursor: pointer;
      border: none;
      background: none;
      width: 100%;
    }
    .bottom-tab-link.active {
      color: ${COLORS.accent};
    }
    .bottom-tab-link.active .bottom-tab-icon {
      transform: scale(1.05);
    }

    /* Active indicator bar */
    .bottom-tab-indicator {
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      height: 2px;
      width: 0;
      background: ${COLORS.accent};
      border-radius: 999px;
      transition: width 0.18s;
    }
    .bottom-tab-item.active .bottom-tab-indicator {
      width: 40px;
    }

    .bottom-tab-icon {
      width: 22px;
      height: 22px;
      transition: transform 0.18s;
    }

    .bottom-tab-label {
      line-height: 1;
    }

    /* ========== NOTIFICATION TOAST ========== */
    .locale-toast {
      position: fixed;
      bottom: calc(80px + env(safe-area-inset-bottom, 0px));
      left: 50%;
      transform: translateX(-50%);
      background: ${COLORS.text};
      color: ${COLORS.surface};
      padding: 12px 24px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      z-index: 9999;
      box-shadow: 0 4px 20px rgba(15,23,42,0.3);
      animation: toastSlideUp 0.3s ease;
    }
    .locale-toast.hiding {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
      transition: all 0.3s ease;
    }

    @keyframes toastSlideUp {
      from { opacity: 0; transform: translateX(-50%) translateY(20px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    /* ========== MOBILE LANGUAGE DROPDOWN ========== */
    .mobile-lang-dropdown {
      position: fixed;
      top: 60px;
      right: 16px;
      background: ${COLORS.surface};
      border: 1px solid ${COLORS.border};
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(15,23,42,0.14);
      padding: 4px;
      z-index: 200;
      display: none;
      min-width: 160px;
    }
    .mobile-lang-dropdown.open {
      display: block;
      animation: fadeSlideDown 0.15s ease;
    }
    @keyframes fadeSlideDown {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .mobile-lang-backdrop {
      position: fixed;
      inset: 0;
      z-index: 199;
      display: none;
    }
    .mobile-lang-backdrop.open {
      display: block;
    }
  `;

  // ============ SVG ICONS ============
  const ICONS = {
    languages: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>`,
    chevronUpDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>`,
    chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    // Bottom Tab Icons
    dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>`,
    trips: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>`,
    vehicles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
  };

  // ============ NAV ITEMS ============
  const NAV_ITEMS = [
    { key: 'dashboard', icon: 'dashboard', label: { vi: 'Tổng quan', en: 'Dashboard', ko: '대시보드' } },
    { key: 'trips', icon: 'trips', label: { vi: 'Chuyến', en: 'Trips', ko: '운행' } },
    { key: 'vehicles', icon: 'vehicles', label: { vi: 'Phương tiện', en: 'Vehicles', ko: '차량' } },
    { key: 'settings', icon: 'settings', label: { vi: 'Cài đặt', en: 'Settings', ko: '설정' } },
  ];

  // ============ STATE ============
  let currentLang = localStorage.getItem('app-lang') || 'vi';
  let dropdownOpen = false;
  let mobileLangOpen = false;
  let isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
  let originalTexts = new Map();

  // ============ DOM REFERENCES ============
  let sidebar = null;
  let mainEl = null;
  let mobileHeader = null;
  let bottomNav = null;
  let mobileLangDropdown = null;
  let mobileLangBackdrop = null;

  // ============ INIT ============
  function init() {
    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.id = 'mobile-i18n-styles';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // Wait for DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupUI);
    } else {
      setupUI();
    }
  }

  function setupUI() {
    // Get DOM references
    sidebar = document.querySelector('aside');
    mainEl = document.querySelector('main');

    console.log('[i18n] setupUI - sidebar found:', !!sidebar);
    console.log('[i18n] setupUI - mainEl found:', !!mainEl);
    if (sidebar) {
      console.log('[i18n] sidebar children count:', sidebar.children.length);
      Array.from(sidebar.children).forEach((child, i) => {
        const styleAttr = child.getAttribute('style') || '';
        console.log(`[i18n] child ${i}: ${child.tagName}, has border-top: ${styleAttr.includes('border-top')}`);
      });
    }

    // Scan and store original Vietnamese texts
    scanAndStoreTexts();

    // Create locale switcher in sidebar (for desktop)
    createLocaleSwitcher();

    // Create mobile header
    createMobileHeader();

    // Create bottom tab nav for mobile
    createBottomTabNav();

    // Apply responsive layout
    applyResponsiveLayout();

    // Listen for resize
    window.addEventListener('resize', debounce(handleResize, 100));

    // Apply stored language
    if (currentLang !== 'vi') {
      applyTranslations(currentLang);
    }
  }

  // ============ RESPONSIVE LAYOUT ============
  function applyResponsiveLayout() {
    isMobile = window.innerWidth <= MOBILE_BREAKPOINT;

    if (isMobile) {
      // MOBILE MODE
      if (sidebar) {
        sidebar.style.display = 'none';
      }
      if (mainEl) {
        mainEl.style.paddingTop = '56px';
        mainEl.style.paddingBottom = 'calc(56px + env(safe-area-inset-bottom, 0px))';
      }
      if (mobileHeader) {
        mobileHeader.style.display = 'flex';
      }
      if (bottomNav) {
        bottomNav.style.display = 'block';
      }
      // Adjust root container
      const rootContainer = document.querySelector('body > x-dc > div') || document.querySelector('body > div');
      if (rootContainer) {
        rootContainer.style.flexDirection = 'column';
      }
    } else {
      // DESKTOP MODE
      if (sidebar) {
        sidebar.style.display = 'flex';
      }
      if (mainEl) {
        mainEl.style.paddingTop = '0';
        mainEl.style.paddingBottom = '0';
      }
      if (mobileHeader) {
        mobileHeader.style.display = 'none';
      }
      if (bottomNav) {
        bottomNav.style.display = 'none';
      }
      // Reset root container
      const rootContainer = document.querySelector('body > x-dc > div') || document.querySelector('body > div');
      if (rootContainer) {
        rootContainer.style.flexDirection = 'row';
      }
    }
  }

  function handleResize() {
    const wasMobile = isMobile;
    isMobile = window.innerWidth <= MOBILE_BREAKPOINT;

    if (wasMobile !== isMobile) {
      applyResponsiveLayout();
    }
  }

  function debounce(fn, delay) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ============ TEXT SCANNING & TRANSLATION ============
  function scanAndStoreTexts() {
    // Get all text nodes that match our translation keys
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent.trim();
      if (text && T[text]) {
        if (!originalTexts.has(text)) {
          originalTexts.set(text, []);
        }
        originalTexts.get(text).push(node);
      }
    }

    // Also find text in span elements (for buttons, etc)
    document.querySelectorAll('span, button, div, th, td').forEach(el => {
      const directText = Array.from(el.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent.trim())
        .join('');

      if (directText && T[directText]) {
        el.setAttribute('data-i18n', directText);
      }

      if (el.children.length === 0) {
        const text = el.textContent.trim();
        if (text && T[text]) {
          el.setAttribute('data-i18n', text);
        }
      }
    });
  }

  function applyTranslations(lang) {
    // Translate text nodes
    originalTexts.forEach((nodes, viText) => {
      const translation = T[viText];
      if (translation && translation[lang]) {
        nodes.forEach(node => {
          const leadingSpace = node.textContent.match(/^\s*/)[0];
          const trailingSpace = node.textContent.match(/\s*$/)[0];
          node.textContent = leadingSpace + translation[lang] + trailingSpace;
        });
      }
    });

    // Translate elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (T[key] && T[key][lang]) {
        el.textContent = T[key][lang];
      }
    });

    // Update mobile header title
    if (mobileHeader) {
      const title = mobileHeader.querySelector('.mobile-header-title');
      if (title) {
        title.textContent = 'Amoeba Fleet';
      }
    }
  }

  // ============ LOCALE SWITCHER (Desktop) ============
  function createLocaleSwitcher() {
    if (!sidebar) return;

    // Find insertion point: after nav, before doc link/user sections
    // Structure: aside > (brand div) > (dept div) > nav > (doc link div) > (user div)
    const navEl = sidebar.querySelector('nav');
    let insertBefore = null;

    if (navEl && navEl.nextElementSibling) {
      // Insert after nav (before doc link)
      insertBefore = navEl.nextElementSibling;
      console.log('[i18n] Found nav, will insert after it');
    } else {
      // Fallback: find last div with border-top (user section)
      const children = Array.from(sidebar.children);
      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i];
        const styleAttr = child.getAttribute('style') || '';
        if (child.tagName === 'DIV' && styleAttr.includes('border-top')) {
          insertBefore = child;
          break;
        }
      }
    }

    if (!insertBefore) {
      // Last fallback: append to sidebar
      insertBefore = null;
      console.log('[i18n] No insertion point found, will append to sidebar');
    }

    console.log('[i18n] Creating locale switcher, insertBefore:', insertBefore);

    const current = LOCALES.find(l => l.id === currentLang) || LOCALES[0];

    const wrapper = document.createElement('div');
    wrapper.className = 'locale-switcher-wrapper';
    wrapper.innerHTML = `
      <div class="locale-backdrop"></div>
      <button type="button" class="locale-trigger" data-open="false">
        <span class="locale-trigger-icon">${ICONS.languages}</span>
        <span class="locale-trigger-label">${current.label}</span>
        <span class="locale-trigger-short">${current.short}</span>
        <span class="locale-trigger-chevron">${ICONS.chevronUpDown}</span>
      </button>
      <div class="locale-dropdown">
        <div class="locale-dropdown-label">Language</div>
        <div class="locale-dropdown-sep"></div>
        ${LOCALES.map(l => `
          <button type="button" class="locale-item ${l.id === currentLang ? 'active' : ''}" data-lang="${l.id}">
            <span class="locale-item-badge">${l.short}</span>
            <span class="locale-item-label">${l.label}</span>
            <span class="locale-item-check">${ICONS.check}</span>
          </button>
        `).join('')}
      </div>
    `;

    if (insertBefore) {
      sidebar.insertBefore(wrapper, insertBefore);
    } else {
      sidebar.appendChild(wrapper);
    }

    const trigger = wrapper.querySelector('.locale-trigger');
    const dropdown = wrapper.querySelector('.locale-dropdown');
    const backdrop = wrapper.querySelector('.locale-backdrop');

    trigger.addEventListener('click', () => {
      dropdownOpen = !dropdownOpen;
      trigger.dataset.open = dropdownOpen;
      dropdown.classList.toggle('open', dropdownOpen);
      backdrop.classList.toggle('open', dropdownOpen);
    });

    backdrop.addEventListener('click', () => {
      dropdownOpen = false;
      trigger.dataset.open = 'false';
      dropdown.classList.remove('open');
      backdrop.classList.remove('open');
    });

    wrapper.querySelectorAll('.locale-item').forEach(item => {
      item.addEventListener('click', () => {
        setLanguage(item.dataset.lang);
        dropdownOpen = false;
        trigger.dataset.open = 'false';
        dropdown.classList.remove('open');
        backdrop.classList.remove('open');
      });
    });
  }

  // ============ MOBILE HEADER ============
  function createMobileHeader() {
    const current = LOCALES.find(l => l.id === currentLang) || LOCALES[0];

    mobileHeader = document.createElement('header');
    mobileHeader.className = 'mobile-header';
    mobileHeader.innerHTML = `
      <div class="mobile-header-brand">
        <div class="mobile-header-logo">AF</div>
        <div class="mobile-header-title">Amoeba Fleet</div>
      </div>
      <button class="mobile-header-lang" id="mobile-lang-btn">
        <span class="mobile-lang-short">${current.short}</span>
        <span style="width:14px;height:14px;">${ICONS.chevronDown}</span>
      </button>
    `;

    document.body.appendChild(mobileHeader);

    // Create mobile language dropdown
    mobileLangBackdrop = document.createElement('div');
    mobileLangBackdrop.className = 'mobile-lang-backdrop';
    document.body.appendChild(mobileLangBackdrop);

    mobileLangDropdown = document.createElement('div');
    mobileLangDropdown.className = 'mobile-lang-dropdown';
    mobileLangDropdown.innerHTML = LOCALES.map(l => `
      <button type="button" class="locale-item ${l.id === currentLang ? 'active' : ''}" data-lang="${l.id}">
        <span class="locale-item-badge">${l.short}</span>
        <span class="locale-item-label">${l.label}</span>
        <span class="locale-item-check">${ICONS.check}</span>
      </button>
    `).join('');
    document.body.appendChild(mobileLangDropdown);

    // Event handlers
    const langBtn = mobileHeader.querySelector('#mobile-lang-btn');
    langBtn.addEventListener('click', () => {
      mobileLangOpen = !mobileLangOpen;
      mobileLangDropdown.classList.toggle('open', mobileLangOpen);
      mobileLangBackdrop.classList.toggle('open', mobileLangOpen);
    });

    mobileLangBackdrop.addEventListener('click', closeMobileLang);

    mobileLangDropdown.querySelectorAll('.locale-item').forEach(item => {
      item.addEventListener('click', () => {
        setLanguage(item.dataset.lang);
        closeMobileLang();
      });
    });

    function closeMobileLang() {
      mobileLangOpen = false;
      mobileLangDropdown.classList.remove('open');
      mobileLangBackdrop.classList.remove('open');
    }
  }

  // ============ BOTTOM TAB NAV ============
  function createBottomTabNav() {
    bottomNav = document.createElement('nav');
    bottomNav.className = 'bottom-tab-nav';
    bottomNav.setAttribute('aria-label', 'Mobile navigation');

    bottomNav.innerHTML = `
      <ul class="bottom-tab-list">
        ${NAV_ITEMS.map((item, index) => `
          <li class="bottom-tab-item ${index === 0 ? 'active' : ''}">
            <button class="bottom-tab-link ${index === 0 ? 'active' : ''}" data-nav="${item.key}">
              <span class="bottom-tab-icon">${ICONS[item.icon]}</span>
              <span class="bottom-tab-label">${item.label[currentLang]}</span>
            </button>
            <span class="bottom-tab-indicator"></span>
          </li>
        `).join('')}
      </ul>
    `;

    document.body.appendChild(bottomNav);

    // Handle tab clicks
    bottomNav.querySelectorAll('.bottom-tab-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        bottomNav.querySelectorAll('.bottom-tab-item').forEach(item => item.classList.remove('active'));
        bottomNav.querySelectorAll('.bottom-tab-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        link.closest('.bottom-tab-item').classList.add('active');
      });
    });
  }

  // ============ SET LANGUAGE ============
  function setLanguage(lang) {
    if (!LOCALES.find(l => l.id === lang)) return;
    currentLang = lang;
    localStorage.setItem('app-lang', lang);

    const current = LOCALES.find(l => l.id === lang);

    // Update desktop trigger
    const trigger = document.querySelector('.locale-trigger');
    if (trigger && current) {
      trigger.querySelector('.locale-trigger-label').textContent = current.label;
      trigger.querySelector('.locale-trigger-short').textContent = current.short;
    }

    // Update desktop dropdown items
    document.querySelectorAll('.locale-switcher-wrapper .locale-item').forEach(item => {
      item.classList.toggle('active', item.dataset.lang === lang);
    });

    // Update mobile lang button
    const mobileLangShort = document.querySelector('.mobile-lang-short');
    if (mobileLangShort) {
      mobileLangShort.textContent = current.short;
    }

    // Update mobile dropdown items
    if (mobileLangDropdown) {
      mobileLangDropdown.querySelectorAll('.locale-item').forEach(item => {
        item.classList.toggle('active', item.dataset.lang === lang);
      });
    }

    // Update bottom tab labels
    NAV_ITEMS.forEach(item => {
      const link = document.querySelector(`.bottom-tab-link[data-nav="${item.key}"]`);
      if (link) {
        link.querySelector('.bottom-tab-label').textContent = item.label[lang];
      }
    });

    // Apply translations to all UI text
    applyTranslations(lang);

    // Show notification
    showToast(`Language: ${current.label}`);
  }

  // ============ TOAST ============
  function showToast(message) {
    const existing = document.querySelector('.locale-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'locale-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // ============ EXPORT ============
  window.AppI18n = {
    setLanguage,
    getCurrentLang: () => currentLang,
    getTranslation: (key, lang) => T[key]?.[lang || currentLang] || key,
    applyResponsiveLayout,
    LOCALES,
    T,
  };

  // Run
  init();
})();

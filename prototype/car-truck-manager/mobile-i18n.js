/**
 * Mobile Responsive & i18n Enhancement for Car-Truck Manager Prototype
 * Supports: Vietnamese (vi), English (en), Korean (ko)
 */

(function() {
  'use strict';

  // ============ TRANSLATIONS ============
  const translations = {
    vi: {
      // Sidebar
      'dept.label': 'Phong ban',
      'dept.car': 'Xe con',
      'dept.truck': 'Xe tai',
      // Truck Nav
      'nav.dashboard': 'Bang dieu khien',
      'nav.trips': 'Nhat ky chuyen',
      'nav.trucks': 'Doi xe tai',
      'nav.drivers': 'Tai xe',
      'nav.monthly': 'Chi phi & Loi nhuan',
      'nav.reports': 'Bao cao',
      'nav.import': 'Import Excel',
      'nav.about': 'Kien truc & quyet dinh',
      'nav.operations': 'Van hanh',
      'nav.finance': 'Tai chinh',
      'nav.data': 'Du lieu',
      // Car Nav
      'car.workspace': 'Khong gian lam viec',
      'car.admin': 'Quan tri',
      'car.trips': 'Chuyen di',
      'car.vehicles': 'Phuong tien',
      'car.expenses': 'Chi phi',
      'car.users': 'Nguoi dung',
      'car.settings': 'Cai dat',
      'car.audit': 'Nhat ky kiem toan',
      // Headers
      'header.dashboard': 'Bang dieu khien',
      'header.trips': 'Chuyen di',
      'header.fleet': 'Doi xe cong ty',
      'header.drivers': 'Tai xe',
      'header.expenses': 'Chi phi & duyet',
      'header.users': 'Nguoi dung & quyen',
      'header.settings': 'Cai dat duyet tu dong',
      'header.auditLog': 'Nhat ky he thong',
      // Buttons
      'btn.newTrip': 'Tao chuyen',
      'btn.bookCar': 'Dat xe',
      'btn.addVehicle': 'Them xe',
      'btn.inviteUser': 'Moi nguoi dung',
      'btn.approve': 'Duyet',
      'btn.reject': 'Tu choi',
      // KPI
      'kpi.revenue': 'Tong doanh thu',
      'kpi.cost': 'Tong chi phi',
      'kpi.profit': 'Loi nhuan rong',
      'kpi.trips': 'So chuyen trong thang',
      // Table Headers
      'th.time': 'Thoi gian',
      'th.booker': 'Nguoi dat',
      'th.route': 'Lo trinh',
      'th.vehicleDriver': 'Xe · Tai xe',
      'th.status': 'Trang thai',
      'th.driver': 'Tai xe',
      'th.vehicle': 'Xe phu trach',
      'th.tripsMonth': 'Chuyen T10',
      'th.date': 'Ngay',
      'th.type': 'Loai',
      'th.note': 'Ghi chu',
      'th.amount': 'So tien',
      'th.action': 'Trang thai / Thao tac',
      'th.user': 'Nguoi dung',
      'th.email': 'Email',
      'th.role': 'Vai tro',
      // Status
      'status.pending': 'Cho',
      'status.confirmed': 'Da xac nhan',
      'status.inProgress': 'Dang chay',
      'status.completed': 'Hoan thanh',
      'status.cancelled': 'Da huy',
      'status.rejected': 'Tu choi',
      'status.available': 'San sang',
      'status.maintenance': 'Bao duong',
      'status.running': 'Dang chay',
      'status.approved': 'Da duyet',
      'status.active': 'Hoat dong',
      // Misc
      'misc.admin': 'Quan tri vien',
      'misc.pending': 'cho',
      'misc.approve': 'duyet',
      'misc.manageVehicles': 'Quan ly xe',
      'misc.upcoming': 'Sap toi',
      'misc.vehicles': 'Phuong tien',
      'misc.fleetStatus': 'Tinh trang doi xe',
      'misc.maintenanceAlerts': 'Canh bao bao duong',
      'misc.revenueProfit': 'Doanh thu & loi nhuan theo thang',
      'misc.costStructure': 'Co cau chi phi',
      'misc.odo': 'Odo',
      'misc.oilChange': 'Thay dau',
      'misc.color': 'Mau',
      'misc.year': 'Nam',
      'misc.driver': 'Tai xe',
      // Language
      'lang.vi': 'Tieng Viet',
      'lang.en': 'English',
      'lang.ko': '한국어'
    },
    en: {
      // Sidebar
      'dept.label': 'Department',
      'dept.car': 'Car',
      'dept.truck': 'Truck',
      // Truck Nav
      'nav.dashboard': 'Dashboard',
      'nav.trips': 'Trip Log',
      'nav.trucks': 'Truck Fleet',
      'nav.drivers': 'Drivers',
      'nav.monthly': 'Cost & Profit',
      'nav.reports': 'Reports',
      'nav.import': 'Import Excel',
      'nav.about': 'Architecture & Decisions',
      'nav.operations': 'Operations',
      'nav.finance': 'Finance',
      'nav.data': 'Data',
      // Car Nav
      'car.workspace': 'Workspace',
      'car.admin': 'Administration',
      'car.trips': 'Trips',
      'car.vehicles': 'Vehicles',
      'car.expenses': 'Expenses',
      'car.users': 'Users',
      'car.settings': 'Settings',
      'car.audit': 'Audit Log',
      // Headers
      'header.dashboard': 'Dashboard',
      'header.trips': 'Trips',
      'header.fleet': 'Company Fleet',
      'header.drivers': 'Drivers',
      'header.expenses': 'Expenses & Approval',
      'header.users': 'Users & Permissions',
      'header.settings': 'Auto-approval Settings',
      'header.auditLog': 'System Log',
      // Buttons
      'btn.newTrip': 'New Trip',
      'btn.bookCar': 'Book Car',
      'btn.addVehicle': 'Add Vehicle',
      'btn.inviteUser': 'Invite User',
      'btn.approve': 'Approve',
      'btn.reject': 'Reject',
      // KPI
      'kpi.revenue': 'Total Revenue',
      'kpi.cost': 'Total Cost',
      'kpi.profit': 'Net Profit',
      'kpi.trips': 'Trips This Month',
      // Table Headers
      'th.time': 'Time',
      'th.booker': 'Booker',
      'th.route': 'Route',
      'th.vehicleDriver': 'Vehicle · Driver',
      'th.status': 'Status',
      'th.driver': 'Driver',
      'th.vehicle': 'Assigned Vehicle',
      'th.tripsMonth': 'Trips Oct',
      'th.date': 'Date',
      'th.type': 'Type',
      'th.note': 'Note',
      'th.amount': 'Amount',
      'th.action': 'Status / Action',
      'th.user': 'User',
      'th.email': 'Email',
      'th.role': 'Role',
      // Status
      'status.pending': 'Pending',
      'status.confirmed': 'Confirmed',
      'status.inProgress': 'In Progress',
      'status.completed': 'Completed',
      'status.cancelled': 'Cancelled',
      'status.rejected': 'Rejected',
      'status.available': 'Available',
      'status.maintenance': 'Maintenance',
      'status.running': 'Running',
      'status.approved': 'Approved',
      'status.active': 'Active',
      // Misc
      'misc.admin': 'Administrator',
      'misc.pending': 'pending',
      'misc.approve': 'approve',
      'misc.manageVehicles': 'Manage Vehicles',
      'misc.upcoming': 'Upcoming',
      'misc.vehicles': 'Vehicles',
      'misc.fleetStatus': 'Fleet Status',
      'misc.maintenanceAlerts': 'Maintenance Alerts',
      'misc.revenueProfit': 'Revenue & Profit by Month',
      'misc.costStructure': 'Cost Structure',
      'misc.odo': 'Odo',
      'misc.oilChange': 'Oil Change',
      'misc.color': 'Color',
      'misc.year': 'Year',
      'misc.driver': 'Driver',
      // Language
      'lang.vi': 'Tieng Viet',
      'lang.en': 'English',
      'lang.ko': '한국어'
    },
    ko: {
      // Sidebar
      'dept.label': '부서',
      'dept.car': '승용차',
      'dept.truck': '트럭',
      // Truck Nav
      'nav.dashboard': '대시보드',
      'nav.trips': '운행 일지',
      'nav.trucks': '트럭 대대',
      'nav.drivers': '운전사',
      'nav.monthly': '비용 & 수익',
      'nav.reports': '보고서',
      'nav.import': 'Excel 가져오기',
      'nav.about': '아키텍처 & 결정',
      'nav.operations': '운영',
      'nav.finance': '재무',
      'nav.data': '데이터',
      // Car Nav
      'car.workspace': '작업 공간',
      'car.admin': '관리',
      'car.trips': '운행',
      'car.vehicles': '차량',
      'car.expenses': '비용',
      'car.users': '사용자',
      'car.settings': '설정',
      'car.audit': '감사 로그',
      // Headers
      'header.dashboard': '대시보드',
      'header.trips': '운행',
      'header.fleet': '회사 차량',
      'header.drivers': '운전사',
      'header.expenses': '비용 & 승인',
      'header.users': '사용자 & 권한',
      'header.settings': '자동 승인 설정',
      'header.auditLog': '시스템 로그',
      // Buttons
      'btn.newTrip': '새 운행',
      'btn.bookCar': '차량 예약',
      'btn.addVehicle': '차량 추가',
      'btn.inviteUser': '사용자 초대',
      'btn.approve': '승인',
      'btn.reject': '거부',
      // KPI
      'kpi.revenue': '총 매출',
      'kpi.cost': '총 비용',
      'kpi.profit': '순이익',
      'kpi.trips': '이번 달 운행',
      // Table Headers
      'th.time': '시간',
      'th.booker': '예약자',
      'th.route': '경로',
      'th.vehicleDriver': '차량 · 운전사',
      'th.status': '상태',
      'th.driver': '운전사',
      'th.vehicle': '담당 차량',
      'th.tripsMonth': '10월 운행',
      'th.date': '날짜',
      'th.type': '유형',
      'th.note': '메모',
      'th.amount': '금액',
      'th.action': '상태 / 작업',
      'th.user': '사용자',
      'th.email': '이메일',
      'th.role': '역할',
      // Status
      'status.pending': '대기중',
      'status.confirmed': '확인됨',
      'status.inProgress': '진행중',
      'status.completed': '완료',
      'status.cancelled': '취소',
      'status.rejected': '거부',
      'status.available': '사용 가능',
      'status.maintenance': '정비중',
      'status.running': '운행중',
      'status.approved': '승인됨',
      'status.active': '활성',
      // Misc
      'misc.admin': '관리자',
      'misc.pending': '대기',
      'misc.approve': '승인',
      'misc.manageVehicles': '차량 관리',
      'misc.upcoming': '예정',
      'misc.vehicles': '차량',
      'misc.fleetStatus': '차량 현황',
      'misc.maintenanceAlerts': '정비 알림',
      'misc.revenueProfit': '월별 매출 & 수익',
      'misc.costStructure': '비용 구조',
      'misc.odo': '주행거리',
      'misc.oilChange': '오일 교환',
      'misc.color': '색상',
      'misc.year': '연식',
      'misc.driver': '운전사',
      // Language
      'lang.vi': 'Tieng Viet',
      'lang.en': 'English',
      'lang.ko': '한국어'
    }
  };

  // ============ MOBILE RESPONSIVE CSS ============
  const mobileCSS = `
    /* Language Switcher */
    .lang-switcher {
      display: flex;
      gap: 4px;
      padding: 8px 12px;
      border-top: 1px solid #E2E5EB;
    }
    .lang-btn {
      flex: 1;
      height: 32px;
      border: 1px solid #E2E5EB;
      border-radius: 6px;
      background: #fff;
      font: 600 11px/1 inherit;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      color: #64748B;
    }
    .lang-btn:hover {
      border-color: var(--accent, #0369A1);
      color: var(--accent, #0369A1);
    }
    .lang-btn.active {
      background: var(--accent, #0369A1);
      border-color: var(--accent, #0369A1);
      color: #fff;
    }
    .lang-btn img, .lang-btn svg {
      width: 14px;
      height: 14px;
      border-radius: 2px;
    }

    /* Mobile Menu Button */
    .mobile-menu-btn {
      display: none;
      position: fixed;
      top: 12px;
      left: 12px;
      z-index: 1001;
      width: 44px;
      height: 44px;
      border: none;
      border-radius: 10px;
      background: #fff;
      box-shadow: 0 2px 8px rgba(15,23,42,0.15);
      cursor: pointer;
      align-items: center;
      justify-content: center;
    }
    .mobile-menu-btn svg {
      width: 24px;
      height: 24px;
      stroke: #0F172A;
    }

    /* Mobile Overlay */
    .mobile-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(15,23,42,0.5);
      z-index: 999;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .mobile-overlay.show {
      opacity: 1;
    }

    /* Mobile Responsive */
    @media (max-width: 1024px) {
      .app-sidebar {
        position: fixed !important;
        left: 0;
        top: 0;
        z-index: 1000;
        transform: translateX(-100%);
        transition: transform 0.3s ease;
        box-shadow: 4px 0 20px rgba(15,23,42,0.15);
      }
      .app-sidebar.open {
        transform: translateX(0);
      }
      .mobile-menu-btn {
        display: flex;
      }
      .mobile-overlay.show {
        display: block;
      }
      .app-main {
        margin-left: 0 !important;
        padding-top: 60px !important;
      }
      .app-main > header {
        padding-left: 70px !important;
      }
    }

    @media (max-width: 768px) {
      /* KPI Grid */
      .kpi-grid {
        grid-template-columns: repeat(2, 1fr) !important;
      }
      /* Chart Grid */
      .chart-grid {
        grid-template-columns: 1fr !important;
      }
      /* Content padding */
      .content-area {
        padding: 16px !important;
      }
      /* Header */
      .app-main > header {
        padding: 12px 16px 12px 60px !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: 12px !important;
      }
      .app-main > header > div:last-child {
        width: 100%;
      }
      .app-main > header button {
        width: 100%;
        justify-content: center;
      }
      /* Table */
      .data-table {
        display: block;
        overflow-x: auto;
      }
      .data-table table {
        min-width: 700px;
      }
      /* Cards Grid */
      .cards-grid {
        grid-template-columns: 1fr !important;
      }
      /* Dashboard grid */
      .dashboard-grid {
        grid-template-columns: 1fr !important;
      }
      /* Fleet + Alerts */
      .fleet-alerts-grid {
        grid-template-columns: 1fr !important;
      }
    }

    @media (max-width: 480px) {
      /* KPI Grid */
      .kpi-grid {
        grid-template-columns: 1fr !important;
      }
      /* KPI Card */
      .kpi-card {
        padding: 14px !important;
      }
      .kpi-card .kpi-value {
        font-size: 22px !important;
      }
      /* Header title */
      .page-title {
        font-size: 18px !important;
      }
      /* Sidebar width */
      .app-sidebar {
        width: 280px !important;
      }
    }
  `;

  // ============ INITIALIZATION ============
  let currentLang = localStorage.getItem('app-lang') || 'vi';
  let sidebarOpen = false;

  function init() {
    // Inject CSS
    const style = document.createElement('style');
    style.id = 'mobile-i18n-styles';
    style.textContent = mobileCSS;
    document.head.appendChild(style);

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupUI);
    } else {
      setupUI();
    }
  }

  function setupUI() {
    // Add class to sidebar for CSS targeting
    const sidebar = document.querySelector('aside');
    if (sidebar) {
      sidebar.classList.add('app-sidebar');
    }

    // Add class to main content
    const main = document.querySelector('main');
    if (main) {
      main.classList.add('app-main');
    }

    // Create mobile menu button
    createMobileMenuButton();

    // Create mobile overlay
    createMobileOverlay();

    // Create language switcher
    createLanguageSwitcher();

    // Apply initial language (don't translate on first load to preserve prototype)
    // applyTranslations(currentLang);
  }

  function createMobileMenuButton() {
    const btn = document.createElement('button');
    btn.className = 'mobile-menu-btn';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    `;
    btn.onclick = toggleSidebar;
    document.body.appendChild(btn);
  }

  function createMobileOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'mobile-overlay';
    overlay.onclick = closeSidebar;
    document.body.appendChild(overlay);
  }

  function createLanguageSwitcher() {
    const sidebar = document.querySelector('aside');
    if (!sidebar) return;

    // Find the user section (last div in sidebar)
    const userSection = sidebar.querySelector('div:last-child');
    if (!userSection) return;

    // Create language switcher container
    const langContainer = document.createElement('div');
    langContainer.className = 'lang-switcher';
    langContainer.innerHTML = `
      <button class="lang-btn ${currentLang === 'vi' ? 'active' : ''}" data-lang="vi" title="Tiếng Việt">
        <span style="font-size:14px;">🇻🇳</span>
        <span>VI</span>
      </button>
      <button class="lang-btn ${currentLang === 'en' ? 'active' : ''}" data-lang="en" title="English">
        <span style="font-size:14px;">🇬🇧</span>
        <span>EN</span>
      </button>
      <button class="lang-btn ${currentLang === 'ko' ? 'active' : ''}" data-lang="ko" title="한국어">
        <span style="font-size:14px;">🇰🇷</span>
        <span>KO</span>
      </button>
    `;

    // Insert before user section
    sidebar.insertBefore(langContainer, userSection);

    // Add click handlers
    langContainer.querySelectorAll('.lang-btn').forEach(btn => {
      btn.onclick = () => {
        const lang = btn.dataset.lang;
        setLanguage(lang);
      };
    });
  }

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
    const sidebar = document.querySelector('.app-sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    const btn = document.querySelector('.mobile-menu-btn');

    if (sidebarOpen) {
      sidebar?.classList.add('open');
      overlay?.classList.add('show');
      if (btn) {
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        `;
      }
    } else {
      closeSidebar();
    }
  }

  function closeSidebar() {
    sidebarOpen = false;
    const sidebar = document.querySelector('.app-sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    const btn = document.querySelector('.mobile-menu-btn');

    sidebar?.classList.remove('open');
    overlay?.classList.remove('show');
    if (btn) {
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      `;
    }
  }

  function setLanguage(lang) {
    if (!translations[lang]) return;

    currentLang = lang;
    localStorage.setItem('app-lang', lang);

    // Update button states
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Show notification
    showLanguageNotification(lang);
  }

  function showLanguageNotification(lang) {
    const langNames = {
      vi: 'Tiếng Việt',
      en: 'English',
      ko: '한국어'
    };

    // Remove existing notification
    const existing = document.querySelector('.lang-notification');
    if (existing) existing.remove();

    // Create notification
    const notif = document.createElement('div');
    notif.className = 'lang-notification';
    notif.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #0F172A;
      color: #fff;
      padding: 12px 24px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      z-index: 9999;
      box-shadow: 0 4px 20px rgba(15,23,42,0.3);
      animation: slideUp 0.3s ease;
    `;
    notif.textContent = `Language: ${langNames[lang]}`;

    // Add animation keyframes
    if (!document.querySelector('#lang-notif-style')) {
      const style = document.createElement('style');
      style.id = 'lang-notif-style';
      style.textContent = `
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notif);

    // Remove after 2s
    setTimeout(() => {
      notif.style.opacity = '0';
      notif.style.transform = 'translateX(-50%) translateY(20px)';
      notif.style.transition = 'all 0.3s ease';
      setTimeout(() => notif.remove(), 300);
    }, 2000);
  }

  // Export for external use
  window.AppI18n = {
    setLanguage,
    getCurrentLang: () => currentLang,
    getTranslation: (key) => translations[currentLang]?.[key] || key,
    translations
  };

  // Initialize
  init();
})();

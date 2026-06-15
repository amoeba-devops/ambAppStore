/**
 * Mobile Responsive & i18n Enhancement for Car-Truck Manager Prototype
 * Design matches car-manager-v2 (bottom tab nav, dropdown language switcher)
 * Supports: Vietnamese (vi), English (en), Korean (ko)
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
    { id: 'vi', label: 'Tieng Viet', short: 'VI' },
    { id: 'en', label: 'English',    short: 'EN' },
    { id: 'ko', label: '한국어',      short: 'KO' },
  ];

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

    /* ========== BOTTOM TAB NAV (Mobile Only) ========== */
    .bottom-tab-nav {
      display: none;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 40;
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
      font-size: 12px;
      font-weight: 500;
      transition: color 0.15s;
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
    .bottom-tab-link.active + .bottom-tab-indicator,
    .bottom-tab-item:has(.active) .bottom-tab-indicator {
      width: 40px;
    }

    .bottom-tab-icon {
      width: 24px;
      height: 24px;
      transition: transform 0.18s;
    }

    .bottom-tab-label {
      line-height: 1;
    }

    /* ========== MOBILE RESPONSIVE ========== */
    @media (max-width: 1024px) {
      /* Hide sidebar on mobile */
      .app-sidebar {
        display: none !important;
      }

      /* Show bottom tab nav */
      .bottom-tab-nav {
        display: block;
      }

      /* Main content adjustments */
      .app-main {
        margin-left: 0 !important;
        /* Reserve space for bottom nav */
        padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px)) !important;
      }

      /* Adjust main container */
      body > div:first-child,
      x-dc > div:first-child {
        flex-direction: column !important;
      }
    }

    @media (max-width: 768px) {
      /* KPI Grid adjustments */
      main > div[style*="grid-template-columns:repeat(4"] {
        grid-template-columns: repeat(2, 1fr) !important;
      }

      /* Chart Grid adjustments */
      main > div[style*="grid-template-columns:1.15fr"] {
        grid-template-columns: 1fr !important;
      }

      /* Dashboard grid */
      main > div[style*="grid-template-columns:1fr 300px"] {
        grid-template-columns: 1fr !important;
      }

      /* Fleet + Alerts grid */
      main > div[style*="grid-template-columns:1fr 1.4fr"] {
        grid-template-columns: 1fr !important;
      }

      /* Cards grid */
      main > div[style*="grid-template-columns:repeat(auto-fill"] {
        grid-template-columns: 1fr !important;
      }

      /* Header adjustments */
      main > header {
        flex-wrap: wrap !important;
        gap: 12px !important;
        padding: 16px !important;
      }

      /* Content padding */
      main > div {
        padding: 16px !important;
      }

      /* Table horizontal scroll */
      table {
        display: block;
        overflow-x: auto;
      }
    }

    @media (max-width: 480px) {
      /* Single column KPI */
      main > div[style*="grid-template-columns:repeat(2"] {
        grid-template-columns: 1fr !important;
      }

      /* Bottom tab with 3 columns for smaller screens */
      .bottom-tab-list {
        grid-template-columns: repeat(3, 1fr);
      }
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
  `;

  // ============ SVG ICONS ============
  const ICONS = {
    languages: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>`,
    chevronUpDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    // Bottom Tab Icons
    dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>`,
    trips: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>`,
    vehicles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
  };

  // ============ NAV ITEMS ============
  const NAV_ITEMS = [
    { key: 'dashboard', icon: 'dashboard', label: { vi: 'Tong quan', en: 'Dashboard', ko: '대시보드' } },
    { key: 'trips', icon: 'trips', label: { vi: 'Chuyen', en: 'Trips', ko: '운행' } },
    { key: 'vehicles', icon: 'vehicles', label: { vi: 'Phuong tien', en: 'Vehicles', ko: '차량' } },
    { key: 'settings', icon: 'settings', label: { vi: 'Cai dat', en: 'Settings', ko: '설정' } },
  ];

  // ============ STATE ============
  let currentLang = localStorage.getItem('app-lang') || 'vi';
  let dropdownOpen = false;

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
    // Add classes for CSS targeting
    const sidebar = document.querySelector('aside');
    if (sidebar) {
      sidebar.classList.add('app-sidebar');
    }

    const main = document.querySelector('main');
    if (main) {
      main.classList.add('app-main');
    }

    // Create locale switcher in sidebar
    createLocaleSwitcher();

    // Create bottom tab nav for mobile
    createBottomTabNav();
  }

  // ============ LOCALE SWITCHER ============
  function createLocaleSwitcher() {
    const sidebar = document.querySelector('aside');
    if (!sidebar) return;

    // Find user section (last div with border-top)
    const userSection = sidebar.querySelector('div[style*="border-top"]:last-of-type');
    if (!userSection) return;

    const current = LOCALES.find(l => l.id === currentLang) || LOCALES[0];

    // Create wrapper
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

    // Insert before user section
    sidebar.insertBefore(wrapper, userSection);

    // Event handlers
    const trigger = wrapper.querySelector('.locale-trigger');
    const dropdown = wrapper.querySelector('.locale-dropdown');
    const backdrop = wrapper.querySelector('.locale-backdrop');

    trigger.addEventListener('click', () => {
      dropdownOpen = !dropdownOpen;
      trigger.dataset.open = dropdownOpen;
      dropdown.classList.toggle('open', dropdownOpen);
      backdrop.classList.toggle('open', dropdownOpen);
    });

    backdrop.addEventListener('click', closeDropdown);

    wrapper.querySelectorAll('.locale-item').forEach(item => {
      item.addEventListener('click', () => {
        const lang = item.dataset.lang;
        setLanguage(lang);
        closeDropdown();
      });
    });

    function closeDropdown() {
      dropdownOpen = false;
      trigger.dataset.open = 'false';
      dropdown.classList.remove('open');
      backdrop.classList.remove('open');
    }
  }

  // ============ BOTTOM TAB NAV ============
  function createBottomTabNav() {
    const nav = document.createElement('nav');
    nav.className = 'bottom-tab-nav';
    nav.setAttribute('aria-label', 'Mobile navigation');

    nav.innerHTML = `
      <ul class="bottom-tab-list">
        ${NAV_ITEMS.map((item, index) => `
          <li class="bottom-tab-item">
            <a href="#" class="bottom-tab-link ${index === 0 ? 'active' : ''}" data-nav="${item.key}">
              <span class="bottom-tab-icon">${ICONS[item.icon]}</span>
              <span class="bottom-tab-label">${item.label[currentLang]}</span>
            </a>
            <span class="bottom-tab-indicator"></span>
          </li>
        `).join('')}
      </ul>
    `;

    document.body.appendChild(nav);

    // Handle tab clicks (for prototype, just show which tab is active)
    nav.querySelectorAll('.bottom-tab-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        nav.querySelectorAll('.bottom-tab-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        showToast(`Navigating to ${link.dataset.nav}...`);
      });
    });
  }

  // ============ SET LANGUAGE ============
  function setLanguage(lang) {
    if (!LOCALES.find(l => l.id === lang)) return;
    currentLang = lang;
    localStorage.setItem('app-lang', lang);

    // Update trigger
    const current = LOCALES.find(l => l.id === lang);
    const trigger = document.querySelector('.locale-trigger');
    if (trigger && current) {
      trigger.querySelector('.locale-trigger-label').textContent = current.label;
      trigger.querySelector('.locale-trigger-short').textContent = current.short;
    }

    // Update dropdown items
    document.querySelectorAll('.locale-item').forEach(item => {
      item.classList.toggle('active', item.dataset.lang === lang);
    });

    // Update bottom tab labels
    NAV_ITEMS.forEach(item => {
      const link = document.querySelector(`.bottom-tab-link[data-nav="${item.key}"]`);
      if (link) {
        link.querySelector('.bottom-tab-label').textContent = item.label[lang];
      }
    });

    // Show notification
    showToast(`Language: ${current.label}`);
  }

  // ============ TOAST ============
  function showToast(message) {
    // Remove existing
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
    LOCALES,
  };

  // Run
  init();
})();

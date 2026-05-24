import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import {
  captureRaw,
  uiLocaleFromTestInfo,
  deviceFromTestInfo,
  RAW_OUT,
} from './_helpers.js';

// Smoke-check: hit each VI common page through the dev server (since
// the user guide lives in apps/web/public/, Next.js serves it as a static
// asset). Capture a thumbnail of each so we can verify visually.

const VI_PAGES = [
  { slug: 'landing-vi', url: '/docs/user-guide/vi/index.html', expectText: 'Bạn là ai' },
  { slug: 'common-00-gioi-thieu', url: '/docs/user-guide/vi/common/00-gioi-thieu.html', expectText: 'Giới thiệu hệ thống' },
  { slug: 'common-01-dang-nhap', url: '/docs/user-guide/vi/common/01-dang-nhap.html', expectText: 'Đăng nhập hệ thống' },
  { slug: 'common-02-dieu-huong', url: '/docs/user-guide/vi/common/02-dieu-huong.html', expectText: 'Điều hướng trong app' },
  { slug: 'common-03-ngon-ngu', url: '/docs/user-guide/vi/common/03-ngon-ngu.html', expectText: 'Đổi ngôn ngữ' },
  { slug: 'common-04-thong-bao', url: '/docs/user-guide/vi/common/04-thong-bao.html', expectText: 'Hộp thư thông báo' },
  { slug: 'common-99-thuat-ngu', url: '/docs/user-guide/vi/common/99-thuat-ngu.html', expectText: 'Bảng thuật ngữ' },
  { slug: 'driver-00-tong-quan', url: '/docs/user-guide/vi/driver/00-tong-quan.html', expectText: 'Tài xế — Tổng quan' },
  { slug: 'driver-01-cai-pwa', url: '/docs/user-guide/vi/driver/01-cai-pwa.html', expectText: 'Cài đặt PWA' },
  { slug: 'driver-02-today', url: '/docs/user-guide/vi/driver/02-today-screen.html', expectText: 'Màn hình "Hôm nay"' },
  { slug: 'driver-03-xac-nhan', url: '/docs/user-guide/vi/driver/03-xac-nhan-chuyen.html', expectText: 'Xác nhận / Từ chối chuyến mới' },
  { slug: 'driver-04-bat-dau-ket-thuc', url: '/docs/user-guide/vi/driver/04-bat-dau-ket-thuc-chuyen.html', expectText: 'Bắt đầu và kết thúc chuyến' },
  { slug: 'driver-05-ghi-chi-phi', url: '/docs/user-guide/vi/driver/05-ghi-chi-phi.html', expectText: 'Ghi chi phí phát sinh' },
  { slug: 'driver-06-canh-bao', url: '/docs/user-guide/vi/driver/06-canh-bao-bao-duong.html', expectText: 'Đọc cảnh báo bảo dưỡng' },
  { slug: 'driver-07-ngoai-tuyen', url: '/docs/user-guide/vi/driver/07-ngoai-tuyen.html', expectText: 'Khi mạng yếu hoặc mất sóng' },
  { slug: 'manager-00-tong-quan', url: '/docs/user-guide/vi/manager/00-tong-quan.html', expectText: 'Quản lý / Giám đốc — Tổng quan' },
  { slug: 'manager-01-dashboard', url: '/docs/user-guide/vi/manager/01-dashboard.html', expectText: 'Dashboard — Tổng quan đội xe' },
  { slug: 'manager-02-dat-xe', url: '/docs/user-guide/vi/manager/02-dat-xe.html', expectText: 'Đặt xe — tạo chuyến mới' },
  { slug: 'manager-03-theo-doi', url: '/docs/user-guide/vi/manager/03-theo-doi-chuyen-di.html', expectText: 'Theo dõi chuyến đi' },
  { slug: 'manager-04-ghi-chi-phi', url: '/docs/user-guide/vi/manager/04-ghi-chi-phi.html', expectText: 'Ghi chi phí phát sinh' },
  { slug: 'manager-05-so-chi-phi', url: '/docs/user-guide/vi/manager/05-so-chi-phi.html', expectText: 'Sổ chi phí (Costs Ledger)' },
  { slug: 'manager-06-bao-cao', url: '/docs/user-guide/vi/manager/06-bao-cao-ca-nhan.html', expectText: 'Báo cáo cá nhân' },
  { slug: 'admin-00-tong-quan', url: '/docs/user-guide/vi/admin/00-tong-quan.html', expectText: 'Quản trị viên — Tổng quan' },
  { slug: 'admin-01-dashboard', url: '/docs/user-guide/vi/admin/01-dashboard.html', expectText: 'Dashboard — Tổng quan toàn công ty' },
  { slug: 'admin-02-vehicles', url: '/docs/user-guide/vi/admin/02-quan-ly-xe.html', expectText: 'Quản lý xe (Vehicles)' },
  { slug: 'admin-03-drivers', url: '/docs/user-guide/vi/admin/03-quan-ly-tai-xe.html', expectText: 'Quản lý tài xế (Drivers)' },
  { slug: 'admin-04-users', url: '/docs/user-guide/vi/admin/04-quan-ly-nguoi-dung.html', expectText: 'Quản lý người dùng' },
  { slug: 'admin-05-trips', url: '/docs/user-guide/vi/admin/05-quan-ly-chuyen-di.html', expectText: 'Quản lý chuyến đi (Trips)' },
  { slug: 'admin-06-costs', url: '/docs/user-guide/vi/admin/06-quan-ly-chi-phi.html', expectText: 'Quản lý chi phí toàn công ty' },
  { slug: 'admin-07-maintenance', url: '/docs/user-guide/vi/admin/07-canh-bao-bao-duong.html', expectText: 'Cảnh báo bảo dưỡng (Maintenance Alerts)' },
  { slug: 'admin-08-reports', url: '/docs/user-guide/vi/admin/08-bao-cao.html', expectText: 'Báo cáo & Phân tích' },
  { slug: 'admin-09-settings', url: '/docs/user-guide/vi/admin/09-cau-hinh-he-thong.html', expectText: 'Cấu hình hệ thống (Settings)' },
  { slug: 'admin-10-audit', url: '/docs/user-guide/vi/admin/10-audit-log.html', expectText: 'Nhật ký kiểm toán (Audit Log)' },

  // ──────────────── KO mirror ────────────────
  { slug: 'ko-landing', url: '/docs/user-guide/ko/index.html', expectText: '역할을 선택하세요' },
  { slug: 'ko-common-00-soge',     url: '/docs/user-guide/ko/common/00-gioi-thieu.html',  expectText: '시스템 소개' },
  { slug: 'ko-common-01-login',    url: '/docs/user-guide/ko/common/01-dang-nhap.html',    expectText: '시스템 로그인' },
  { slug: 'ko-common-02-nav',      url: '/docs/user-guide/ko/common/02-dieu-huong.html',   expectText: '앱 화면 탐색' },
  { slug: 'ko-common-03-lang',     url: '/docs/user-guide/ko/common/03-ngon-ngu.html',     expectText: '표시 언어 변경' },
  { slug: 'ko-common-04-inbox',    url: '/docs/user-guide/ko/common/04-thong-bao.html',    expectText: '알림함' },
  { slug: 'ko-common-99-glossary', url: '/docs/user-guide/ko/common/99-thuat-ngu.html',    expectText: '용어집' },
  { slug: 'ko-driver-00', url: '/docs/user-guide/ko/driver/00-tong-quan.html',             expectText: '기사 — 개요' },
  { slug: 'ko-driver-01', url: '/docs/user-guide/ko/driver/01-cai-pwa.html',               expectText: 'PWA 설치' },
  { slug: 'ko-driver-02', url: '/docs/user-guide/ko/driver/02-today-screen.html',          expectText: '"오늘" 화면' },
  { slug: 'ko-driver-03', url: '/docs/user-guide/ko/driver/03-xac-nhan-chuyen.html',       expectText: '운행 확인' },
  { slug: 'ko-driver-04', url: '/docs/user-guide/ko/driver/04-bat-dau-ket-thuc-chuyen.html', expectText: '운행 시작' },
  { slug: 'ko-driver-05', url: '/docs/user-guide/ko/driver/05-ghi-chi-phi.html',           expectText: '비용 기록' },
  { slug: 'ko-driver-06', url: '/docs/user-guide/ko/driver/06-canh-bao-bao-duong.html',    expectText: '정비 알림' },
  { slug: 'ko-driver-07', url: '/docs/user-guide/ko/driver/07-ngoai-tuyen.html',           expectText: '네트워크' },
  { slug: 'ko-manager-00', url: '/docs/user-guide/ko/manager/00-tong-quan.html',           expectText: '매니저' },
  { slug: 'ko-manager-01', url: '/docs/user-guide/ko/manager/01-dashboard.html',           expectText: '대시보드' },
  { slug: 'ko-manager-02', url: '/docs/user-guide/ko/manager/02-dat-xe.html',              expectText: '차량 예약' },
  { slug: 'ko-manager-03', url: '/docs/user-guide/ko/manager/03-theo-doi-chuyen-di.html',  expectText: '운행 추적' },
  { slug: 'ko-manager-04', url: '/docs/user-guide/ko/manager/04-ghi-chi-phi.html',         expectText: '비용 기록' },
  { slug: 'ko-manager-05', url: '/docs/user-guide/ko/manager/05-so-chi-phi.html',          expectText: '비용 장부' },
  { slug: 'ko-manager-06', url: '/docs/user-guide/ko/manager/06-bao-cao-ca-nhan.html',     expectText: '개인 보고서' },
  { slug: 'ko-admin-00', url: '/docs/user-guide/ko/admin/00-tong-quan.html',               expectText: '관리자 — 개요' },
  { slug: 'ko-admin-01', url: '/docs/user-guide/ko/admin/01-dashboard.html',               expectText: '대시보드' },
  { slug: 'ko-admin-02', url: '/docs/user-guide/ko/admin/02-quan-ly-xe.html',              expectText: '차량 관리' },
  { slug: 'ko-admin-03', url: '/docs/user-guide/ko/admin/03-quan-ly-tai-xe.html',          expectText: '기사 관리' },
  { slug: 'ko-admin-04', url: '/docs/user-guide/ko/admin/04-quan-ly-nguoi-dung.html',      expectText: '사용자 관리' },
  { slug: 'ko-admin-05', url: '/docs/user-guide/ko/admin/05-quan-ly-chuyen-di.html',       expectText: '운행 관리' },
  { slug: 'ko-admin-06', url: '/docs/user-guide/ko/admin/06-quan-ly-chi-phi.html',         expectText: '전사 비용 관리' },
  { slug: 'ko-admin-07', url: '/docs/user-guide/ko/admin/07-canh-bao-bao-duong.html',      expectText: '정비 알림' },
  { slug: 'ko-admin-08', url: '/docs/user-guide/ko/admin/08-bao-cao.html',                 expectText: '보고서' },
  { slug: 'ko-admin-09', url: '/docs/user-guide/ko/admin/09-cau-hinh-he-thong.html',       expectText: '시스템 설정' },
  { slug: 'ko-admin-10', url: '/docs/user-guide/ko/admin/10-audit-log.html',               expectText: '감사 로그' },
];

test.describe('User guide — VI smoke', () => {
  test.beforeEach(({ }, info) => {
    test.skip(deviceFromTestInfo(info) !== 'desktop', 'Desktop preview only');
    test.skip(uiLocaleFromTestInfo(info) !== 'vi', 'Smoke test runs once per locale — desktop project enough for HTML rendering check');
  });

  for (const page of VI_PAGES) {
    test(`renders ${page.slug}`, async ({ page: pw }) => {
      await pw.goto(page.url);
      await expect(pw.locator('h1, .landing h1').first()).toContainText(page.expectText);
      // Ensure no broken screenshot images on the page
      const broken = await pw.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        return imgs
          .filter((i) => i.complete && i.naturalWidth === 0)
          .map((i) => i.getAttribute('src'));
      });
      expect(broken, `broken images on ${page.url}`).toEqual([]);

      const out = resolve(RAW_OUT, '..', 'preview', `${page.slug}.png`);
      await captureRaw(pw, out, { fullPage: true });
    });
  }
});

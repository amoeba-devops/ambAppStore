#!/usr/bin/env node
/**
 * build-truck-guide.mjs — generate the TRUCK user-guide pages (vi + ko) for the
 * static guide site, matching the hand-written car pages' structure exactly
 * (header + search + lang-switch, grouped sidebar, breadcrumb, app-link CTA,
 * figures, pager, footer, scripts). Also patches the per-language role picker
 * (vi/index.html, ko/index.html) to add the two truck role cards.
 *
 * Content lives in PAGES[].{vi,ko}. Screenshots are captured separately by the
 * Playwright pipeline (scripts/user-guide/shots/truck-*.spec.ts).
 *
 * Usage: node scripts/build-truck-guide.mjs
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GUIDE = resolve(__dirname, '../apps/web/public/docs/user-guide');
const UPDATED = '01-07-2026';

const STR = {
  vi: { home: 'Trang chủ', searchPh: 'Tìm trong hướng dẫn… (/)', openInApp: 'Mở trang trong app',
    prev: '← Trước', next: 'Tiếp theo →', rolePick: 'Chọn vai trò',
    gMgr: 'Xe tải · Quản lý', gDrv: 'Xe tải · Tài xế', gCommon: 'Chung',
    feedback: 'Phản hồi', updatedLbl: 'Cập nhật' },
  ko: { home: '홈', searchPh: '가이드 검색… (/)', openInApp: '앱에서 열기',
    prev: '← 이전', next: '다음 →', rolePick: '역할 선택',
    gMgr: '트럭 · 관리자', gDrv: '트럭 · 기사', gCommon: '공통',
    feedback: '피드백', updatedLbl: '업데이트' },
};

// Sidebar nav per language: [href-relative-to-truck-manager, label]
const NAV = {
  manager: [
    ['00-tong-quan', { vi: 'Tổng quan', ko: '개요' }],
    ['01-bang-dieu-khien', { vi: 'Bảng điều khiển', ko: '대시보드' }],
    ['02-nhat-ky-chuyen', { vi: 'Nhật ký chuyến', ko: '운행 일지' }],
    ['03-lap-chuyen', { vi: 'Lập chuyến', ko: '운행 등록' }],
    ['04-chi-tiet-chuyen', { vi: 'Chi tiết chuyến', ko: '운행 상세' }],
    ['05-doi-xe', { vi: 'Đội xe', ko: '차량' }],
    ['06-tai-xe', { vi: 'Tài xế', ko: '기사' }],
    ['07-chi-phi-loi-nhuan', { vi: 'Chi phí & Lợi nhuận', ko: '비용 & 손익' }],
    ['08-tong-quan-pnl', { vi: 'Tổng quan P&L', ko: '손익 개요' }],
    ['09-lap-bao-cao', { vi: 'Lập báo cáo', ko: '보고서 작성' }],
    ['10-danh-sach-bao-cao', { vi: 'Danh sách báo cáo', ko: '보고서 목록' }],
    ['11-import-excel', { vi: 'Import Excel', ko: '엑셀 가져오기' }],
    ['12-cau-hinh', { vi: 'Cấu hình xe tải', ko: '트럭 설정' }],
  ],
  driver: [
    ['00-tong-quan', { vi: 'Tổng quan', ko: '개요' }],
    ['01-hom-nay', { vi: 'Hôm nay', ko: '오늘' }],
    ['02-hoan-thanh-chuyen', { vi: 'Hoàn thành chuyến', ko: '운행 완료' }],
    ['03-ghi-chuyen-moi', { vi: 'Ghi chuyến mới', ko: '새 운행 기록' }],
  ],
};

function langSwitch() {
  return '<span class="lang-switch"><a href="#" class="is-active" data-lang="vi"><span class="lang-name">Tiếng Việt</span><span class="lang-code">VI</span></a><a href="#" data-lang="ko"><span class="lang-name">한국어</span><span class="lang-code">KO</span></a></span>';
}

function sidebar(lang, section, slug) {
  const s = STR[lang];
  const link = (href, label, active) =>
    `        <a class="sidebar__link${active ? ' is-active' : ''}" href="${href}">${label}</a>`;
  const mgr = NAV.manager.map(([sl, lab]) => {
    const href = section === 'truck-manager' ? `${sl}.html` : `../truck-manager/${sl}.html`;
    return link(href, lab[lang], section === 'truck-manager' && sl === slug);
  }).join('\n');
  const drv = NAV.driver.map(([sl, lab]) => {
    const href = section === 'truck-driver' ? `${sl}.html` : `../truck-driver/${sl}.html`;
    return link(href, lab[lang], section === 'truck-driver' && sl === slug);
  }).join('\n');
  const common = [
    ['../common/01-dang-nhap.html', { vi: 'Đăng nhập', ko: '로그인' }],
    ['../common/03-ngon-ngu.html', { vi: 'Đổi ngôn ngữ', ko: '언어 변경' }],
    ['../common/04-thong-bao.html', { vi: 'Thông báo', ko: '알림' }],
  ].map(([href, lab]) => link(href, lab[lang])).join('\n');
  return `    <aside class="sidebar">
      <div class="sidebar__group">
        <div class="sidebar__group-label">${s.gMgr}</div>
${mgr}
      </div>
      <div class="sidebar__group">
        <div class="sidebar__group-label">${s.gDrv}</div>
${drv}
      </div>
      <div class="sidebar__group">
        <div class="sidebar__group-label">${s.gCommon}</div>
${common}
      </div>
    </aside>`;
}

function pageHtml({ lang, section, slug, title, route, crumb, body, prev, next }) {
  const s = STR[lang];
  const pager = `        <nav class="pager">
          ${prev ? `<a class="pager__prev" href="${prev.href}"><span>${s.prev}</span><strong>${prev.label}</strong></a>` : '<span></span>'}
          ${next ? `<a class="pager__next" href="${next.href}"><span>${s.next}</span><strong>${next.label}</strong></a>` : '<span></span>'}
        </nav>`;
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — Amoeba Car Manager v2</title>
  <link rel="stylesheet" href="../../assets/css/main.css">
  <link rel="stylesheet" href="../../assets/css/print.css" media="print">
</head>
<body>
  <div class="layout">
    <header class="header">
      <a href="../index.html" class="header__brand" title="Amoeba Car Manager v2" aria-label="Amoeba Car Manager v2">
        <span class="header__brand-mark">A</span>
        <span class="header__brand-desktop">Amoeba Car Manager v2 <span class="header__brand-sub">· ${lang === 'ko' ? '가이드' : 'Hướng dẫn'}</span></span><span class="header__brand-mobile">${lang === 'ko' ? '가이드' : 'Hướng dẫn'}</span>
      </a>
      <div class="header__tools">
        <div class="search">
          <input id="guide-search-input" class="search__input" type="search" placeholder="${s.searchPh}" aria-label="${lang === 'ko' ? '검색' : 'Tìm kiếm'}">
          <div id="guide-search-results" class="search__results"></div>
        </div>
        ${langSwitch()}
      </div>
    </header>

${sidebar(lang, section, slug)}

    <main class="main">
      <article class="content">
        <div class="breadcrumb"><a href="../index.html">${s.home}</a> · ${crumb}</div>
        <h1>${title}</h1>
        <!-- APP_LINK_CTA -->
        <p class="app-link-cta-row">
          <a class="app-link-cta" href="${route}" target="_parent" rel="noopener">
            <span>${s.openInApp}</span>
            <span class="app-link-cta__route">${route}</span>
            <span aria-hidden="true">→</span>
          </a>
        </p>

${body}

${pager}
      </article>
      <footer class="footer">${s.updatedLbl} ${UPDATED} · ${s.feedback}: <a href="mailto:dev@amoeba.group">dev@amoeba.group</a></footer>
    </main>
  </div>
  <script src="../../assets/js/sidebar.js"></script>
  <script src="../../assets/js/lang-switch.js"></script>
  <script src="../../assets/js/lightbox.js"></script>
  <script src="../../assets/js/search.js"></script>
  <script src="../../assets/js/app-link.js"></script>
</body>
</html>
`;
}

// helper builders for body html
const fig = (section, file, cap) =>
  `        <figure><img src="../../assets/img/screenshots/{LANG}/${section}/${file}.png" alt="${cap}"><figcaption>${cap}</figcaption></figure>`;
const intro = (rows) =>
  `        <div class="intro"><dl class="intro__row">${rows.map(([dt, dd]) => `<dt>${dt}</dt><dd>${dd}</dd>`).join('')}</dl></div>`;

// ─────────────────────────────────────────────────────────────────────────
// PAGE CONTENT.  {LANG} in figure src is replaced per language at build time.
// ─────────────────────────────────────────────────────────────────────────
const PAGES = [];  // filled by ./build-truck-guide.content.mjs
import { CONTENT } from './build-truck-guide.content.mjs';
PAGES.push(...CONTENT({ fig, intro }));

// ─── generate ────────────────────────────────────────────────────────────
function bySection(section) { return PAGES.filter((p) => p.section === section); }

let count = 0;
for (const p of PAGES) {
  const sectionPages = bySection(p.section);
  const idx = sectionPages.indexOf(p);
  for (const lang of ['vi', 'ko']) {
    const d = p[lang];
    if (!d) continue;
    // prev / next within section
    const prevP = sectionPages[idx - 1];
    const nextP = sectionPages[idx + 1];
    const prev = prevP
      ? { href: `${prevP.slug}.html`, label: prevP[lang]?.navTitle ?? prevP[lang]?.title ?? '' }
      : { href: '../index.html', label: STR[lang].rolePick };
    const next = nextP ? { href: `${nextP.slug}.html`, label: nextP[lang]?.navTitle ?? nextP[lang]?.title ?? '' } : null;
    const body = d.body.replace(/\{LANG\}/g, lang);
    const html = pageHtml({
      lang, section: p.section, slug: p.slug, title: d.title, route: p.route,
      crumb: d.crumb, body, prev, next,
    });
    const dir = resolve(GUIDE, lang, p.section);
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, `${p.slug}.html`), html, 'utf8');
    count++;
  }
}
console.log(`✓ generated ${count} truck guide pages`);

// ─── patch per-language role pickers (add 2 truck role cards, once) ────────
for (const lang of ['vi', 'ko']) {
  const idxPath = resolve(GUIDE, lang, 'index.html');
  if (!existsSync(idxPath)) continue;
  let html = readFileSync(idxPath, 'utf8');
  if (html.includes('truck-manager/00-tong-quan.html')) continue; // idempotent
  const cards = lang === 'vi'
    ? `\n      <a class="role-card" href="truck-manager/00-tong-quan.html">\n        <div class="role-card__icon">🚚</div>\n        <h2>Xe tải · Quản lý</h2>\n        <p>Nhật ký chuyến hàng, đội xe theo khu vực, chi phí – lợi nhuận và báo cáo tháng. Dùng trên máy tính.</p>\n      </a>\n\n      <a class="role-card" href="truck-driver/00-tong-quan.html">\n        <div class="role-card__icon">🚛</div>\n        <h2>Xe tải · Tài xế</h2>\n        <p>Xem chuyến cần hoàn thành, ghi số liệu nhiên liệu – cầu đường – doanh thu khi kết thúc chuyến. Dùng trên điện thoại (PWA).</p>\n      </a>\n`
    : `\n      <a class="role-card" href="truck-manager/00-tong-quan.html">\n        <div class="role-card__icon">🚚</div>\n        <h2>트럭 · 관리자</h2>\n        <p>화물 운행 일지, 지역별 차량, 비용·손익 및 월간 보고서. PC에서 사용합니다.</p>\n      </a>\n\n      <a class="role-card" href="truck-driver/00-tong-quan.html">\n        <div class="role-card__icon">🚛</div>\n        <h2>트럭 · 기사</h2>\n        <p>완료할 운행을 확인하고 운행 종료 시 연료·통행료·매출을 기록합니다. 휴대폰(PWA)에서 사용합니다.</p>\n      </a>\n`;
  // insert before the closing </div> of .landing__roles
  html = html.replace(/(\s*)<\/div>(\s*<div style="margin-top:48px">)/, `${cards}$1</div>$2`);
  writeFileSync(idxPath, html, 'utf8');
  console.log(`  ✓ patched ${lang}/index.html role picker`);
}

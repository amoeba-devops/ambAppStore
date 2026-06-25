#!/usr/bin/env node
/**
 * translate-ko-headings.mjs — second-pass translator that operates on the
 * skeleton output (ko/* with KO chrome, VI body). Replaces a curated dictionary
 * of page titles, h1/h2/h3 headings, common p/li/td snippets, and adds a
 * "translation in progress" banner above the article so users know they may
 * encounter mixed VI/KO content on pages not yet fully localized.
 *
 * Pages already manually translated (full KO content) are detected by the
 * marker `<!-- ko-full-translation -->` in <head>; the script skips them.
 *
 * Run AFTER generate-ko-skeleton.mjs.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KO_ROOT = resolve(__dirname, '..', 'apps/web/public/docs/user-guide/ko');

// Per-page title dictionary (filename → KO title)
const TITLES = {
  'common/02-dieu-huong.html':   { h1: '앱 화면 탐색',         title: '화면 탐색' },
  'common/03-ngon-ngu.html':     { h1: '표시 언어 변경',       title: '언어 변경' },
  'common/04-thong-bao.html':    { h1: '알림함',              title: '알림함' },
  'common/99-thuat-ngu.html':    { h1: '용어집',              title: '용어집' },

  'driver/00-tong-quan.html':    { h1: '기사 — 개요',                title: '기사 개요' },
  'driver/01-cai-pwa.html':      { h1: '모바일에 PWA 설치',           title: 'PWA 설치' },
  'driver/02-today-screen.html': { h1: '"오늘" 화면',                title: '오늘 화면' },
  'driver/03-xac-nhan-chuyen.html':         { h1: '새 운행 확인 / 거절', title: '운행 확인' },
  'driver/04-bat-dau-ket-thuc-chuyen.html': { h1: '운행 시작 및 종료',  title: '운행 시작/종료' },
  'driver/05-ghi-chi-phi.html':  { h1: '발생 비용 기록',              title: '비용 기록' },
  'driver/06-canh-bao-bao-duong.html':       { h1: '정비 알림 읽기',    title: '정비 알림' },
  'driver/07-ngoai-tuyen.html':  { h1: '네트워크가 약할 때',           title: '오프라인 동작' },

  'manager/00-tong-quan.html':   { h1: '매니저 / 디렉터 — 개요',       title: '매니저 개요' },
  'manager/01-dashboard.html':   { h1: '대시보드 — 차량팀 현황',        title: '대시보드' },
  'manager/02-dat-xe.html':      { h1: '차량 예약 — 새 운행 만들기',    title: '차량 예약' },
  'manager/03-theo-doi-chuyen-di.html': { h1: '운행 추적',             title: '운행 추적' },
  'manager/04-ghi-chi-phi.html': { h1: '발생 비용 기록',                title: '비용 기록' },
  'manager/05-so-chi-phi.html':  { h1: '비용 장부 (Costs Ledger)',     title: '비용 장부' },
  'manager/06-bao-cao-ca-nhan.html': { h1: '개인 보고서',              title: '개인 보고서' },

  'admin/00-tong-quan.html':     { h1: '관리자 — 개요',                title: '관리자 개요' },
  'admin/01-dashboard.html':     { h1: '대시보드 — 전사 현황',          title: '대시보드' },
  'admin/02-quan-ly-xe.html':    { h1: '차량 관리 (Vehicles)',         title: '차량 관리' },
  'admin/03-quan-ly-tai-xe.html':{ h1: '기사 관리 (Drivers)',          title: '기사 관리' },
  'admin/04-quan-ly-nguoi-dung.html': { h1: '사용자 관리',              title: '사용자' },
  'admin/05-quan-ly-chuyen-di.html':  { h1: '운행 관리 (Trips)',       title: '운행' },
  'admin/06-quan-ly-chi-phi.html': { h1: '전사 비용 관리',              title: '비용 관리' },
  'admin/07-canh-bao-bao-duong.html': { h1: '정비 알림 (Maintenance Alerts)', title: '정비 알림' },
  'admin/08-bao-cao.html':       { h1: '보고서 & 분석',                title: '보고서' },
  'admin/09-cau-hinh-he-thong.html': { h1: '시스템 설정 (Settings)',   title: '시스템 설정' },
  'admin/10-audit-log.html':     { h1: '감사 로그 (Audit Log)',        title: '감사 로그' },
};

// Pager target labels (strong tags) — derive from titles above
function strongLabel(file) {
  const t = TITLES[file.replace(/\\/g, '/')];
  return t ? t.title : null;
}

const TRANSLATION_BANNER = `<div class="callout callout--info" style="margin-bottom:24px">
          <div class="callout__icon">🌐</div>
          <div class="callout__body">
            <p><strong>한국어 번역 진행 중</strong> — 이 페이지의 본문 일부는 아직 베트남어입니다.
            제목·사이드바·이미지는 한국어로 제공되며, 본문 번역은 점진적으로 업데이트됩니다.
            급한 경우 <a href="../../vi/${'$'}{currentSection}/${'$'}{currentSlug}">베트남어 원문</a>을 참고하세요.</p>
          </div>
        </div>
        `;

// Common in-body translations applied to ALL pages (broader dictionary).
// Order matters: longer phrases first to avoid partial matches.
const PHRASES = [
  // Frequent VN business terms → KO
  ['chuyến đi', '운행'],
  ['chuyến', '운행'],
  ['tài xế', '기사'],
  ['phương tiện', '차량'],
  ['biển số', '번호판'],
  ['hành khách', '승객'],
  ['mục đích', '목적'],
  ['ghi chú', '메모'],
  ['điểm đón', '출발지'],
  ['điểm đến', '도착지'],
  ['điểm ghé', '경유지'],
  ['thời gian khởi hành', '출발 시각'],
  ['khởi hành', '출발'],
  ['số km', '주행거리'],
  ['odometer', '주행거리계'],
  ['chu kỳ thay dầu', '엔진오일 교환 주기'],
  ['thay dầu', '오일 교환'],
  ['đăng kiểm', '정기검사'],
  ['cảnh báo', '알림'],
  ['phê duyệt', '승인'],
  ['hủy chuyến', '운행 취소'],
  ['hủy', '취소'],
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

let updated = 0;
let skipped = 0;

for (const file of walk(KO_ROOT)) {
  const rel = file.slice(KO_ROOT.length + 1).replace(/\\/g, '/');
  let html = readFileSync(file, 'utf8');

  // Skip fully-translated pages.
  if (html.includes('<!-- ko-full-translation -->')) {
    skipped++;
    continue;
  }
  // Skip the ko/index landing — already manually written.
  if (rel === 'index.html') {
    skipped++;
    continue;
  }

  const titleEntry = TITLES[rel];
  if (!titleEntry) {
    skipped++;
    continue;
  }

  // Replace <title>... — Amoeba Car Manager v2</title>
  html = html.replace(
    /<title>[^<]+— Amoeba Car Manager v2<\/title>/,
    `<title>${titleEntry.title} — Amoeba Car Manager v2</title>`,
  );

  // Replace <h1> content (first h1).
  html = html.replace(/<h1>[^<]+<\/h1>/, `<h1>${titleEntry.h1}</h1>`);

  // Apply phrase dictionary BUT only inside <article class="content"> body —
  // skip the chrome (sidebar etc) which already has its own translations.
  const articleStart = html.indexOf('<article class="content">');
  const articleEnd = html.indexOf('</article>', articleStart);
  if (articleStart >= 0 && articleEnd > articleStart) {
    let body = html.slice(articleStart, articleEnd);
    for (const [from, to] of PHRASES) {
      // Case-insensitive substring replacement.
      const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      body = body.replace(re, to);
    }
    html = html.slice(0, articleStart) + body + html.slice(articleEnd);
  }

  // Insert translation-progress banner right after <h1> (only once).
  if (!html.includes('한국어 번역 진행 중')) {
    const section = rel.split('/')[0];
    const slug = rel.split('/')[1];
    const banner = TRANSLATION_BANNER
      .replace('${currentSection}', section)
      .replace('${currentSlug}', slug);
    html = html.replace(/(<h1>[^<]+<\/h1>\n)/, `$1\n        ${banner}\n`);
  }

  // Update pager <strong> labels using titles map.
  // Find all `href="XXX.html"` next to `<strong>YYY</strong>` and rewrite YYY.
  const pagerRe = /(href="([^"]+\.html)"[^>]*>\s*<span>[^<]+<\/span>\s*<strong>)([^<]+)(<\/strong>)/g;
  html = html.replace(pagerRe, (m, prefix, hrefPath, label, suffix) => {
    // Resolve the target file's relative path relative to KO root
    const baseSection = rel.split('/')[0];
    let targetRel;
    if (hrefPath.startsWith('../')) {
      // ../driver/00-tong-quan.html → driver/00-tong-quan.html
      targetRel = hrefPath.replace(/^\.\.\//, '');
    } else if (hrefPath === '../index.html') {
      return m; // keep "홈" label (already translated by skeleton chrome)
    } else {
      targetRel = `${baseSection}/${hrefPath}`;
    }
    const targetTitle = TITLES[targetRel];
    if (targetTitle) {
      return prefix + targetTitle.title + suffix;
    }
    return m;
  });

  writeFileSync(file, html, 'utf8');
  updated++;
}

console.log(`✓ Translated headings/titles/phrases in ${updated} files (${skipped} skipped — full-translation or landing)`);

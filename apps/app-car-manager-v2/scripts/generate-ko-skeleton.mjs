#!/usr/bin/env node
/**
 * generate-ko-skeleton.mjs — copy every VI page to KO with the page chrome
 * (sidebar, header, breadcrumbs, footer, lang switch, page title, pager nav,
 * intro card labels, callout icons) translated to Korean. Body content is left
 * in Vietnamese — the calling translator (a human or Claude) writes Korean
 * paragraphs on top.
 *
 * Idempotent — overwrites ko/* every run. Source of truth = vi/*.
 *
 * Run AFTER the vi/* tree has the final HTML structure.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GUIDE_ROOT = resolve(__dirname, '..', 'apps/web/public/docs/user-guide');
const VI_ROOT = resolve(GUIDE_ROOT, 'vi');
const KO_ROOT = resolve(GUIDE_ROOT, 'ko');

// Chrome translations — applied to text outside the article body to translate
// sidebar labels, headers, etc.  Whole-string + word replacements.
const CHROME = {
  // <html lang="vi"> → <html lang="ko">
  '<html lang="vi">': '<html lang="ko">',

  // Branding line "Amoeba Car Manager v2 · Hướng dẫn"
  '· Hướng dẫn': '· 사용 안내서',

  // Lang switch active state — flip from vi-active to ko-active
  '<a href="#" class="is-active" data-lang="vi">VI</a>\n        <a href="#" data-lang="ko">KO</a>':
    '<a href="#" data-lang="vi">VI</a>\n        <a href="#" class="is-active" data-lang="ko">KO</a>',

  // Search placeholder
  'placeholder="Tìm trong hướng dẫn… (/)"': 'placeholder="안내서 검색… (/)"',
  'aria-label="Tìm kiếm"': 'aria-label="검색"',

  // Sidebar group labels
  '<div class="sidebar__group-label">Chung</div>': '<div class="sidebar__group-label">공통</div>',
  '<div class="sidebar__group-label">Quản trị viên</div>': '<div class="sidebar__group-label">관리자</div>',
  '<div class="sidebar__group-label">Quản lý</div>': '<div class="sidebar__group-label">매니저</div>',
  '<div class="sidebar__group-label">Tài xế</div>': '<div class="sidebar__group-label">기사</div>',

  // Sidebar items — common
  '">Giới thiệu</a>': '">소개</a>',
  '">Đăng nhập</a>': '">로그인</a>',
  '">Điều hướng</a>': '">화면 탐색</a>',
  '">Đổi ngôn ngữ</a>': '">언어 변경</a>',
  '">Thông báo</a>': '">알림함</a>',
  '">Thuật ngữ</a>': '">용어집</a>',

  // Sidebar items — admin
  '">Tổng quan</a>': '">개요</a>',
  '">Dashboard</a>': '">대시보드</a>',
  '">Quản lý xe</a>': '">차량 관리</a>',
  '">Quản lý tài xế</a>': '">기사 관리</a>',
  '">Người dùng</a>': '">사용자</a>',
  '">Chuyến đi</a>': '">운행</a>',
  '">Phê duyệt chi phí</a>': '">비용 관리</a>',
  '">Quản lý chi phí</a>': '">비용 관리</a>',
  '">Cảnh báo bảo dưỡng</a>': '">정비 알림</a>',
  '">Báo cáo</a>': '">보고서</a>',
  '">Cấu hình hệ thống</a>': '">시스템 설정</a>',
  '">Audit log</a>': '">감사 로그</a>',

  // Sidebar items — manager
  '">Đặt xe</a>': '">차량 예약</a>',
  '">Theo dõi chuyến đi</a>': '">운행 추적</a>',
  '">Ghi chi phí</a>': '">비용 기록</a>',
  '">Phê duyệt phân cấp</a>': '">비용 장부</a>',
  '">Sổ chi phí</a>': '">비용 장부</a>',
  '">Báo cáo cá nhân</a>': '">개인 보고서</a>',

  // Sidebar items — driver
  '">Cài đặt PWA</a>': '">PWA 설치</a>',
  '">Màn hình Hôm nay</a>': '">오늘 화면</a>',
  '">Xác nhận chuyến</a>': '">운행 확인</a>',
  '">Bắt đầu / kết thúc chuyến</a>': '">운행 시작/종료</a>',
  '">Hành vi ngoại tuyến</a>': '">오프라인 동작</a>',

  // Breadcrumb labels (separated, partial matches in <div class="breadcrumb">)
  '>Trang chủ</a>': '>홈</a>',
  '· Chung ·': '· 공통 ·',
  '· Quản trị viên ·': '· 관리자 ·',
  '· Quản lý ·': '· 매니저 ·',
  '· Tài xế ·': '· 기사 ·',

  // Pager labels
  '<span>← Trước</span>': '<span>← 이전</span>',
  '<span>Tiếp theo →</span>': '<span>다음 →</span>',
  '<span>← Trang chủ</span>': '<span>← 홈</span>',
  '<span>Hoàn tất →</span>': '<span>완료 →</span>',
  '<strong>Quay về trang chủ</strong>': '<strong>홈으로 돌아가기</strong>',
  '<strong>Hướng dẫn Quản trị viên</strong>': '<strong>관리자 가이드</strong>',
  '<strong>Hướng dẫn Quản lý</strong>': '<strong>매니저 가이드</strong>',

  // Intro card labels
  '<dt>Đối tượng</dt>': '<dt>대상</dt>',
  '<dt>Thời gian đọc</dt>': '<dt>읽는 시간</dt>',
  '<dt>Thời gian</dt>': '<dt>소요 시간</dt>',
  '<dt>Điều kiện trước</dt>': '<dt>사전 조건</dt>',
  '<dt>Phiên bản</dt>': '<dt>버전</dt>',
  '<dt>Phạm vi</dt>': '<dt>범위</dt>',
  '<dt>URL</dt>': '<dt>URL</dt>',
  '<dt>Quyền</dt>': '<dt>권한</dt>',
  '<dt>Khi nào</dt>': '<dt>시기</dt>',
  '<dt>Thời hạn</dt>': '<dt>기한</dt>',
  '<dt>Cần</dt>': '<dt>준비물</dt>',
  '<dt>Phê duyệt</dt>': '<dt>승인</dt>',
  '<dt>Trước đó</dt>': '<dt>사전 단계</dt>',
  '<dt>Mức độ</dt>': '<dt>난이도</dt>',
  '<dt>Đặc tính</dt>': '<dt>특성</dt>',
  '<dt>Đặc quyền Admin</dt>': '<dt>관리자 권한</dt>',
  '<dt>Trang liên quan</dt>': '<dt>관련 페이지</dt>',
  '<dt>Hậu quả</dt>': '<dt>결과</dt>',
  '<dt>Lợi ích</dt>': '<dt>장점</dt>',
  '<dt>Thiết bị</dt>': '<dt>기기</dt>',
  '<dt>Bắt buộc</dt>': '<dt>필수</dt>',
  '<dt>Tùy chọn</dt>': '<dt>선택</dt>',
  '<dt>Auto-save</dt>': '<dt>자동 저장</dt>',
  '<dt>Soft delete</dt>': '<dt>소프트 삭제</dt>',
  '<dt>Bằng lái</dt>': '<dt>운전면허</dt>',
  '<dt>Trigger</dt>': '<dt>트리거</dt>',
  '<dt>Xuất hiện ở</dt>': '<dt>표시 위치</dt>',
  '<dt>Trách nhiệm xử lý</dt>': '<dt>처리 책임</dt>',
  '<dt>Tự động ghi nhận</dt>': '<dt>자동 기록</dt>',
  '<dt>Mục đích</dt>': '<dt>목적</dt>',
  '<dt>Cách tạo</dt>': '<dt>생성 방법</dt>',
  '<dt>Cập nhật</dt>': '<dt>업데이트</dt>',
  '<dt>Quan trọng</dt>': '<dt>중요</dt>',

  // Footer line
  '· Phản hồi: ': '· 피드백: ',
  'Cập nhật 24-05-2026': '최종 업데이트 2026-05-24',
};

// Image src translation: vi/.../foo.png → ko/.../foo.png (so KO pages
// reference KO screenshots).
function rewriteImageSrc(html) {
  return html.replace(
    /src="(\.\.\/\.\.\/assets\/img\/screenshots\/)vi(\/[^"]+)"/g,
    'src="$1ko$2"',
  );
}

function applyChrome(html) {
  let out = html;
  for (const [from, to] of Object.entries(CHROME)) {
    // Whole-string replacement with all occurrences.
    out = out.split(from).join(to);
  }
  return out;
}

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

const viFiles = walk(VI_ROOT);
let count = 0;
for (const viFile of viFiles) {
  const rel = viFile.slice(VI_ROOT.length);
  const koFile = resolve(KO_ROOT, '.' + rel);
  const html = readFileSync(viFile, 'utf8');
  const transformed = rewriteImageSrc(applyChrome(html));
  mkdirSync(dirname(koFile), { recursive: true });
  writeFileSync(koFile, transformed, 'utf8');
  count++;
}

console.log(`✓ Generated ${count} KO skeleton pages → ko/`);
console.log('  Body content still in VI — translate manually per page.');

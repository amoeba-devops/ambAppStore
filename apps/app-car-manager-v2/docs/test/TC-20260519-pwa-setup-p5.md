# TC-20260519 — P5 Mobile PWA Setup 테스트케이스

> 작성일: 2026-05-19 · 작성자: dev@amoeba.group + Claude Code
> 선행 문서: [REQ-20260519-pwa-setup-p5.md](../analysis/REQ-20260519-pwa-setup-p5.md) · [PLAN-20260519-pwa-setup-p5.md](../plan/PLAN-20260519-pwa-setup-p5.md)
> 후속 문서 (예정): `docs/test/TR-20260519-pwa-setup-p5.md`

---

## 1. 테스트 환경

| 환경 | URL | 비고 |
|---|---|---|
| Local dev | http://localhost:3001 | `NEXT_PUBLIC_ENABLE_SW=true` 로 SW 활성화 |
| Render | https://car-manager-v2.onrender.com (예시) | basePath empty |
| Staging Docker | https://stg-apps.amoeba.site/app-car-manager-v2 | basePath `/app-car-manager-v2` |
| AMA iframe (staging) | https://stg-ama.amoeba.site → app embed | iframe 동작 검증 |

### 1.1 테스트 디바이스 매트릭스

| 디바이스 | OS | 브라우저 | 비고 |
|---|---|---|---|
| 데스크톱 | Windows / macOS | Chrome 최신, Edge 최신 | install + standalone |
| Android | Android 12+ | Chrome | 메인 driver 타깃 |
| iPhone | iOS 16.4+ | Safari | "홈 화면에 추가" |
| iPhone (구버전) | iOS 15.x | Safari | 점진적 노출 fallback |
| Firefox | Desktop | Firefox 최신 | SW 동작, install 없음 |

---

## 2. 테스트 케이스

### TC-001: Manifest 정적 검증

**목적**: `/manifest.webmanifest` 가 인증 없이 200 + 유효 JSON 응답.

**Steps**:
1. 브라우저에서 `https://stg-apps.amoeba.site/app-car-manager-v2/manifest.webmanifest` 직접 방문 (인증 cookie 없는 시크릿 창)
2. Response 확인

**Expected**:
- HTTP 200
- `Content-Type: application/manifest+json`
- JSON body 에 `name`, `short_name`, `start_url`, `scope`, `display: standalone`, `icons` (3개 entries), `theme_color`, `background_color` 모두 존재
- `start_url`, `scope` 가 `/app-car-manager-v2/` (staging) 또는 `/` (local/render)
- 각 icon `src` 가 환경 prefix 포함

**Pass criteria**: 위 모두 충족

---

### TC-002: Service Worker 등록 (production-like)

**Steps**:
1. Chrome desktop 으로 staging URL 접속, 로그인
2. DevTools → Application → Service Workers
3. 등록 상태 확인

**Expected**:
- Status: "activated and is running"
- Source: `/app-car-manager-v2/sw.js`
- Scope: `/app-car-manager-v2/`
- `Service-Worker-Allowed` 응답 헤더 `/` 또는 `/app-car-manager-v2/`

---

### TC-003: SW 등록 — Dev 모드 비활성화

**Steps**:
1. `cd apps/web && npm run dev` (NEXT_PUBLIC_ENABLE_SW 미설정)
2. http://localhost:3001 접속
3. DevTools → Application → Service Workers 확인

**Expected**:
- "No service workers detected"
- console 에 register 시도 흔적 없음

---

### TC-004: SW 등록 — Dev 모드 명시적 활성화

**Steps**:
1. `.env` 에 `NEXT_PUBLIC_ENABLE_SW=true` 추가
2. `npm run dev`
3. http://localhost:3001 접속, 로그인
4. DevTools → Application → Service Workers 확인

**Expected**:
- "activated and is running"
- Source `/sw.js`, Scope `/`

---

### TC-005: SW 등록 — iframe 환경에서 skip

**Steps**:
1. AMA staging (https://stg-ama.amoeba.site) 로그인
2. car-manager-v2 앱 아이콘 클릭 → iframe 안에서 앱 로드
3. iframe 내부 DevTools (or top-level DevTools 의 frame 선택) → Service Workers 확인
4. console 메시지 확인

**Expected**:
- iframe context 에서 SW register **호출 안 됨**
- console 에 `[PWA] Skipped SW register (in iframe)` 또는 silent
- top-level navigation (직접 URL 접속) 시에는 등록됨 (TC-002 와 별도)

---

### TC-006: PWA Install Prompt — Android Chrome

**Steps**:
1. Android Chrome 으로 staging top-level URL 접속 (iframe 아님)
2. 로그인 완료
3. 30초 대기 (Chrome engagement heuristic) 또는 페이지 이동 1-2회
4. 하단 install banner 노출 확인
5. "설치" 버튼 탭
6. 네이티브 install dialog → "설치" 확인
7. 홈 화면에서 Fleet 아이콘 확인 → 탭

**Expected**:
- 4: `<InstallPrompt>` banner 표시, "Cài đặt Fleet" 텍스트 (locale=vi)
- 6: Chrome 네이티브 dialog 등장, 앱 정보 (이름, icon) 표시
- 7: 홈 화면 아이콘 192px → 탭 시 **standalone 모드** (URL bar 없음) 로 앱 실행
- App 실행 위치: dashboard `/` (start_url)

---

### TC-007: PWA Install Prompt — Android Dismiss

**Steps**:
1. TC-006 1-4 와 동일
2. "나중에" 버튼 탭

**Expected**:
- banner 사라짐
- localStorage `pwa.installDismissed` = ISO 날짜 + 7일 만료 시각
- 페이지 새로고침 → banner 재노출 안 됨 (7일간)

---

### TC-008: PWA Install Prompt — iOS Safari

**Steps**:
1. iPhone (iOS 16.4+) Safari 로 staging top-level URL 접속
2. 로그인
3. install prompt banner 노출 확인
4. banner 탭 → "iPhone 설치 안내" modal 등장
5. modal 안내대로 Share → "홈 화면에 추가"
6. 홈 화면 아이콘 탭

**Expected**:
- 3: banner 노출, "iPhone 설치 안내" 텍스트
- 4: modal 에 1. Share 버튼 탭 2. "홈 화면에 추가" 단계 + 스크린샷/아이콘
- 6: standalone 모드 (status bar 만, Safari UI 없음)
- App icon: 180px (`apple-touch-icon-180.png`)

---

### TC-009: PWA Install Prompt — iframe 안에서 미노출

**Steps**:
1. AMA staging 로그인
2. car-manager-v2 앱 iframe 진입
3. 30초+ 대기, 페이지 이동
4. install banner 노출 여부 확인

**Expected**:
- banner **노출 안 됨** (iframe 감지로 hide)
- console 에 `beforeinstallprompt` 캡처 안 됨 또는 무시됨

---

### TC-010: Offline Fallback

**Steps**:
1. PWA install 후 standalone 모드로 실행 (또는 desktop Chrome 일반)
2. DevTools → Network → "Offline" 체크 또는 디바이스 비행기 모드
3. Nav 아이템 (Trips, Vehicles 등) 탭

**Expected**:
- SW 가 navigation fetch 실패 감지 → cached `/offline.html` 반환
- 화면: "Mất kết nối mạng" + "Thử lại" 버튼
- "Thử lại" 탭 → `location.reload()` → 네트워크 끊겨있으면 다시 offline page

---

### TC-011: Offline Fallback — 네트워크 복구

**Steps**:
1. TC-010 상태에서 네트워크 ON
2. "Thử lại" 버튼 탭

**Expected**:
- 정상 페이지 로드
- SW fetch handler 가 network 요청 성공 → cached `/offline.html` 미사용

---

### TC-012: Static Assets Cache (cache-first)

**Steps**:
1. PWA 최초 방문 → DevTools → Application → Cache Storage 확인
2. `/_next/static/*` 자산이 caching 되었는지 확인
3. 네트워크 끊기 + 페이지 새로고침

**Expected**:
- 캐시 이름: `fleet-v1`
- `/_next/static/chunks/*`, `/_next/static/css/*` 등 cached
- 오프라인 새로고침 시 정적 자산은 cache 에서 즉시 응답
- HTML 만 offline.html 로 폴백

---

### TC-013: API No-Cache

**Steps**:
1. PWA standalone, DevTools → Network
2. Trip List 페이지 진입
3. `/api/v1/trips/check-conflicts` 등 API 호출 확인

**Expected**:
- API 응답은 SW cache 에 저장되지 **않음** (network-only)
- 두 번째 호출도 network 요청 발생 (cache hit 없음)

---

### TC-014: Trip Conflict 링크 — PWA 내부 탐색 (회귀 fix)

**Steps**:
1. Admin 으로 PWA standalone 실행, 로그인
2. "새 트립 만들기" 페이지로 이동
3. 폼 작성, 기존 트립과 시간 겹치게 입력 → conflict banner 표시
4. conflict 트립 링크 (예: TRIP-0042) 탭

**Expected (수정 후)**:
- **같은 PWA standalone session 안에서** `/trips/TRIP-0042` 페이지로 이동
- 외부 브라우저 (Chrome / Safari) 로 튕기지 **않음**
- URL bar 노출 없이 standalone 모드 유지
- 뒤로가기 → trip 폼 페이지 (state 휘발은 알려진 한계 — Open Q7)

---

### TC-015: Google Maps Fullscreen 링크 — 외부 브라우저 + toast hint

**Steps**:
1. PWA standalone 실행, Trip Detail 페이지 진입
2. Map fullscreen 링크 ("Mở rộng" / "Open in Maps") 탭

**Expected**:
- sonner toast: "Mở trong trình duyệt" (또는 EN/KO 대응) 1-2초 노출
- 외부 OS 기본 브라우저 (Chrome / Safari) 로 maps.google.com 열림
- (옵션) OS task switcher 로 PWA 복귀 가능

**검증**:
- a tag rel: `noopener noreferrer` (DOM inspect)
- 새 window context 가 opener 접근 불가 (보안)

---

### TC-016: Google Maps 링크 — Browser 모드 (toast 미노출)

**Steps**:
1. PWA install 안 한 desktop Chrome 일반 탭에서 동일 페이지 진입
2. Map fullscreen 링크 탭

**Expected**:
- toast 미노출 (이미 browser tab 이므로 hint 불필요)
- 새 탭에서 maps.google.com 열림

---

### TC-017: Middleware PUBLIC_PATHS — 미인증 manifest 접근

**Steps**:
1. 시크릿 창 (cookie 없음) 에서 staging `/app-car-manager-v2/manifest.webmanifest` 직접 GET
2. 동일하게 `/app-car-manager-v2/sw.js`, `/app-car-manager-v2/icons/icon-192.png`, `/app-car-manager-v2/offline.html`

**Expected**:
- 모두 HTTP 200 응답
- `/session-expired` 로 **redirect 안 됨**

---

### TC-018: Lighthouse PWA Audit

**Steps**:
1. Render production-like URL 또는 staging URL
2. Chrome DevTools → Lighthouse → "Progressive Web App" 카테고리만 선택 → "Mobile" mode → Analyze

**Expected**:
- PWA 점수 ≥ 90
- "Installable" ✅
- "PWA Optimized" ✅
- Best Practices, Performance, Accessibility 별도 항목은 본 작업 대상 외 (P6 hardening)

---

### TC-019: SW 업데이트 — 새 배포 후 자동 pickup

**Steps**:
1. SW 등록된 상태 (TC-002 완료)
2. sw.js 파일 변경 (예: cache version `fleet-v1` → `fleet-v2`) 후 배포
3. 페이지 새로고침 후 새로고침 (두 번) — Chrome SW lifecycle: 새 SW install → waiting → activate (다음 navigation 에서)

**Expected**:
- DevTools → Application → Service Workers 에 "waiting to activate" 새 SW 표시
- 두 번째 새로고침 후 새 SW activated
- 활성화 후 old cache (`fleet-v1`) 삭제됨, 새 cache (`fleet-v2`) 생성됨
- `Cache-Control: no-cache` 헤더 덕에 sw.js 가 매 요청마다 새로 fetch

---

### TC-020: BASE_PATH prefix — staging Docker

**Steps**:
1. Staging Docker 환경 (basePath `/app-car-manager-v2`)
2. 다음 URL 들 직접 GET (시크릿 창):
   - `https://stg-apps.amoeba.site/app-car-manager-v2/manifest.webmanifest`
   - `https://stg-apps.amoeba.site/app-car-manager-v2/sw.js`
   - `https://stg-apps.amoeba.site/app-car-manager-v2/icons/icon-192.png`
3. 로그인 후 SW register 동작 확인

**Expected**:
- 모두 200 OK
- manifest JSON 의 `start_url`, `scope` 가 `/app-car-manager-v2/`
- manifest icons 의 src 가 `/app-car-manager-v2/icons/...`
- SW scope `/app-car-manager-v2/`

---

### TC-021: i18n PWA strings — locale switching

**Steps**:
1. 설정 → 언어를 vi → en → ko 순차 변경
2. install prompt banner 의 텍스트 변경 확인 (각 locale 별)
3. offline page 의 텍스트 확인 (locale 별, navigator.language 기반)

**Expected**:
- install prompt: vi="Cài đặt Fleet", en="Install Fleet", ko="Fleet 설치"
- offline page: 3개 언어 모두 페이지 안에 표시되거나 navigator.language 로 적절히 표시

---

### TC-022: Safe-area (iOS notch / home indicator)

**Steps**:
1. iPhone (notch 폰: 11 이상) 에서 PWA standalone 실행
2. Trip list / Dashboard 등 페이지 확인
3. 상단 status bar 영역, 하단 home indicator 영역 확인

**Expected**:
- Status bar 영역에 contents 가려지지 않음 (top safe-area 적용)
- Home indicator 영역에 install prompt banner 가 가려지지 않음 (bottom safe-area)
- AppShell 의 mobile bottom area `pb-safe-bottom` 적용

---

### TC-023: 회귀 — 기존 페이지 동작 정상

**Steps**:
1. 모든 메인 페이지 순회 (PWA standalone 모드):
   - `/` Dashboard
   - `/trips` List
   - `/trips/[id]` Detail (Admin/Manager/Driver views)
   - `/trips/new`, `/trips/[id]/edit`
   - `/vehicles`, `/vehicles/[id]`, `/vehicles/new`
   - `/drivers`, `/drivers/[id]`, `/drivers/new`
   - `/users`, `/settings`, `/audit`, `/reports`, `/costs`, `/today`
2. 각 페이지에서:
   - 데이터 로드 정상
   - nav 사이드바 동작
   - 폼 제출 (해당되는 경우)
   - 로그아웃 → `/session-expired` 이동

**Expected**:
- 모든 페이지 정상 동작
- SW 가 navigation fetch 가로채기로 인한 latency 증가 없음 (≤ 100ms)
- 콘솔 에러 없음

---

### TC-024: 회귀 — AMA iframe passthrough

**Steps**:
1. AMA staging 로그인
2. car-manager-v2 앱 iframe 진입 → ama_token cookie 설정 → dashboard 표시
3. iframe 안에서 trip create, expense add 등 정상 동작 확인

**Expected**:
- iframe 안에서도 기존 기능 정상 (SW 미등록 영향 없음)
- install prompt 미노출 (TC-009)
- CSP `frame-ancestors` 유지 — 새 next.config 헤더 추가가 기존 CSP 깨뜨리지 않음

---

### TC-025: SW Rollback (긴급)

**시나리오**: SW 버그로 사용자 사이트 봉쇄 발생 가정.

**Steps**:
1. sw.js 의 fetch handler 를 빈 함수로 교체 + cache version bump → 배포
2. 봉쇄된 사용자 PWA 새로고침 1-2회

**Expected**:
- 새 SW 가 install + activate → old cache 삭제
- fetch handler 가 빈 함수 → 모든 요청이 browser 기본 처리 (정상 동작 복귀)
- 사용자 별다른 action 불필요

---

## 3. 우선순위

| Priority | Test cases |
|---|---|
| P0 (필수) | TC-001, TC-002, TC-006, TC-010, TC-014, TC-015, TC-017, TC-018 |
| P1 (중요) | TC-003, TC-004, TC-005, TC-008, TC-009, TC-012, TC-013, TC-019, TC-020, TC-023, TC-024 |
| P2 (권장) | TC-007, TC-011, TC-016, TC-021, TC-022, TC-025 |

---

## 4. 자동화 가능성

| TC | 자동화 도구 | 비고 |
|---|---|---|
| TC-001, TC-017, TC-020 | curl + jq | 정적 응답 검증, CI 통합 가능 |
| TC-002, TC-003, TC-004 | Playwright | `page.evaluate(() => navigator.serviceWorker.controller)` |
| TC-010, TC-011 | Playwright + `page.context().setOffline(true)` | navigation 가로채기 확인 |
| TC-012, TC-013 | Playwright + DevTools protocol | Cache Storage 검증 |
| TC-018 | Lighthouse CLI | `lhci autorun --collect.url=...` |
| TC-006, TC-008, TC-022 | 수동 (실제 디바이스) | install dialog, iOS Safari UI |

→ P6 Hardening 에서 Playwright suite 작성 시 위 자동화 가능 TC 들을 우선 포함.

---

## 5. 실패 대응

각 TC 실패 시:
1. TR 문서에 reproduce step + 스크린샷 기록
2. 원인 분류: 코드 버그 / 환경 설정 / 외부 의존성 (Render/nginx)
3. Fix 후 동일 TC 재실행
4. 회귀 영향 범위 (TC-023, TC-024) 재확인

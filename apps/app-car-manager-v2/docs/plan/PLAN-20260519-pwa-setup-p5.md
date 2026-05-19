# PLAN-20260519 — P5 Mobile PWA Setup 구현 계획

> 작성일: 2026-05-19 · 작성자: dev@amoeba.group + Claude Code
> 선행 문서: [REQ-20260519-pwa-setup-p5.md](../analysis/REQ-20260519-pwa-setup-p5.md)
> 후속 문서 (예정): `docs/test/TC-20260519-pwa-setup-p5.md` · `docs/implementation/RPT-20260519-pwa-setup-p5.md`

---

## 1. 시스템 개발 현황 분석

### 1.1 디렉토리 구조 (현재)

```
apps/app-car-manager-v2/apps/web/
├── public/                         ← 정적 자산 (.gitkeep 만 존재)
├── src/
│   ├── app/
│   │   ├── layout.tsx              ← root layout (수정)
│   │   ├── globals.css
│   │   ├── (app)/                  ← 인증된 페이지 그룹
│   │   │   ├── layout.tsx          ← AppShell mount (수정 후보)
│   │   │   ├── page.tsx            ← Dashboard
│   │   │   └── trips/, drivers/, vehicles/, ...
│   │   ├── dev-login/
│   │   ├── session-expired/
│   │   ├── not-found.tsx
│   │   └── error.tsx
│   ├── components/
│   │   ├── layout/                 ← AppShell, sidebar, page-header
│   │   ├── inputs/                 ← map-preview, map-route 등
│   │   └── (pwa/ 신규)
│   ├── middleware.ts               ← 수정 (PUBLIC_PATHS)
│   └── ...
├── messages/{vi,en,ko}.json        ← i18n (pwa namespace 추가)
├── tailwind.config.ts              ← safe-area utilities 추가
└── next.config.mjs                 ← headers 추가
```

### 1.2 기술 스택

- Next.js 15.1.3 App Router + RSC
- React 19
- TailwindCSS 3.4
- next-intl 3.26
- TypeScript strict
- 배포: Render (Web Service) + staging Docker (basePath 분기)

### 1.3 기존 코드 상황

- `target="_blank"` 사용 3곳: `map-preview.tsx`, `map-route.tsx`, `trip-conflict-banner.tsx`
- middleware PUBLIC_PATHS 5 entries (PWA 자산 미포함)
- next.config.mjs headers 1개 (CSP frame-ancestors)
- root layout metadata: title + description 만
- i18n 614 keys (per language)
- AppShell 은 [src/components/layout/app-shell.tsx](../../apps/web/src/components/layout/app-shell.tsx) — sidebar + main area (확인 완료)

### 1.4 제약사항

- **basePath 분기**: Local/Render 은 empty, Staging Docker 은 `/app-car-manager-v2`. manifest 와 SW register URL 모두 영향. Next.js Metadata API 가 자동 prefix 처리 가능 (manifest.ts 사용 시).
- **iframe 환경**: AMA 가 항상 iframe embed. install prompt + SW register 는 top-level 일 때만.
- **P4 충돌 방지**: P4 (Web Push) 가 sw.js 를 추가할 수 있음 — 현재 미존재 확인. 본 작업이 먼저 추가, P4 가 push handler 만 머지.
- **Neon HTTP driver / DB 영향**: 없음. DB 변경 0건.
- **i18n locale 우선순위**: cookie > URL > default. offline.html 은 SW 가 캐싱하므로 인라인 다국어 필요.

---

## 2. 단계별 구현 계획

> **6 phase 순차 실행**. 각 phase 종료 시 typecheck + lint + 영향 페이지 수동 확인 → commit.

### Phase P5.1 — Internal Navigation Fix (highest priority, quick win)

#### S5.1.1 `trip-conflict-banner.tsx` `target="_blank"` 제거
- 수정: [apps/web/src/app/(app)/trips/_components/trip-conflict-banner.tsx](../../apps/web/src/app/(app)/trips/_components/trip-conflict-banner.tsx#L66)
- Line 66: `target="_blank" rel="noreferrer"` → 제거
- 결과: 같은 탭에서 `/trips/[id]` 내부 라우팅
- └─ 사이드 임팩트: 사용자가 conflict 링크 탭 → 현재 폼 페이지 떠남. 폼 state 휘발. (별도 폼 가드 작업 필요. 본 작업 범위 외 — Open Q7 답: 폼 가드 분리)
- └─ 테스트: PWA standalone 에서 conflict 링크 탭 → 같은 standalone session 에서 trip detail 표시 확인

#### S5.1.2 Maps 외부 링크 — `rel` 강화 (deep link 본격 작업은 P5.6)
- 수정: [map-preview.tsx:91-101](../../apps/web/src/components/inputs/map-preview.tsx#L91-L101), [map-route.tsx:227-237](../../apps/web/src/components/inputs/map-route.tsx#L227-L237)
- `target="_blank"` 유지 (desktop 동작)
- `rel="noopener noreferrer"` 로 강화 (보안)
- aria-label 추가: 새창에서 열림 알림 (a11y)
- (P5.6 에서 deep link logic 본격 추가)
- └─ 사이드 임팩트: 없음

#### S5.1.3 Form state 영속화 (sessionStorage auto-draft)
- 신규: `apps/web/src/hooks/use-form-persistence.ts`
- 동작:
  - mount: `sessionStorage.getItem(key)` → 있으면 `form.reset(parsed)`
  - subscribe: `form.watch()` → debounced 500ms `sessionStorage.setItem(key, JSON.stringify(values))`
  - cleanup on submit success: `sessionStorage.removeItem(key)`
- 옵션: `exclude` (예: 비밀번호 같은 민감 필드. trip 폼은 해당 없음)
- 수정: [apps/web/src/app/(app)/trips/new/new-trip-form.tsx](../../apps/web/src/app/(app)/trips/new/new-trip-form.tsx) — `useFormPersistence(form, 'trip-new-draft')`
- 수정: [apps/web/src/app/(app)/trips/[id]/edit/edit-trip-form.tsx](../../apps/web/src/app/(app)/trips/[id]/edit/edit-trip-form.tsx) — `useFormPersistence(form, ${tripId} \`trip-edit-${tripId}-draft\`)`
- 폼 제출 성공 시 자동 cleanup (action result 가 success 일 때 `sessionStorage.removeItem`)
- └─ 사이드 임팩트:
  - sessionStorage 는 same-origin same-tab 만 → 페이지 떠나도 다시 와도 복원됨 ✅
  - tab 닫으면 휘발됨 (의도)
  - 민감 정보 저장 위험: trip 폼은 주소/시간/이름만 — 낮은 위험
  - 다른 tab 에서 동시 작업 시 격리됨 ✅

### Phase P5.2 — PWA Assets (manifest + icons + offline page)

#### S5.2.1 Icons 생성
- 신규: `apps/web/public/icons/`
- 4개 PNG:
  - `icon-192.png` (192×192)
  - `icon-512.png` (512×512)
  - `icon-maskable-512.png` (512×512, safe-zone center 80%)
  - `apple-touch-icon-180.png` (180×180)
- 디자인: 단색 Toss blue (#3182f6) 배경 + 흰색 "F" letter (Pretendard Bold) 중앙
- 생성 방법: ImageMagick CLI 스크립트 또는 Node `sharp` lib 1회성 생성. 결과 PNG 만 commit.
- └─ 사이드 임팩트: public/ 이 지금 비어있으므로 4개 파일 추가만. 빌드 시점 정적 자산으로 포함됨.

#### S5.2.2 Web App Manifest
- 신규: `apps/web/src/app/manifest.ts`
- Next.js Metadata API `MetadataRoute.Manifest` 반환
- 내용: REQ §3.1 그대로
- Next.js 가 자동으로 `/manifest.webmanifest` 라우트 생성, `Content-Type: application/manifest+json` 헤더 설정
- basePath 처리: Next.js 가 자동 prefix (확인 필요 — manifest.ts 내부 path 는 `/` 기반으로 작성)
- └─ 사이드 임팩트: build 시 `/manifest.webmanifest` 라우트 추가됨. middleware 에서 이 경로 PUBLIC 처리 필요 (S5.4.1).

#### S5.2.3 Offline fallback page
- 신규: `apps/web/public/offline.html`
- 정적 HTML, vi/en/ko 텍스트 모두 inline (navigator.language 로 client-side switch)
- "다시 시도" 버튼 → `location.reload()`
- 디자인: AppShell 톤 (bg-bg, text-text, accent button) — Tailwind 미적용 (static HTML) → inline CSS minimal
- └─ 사이드 임팩트: 없음 — 새 정적 자산. middleware PUBLIC 처리 필요 (S5.4.1).

### Phase P5.3 — Service Worker

#### S5.3.1 sw.js 작성
- 신규: `apps/web/public/sw.js`
- 구조:
  ```
  const CACHE = 'fleet-v1';
  const PRECACHE = ['/offline.html', '/manifest.webmanifest', '/icons/icon-192.png'];

  self.addEventListener('install', ...);   // precache + skipWaiting
  self.addEventListener('activate', ...);  // delete old caches + clients.claim
  self.addEventListener('fetch', ...);     // strategy router (see below)
  ```
- Fetch strategy:
  - GET `/_next/static/*` → cache-first (immutable hash)
  - GET `/icons/*`, `/manifest.webmanifest` → cache-first
  - GET navigation (mode === 'navigate') → network with 3s timeout, fallback to cached `/offline.html`
  - GET `/api/v1/*` → network-only (no cache)
  - Other GET → network-first, no cache fallback
  - Non-GET → network-only (no SW intervention)
  - Cross-origin → SW bypass (`if (url.origin !== self.location.origin) return;`)
- basePath: SW 코드 내에서 `self.registration.scope` 또는 `self.location.pathname` 기반으로 prefix 결정 → `PRECACHE` 항목들 prefix 처리
- └─ 사이드 임팩트: 모든 fetch 가 SW 경유 (등록 후). 버그 시 사용자 봉쇄 위험 → cache version bump + Cache-Control `no-cache` for sw.js 설정 (S5.4.2)

#### S5.3.2 SW Register client component
- 신규: `apps/web/src/components/pwa/sw-register.tsx`
- `'use client'`
- `useEffect(() => { ... }, [])`:
  - `if (window.self !== window.top) return;` (iframe skip)
  - `if (!('serviceWorker' in navigator)) return;` (지원 안함)
  - `if (process.env.NODE_ENV !== 'production') return;` (dev 에서 SW 비활성화 — Hot Reload 충돌 방지). 단, 명시적 `NEXT_PUBLIC_ENABLE_SW=true` 시 dev 에서도 등록 (테스트용)
  - `navigator.serviceWorker.register('/sw.js', { scope: '/' })`
  - register 시 basePath 자동 prefix? → Next.js 가 inline 처리 안 함. 클라이언트 에서 `document.baseURI` 로 처리 또는 `process.env.NEXT_PUBLIC_BASE_PATH` 환경변수로 전달
- 결정: 새 env `NEXT_PUBLIC_BASE_PATH` 추가, build 시 inline. register URL = `${NEXT_PUBLIC_BASE_PATH}/sw.js`
- └─ 사이드 임팩트: `.env.example` 에 `NEXT_PUBLIC_BASE_PATH` 추가 (선택, 미설정 시 empty). render.yaml + docker-compose 도 환경변수 매핑 필요.

#### S5.3.3 Root layout 에 SWRegister mount
- 수정: [apps/web/src/app/layout.tsx](../../apps/web/src/app/layout.tsx)
- `<NextIntlClientProvider>` 안에 `<SWRegister />` 추가
- metadata 객체 확장: manifest, applicationName, appleWebApp, themeColor, viewport, icons (REQ §3.3)
- └─ 사이드 임팩트: layout.tsx 가 client component import 함 → RSC layout 유지 가능 (client component 를 자식으로 render OK). 단, `<SWRegister />` 가 client component 임을 명시.

### Phase P5.4 — Middleware & next.config

#### S5.4.1 Middleware PUBLIC_PATHS 확장
- 수정: [apps/web/src/middleware.ts](../../apps/web/src/middleware.ts#L6)
- PUBLIC_PATHS 에 추가:
  ```
  '/manifest.webmanifest',
  '/sw.js',
  '/icons',         // prefix match — startsWith handles /icons/*.png
  '/offline.html',
  ```
- matcher 는 변경 불필요 (이미 `/_next/static` 제외)
- └─ 사이드 임팩트: 이 paths 는 인증 없이 200 응답. PWA install 가능. 정적 자산이라 정보 누출 위험 없음.

#### S5.4.2 next.config.mjs headers 확장
- 수정: [apps/web/next.config.mjs](../../apps/web/next.config.mjs#L25-L37)
- 기존 CSP 헤더 유지
- 추가:
  - `/sw.js` → `Cache-Control: public, max-age=0, must-revalidate`, `Service-Worker-Allowed: /`
  - `/manifest.webmanifest` → `Cache-Control: public, max-age=3600`
- └─ 사이드 임팩트: SW 가 매 배포마다 새로 fetch 됨 (max-age=0) → 사용자 자동 업데이트.

### Phase P5.5 — Install Prompt + Display Mode hook

#### S5.5.1 Display mode hook
- 신규: `apps/web/src/components/pwa/use-display-mode.ts`
- `useDisplayMode(): 'standalone' | 'browser'`
- `window.matchMedia('(display-mode: standalone)').matches` 또는 `(navigator as any).standalone === true` (iOS)
- SSR 안전: 초기값 `'browser'`, useEffect 에서 update
- 사용처: install prompt 표시 여부, Maps 링크 toast 표시 여부

#### S5.5.2 InstallPrompt component
- 신규: `apps/web/src/components/pwa/install-prompt.tsx`
- `'use client'`
- 상태:
  - `deferredPrompt: BeforeInstallPromptEvent | null` (Android)
  - `isIOS: boolean` (UA 감지)
  - `dismissed: boolean` (localStorage `pwa.installDismissed` 확인)
- effect:
  - `window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); setDeferredPrompt(e); })`
  - iframe 체크: `if (window.self !== window.top) return;`
  - localStorage 만료 체크 — 7일/30일 차등
- UI:
  - Android: 하단 fixed banner — "Cài đặt Fleet" + 설치 / 나중에 버튼
  - iOS: 하단 fixed banner — "iPhone 설치 안내" + Share→Add 단계 modal
  - 이미 standalone → null
- mount 위치: AppShell footer 또는 root layout — **결정: AppShell 안 (인증 후만 노출)** → (app)/layout.tsx 또는 app-shell.tsx
- └─ 사이드 임팩트: 미인증 상태(session-expired)에서는 prompt 미노출. 인증 후 첫 dashboard 진입 시 노출 가능.

#### S5.5.3 InstallPrompt mount
- 수정: [apps/web/src/components/layout/app-shell.tsx](../../apps/web/src/components/layout/app-shell.tsx)
- `<InstallPrompt />` 를 main content 영역 끝에 추가 (fixed positioning 이므로 위치 중요 X)
- └─ 사이드 임팩트: 인증된 모든 페이지에서 InstallPrompt 표시 가능. iframe 감지 후 자체적으로 hide.

### Phase P5.6 — Safe-area + i18n + Maps toast hint

#### S5.6.1 Tailwind safe-area utilities
- 수정: [apps/web/tailwind.config.ts](../../apps/web/tailwind.config.ts)
- theme.extend.spacing 에 추가:
  ```
  'safe-top':    'env(safe-area-inset-top)',
  'safe-bottom': 'env(safe-area-inset-bottom)',
  'safe-left':   'env(safe-area-inset-left)',
  'safe-right':  'env(safe-area-inset-right)',
  ```
- 사용처: install-prompt fixed banner `bottom-safe-bottom`, mobile main `pb-safe-bottom`
- └─ 사이드 임팩트: 없음 — additive utilities, 기존 클래스 영향 X

#### S5.6.2 i18n `pwa` namespace 추가
- 수정: `apps/web/messages/{vi,en,ko}.json`
- 13 키 추가 (REQ §3.12)
- vi (default), en, ko 모두 동일 키 채움
- └─ 사이드 임팩트: 없음 — additive keys

#### S5.6.3 Maps deep link (전략 B)
- 신규: `apps/web/src/lib/maps-deep-link.ts` — `buildMapsUrl(opts): string` (REQ §3.11 구현)
- UA 감지: iOS / Android / Desktop
- iOS: `comgooglemaps://?saddr=...&daddr=...&waypoints=...&directionsmode=driving`
- Android: `geo:0,0?q=<dest>` (intent picker → 모든 maps 앱 노출)
- Desktop: 기존 `https://www.google.com/maps/dir/?...`
- iOS fallback timer: 클릭 후 3초 내 `document.visibilityState` 가 `hidden` 안 되면 (= 앱 안 떴으면) → `window.location.href = httpsUrl` 으로 web 폴백
- 수정: [map-preview.tsx](../../apps/web/src/components/inputs/map-preview.tsx), [map-route.tsx](../../apps/web/src/components/inputs/map-route.tsx)
  - SSR 안전: 초기 URL = https (server-side rendered), client mount 시 UA 기반 deep link 으로 swap (`useEffect` + `useState`)
  - onClick handler (iOS only): visibility 변화 감지 + fallback timer
  - desktop: `target="_blank"` 유지 (기존 동작)
  - mobile: `target="_blank"` 제거 (deep link 은 새창 의미 없음 — OS handler)
- └─ 사이드 임팩트:
  - SSR-rendered HTML 에는 https URL → JS 비활성/구버전 폴백 OK
  - sonner toast 미사용 (deep link 이 더 UX 좋음 — 별도 안내 불필요)
  - 차후 P6 에서 deep link 클릭율 측정 가능 (analytics 미작업)

---

## 3. 변경 파일 목록

| 구분 | 파일 | 변경유형 | Phase |
|---|---|---|---|
| **Frontend Components (NEW)** | `apps/web/src/components/pwa/sw-register.tsx` | 신규 | P5.3 |
| | `apps/web/src/components/pwa/install-prompt.tsx` | 신규 | P5.5 |
| | `apps/web/src/components/pwa/use-display-mode.ts` | 신규 | P5.5 |
| | `apps/web/src/hooks/use-form-persistence.ts` | 신규 | P5.1 |
| | `apps/web/src/lib/maps-deep-link.ts` | 신규 | P5.6 |
| **Routes (NEW)** | `apps/web/src/app/manifest.ts` | 신규 | P5.2 |
| **Public assets (NEW)** | `apps/web/public/sw.js` | 신규 | P5.3 |
| | `apps/web/public/offline.html` | 신규 | P5.2 |
| | `apps/web/public/icons/icon-192.png` | 신규 | P5.2 |
| | `apps/web/public/icons/icon-512.png` | 신규 | P5.2 |
| | `apps/web/public/icons/icon-maskable-512.png` | 신규 | P5.2 |
| | `apps/web/public/icons/apple-touch-icon-180.png` | 신규 | P5.2 |
| **Frontend (MODIFY)** | `apps/web/src/app/layout.tsx` | 수정 (metadata + SWRegister) | P5.3 |
| | `apps/web/src/components/layout/app-shell.tsx` | 수정 (InstallPrompt mount) | P5.5 |
| | `apps/web/src/app/(app)/trips/_components/trip-conflict-banner.tsx` | 수정 (target=_blank 제거) | P5.1 |
| | `apps/web/src/app/(app)/trips/new/new-trip-form.tsx` | 수정 (useFormPersistence) | P5.1 |
| | `apps/web/src/app/(app)/trips/[id]/edit/edit-trip-form.tsx` | 수정 (useFormPersistence) | P5.1 |
| | `apps/web/src/components/inputs/map-preview.tsx` | 수정 (rel 강화 + deep link) | P5.1, P5.6 |
| | `apps/web/src/components/inputs/map-route.tsx` | 수정 (rel 강화 + deep link) | P5.1, P5.6 |
| **Config (MODIFY)** | `apps/web/src/middleware.ts` | 수정 (PUBLIC_PATHS +4) | P5.4 |
| | `apps/web/next.config.mjs` | 수정 (headers sw.js + manifest) | P5.4 |
| | `apps/web/tailwind.config.ts` | 수정 (safe-area utilities) | P5.6 |
| **i18n (MODIFY)** | `apps/web/messages/vi.json` | 수정 (pwa namespace) | P5.6 |
| | `apps/web/messages/en.json` | 수정 | P5.6 |
| | `apps/web/messages/ko.json` | 수정 | P5.6 |
| **Env (MODIFY)** | `apps/app-car-manager-v2/.env.example` | 수정 (NEXT_PUBLIC_BASE_PATH 추가) | P5.3 |
| | `apps/app-car-manager-v2/docker-compose.app-car-manager-v2.yml` | 수정 (env 매핑) | P5.3 |
| | `apps/app-car-manager-v2/render.yaml` | 수정 (env 매핑) | P5.3 |

**Backend**: 변경 없음
**DB**: 변경 없음

---

## 4. 사이드 임팩트 분석

| 범위 | 위험도 | 설명 |
|---|---|---|
| SW 캐시 버그 | **High** | 잘못된 cache 설정 시 사용자가 update 못 받음 → 영구 봉쇄. 완화: `Cache-Control: no-cache` for sw.js + cache version constant + activate 시 old cache delete |
| Trip conflict 폼 state 손실 | **Medium** | conflict 링크 같은 탭 이동 시 작성 중 폼 휘발. 완화: 본 작업 범위 외, 별도 폼 가드 작업 (sessionStorage draft) — 추후 |
| Iframe 안 PWA 동작 | **Low** | install prompt + SW register 모두 iframe 감지 후 skip. 정상 동작 보장. AMA passthrough 영향 없음 |
| BASE_PATH prefix 누락 | **Medium** | staging Docker 에서 sw.js URL 잘못되면 등록 실패. 완화: `NEXT_PUBLIC_BASE_PATH` 환경변수 명시 + TC 에서 staging 환경 verify |
| P4 Web Push 와 sw.js 충돌 | **Low** | P4 가 아직 sw.js 안 만듦 (확인 완료). 본 작업이 먼저 만들고 P4 가 push handler 머지. P4 작업자에게 인계 시 README 또는 sw.js 주석 명시 |
| 새 NPM 의존성 | **None** | 없음. Next.js Metadata API + native APIs 만 사용 |
| Lighthouse PWA 점수 | **Low** | 본 작업 후 90+ 목표. Lighthouse 자동 실행 (P6 hardening 에서 정식 측정) |
| iOS Safari < 16.4 | **Low** | manifest 부분 지원 (icon, theme-color), SW 동작. 점진적 노출 — fallback 으로 그냥 웹앱 사용 |
| 외부 Maps 새창 | **Low** | rel="noopener noreferrer" 추가로 보안 강화. PWA standalone 에서 새창 동작은 OS 기본 브라우저로 → 의도된 동작, toast 로 사용자 안내 |
| i18n 파일 크기 증가 | **None** | +13 keys × 3 lang ≈ 1KB total — 무시 가능 |

---

## 5. DB 마이그레이션

**없음.**

P5 shell phase 는 PWA 인프라만 추가. DB 변경 0건.

(참고: P4 Web Push 가 `car_push_subscriptions` 테이블 신규 필요 — 별도 REQ/PLAN 에서 다룸.)

---

## 6. 배포 전략

### 6.1 Local dev

- `NODE_ENV=development` 에서 SW register 자동 비활성화 (Hot Reload 충돌 방지)
- 명시적 테스트 시 `NEXT_PUBLIC_ENABLE_SW=true` 환경변수로 enable
- Chrome `localhost` 은 PWA 자동 허용 ✅

### 6.2 Render (Web Service)

- `render.yaml` 에 `NEXT_PUBLIC_BASE_PATH=` (empty) 추가
- 첫 배포 후 manifest, sw.js 200 OK 확인
- Chrome DevTools → Application → Manifest → "Installable" 확인

### 6.3 Staging Docker

- `docker-compose.app-car-manager-v2.yml` build args 에 `NEXT_PUBLIC_BASE_PATH=/app-car-manager-v2` 추가
- nginx config 확인: `/app-car-manager-v2/manifest.webmanifest` 와 `/app-car-manager-v2/sw.js` 가 백엔드로 proxy 되는지 (현재 location block 이 `/app-car-manager-v2/` prefix 전체를 proxy 하므로 영향 없음 — 확인 필요)
- 스테이징 배포 후 Lighthouse 측정

### 6.4 Production

- 스테이징에서 PWA install + offline + standalone 모드 확인 후
- production PR → 머지 → 자동 배포 (CLAUDE.md 의 배포 원칙 준수: 스테이징 먼저)

---

## 7. 구현 순서 (Critical Path)

권장 commit 단위:

1. **P5.1 commit** — `fix: prevent PWA escape on trip-conflict link, harden maps external link rel`
   - trip-conflict-banner.tsx target=_blank 제거
   - map-preview/map-route.tsx rel=noopener noreferrer 추가
   - **Quick win, 코드 작음, 회귀 위험 낮음** → 별도 PR 가능
2. **P5.2 commit** — `feat: add PWA manifest, icons, and offline fallback`
3. **P5.3 commit** — `feat: register service worker with offline-first navigation cache`
4. **P5.4 commit** — `chore: allow manifest/sw/icons through auth middleware`
5. **P5.5 commit** — `feat: PWA install prompt with iframe-aware suppression`
6. **P5.6 commit** — `feat: i18n PWA strings + safe-area utilities + maps standalone hint`

각 commit 후 typecheck + lint + 수동 verify (Lighthouse if applicable).

---

## 8. Rollback 전략

- SW 버그 시 즉시 rollback: `apps/web/public/sw.js` 의 `fetch` 핸들러를 빈 함수로 교체 (또는 unregister 코드 배포)
  ```js
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', () => self.clients.claim());
  // No fetch handler → browser handles all requests normally
  ```
- 또는 SW 자체 제거: `sw.js` 파일을 빈 응답으로 변경 (사용자 클라이언트가 다음 fetch 에서 SW unregister)
- 더 적극적: `apps/web/src/components/pwa/sw-register.tsx` 에서 register 호출을 `unregister` 로 1회 변경 후 배포 → 모든 사용자 SW 제거 → 정상 후 register 재배포
- manifest 깨짐: `manifest.ts` 만 revert (브라우저는 manifest 없어도 PWA 외 정상 동작)
- conflict-banner target=_blank: revert 1줄

---

## 9. 의존성 / 외부 작업

- **P4 Web Push (in-progress)**: 본 작업의 sw.js 가 push event listener placeholder 미포함. P4 작업자가 sw.js 에 push handler 추가 시 본 작업의 fetch/install/activate 핸들러 보존 필요. P4 PR 에서 conflict 발생 시 본 sw.js 기준으로 merge.
- **Icon 디자인**: 임시 "F" + Toss blue PNG 로 진행. designer 가 정식 로고 제공 시 4개 PNG 교체 (별도 작업, 디자인 freeze 후).
- **폼 가드 (trip-conflict-banner target=_blank 제거 사이드 임팩트)**: 본 작업 후 별도 REQ 작성 — `sessionStorage` draft + Next.js `beforeunload` listener.

---

## 10. 완료 후 산출물

- [ ] 위 변경 파일 모두 commit, typecheck/lint pass
- [ ] Local dev: `NEXT_PUBLIC_ENABLE_SW=true` 로 SW 동작 확인
- [ ] Render staging deploy → manifest/sw.js 200, Lighthouse PWA ≥ 90
- [ ] Staging Docker deploy → basePath prefixed manifest/sw.js 동작 확인
- [ ] `docs/test/TC-20260519-pwa-setup-p5.md` 작성 + 실행
- [ ] `docs/test/TR-20260519-pwa-setup-p5.md` 결과 기록
- [ ] `docs/implementation/RPT-20260519-pwa-setup-p5.md` 회고/이슈/후속
- [ ] PR 본문에 Lighthouse PWA report screenshot 첨부

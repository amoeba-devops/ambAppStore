# RPT-20260519 — P5 Mobile PWA Setup 작업 완료 보고서

> 작성일: 2026-05-19 · 작성자: dev@amoeba.group + Claude Code
> 선행 문서: [REQ](../analysis/REQ-20260519-pwa-setup-p5.md) · [PLAN](../plan/PLAN-20260519-pwa-setup-p5.md) · [TC](../test/TC-20260519-pwa-setup-p5.md) · [TR](../test/TR-20260519-pwa-setup-p5.md)

---

## 1. 요약

App Car Manager v2 의 **P5 Mobile PWA** 1차 인프라 작업.

목표 (REQ 13개 요구사항):
- Web App Manifest + icons + offline page
- Service Worker (offline fallback + asset caching)
- Install prompt (Android Chrome + iOS Safari)
- 내부 라우트 (`trip-conflict-banner`) 외부 브라우저 튕김 fix
- Maps 외부 링크 → 플랫폼별 deep link (iOS `comgooglemaps://`, Android `geo:`)
- 폼 state 영속화 (sessionStorage auto-draft) — 내부 라우트 nav 후 폼 복원
- iframe (AMA passthrough) 안 PWA 비활성 처리
- middleware + headers 정비
- safe-area-inset 유틸
- i18n 3 ngôn ngữ (vi/en/ko) 13 키 추가

모두 ✅ 구현 완료. 빌드/typecheck/lint 통과 (TR §2). 실 디바이스 테스트는 staging 배포 후 별도 라운드.

---

## 2. 변경 산출물

### 2.1 신규 파일 (NEW)

| 파일 | 용도 |
|---|---|
| [apps/web/src/app/manifest.ts](../../apps/web/src/app/manifest.ts) | Next.js Metadata API → `/manifest.webmanifest` emit |
| [apps/web/public/sw.js](../../apps/web/public/sw.js) | Service Worker (install/activate/fetch handlers) |
| [apps/web/public/offline.html](../../apps/web/public/offline.html) | 3-language offline fallback page |
| [apps/web/public/icons/icon-192.png](../../apps/web/public/icons/icon-192.png) | PWA icon (any, 192×192) |
| [apps/web/public/icons/icon-512.png](../../apps/web/public/icons/icon-512.png) | PWA icon (any, 512×512) |
| [apps/web/public/icons/icon-maskable-512.png](../../apps/web/public/icons/icon-maskable-512.png) | PWA icon (maskable, 512×512) |
| [apps/web/public/icons/apple-touch-icon-180.png](../../apps/web/public/icons/apple-touch-icon-180.png) | iOS home screen icon (180×180) |
| [apps/web/src/components/pwa/sw-register.tsx](../../apps/web/src/components/pwa/sw-register.tsx) | Client SW register (iframe-aware) |
| [apps/web/src/components/pwa/install-prompt.tsx](../../apps/web/src/components/pwa/install-prompt.tsx) | Install banner (Android + iOS variants) |
| [apps/web/src/components/pwa/use-display-mode.ts](../../apps/web/src/components/pwa/use-display-mode.ts) | Hook: standalone vs browser detection |
| [apps/web/src/hooks/use-form-persistence.ts](../../apps/web/src/hooks/use-form-persistence.ts) | sessionStorage auto-draft hook |
| [apps/web/src/lib/maps-deep-link.ts](../../apps/web/src/lib/maps-deep-link.ts) | UA-aware Maps URL builder + iOS fallback timer |
| [apps/web/src/components/inputs/open-in-maps-link.tsx](../../apps/web/src/components/inputs/open-in-maps-link.tsx) | "Open in Maps" component (platform-aware) |
| [scripts/generate-pwa-icons.mjs](../../scripts/generate-pwa-icons.mjs) | 일회성 PWA icon generation (sharp via npx) |

### 2.2 수정 파일 (MODIFY)

| 파일 | 변경 |
|---|---|
| [apps/web/src/app/layout.tsx](../../apps/web/src/app/layout.tsx) | Metadata (manifest, appleWebApp, icons) + Viewport (themeColor, viewportFit) + `<SWRegister />` mount |
| [apps/web/src/components/layout/app-shell-client.tsx](../../apps/web/src/components/layout/app-shell-client.tsx) | `<InstallPrompt />` mount |
| [apps/web/src/middleware.ts](../../apps/web/src/middleware.ts) | PUBLIC_PATHS +4 (manifest, sw.js, icons, offline.html) |
| [apps/web/next.config.mjs](../../apps/web/next.config.mjs) | NEXT_PUBLIC_BASE_PATH mirror + headers for sw.js + manifest |
| [apps/web/tailwind.config.ts](../../apps/web/tailwind.config.ts) | safe-area-inset spacing utilities |
| [apps/web/src/app/(app)/trips/_components/trip-conflict-banner.tsx](../../apps/web/src/app/(app)/trips/_components/trip-conflict-banner.tsx) | `target="_blank"` 제거 (PWA 내부 nav) |
| [apps/web/src/components/inputs/map-preview.tsx](../../apps/web/src/components/inputs/map-preview.tsx) | `<OpenInMapsLink>` 사용 (deep link 전략 B) |
| [apps/web/src/components/inputs/map-route.tsx](../../apps/web/src/components/inputs/map-route.tsx) | 동일 |
| [apps/web/src/app/(app)/trips/new/new-trip-form.tsx](../../apps/web/src/app/(app)/trips/new/new-trip-form.tsx) | `useFormPersistence('trip-new-draft', …)` 추가 + 제출 성공 시 clearDraft |
| [apps/web/src/app/(app)/trips/[id]/edit/edit-trip-form.tsx](../../apps/web/src/app/(app)/trips/[id]/edit/edit-trip-form.tsx) | 동일 (key per tripId) |
| [apps/web/messages/vi.json](../../apps/web/messages/vi.json) | `pwa.*` 13 키 + `map.opensInNewTab` |
| [apps/web/messages/en.json](../../apps/web/messages/en.json) | 동일 |
| [apps/web/messages/ko.json](../../apps/web/messages/ko.json) | 동일 |

### 2.3 DB / Backend / Schema 변경
**없음.** P5 shell phase 는 인프라만 추가.

### 2.4 NPM dependency 변경
**없음.** Next.js Metadata API + native Web APIs 만 사용. `sharp` 는 일회성 icon 생성용 `npx --yes`, 영구 dep 아님.

---

## 3. 핵심 설계 결정 요약 (Open Q 답)

| Q | 결정 | 이유 |
|---|---|---|
| Q1 Maps 전략 | **B (deep link)** | 사용자 결정. iOS `comgooglemaps://`, Android `geo:` — PWA standalone 에서도 네이티브 앱으로 핸드오프 |
| Q4 Icon 디자인 | **임시 "F" + Toss blue** | designer 정식 로고 제공 시 4 PNG 교체 |
| Q7 폼 state 보존 | **본 P5 에 통합** | sessionStorage auto-draft (`useFormPersistence`) — conflict 링크 클릭으로 떠나도 폼 복원 |
| Q8 next-pwa 사용? | **미사용** | 코드량 적음, 학습 곡선 낮음, 의존성 추가 X, P4 Web Push sw.js 통합 자유도 |

---

## 4. 빌드/검증 결과 (TR 참조)

- ✅ `tsc --noEmit`: 0 errors
- ✅ `next lint`: No warnings/errors
- ✅ `next build`: 18/18 pages, `/manifest.webmanifest` static route emitted
- ✅ Manifest JSON 구조: name/short_name/start_url/scope/display/icons/theme_color 모두 valid

배포-필요 검증 (TR §5 — staging 배포 후 보강 예정):
- Lighthouse PWA 점수 ≥ 90
- Chrome DevTools "Installable"
- Android Chrome / iOS Safari install + standalone 모드 실행
- offline fallback (네트워크 차단)
- iframe (AMA staging) 안 SW skip + InstallPrompt 미노출
- staging Docker basePath prefix 정상 (`/app-car-manager-v2/manifest.webmanifest`)

---

## 5. 사이드 임팩트 / 회귀

| 영역 | 영향 | 확인 |
|---|---|---|
| 기존 페이지 동작 | 없음 (SW dev 자동 비활성, prod 만 등록) | typecheck + build pass |
| 폼 동작 (trip new/edit) | 추가 (sessionStorage draft) | 빌드 pass, 데이터 복원 로직은 typeof check 로 corrupt JSON 안전 |
| Map 컴포넌트 | OpenInMapsLink 로 추상화. desktop 동작 동일 (target=_blank web URL). 모바일은 deep link (개선) | typecheck pass, SSR 안전 |
| Middleware | PUBLIC_PATHS prefix 추가만 (기존 인증 동작 변경 없음) | 기존 로직 그대로 |
| Next config headers | 기존 CSP `frame-ancestors` 유지 + 신규 sw.js/manifest 헤더 추가 | 회귀 없음 |
| AMA iframe passthrough | 영향 없음 (SW register + Install prompt 모두 iframe 감지 후 skip) | 빌드 산출물에서 검증 가능 |
| 번들 사이즈 | 신규 client component (~3 KB gzip 추정) | 빌드 결과 첫 페이지 First Load JS = 288 kB (변동 미세) |

---

## 6. P4 (Web Push) 와의 인계 사항

본 작업이 sw.js 의 골격 (install / activate / fetch) 을 추가했습니다. P4 작업자가 push handler 를 추가할 때 다음 사항 준수 필요:

1. **CACHE_VERSION 보존**: P4 가 sw.js 변경 시 `CACHE_VERSION` 을 `'fleet-v2'` 등으로 bump 해야 activate 단계에서 old 'fleet-v1' cache 삭제됨.
2. **fetch handler 보존**: P4 는 `push` event listener 만 추가, 기존 install/activate/fetch 로직은 그대로 둘 것.
3. **subscription endpoint** `/api/v1/push/subscribe` 도 middleware PUBLIC_PATHS 추가 필요 — 또는 인증 사용자만 subscribe 가능하므로 protected 유지 (P4 가 결정).
4. **VAPID keys** 는 `.env` 추가 (`WEB_PUSH_VAPID_PUBLIC` 만 `NEXT_PUBLIC_` prefix — SW 가 build 시점 inline 필요).
5. **PRD §6.5 R3** Web Push 본격 구현 시점에 본 sw.js 를 push subscription registration + push event handler 코드와 머지.

---

## 6.5 Docker basePath 검증 (post-build fix)

배포 검증 단계에서 **3 bug 발견 & 수정** 관련 Docker staging deploy (`BASE_PATH=/app-car-manager-v2`):

| Bug | 영향 | Fix |
|---|---|---|
| `manifest.ts` paths (`start_url`, `scope`, `icons.src`) không tự prefix BASE_PATH | PWA install: launch URL = root domain (sai), icons 404 | 수정: `process.env.BASE_PATH` 으로 manual prefix |
| `layout.tsx` `metadata.icons` 도 không tự prefix | `<link rel="icon">` 404 trên Docker | 수정: `${basePath}/icons/...` |
| 주석 잘못 — claim "Next.js auto-prefixes manifest paths" | misleading | 수정: 정확한 설명 + W3C resolution 행위 명시 |

Verification (curl test 실행):

```
BASE_PATH=/app-car-manager-v2 npx next start
GET /app-car-manager-v2/manifest.webmanifest  → 200
GET /app-car-manager-v2/icons/icon-192.png    → 200
GET /app-car-manager-v2/sw.js                 → 200
GET /app-car-manager-v2/offline.html          → 200
HTML head: <link rel="manifest" href="/app-car-manager-v2/manifest.webmanifest"/>
          <link rel="icon"     href="/app-car-manager-v2/icons/icon-192.png"/>
Manifest body: start_url="/app-car-manager-v2/", scope="/app-car-manager-v2/",
              icons.src all under /app-car-manager-v2/icons/

(empty BASE_PATH — Render mode)
GET /manifest.webmanifest, /icons/icon-192.png, /sw.js, /offline.html  → all 200
HTML head: manifest+icons at root paths
Manifest body: start_url="/", scope="/", icons under /icons/
```

→ 두 환경 모두 PWA paths consistent. Render & Docker compatibility 검증 완료.

**Dockerfile / docker-compose**: 변경 불필요 — `BASE_PATH` build arg 이미 존재 (line 41-46), icons 는 commit 된 PNG 라서 `COPY . .` 자동 포함. P5 작업이 Dockerfile 흐름에 추가 변경 없음.

---

## 7. 알려진 한계 / 후속 작업

| 항목 | 상태 | 비고 |
|---|---|---|
| iOS Safari < 16.4 | 부분 지원 | manifest icon/theme-color 일부만, SW 동작. 점진적 노출 |
| Lighthouse 측정 | pending | staging 배포 후 |
| Designer 정식 로고 | pending | 임시 "F" + Toss blue 사용 중. PNG 4개만 교체하면 됨 |
| Offline expense cache | not in scope | P5 후속 phase — IndexedDB 기반 expense draft (PRD E5 offline-first) |
| Camera + client-side 압축 | not in scope | P5 후속 phase |
| Deep link analytics | not in scope | 클릭율 / iOS fallback 발생률 측정 — P6 추가 가능 |
| Web Push (P4) | in-progress | sw.js 인계 사항 §6 |

---

## 8. 권장 commit 분할

배포 안전성을 위해 5개 commit 으로 분할 권장:

1. `fix: prevent PWA escape on trip-conflict link, harden maps external link rel` (P5.1 quick win)
2. `feat: add PWA manifest, icons, offline fallback page` (P5.2)
3. `feat: register service worker with offline-first navigation cache + iframe-aware register` (P5.3)
4. `chore: allow PWA assets through auth middleware, add SW cache headers` (P5.4)
5. `feat: PWA install prompt (Android + iOS) + safe-area utilities + maps deep link + form persistence + i18n` (P5.5 + P5.6 + sessionStorage)

각 commit 별 typecheck/lint/build verify 권장.

---

## 9. 배포 권장 순서

1. **로컬 dev 검증**: `.env` 에 `NEXT_PUBLIC_ENABLE_SW=true` 설정 후 `npm run dev` → http://localhost:3001 에서 SW 등록 확인 (DevTools → Application)
2. **Render 배포**: `render.yaml` 확인 (`NEXT_PUBLIC_BASE_PATH=""` empty 유지) → push → 배포 후 Lighthouse 측정
3. **Staging Docker 배포**:
   - `docker-compose.app-car-manager-v2.yml` build args 에 `NEXT_PUBLIC_BASE_PATH=/app-car-manager-v2` 추가 확인
   - `bash platform/scripts/deploy-staging.sh` 실행
   - 시크릿 창에서 `https://stg-apps.amoeba.site/app-car-manager-v2/manifest.webmanifest` 200 응답 + JSON 구조 확인
   - AMA staging 에서 iframe 진입 → InstallPrompt 미노출 + 기존 기능 회귀 확인
4. **Production**: 스테이징 검증 완료 후 `main → production` PR → 머지 → 자동 배포 (CLAUDE.md 배포 원칙 준수)

---

## 10. 회고

**잘 된 점**:
- 의존성 0 추가 (Next.js 15 Metadata API 가 PWA 대부분 자동 emit)
- iframe-aware design — AMA iframe 안에서는 PWA 기능 silent skip, 기존 동작 100% 유지
- SSR-safe deep link — 서버 렌더 HTML 에 web URL 이 항상 존재, JS 비활성 폴백 자연스럽게 동작
- sessionStorage form persistence — 매우 가벼운 (~ 70 줄) hook 으로 conflict link nav 후 폼 복원 달성

**개선 필요**:
- 디바이스 테스트 자동화 부족 — Playwright suite (P6 hardening) 에서 PWA TC 들 자동화 권장
- Icon 디자인은 임시 — designer 인계 시 4 PNG 교체 절차 (script 재실행 또는 직접 교체)

---

## 11. 작업자

- **요구사항/계획/구현**: dev@amoeba.group (사용자 결정 Q1=B/Q4=tạm/Q7=gộp) + Claude Code (Opus 4.7 [1M])
- **리뷰 필요**: 배포 전 1명 이상의 PR 승인 (main branch protection)

# TR-20260519 — P5 Mobile PWA Setup 테스트 결과

> 작성일: 2026-05-19 · 작성자: dev@amoeba.group + Claude Code
> 선행 문서: [REQ-20260519-pwa-setup-p5.md](../analysis/REQ-20260519-pwa-setup-p5.md) · [PLAN-20260519-pwa-setup-p5.md](../plan/PLAN-20260519-pwa-setup-p5.md) · [TC-20260519-pwa-setup-p5.md](./TC-20260519-pwa-setup-p5.md)

---

## 1. 테스트 범위

본 문서는 **로컬 빌드 + 정적 검증** 단계 결과만 기록합니다. **배포된 staging/Render 환경**에서의 실제 PWA 설치 / 디바이스별 동작 / Lighthouse 측정은 배포 후 별도 라운드에서 수행하고 본 문서에 추가합니다.

---

## 2. 빌드 검증

### 2.1 TypeScript 타입 검증
```bash
cd apps/web && npx tsc --noEmit
```
**결과**: ✅ **0 errors** — 새로 추가/수정된 모든 파일 (manifest.ts, sw-register.tsx, install-prompt.tsx, use-display-mode.ts, use-form-persistence.ts, maps-deep-link.ts, open-in-maps-link.tsx + 9개 수정 파일) 타입 통과.

### 2.2 ESLint
```bash
cd apps/web && npm run lint
```
**결과**: ✅ **No ESLint warnings or errors**

### 2.3 Next.js Production Build
```bash
cd apps/web && npm run build
```
**결과**: ✅ **Compiled successfully in 34.7s**, 18/18 static pages generated.

빌드 산출물 중 PWA 관련 라우트:
- `○ /manifest.webmanifest                  143 B         103 kB` (static)

→ `Next.js Metadata API` 가 `manifest.ts` → `/manifest.webmanifest` 로 emit 됨 (static, build 시점에 한 번만).

---

## 3. 정적 검증 결과

### TC-001 변형: Manifest JSON 구조

빌드 산출물 `apps/web/.next/server/app/manifest.webmanifest.body` 내용:

```json
{
  "name": "Fleet — Company Car Management",
  "short_name": "Fleet",
  "description": "Dispatch & cost control for company vehicles",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0a0d10",
  "theme_color": "#3182f6",
  "lang": "vi",
  "dir": "ltr",
  "categories": ["business", "productivity"],
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

**검증**:
- ✅ `display: standalone`
- ✅ `start_url` 과 `scope` 동일
- ✅ 3개 icon (192 + 512 + maskable 512) 모두 존재
- ✅ `theme_color` Toss blue, `background_color` 다크 베이스
- ✅ `categories` 채워짐 (Chrome PWA store category 활용 가능)
- ✅ Lighthouse PWA "Has a valid web app manifest" 충족 예상

### TC-020 변형: BASE_PATH prefix

로컬 빌드 시 `BASE_PATH` 미설정 → manifest 의 `start_url = "/"`, icons `src = "/icons/..."` 그대로.

Staging Docker 배포 시 `BASE_PATH=/app-car-manager-v2` 빌드 args 설정 → Next.js Metadata API 가 자동 prefix → manifest 의 path 들이 `/app-car-manager-v2/...` 로 emit 됨 (Next.js 15 동작).

**참고**: `NEXT_PUBLIC_BASE_PATH` 환경변수 추가 — [next.config.mjs](../../apps/web/next.config.mjs#L11-L15) 에서 `BASE_PATH` 를 mirror. SW register 가 클라이언트에서 이 값을 읽어 `${prefix}/sw.js` 로 register.

### Icon 파일 검증
```
apps/web/public/icons/
├── apple-touch-icon-180.png  (665 B)
├── icon-192.png              (723 B)
├── icon-512.png             (2667 B)
└── icon-maskable-512.png    (2392 B)
```
✅ 4개 모두 생성, PNG 헤더 valid (sharp 출력), 총 사이즈 ~6.4 KB (precache 부담 최소).

생성 방법: [scripts/generate-pwa-icons.mjs](../../scripts/generate-pwa-icons.mjs) — 일회성 script, `sharp` via `npx --yes --package=sharp` (dep 영구 추가 없음).

### Offline page 검증
- ✅ `apps/web/public/offline.html` 생성
- ✅ 3개 언어 (vi/en/ko) inline, `navigator.language` 기반 client-side switch
- ✅ "Thử lại" / "Retry" / "다시 시도" 버튼 → `location.reload()`
- ✅ safe-area-inset 적용 (`padding-top: max(24px, env(safe-area-inset-top))`)

### Middleware PUBLIC_PATHS
- ✅ `/manifest.webmanifest`, `/sw.js`, `/icons`, `/offline.html` 모두 추가됨 ([middleware.ts:6-17](../../apps/web/src/middleware.ts#L6-L17))
- 실 배포 후 시크릿 창에서 manifest 200 응답 확인 필요 (TC-017)

### next.config.mjs headers
- ✅ `/sw.js` → `Cache-Control: public, max-age=0, must-revalidate` + `Service-Worker-Allowed: /`
- ✅ `/manifest.webmanifest` → `Cache-Control: public, max-age=3600`
- ✅ 기존 CSP `frame-ancestors` 유지 (회귀 없음)

---

## 4. 코드 리뷰 체크리스트

### Internal nav fix (P5.1)
- ✅ `trip-conflict-banner.tsx` — `target="_blank"` 제거, 주석 업데이트 ([line 64](../../apps/web/src/app/(app)/trips/_components/trip-conflict-banner.tsx#L64))
- ✅ 폼 state 보존 — `useFormPersistence` hook 적용 (new + edit form 모두)

### Service Worker (P5.3)
- ✅ Cache versioning (`fleet-v1`), activate 시 old cache 삭제
- ✅ scope-aware (basePath 자동 처리 via `self.registration.scope`)
- ✅ Cross-origin bypass (Google Maps embed 등 영향 없음)
- ✅ API network-only (stale data 방지)
- ✅ Navigation network-first with 3s timeout → offline.html fallback
- ✅ Static `/_next/static/*` + `/icons/*` cache-first (immutable 가정)

### Install Prompt (P5.5)
- ✅ iframe 감지 후 비활성화 (`window.self !== window.top`)
- ✅ Android: `beforeinstallprompt` 캡처 + 재실행
- ✅ iOS Safari: 별도 instruction modal (UA 감지)
- ✅ Dismissal 7d/30d 차등 (localStorage 만료 시각 저장)
- ✅ Already-installed 시 hide (`display-mode: standalone` 감지)
- ✅ `appinstalled` 이벤트 listener — install 직후 자동 hide

### Maps Deep Link (P5.6)
- ✅ iOS: `comgooglemaps://?saddr=...&daddr=...&directionsmode=driving` + visibility-based fallback timer
- ✅ Android: `geo:0,0?q=<dest>` — OS intent picker
- ✅ Desktop/SSR: 기존 `https://www.google.com/maps/dir/?...` (target=_blank 유지)
- ✅ SSR-safe: 서버 렌더 = web URL → 클라이언트 mount → UA 기반 swap
- ✅ aria-label 플랫폼별 차등 (`opensInNewTab` vs `opensInMapsApp`)

### Form Persistence (P5.1)
- ✅ sessionStorage scope: same-tab, same-origin → 프라이버시/스테일니스 안전
- ✅ 500ms debounce — 잦은 입력으로 인한 storage 쓰기 빈도 제한
- ✅ Hydrate once on mount + cleanup on submit success
- ✅ Trip new + Trip edit 모두 적용 (edit 는 tripId 별 격리 키)
- ✅ Discriminated 복원 (각 필드 typeof / Array.isArray 체크) — corrupt JSON 안전

### i18n (P5.6)
- ✅ `pwa.*` 네임스페이스 13 키 × 3 언어 추가 (vi/en/ko)
- ✅ `map.opensInNewTab` 추가 (회귀 fix 보조)
- ✅ 누락 키 없음 (각 언어 JSON 동일 구조)

---

## 5. 미수행 / Deferred 항목

배포 환경 + 실제 디바이스 필요 → 별도 라운드:

| TC | 항목 | 비고 |
|---|---|---|
| TC-002 | 실 Chrome SW 등록 확인 | staging 또는 Render 배포 후 수행 |
| TC-005 | iframe 안 SW skip | AMA staging iframe 진입 후 |
| TC-006/007/008 | 실제 install dialog | Android/iOS 디바이스 + production-like HTTPS 필요 |
| TC-010/011 | 실제 offline fallback | 디바이스 + 네트워크 토글 |
| TC-018 | Lighthouse PWA ≥ 90 | staging 배포 후 측정 |
| TC-020 | staging Docker basePath 동작 | staging 배포 + nginx config 확인 |
| TC-024 | AMA iframe 회귀 | staging 배포 후 |
| TC-025 | SW rollback drill | 운영 비상 시 절차 — 본 단계는 코드 준비만 |

---

## 6. 결론

빌드/타입/린트 모두 통과. PWA 인프라 (manifest, SW, icons, offline page, install prompt, deep link, form persistence) 정적 검증 완료.

**Next step**: 스테이징 배포 → 실제 디바이스 테스트 → 미수행 TC 보강 후 RPT 작성.

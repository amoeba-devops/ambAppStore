# REQ-20260519 — P5 Mobile PWA Setup + In-App Navigation Fixes

> 작성일: 2026-05-19 · 작성자: dev@amoeba.group + Claude Code
> 관련 문서: [PRD.md](../../PRD.md) §1.2 (PWA Driver), §6.5 (Notifications/Push) · [CLAUDE.md](../../CLAUDE.md) §6 Roadmap (P5)
> 후속 문서: `docs/plan/PLAN-20260519-pwa-setup-p5.md`

---

## 1. 요구사항 요약

| # | 요구사항 | 유형 |
|---|----------|------|
| R1 | Web App Manifest (`/manifest.webmanifest`) 생성 — `display: standalone`, scope, start_url, theme/background color, 3개 icon size (192/512/maskable) | PWA Manifest |
| R2 | Root layout meta tags 추가: `<link rel="manifest">`, `theme-color`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `viewport-fit=cover`, `apple-touch-icon` | HTML Head |
| R3 | Service Worker (`/sw.js`) 등록 — install / activate / fetch 핸들러. Network-first cho HTML, cache-first cho `/_next/static/*` + 이미지, offline fallback page | Service Worker |
| R4 | PWA install prompt — `beforeinstallprompt` 캡처 후 사용자가 install 가능할 때 UI 노출 (Driver/Manager에게 우선) | Install UX |
| R5 | iOS standalone safe-area 지원 — `env(safe-area-inset-*)` Tailwind 유틸 적용 (notch/홈 인디케이터) | Mobile UX |
| R6 | Middleware 확장 — `/manifest.webmanifest`, `/sw.js`, `/icons/*`, `/offline` 을 PUBLIC_PATHS에 추가 (auth bypass) | Auth |
| R7 | Internal link `target="_blank"` 제거 — `trip-conflict-banner.tsx`의 conflict 트립 링크는 PWA 내부 탐색이어야 함 (현재 PWA standalone에서 외부 브라우저로 튕김) | Navigation Fix |
| R8 | External Google Maps 링크 — 플랫폼별 deep link 우선: iOS `comgooglemaps://` → fallback `maps://` (Apple Maps) → fallback https, Android `geo:0,0?q=...` (intent picker), Desktop https 새창 (기존). PWA standalone 환경 우대 | Navigation Fix |
| R13 | Trip new/edit 폼 state 보존 — sessionStorage 기반 auto-draft (form values change 시 debounced 저장, mount 시 restore). conflict-banner 링크 클릭으로 페이지 떠나도 돌아왔을 때 폼 복원 (Q7 답: 본 P5 에 통합) | Form Persistence |
| R9 | Offline fallback page (`/offline`) — 네트워크 끊김 시 표시될 정적 페이지 (i18n vi/en/ko) | Offline UX |
| R10 | i18n 키 추가 — `pwa.installPrompt`, `pwa.installButton`, `pwa.dismissButton`, `pwa.offlineTitle`, `pwa.offlineMessage`, `pwa.opensInBrowser` (vi/en/ko) | i18n |
| R11 | iframe 환경 대응 — AMA iframe 내부에서는 PWA install / SW register 비활성화 (top-level navigation에서만 동작) | Compatibility |
| R12 | next.config.mjs 헤더 — `Service-Worker-Allowed: /`, `Cache-Control: no-cache` for sw.js, manifest CORS | HTTP Headers |

---

## 2. AS-IS 현황 분석

### 2.1 PWA 기반 인프라 — 전무

| 영역 | 파일 | 상태 |
|---|---|---|
| Web App Manifest | (없음) | ❌ |
| Service Worker | (없음) | ❌ |
| PWA icons | (없음) | ❌ `apps/web/public/.gitkeep` 만 존재 |
| `<link rel="manifest">` | [apps/web/src/app/layout.tsx](../../apps/web/src/app/layout.tsx) | ❌ metadata 객체에 만 `title` + `description` |
| Apple meta tags | (없음) | ❌ |
| `theme-color` | (없음) | ❌ |
| next-pwa / @ducanh2912/next-pwa | [apps/web/package.json](../../apps/web/package.json) | ❌ |
| `display-mode: standalone` 감지 코드 | (없음) | ❌ |
| Offline fallback page | (없음) | ❌ |

### 2.2 현재 외부 브라우저로 튕기는 곳 (PWA-breaking)

| # | 파일:Line | 동작 | 문제 |
|---|---|---|---|
| 1 | [apps/web/src/components/inputs/map-preview.tsx](../../apps/web/src/components/inputs/map-preview.tsx#L91-L101) :91-101 | `<a target="_blank">` to `https://www.google.com/maps/dir/?api=1&...` | PWA standalone → 외부 Chrome/Safari로 튕김. Deep link로 Google Maps 앱이 있다면 그쪽이 우선이어야 함 |
| 2 | [apps/web/src/components/inputs/map-route.tsx](../../apps/web/src/components/inputs/map-route.tsx#L227-L237) :227-237 | 동일 (map fullscreen 링크) | 동일 |
| 3 | [apps/web/src/app/(app)/trips/_components/trip-conflict-banner.tsx](../../apps/web/src/app/(app)/trips/_components/trip-conflict-banner.tsx#L62-L71) :62-71 | `<Link href="/trips/${id}" target="_blank">` | **내부 라우트인데 외부 브라우저로 튕김** — 가장 중요한 PWA breaking 버그 |

### 2.3 내부 네비게이션은 모두 `next/link` 사용 (OK)

확인 완료 — [sidebar-nav.tsx](../../apps/web/src/components/layout/sidebar-nav.tsx#L142-L171), [page.tsx](../../apps/web/src/app/(app)/page.tsx) Dashboard, Trip List 등은 `<Link>` 또는 `useRouter().push()` 사용. 사이드 임팩트 없음.

`mailto:` 와 (잠재 `tel:`) deep link 은 driver-view.tsx 에서 사용 — OS handler 동작이므로 PWA 정상 동작 (브라우저 새창 아님).

### 2.4 Middleware — PWA 필수 리소스 차단 위험

[apps/web/src/middleware.ts](../../apps/web/src/middleware.ts):
```
PUBLIC_PATHS = ['/api/v1/health', '/session-expired', '/dev-login', '/_next', '/favicon.ico']
matcher: ['/', '/((?!_next/static|_next/image|favicon.ico).+)']
```

`/manifest.webmanifest`, `/sw.js`, `/icons/*` 추가 없이는:
- 미인증 상태에서 PWA install 시도 → manifest 요청이 `/session-expired`로 redirect → 브라우저가 manifest 파싱 실패 → install 불가
- SW 등록 → `sw.js` 가 redirect 응답 → SW 등록 실패

### 2.5 iframe 환경 (AMA passthrough)

[next.config.mjs](../../apps/web/next.config.mjs):
- CSP `frame-ancestors 'self' ${amaOrigin}` — iframe 허용
- AMA 가 `?ama_token=` 으로 토큰 전달, middleware 가 cookie 로 저장

**문제**: iframe 안에서 PWA install / SW 는 의미 없음 (top-level navigation 만 install 가능). install prompt 는 top-level 일 때만 노출해야 함. SW 등록은 iframe 에서 가능하지만 scope 가 iframe 한정.

### 2.6 deployment 매트릭스 (manifest start_url 영향)

| 환경 | URL | basePath | manifest start_url |
|---|---|---|---|
| Local | http://localhost:3001 | (empty) | `/` |
| Render | https://*.onrender.com | (empty) | `/` |
| Staging Docker | https://stg-apps.amoeba.site/app-car-manager-v2 | `/app-car-manager-v2` | `/app-car-manager-v2/` |

→ manifest 의 `start_url`, `scope`, icon paths 는 `BASE_PATH` 기반으로 빌드 시점에 inline 해야 함.

### 2.7 디바이스 / OS 가정

- 메인 타깃: Driver = Android (Chrome PWA 지원 우수), Manager/Admin = iOS + desktop
- iOS Safari PWA: manifest 필요하지만 SW 제약 (캐시 50MB, push X — 16.4+ 만 web push 지원)
- 데스크톱 Chrome/Edge: PWA install 지원

### 2.8 PRD 와의 정합성

PRD §1.2 (Driver): 모바일 우선, 빠른 진입 (trip accept/reject/start/end). PRD §6.5 R3: Web Push 알림 (P4 Comprehensive 진행 중).
→ P5 PWA 는 P4 의 Web Push (VAPID + service worker) 와 함께 묶일 수 있음. **본 작업은 PWA shell 만** — Web Push 의 SW registration 은 P4 와 통합되어야 함 (충돌 방지).

---

## 3. TO-BE 요구사항

### 3.1 Web App Manifest

신규: `apps/web/public/manifest.webmanifest` (정적) **또는** `apps/web/src/app/manifest.ts` (Next.js Metadata API — `BASE_PATH` 동적 적용)

> **결정**: `manifest.ts` 사용. `BASE_PATH` 환경변수 inline 필요하므로 정적 파일 불가 (3개 환경 다른 prefix).

```ts
// apps/web/src/app/manifest.ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  const base = process.env.BASE_PATH ?? '';
  return {
    name: 'Fleet — Company Car Management',
    short_name: 'Fleet',
    description: 'Dispatch & cost control for company vehicles',
    start_url: `${base}/`,
    scope: `${base}/`,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0d10',  // matches --bg dark mode
    theme_color: '#3182f6',       // Toss accent blue
    lang: 'vi',
    dir: 'ltr',
    icons: [
      { src: `${base}/icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${base}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${base}/icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    categories: ['business', 'productivity'],
  };
}
```

### 3.2 Icons

신규: `apps/web/public/icons/`
- `icon-192.png` — 192×192 (any)
- `icon-512.png` — 512×512 (any)
- `icon-maskable-512.png` — 512×512 (maskable; safe zone center 80%)
- `apple-touch-icon-180.png` — 180×180 (iOS home screen)
- `favicon.ico` (이미 있다면 유지)

> 디자인 prototype 에 로고가 있을 수 있음 → `resources/claude-design/` 확인 후 export.
> 임시로는 텍스트 기반 (이니셜 "F") + Toss blue 배경의 generated PNG 사용 가능.

### 3.3 Root layout meta tags

수정: [apps/web/src/app/layout.tsx](../../apps/web/src/app/layout.tsx)

```ts
export const metadata: Metadata = {
  title: 'Fleet — Company Car Management',
  description: 'Dispatch & cost control for company vehicles',
  manifest: '/manifest.webmanifest',  // Next.js Metadata API auto-emits
  applicationName: 'Fleet',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Fleet',
  },
  themeColor: '#3182f6',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',  // iOS safe-area
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon-180.png',
  },
};
```

→ Next.js 15 가 자동으로 `<link rel="manifest">`, `<meta name="theme-color">`, `<link rel="apple-touch-icon">` 등 emit.

### 3.4 Service Worker

신규: `apps/web/public/sw.js` (정적 파일 — basePath 는 SW 코드 내부에서 동적 해결)

전략:
- **Install**: precache `offline.html`, root document shell
- **Activate**: clean old caches (`fleet-v1` → `fleet-v2`)
- **Fetch**:
  - Static `/_next/static/*` → cache-first (immutable)
  - `/icons/*`, `/manifest.webmanifest` → cache-first
  - Same-origin HTML navigation → network-first with offline fallback
  - Same-origin API (`/api/v1/*`) → network-only (no offline data in P5 shell phase; P5 의 offline expense cache 는 추후 phase)
  - Cross-origin (Google Maps Embed iframe 등) → bypass SW

신규: `apps/web/public/offline.html` (정적 페이지, i18n 미적용 — vi/en/ko 텍스트 모두 표시 또는 default vi)

→ P4 의 Web Push SW 와 통합: P4 가 이미 `sw.js` 를 추가했다면 본 작업이 push handler 와 합쳐야 함. **현재 P4 는 in-progress, 별도 sw.js 아직 없음 (확인됨)** → 본 작업이 sw.js 최초 추가, P4 가 위에 push handler 머지.

### 3.5 PWA install prompt

신규: `apps/web/src/components/pwa/install-prompt.tsx` (client component)
- `beforeinstallprompt` 캡처 → `localStorage` "pwa.installDismissed" 안 보면 banner 표시
- iframe 안 (window.self !== window.top) 에서는 비활성화
- iOS (no `beforeinstallprompt`) — 별도 instruction modal (`Share button → Add to Home Screen`)
- mount 위치: AppShell footer 또는 dashboard 페이지 상단

### 3.6 Service worker register

신규: `apps/web/src/components/pwa/sw-register.tsx` (client component, `'use client'`)
- `useEffect`: `navigator.serviceWorker.register('/sw.js' + basePath)`
- iframe 감지 후 skip
- 등록 실패 silent (no UI block)
- mount 위치: root layout (AppShell 바깥)

### 3.7 Safe-area utilities (iOS notch)

수정: [apps/web/tailwind.config.ts](../../apps/web/tailwind.config.ts)
- spacing 추가: `safe-top`, `safe-bottom`, `safe-left`, `safe-right` → `env(safe-area-inset-*)`

수정: [apps/web/src/components/layout/app-shell.tsx](../../apps/web/src/components/layout/app-shell.tsx) (또는 sidebar-nav)
- mobile bottom nav 가 있다면 `pb-safe-bottom`

> 확인 필요: 현재 mobile bottom nav 가 있는지. UI restyle 결과물 검토 — sidebar 만 있고 bottom nav 없음. iOS 홈 인디케이터는 dashboard `flex-1 overflow-auto` 영역 padding 으로 대응.

### 3.8 Middleware 확장

수정: [apps/web/src/middleware.ts](../../apps/web/src/middleware.ts)

```ts
const PUBLIC_PATHS = [
  '/api/v1/health',
  '/session-expired',
  '/dev-login',
  '/_next',
  '/favicon.ico',
  '/manifest.webmanifest',  // 신규
  '/sw.js',                  // 신규
  '/icons',                  // 신규 (prefix match)
  '/offline.html',           // 신규
];
```

### 3.9 next.config.mjs 헤더

수정: [apps/web/next.config.mjs](../../apps/web/next.config.mjs)

```ts
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: `frame-ancestors 'self' ${amaOrigin};` },
      ],
    },
    {
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
    {
      source: '/manifest.webmanifest',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=3600' },
        { key: 'Content-Type', value: 'application/manifest+json' },
      ],
    },
  ];
}
```

### 3.10 Internal link 수정

수정: [apps/web/src/app/(app)/trips/_components/trip-conflict-banner.tsx](../../apps/web/src/app/(app)/trips/_components/trip-conflict-banner.tsx#L62-L71)
- `target="_blank"` 제거 → 같은 탭에서 next/link 정상 동작
- 폼 context 손실 우려 → 클릭 전 `confirm()` 또는 unsaved-changes guard (별도 검토)

> **결정**: 일단 `target="_blank"` 제거. 폼 state 보존 필요 시 `sessionStorage` 활용 (별도 작업).

### 3.11 External Maps link 처리 (전략 B — Deep link)

수정: [map-preview.tsx](../../apps/web/src/components/inputs/map-preview.tsx#L91-L101), [map-route.tsx](../../apps/web/src/components/inputs/map-route.tsx#L227-L237)

신규 helper: `apps/web/src/lib/maps-deep-link.ts`

UA 기반 deep link URL builder. **Address-based** deep link (geocoding 불필요 — `geo:0,0?q=...` 와 `maps://?daddr=...` 모두 address 문자열 받음):

```ts
export function buildMapsUrl(opts: { origin: string; dest: string; waypoints?: string[]; ua: string }): string {
  const { origin, dest, waypoints = [], ua } = opts;
  const isIOS     = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);

  if (isIOS) {
    // comgooglemaps:// → 없으면 OS 가 browser fallback (maps:// 도 시도 가능하나 Apple Maps 강제)
    const params = new URLSearchParams({ saddr: origin, daddr: dest });
    if (waypoints.length) params.set('waypoints', waypoints.join('|'));
    return `comgooglemaps://?${params.toString()}&directionsmode=driving`;
  }

  if (isAndroid) {
    // geo: URI — Android intent picker 가 Google Maps, Waze 등에서 고를 수 있게
    // 경로 의도 명시: google.navigation:q=<dest> 도 가능하나 picker 못 띄움
    // waypoints 는 geo: URI 표준 없음 → 첫 stopover 만 query 에 fallback
    return `geo:0,0?q=${encodeURIComponent(dest)}`;
  }

  // Desktop / unknown — 기존 https URL
  const params = new URLSearchParams({ api: '1', origin, destination: dest, travelmode: 'driving' });
  if (waypoints.length) params.set('waypoints', waypoints.join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
```

UI 사용 (map-preview.tsx, map-route.tsx):
- `useEffect`로 client-side UA 감지 + URL 빌드 (SSR 안전: 초기 https URL, mount 후 deep link 으로 교체)
- mobile deep link 은 `target="_blank"` 불필요 (OS 가 앱 직접 호출). 단, fallback 으로 안전하게 유지
- Desktop 은 `target="_blank"` 유지

iOS deep link 동작:
- Google Maps 앱 설치 → `comgooglemaps://` URL 가 OS handler 잡음 → 앱 열림
- 미설치 → OS 가 "Cannot Open Page" → fallback 필요 → js 로 1초 후 `window.location = httpsUrl` (try/fallback 패턴)

Android `geo:` 동작:
- 시스템 intent picker → Google Maps, Waze 등 설치된 모든 maps 앱 노출
- 미설치 → no handler → 자동으로 browser 가 잡음 (https fallback 불필요)

> **결정**: iOS 는 fallback timer (3초 후 https 새창) 추가. Android 는 `geo:` 만으로 충분.

### 3.13 Trip 폼 sessionStorage 영속화

신규: `apps/web/src/hooks/use-form-persistence.ts`

```ts
export function useFormPersistence<T extends FieldValues>(
  form: UseFormReturn<T>,
  key: string,           // e.g. 'trip-new-form-draft'
  options?: { debounceMs?: number; exclude?: (keyof T)[] }
): void {
  // useEffect: form.subscribe → debounced sessionStorage.setItem(key, JSON.stringify(values))
  // useEffect mount: read sessionStorage.getItem(key) → form.reset(parsed)
  // cleanup: form.handleSubmit 성공 시 sessionStorage.removeItem(key)
}
```

수정: [apps/web/src/app/(app)/trips/new/new-trip-form.tsx](../../apps/web/src/app/(app)/trips/new/new-trip-form.tsx), [apps/web/src/app/(app)/trips/[id]/edit/edit-trip-form.tsx](../../apps/web/src/app/(app)/trips/[id]/edit/edit-trip-form.tsx)
- mount `useFormPersistence(form, 'trip-new-form-draft')` (new) / `trip-edit-form-draft-${tripId}` (edit)
- 제출 성공 시 자동 cleanup

→ Conflict banner 의 `target="_blank"` 제거로 인한 폼 state 손실 우려 해결. 사용자가 conflict 트립 보러 가도 돌아오면 폼 그대로 복원.

### 3.12 i18n 키 추가

수정: `apps/web/messages/{vi,en,ko}.json` — namespace `pwa` 신규 추가

```json
"pwa": {
  "installPrompt": "Cài đặt Fleet làm ứng dụng",
  "installPromptSub": "Truy cập nhanh từ màn hình chính, hoạt động ngoại tuyến.",
  "installButton": "Cài đặt",
  "installDismiss": "Để sau",
  "iosInstallTitle": "Cài đặt trên iPhone",
  "iosInstallStep1": "Bấm nút Chia sẻ",
  "iosInstallStep2": "Chọn \"Thêm vào màn hình chính\"",
  "offlineTitle": "Mất kết nối mạng",
  "offlineMessage": "Vui lòng kiểm tra kết nối và thử lại.",
  "offlineRetry": "Thử lại",
  "opensInBrowser": "Mở trong trình duyệt"
}
```

→ vi/en/ko 모두 3개 파일에 동일 키 추가.

### 3.13 Offline fallback

신규: `apps/web/public/offline.html` (정적, vi/en/ko 다국어 inline)
- SW fetch 에서 navigation 실패 시 이 페이지 반환
- `<button onclick="location.reload()">` retry

---

## 4. 갭 분석

### 4.1 변경 범위 요약표

| 영역 | 현재 | 변경 | 영향도 |
|---|---|---|---|
| PWA Manifest | 없음 | `app/manifest.ts` 신규 | Low — 새 라우트, 기존 영향 없음 |
| Service Worker | 없음 | `public/sw.js` + register 컴포넌트 | Medium — fetch 가로채기, 캐시 키 충돌 위험 |
| Layout meta | title + desc 만 | manifest, apple-web-app, theme-color, viewport-fit 추가 | Low — Next.js Metadata API 자동 emit |
| Middleware PUBLIC_PATHS | 5 entries | +4 (manifest, sw.js, icons, offline) | Low — 명확한 prefix match |
| next.config.mjs headers | CSP 1개 | +sw.js + manifest headers | Low |
| Tailwind config | 기본 spacing | +safe-area utilities | Low — additive |
| `target="_blank"` 제거 | 3곳 | 1곳 제거 (#3), 2곳 hint 추가 (#1,#2) | Low |
| i18n keys | 614 keys | +13 keys × 3 lang | Low — additive |
| Icons | 없음 | 4 PNG 신규 (192, 512, maskable, apple) | Low — 정적 자산 |

### 4.2 파일 변경 목록

#### 신규 (NEW)
| 파일 | 용도 |
|---|---|
| `apps/web/src/app/manifest.ts` | Next.js Metadata API → manifest.webmanifest emit |
| `apps/web/public/sw.js` | Service Worker |
| `apps/web/public/offline.html` | Offline fallback page |
| `apps/web/public/icons/icon-192.png` | PWA icon (any) |
| `apps/web/public/icons/icon-512.png` | PWA icon (any) |
| `apps/web/public/icons/icon-maskable-512.png` | PWA icon (maskable) |
| `apps/web/public/icons/apple-touch-icon-180.png` | iOS home screen icon |
| `apps/web/src/components/pwa/sw-register.tsx` | SW register client component |
| `apps/web/src/components/pwa/install-prompt.tsx` | beforeinstallprompt UI |
| `apps/web/src/components/pwa/use-display-mode.ts` | hook: PWA standalone 감지 |

#### 수정 (MODIFY)
| 파일 | 변경 내용 |
|---|---|
| `apps/web/src/app/layout.tsx` | Metadata + `<SWRegister />` mount |
| `apps/web/src/app/(app)/layout.tsx` 또는 app-shell.tsx | `<InstallPrompt />` mount |
| `apps/web/src/middleware.ts` | PUBLIC_PATHS 4개 추가 |
| `apps/web/next.config.mjs` | headers — sw.js + manifest |
| `apps/web/tailwind.config.ts` | safe-area spacing utilities |
| `apps/web/src/app/(app)/trips/_components/trip-conflict-banner.tsx` | `target="_blank"` 제거 |
| `apps/web/src/components/inputs/map-preview.tsx` | external 링크 hint 추가 |
| `apps/web/src/components/inputs/map-route.tsx` | external 링크 hint 추가 |
| `apps/web/messages/vi.json` | `pwa` namespace 추가 |
| `apps/web/messages/en.json` | 동일 |
| `apps/web/messages/ko.json` | 동일 |

### 4.3 DB 마이그레이션 전략

**없음.** P5 shell 단계는 DB 변경 0. (PWA push subscription 테이블은 P4 작업 — 별도 REQ.)

### 4.4 새 NPM 의존성

**없음** (목표). next-pwa 등 추가 없이 manual SW + Next.js Metadata API 만 사용 → 번들 사이즈 추가 최소, 학습 곡선 최소.

---

## 5. 사용자 플로우

### 5.1 PWA 설치 플로우 (Android Chrome)

```
User opens https://apps.amoeba.site/app-car-manager-v2 in Chrome
   │
   ▼
Chrome detects valid manifest + SW + HTTPS → fires `beforeinstallprompt`
   │
   ▼
<InstallPrompt> banner appears (after 30s engagement or immediate)
   │
   ├─ User clicks "설치"
   │     │
   │     ▼
   │  promptEvent.prompt() → native install dialog
   │     │
   │     ├─ Accept → app installed on home screen (standalone)
   │     └─ Dismiss → localStorage flag set, banner hidden 30d
   │
   └─ User clicks "나중에"
         └─ localStorage flag → banner hidden 7d
```

### 5.2 PWA 설치 플로우 (iOS Safari)

iOS 는 `beforeinstallprompt` 미지원 → 수동 instruction.

```
<InstallPrompt> 가 UA 에서 iOS 감지 → "iOS 설치 안내" modal 모드
   │
   ▼
Modal 표시:
   1. Safari 하단 [공유] 버튼 탭
   2. "홈 화면에 추가" 선택
   │
   ▼
User 따라서 수행 → app icon 홈 화면에 추가됨 → 탭하면 standalone 모드
```

### 5.3 Offline 플로우

```
User has app open, network drops
   │
   ▼
User taps "Trips" link
   │
   ▼
SW intercepts navigation request → fetch fails
   │
   ▼
SW returns /offline.html → user sees offline page with "재시도" 버튼
   │
   ▼
User taps 재시도 → location.reload() → if network back → normal flow
```

### 5.4 Trip Conflict 링크 (수정 후)

```
Admin 새 trip 생성 폼 작성 중
   │
   ▼
Conflict banner 표시: "Vehicle 51K-238 충돌: TRIP-0042"
   │
   ▼
Admin taps TRIP-0042 링크
   │  (현재: target="_blank" → PWA 에서 외부 브라우저로 튕김 ❌)
   │  (수정: 같은 탭에서 /trips/TRIP-0042 로 이동 ✅)
   ▼
trip detail 페이지 표시 (PWA standalone 유지)
   │
   ▼
Admin 뒤로가기 → 폼 page 로 돌아옴
   │  (폼 state 휘발 — 별도 폼 가드 작업 향후)
```

### 5.5 Google Maps 외부 링크 (수정 후)

```
Driver trip 화면, map fullscreen 링크 탭
   │
   ▼
<a target="_blank" rel="noreferrer">
   ▼
PWA standalone 감지 → toast: "Google Maps 가 브라우저에서 열립니다"
   │
   ▼
브라우저(Chrome/Safari) 에서 maps.google.com/dir/... 열림
   │
   ▼
Driver 뒤로가기 → OS task switcher 로 PWA 복귀
```

---

## 6. 기술 제약사항

### 6.1 호환성

| 기능 | iOS Safari | Android Chrome | Desktop Chrome/Edge | Firefox |
|---|---|---|---|---|
| Web App Manifest | ✅ 16.4+ | ✅ | ✅ | ✅ |
| Service Worker | ⚠️ 캐시 50MB 제한 | ✅ | ✅ | ✅ |
| `beforeinstallprompt` | ❌ | ✅ | ✅ | ❌ (수동) |
| Add to Home Screen | ⚠️ 수동 (공유 메뉴) | ✅ | ✅ | ⚠️ desktop only |
| `display: standalone` | ✅ | ✅ | ✅ | ✅ |
| safe-area-inset CSS | ✅ | ✅ (notch 폰만) | N/A | ⚠️ partial |

### 6.2 성능

- SW 캐시 전략 — Network-first HTML 은 첫 byte 까지 대기 → fallback 시까지 3초 timeout 적용
- precache 사이즈 최소 (오프라인 폴백 페이지만) — 첫 SW install 빠르게
- icon PNG 들 최적화 (192/512 각 ~10KB 목표)

### 6.3 보안

- SW scope `/` (전체 origin)
- `Service-Worker-Allowed: /` 헤더 필수
- HTTPS 강제 (staging/prod 모두 nginx 가 SSL terminate)
- localhost SW: Chrome 은 localhost 예외 허용 ✅
- manifest 가 leak 하는 정보: app name + colors + icons 만 (민감 정보 없음)
- AMA JWT 토큰은 HttpOnly cookie — SW 가 자동으로 동봉 (별도 처리 불필요)

### 6.4 iframe 제약

- iframe 안의 SW: scope 가 iframe URL 로 제한 → install prompt 의미 없음, register 도 skip
- 감지 방법: `window.self !== window.top`
- AMA 가 항상 iframe 으로 임베드 → install 은 top-level navigation 이용 시에만 (사용자가 직접 https://apps.amoeba.site/app-car-manager-v2 방문)

### 6.5 BASE_PATH 처리

- `BASE_PATH` 가 `/app-car-manager-v2` 인 staging 에서:
  - manifest `start_url`, `scope` → `/app-car-manager-v2/`
  - sw.js register → `navigator.serviceWorker.register('/app-car-manager-v2/sw.js', { scope: '/app-car-manager-v2/' })`
  - icon paths → `${BASE_PATH}/icons/icon-192.png`
- Next.js Metadata API 가 자동으로 `basePath` 를 prefix 함 (`Next.js 14+` 동작 확인됨) — manifest.ts 내부에서 명시 prefix 불필요
- SW register 코드 는 runtime 에 `document.baseURI` 또는 `process.env.BASE_PATH` 클라이언트 inline 필요

### 6.6 P4 (Web Push) 와 의존성

- P4 가 sw.js 에 push handler 추가 예정
- 본 작업이 sw.js 의 골격 (install/activate/fetch) 을 만든 후 P4 가 동일 파일에 push event listener 추가
- 충돌 방지: 본 작업의 sw.js 에 push handler placeholder (`self.addEventListener('push', () => {})`) 미포함 — P4 가 책임

### 6.7 권한 / 인증

- manifest.webmanifest, sw.js, icons, offline.html → middleware PUBLIC_PATHS 추가 (auth bypass)
- 단, sw.js 가 fetch handler 에서 인증 cookie 전달 시 정상 인증된 요청 처리됨 (별도 처리 불필요)

### 6.8 PRD 정합성

- PRD §1.2 Driver 모바일 우선 ✅ (install prompt Driver 에게 우선 노출 가능)
- PRD §6.5 R3 Web Push (P4 영역) — 본 작업 sw.js 가 P4 와 통합 가능 구조 보장 ✅
- PRD NFR-1 (성능): SW precache 최소화로 첫 로딩 영향 없음 ✅
- PRD NFR-8 (접근성): install prompt aria-label, 키보드 dismiss 가능 ✅

---

## 7. Open Questions

| # | 질문 | 제안 답변 |
|---|---|---|
| Q1 | Maps 외부 링크 전략 A vs B? | ✅ **B 채택** — UA 기반 deep link (iOS `comgooglemaps://`, Android `geo:`), iOS fallback timer 추가 |
| Q2 | Install prompt 전 engagement 조건? | 단순화: 첫 방문 즉시 (Android), iOS 는 별도 도움말 메뉴 진입 시만 |
| Q3 | Offline page 의 i18n? | inline 3개 언어 (서버 i18n 미접근, locale cookie 만 client 측 읽기) |
| Q4 | Icon 디자인? | ✅ **"F" + Toss blue 임시 생성** (사용자 확인). designer 가 정식 로고 제공 시 교체 |
| Q5 | install dismissal 기간? | "나중에" → 7일, "X 닫기" → 30일 |
| Q6 | iframe 내부에서 SW register 시도? | 안함 — `window.self !== window.top` 시 skip |
| Q7 | trip-conflict-banner 의 폼 state 보존? | ✅ **본 P5 에 통합** (R13 추가) — sessionStorage auto-draft + restore |
| Q8 | next-pwa 같은 라이브러리? | 미사용 — 코드량 적음, 학습 곡선 낮음, 의존성 추가 X |

---

## 8. Risks

| Risk | 영향 | 완화 |
|---|---|---|
| SW 버그로 모든 페이지 무한 캐시 | 사용자가 업데이트 못 받음 | 명확한 cache version (`fleet-v1`) + activate 시 old cache 삭제 + `Cache-Control: no-cache` for sw.js (재배포 시 즉시 새 SW pickup) |
| BASE_PATH 잘못 prefix 되어 manifest 깨짐 | install 안 됨 | dev/staging 에서 manifest URL 직접 fetch 검증 (TC) |
| iframe 안 install prompt 노출 → 사용자 혼란 | UX 저하 | `window.self !== window.top` 감지 후 skip |
| iOS 16.3 이하 사용자가 manifest 못 읽음 | iOS PWA 미지원 | 점진적 노출 — fallback 으로 그냥 웹앱 사용 (회귀 없음) |
| trip conflict 링크 같은 탭 이동 → 폼 데이터 손실 | UX 저하 | 본 REQ 에서 미해결. 별도 폼 가드 작업으로 분리 |
| Google Maps 새창 → AMA iframe 내부에서 동작 이상 | iframe + window.open 충돌 | rel="noopener noreferrer" 필수, target="_blank" 유지 |

---

## 9. 완료 정의 (Definition of Done)

- [ ] `/manifest.webmanifest` 가 dev/staging 에서 200 + JSON 반환
- [ ] Chrome DevTools → Application → Manifest 에서 "Installable" 표시
- [ ] Chrome DevTools → Application → Service Workers 에서 "activated and is running"
- [ ] Lighthouse PWA 점수 ≥ 90
- [ ] Android Chrome 에서 install prompt 노출 → install → 홈 화면 아이콘 → standalone 실행 확인
- [ ] iOS Safari 16.4+ 에서 "홈 화면에 추가" → standalone 실행 확인
- [ ] 오프라인 모드 (DevTools network throttling = Offline) → `/offline.html` 폴백 표시
- [ ] trip-conflict-banner 의 conflict 링크 → 같은 탭에서 이동 (PWA standalone 환경에서)
- [ ] Google Maps fullscreen 링크 → 새창 + toast hint (PWA standalone 환경에서)
- [ ] iframe 안 (AMA passthrough) 에서 install prompt 미노출, SW register skip
- [ ] vi/en/ko 3개 언어 `pwa.*` 키 모두 채워짐
- [ ] middleware PUBLIC_PATHS 에 manifest, sw.js, icons, offline 추가 — 미인증 상태에서도 manifest fetch 200 확인
- [ ] TR-20260519-pwa-setup-p5.md 작성
- [ ] RPT-20260519-pwa-setup-p5.md 작성

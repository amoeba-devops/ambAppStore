---
document_id: REQ-20260529-debug-context-panel
version: 1.0.0
status: Draft (검토 단계 — 도입 결정 게이트 포함)
created: 2026-05-29
author: 김익용 (Gray)
related:
  - /Users/gray/Documents/Claude/Projects/app-academy/frontend-acm/src/components/common/debug-context-panel.tsx
  - apps/app-car-manager-v2/apps/web/middleware.ts
  - apps/app-car-manager-v2/apps/web/src/lib/auth/get-current-user.ts
  - apps/app-car-manager-v2/apps/web/src/app/dev-login/route.ts
---

# app-car-manager-v2 — Debug Context Panel 도입 검토

## 1. 요구사항 요약

| # | 요구사항 | 유형 | 우선순위 |
|---|---------|------|---------|
| R-1 | app-academy의 `DebugContextPanel` 과 동등한 AMA SSO 디버깅 패널을 app-car-manager-v2 에 도입한다 | 기능 | P0 (검토) |
| R-2 | dev/staging 환경에서만 활성화되고 production 에서는 **절대 렌더링되지 않는다** | 보안 | P0 |
| R-3 | 패널은 다음을 표시한다: Referrer · URL query · `?ama_token=` 원본·디코드 · 현재 user context (`ent_id`, `userId`, `role`) · `amb_session` cookie 메타 | 기능 | P0 |
| R-4 | i18n 4 locale 지원 (next-intl ko/en/vi/zh-CN) | UX | P1 |
| R-5 | 토글 가능 (펼치기/접기), JWT/Cookie 복사 버튼 | UX | P1 |
| R-6 | app-academy 와 동일 UX 패턴 (노란색 dashed border, lucide-react Bug 아이콘) | UX | P2 |

---

## 2. AS-IS 현황 분석

### 2.1 app-academy 의 DebugContextPanel (이식 원본)

| 항목 | 값 |
|------|---|
| 위치 | `frontend-acm/src/components/common/debug-context-panel.tsx` |
| 프레임워크 | React 18 + Vite SPA |
| 토큰 접근 | `localStorage` + URL query (`?ama_token=`) → 클라이언트 JS 가 직접 디코드 |
| JWT 디코드 | 컴포넌트 내장 (`decodeJwtPayload`, base64 수동 파싱) |
| i18n | `react-i18next` `useTranslation('auth')` — `debug.*` 키 (`locales/{ko,en,vi}/auth.json`) |
| UI 의존 | Tailwind + lucide-react (`Bug`, `ChevronDown/Up`, `Copy`, `Check`) |
| 활성화 조건 | **없음** (항상 렌더링) — props 만으로 작동 |
| 백엔드 의존 | 없음 (로컬 디코드 only) |
| 임베드 위치 | `login-page.tsx:154, 232` — AMA 토큰 교환 중·전체 폼 위 |

### 2.2 app-car-manager-v2 의 인증 구조 (이식 대상)

| 항목 | 값 |
|------|---|
| 프레임워크 | **Next.js 15 (App Router) + React 19** |
| 토큰 저장 | **HttpOnly cookie** (`amb_session`) — 클라이언트 JS 접근 불가 |
| `?ama_token=` 처리 | `middleware.ts:35-50` 에서 서버 사이드 검증 후 cookie 발급 → URL 정리 후 리다이렉트 |
| JWT 검증 | `jose.jwtVerify()` + Zod `amaJwtClaimsSchema.parse()` (server only) |
| 사용자 context 전파 | middleware 가 헤더로 전달: `x-ent-id`, `x-user-id`, `x-user-role` (`middleware.ts:61-64`) |
| 현재 사용자 획득 | `getCurrentUser()` — Server Component 에서 `headers()` 로 읽음 (`lib/auth/get-current-user.ts:22-38`) |
| i18n | **next-intl** (vi/en/ko/zh-CN 4 locale) — `messages/{locale}.json` |
| UI 의존 | shadcn/ui + lucide-icons + Tailwind 3 |
| 디버그 도구 | `dev-login/route.ts` (DEMO_AUTO_LOGIN flag) + `format-action-error.ts` 만 존재. **debug panel 없음** |
| 표준 에러 | `CAR-E{4자리}` prefix + `ActionResult<T>` 응답 형태 |
| 라우터 가드 | 별도 컴포넌트 없음 — middleware 레벨 보호 |

### 2.3 두 환경의 본질적 차이

| 측면 | app-academy | app-car-manager-v2 |
|------|------------|-------------------|
| **JWT 원본 접근** | localStorage → JS 직접 | HttpOnly cookie → **JS 차단** |
| **렌더링 시점** | CSR (Vite SPA) | RSC + CSR 혼합 (Next.js App Router) |
| **i18n 라이브러리** | react-i18next | next-intl |
| **dev/prod 구분** | 없음 (코드 상수) | `process.env.NODE_ENV` + `DEMO_AUTO_LOGIN` 명확 |
| **보안 정책** | 클라이언트 토큰 노출 OK | 클라이언트 토큰 노출 금지 (HttpOnly) |

### 2.4 문제점 / 도입 시 도전 과제

| # | 문제 | 영향 |
|---|------|------|
| P-1 | **HttpOnly cookie 라 클라이언트가 JWT 원본을 읽을 수 없음** | 패널이 JWT 원본·디코드 표시 불가 (단순 복사 시 빈 값) |
| P-2 | 단순 이식 시 production 에 노출 위험 (활성화 조건 없음) | 사용자 토큰·entity 노출 보안 사고 |
| P-3 | i18n 라이브러리 다름 → 번역 키 구조 재설계 필요 | 번역 파일 3~4개 갱신 |
| P-4 | Server / Client 컴포넌트 경계 (Next.js) | "use client" 지시어 + 서버에서 props 주입 패턴 필요 |

---

## 3. TO-BE 요구사항

### 3.1 활성화 게이팅 (필수)

```ts
const debugEnabled =
  process.env.NODE_ENV !== 'production' ||
  process.env.DEBUG_PANEL_ENABLED === 'true';
```

- **dev**: 항상 활성
- **staging**: `DEBUG_PANEL_ENABLED=true` 명시 시에만
- **production**: **불가능** — 환경변수 잠금 + 빌드 시점 tree-shake 권장

### 3.2 표시 정보 (HttpOnly cookie 제약 반영)

| 카테고리 | 값 | 출처 |
|---------|---|------|
| **Referrer** | `document.referrer` | Client (browser) |
| **URL Query** | `window.location.search` | Client (browser) |
| **세션 정보** | `ent_id`, `userId`, `role` | Server → Client props (`getCurrentUser()` 결과) |
| **Cookie 메타** | `amb_session` 존재 여부, 발급 시각, exp 까지 남은 초 | Server → Client props (`cookies()` 헤더 파싱) |
| **JWT 원본** | URL `?ama_token=` 쿼리 (있을 때만) — middleware 가 정리하기 *전* | Client (mount 시점 캐치) |
| **JWT 디코드 claims** | `sub`, `email`, `entityId`, `appCode`, `scope`, `exp` | URL `?ama_token=` 이 있을 때 클라이언트에서 디코드, 또는 서버 props 로 전달 |
| **마지막 에러** | `CAR-E*` 코드 + 메시지 (있다면) | URL `?error=` 또는 Server props |

### 3.3 컴포넌트 구조 (TO-BE)

```
apps/app-car-manager-v2/apps/web/src/components/dev/
├── debug-context-panel.tsx        # "use client" 컴포넌트 (UI 토글, 복사)
├── debug-context-provider.tsx     # Server Component — props 모으기 → Panel 렌더 (NODE_ENV 게이팅)
└── decode-jwt.ts                  # base64 디코드 유틸 (app-academy 에서 그대로 가져옴)

apps/app-car-manager-v2/apps/web/messages/
├── ko.json    # "debug.title", "debug.referer", ... 추가
├── en.json
├── vi.json
└── zh-CN.json
```

### 3.4 임베드 위치 (선택지)

| 옵션 | 설명 | 장단점 |
|------|------|-------|
| **A. 로그인 페이지만** | `/login` 또는 `dev-login` 응답 후 redirect 화면에만 표시 | ✅ AMA SSO 디버깅 본래 목적 부합<br>❌ 로그인 후 세션 디버깅 불가 |
| **B. 전역 floating widget** | `layout.tsx` 에 floating button (우하단), 클릭 시 패널 expand | ✅ 모든 페이지에서 사용 가능<br>❌ UI 간섭 가능, 보안 노출 면 ↑ |
| **C. 별도 `/debug` 라우트** | 패널을 페이지로 분리, 즐겨찾기로 접근 | ✅ 명시적, 안전<br>❌ 인라인 디버깅 불가 |
| **D. A + B 혼합** | 로그인 페이지엔 항상, 그 외엔 floating | ✅ 균형<br>❌ 코드 복잡도 ↑ |

→ **권고: 옵션 A** (로그인 페이지만) — app-academy 와 일관, 보안 면적 최소

### 3.5 i18n 키 (next-intl)

```json
// messages/ko.json (en/vi/zh-CN 동일 스키마)
{
  "debug": {
    "title": "디버그 컨텍스트",
    "referer": "Referrer",
    "queryParams": "URL Query",
    "session": "세션 정보",
    "cookie": "쿠키",
    "amaToken": "AMA 토큰",
    "amaTokenPayload": "디코드된 Payload",
    "lastError": "마지막 에러",
    "copy": "복사",
    "copied": "복사됨",
    "expand": "펼치기",
    "collapse": "접기"
  }
}
```

---

## 4. 갭 분석

### 4.1 변경 범위

| 영역 | 현재 | 변경 | 영향도 |
|------|------|------|--------|
| 프론트엔드 컴포넌트 | 없음 | 신규 3 파일 (`debug-context-panel`, `debug-context-provider`, `decode-jwt`) | Medium |
| i18n 메시지 | 4 locale 기존 | `debug.*` 키 11개씩 추가 | Low |
| 로그인 페이지 | 표준 폼 | DebugContextProvider 임베드 (Server Component 1 라인) | Low |
| 환경변수 | `DEMO_AUTO_LOGIN` | `DEBUG_PANEL_ENABLED` 추가 (staging 옵션) | Low |
| 빌드 | — | tree-shake 검증 (production 번들에서 panel 제거 확인) | Low |
| Server actions / API | 변경 없음 | — | None |
| DB / 마이그레이션 | 변경 없음 | — | None |

### 4.2 변경 파일 목록

#### 신규

| # | 파일 | 종류 |
|---|------|------|
| 1 | `apps/web/src/components/dev/debug-context-panel.tsx` | Client Component |
| 2 | `apps/web/src/components/dev/debug-context-provider.tsx` | Server Component (게이팅) |
| 3 | `apps/web/src/components/dev/decode-jwt.ts` | 유틸 |

#### 수정

| # | 파일 | 변경 내용 |
|---|------|----------|
| 1 | `apps/web/src/app/(public)/login/page.tsx` (또는 동등) | `<DebugContextProvider />` 임베드 1 라인 |
| 2 | `apps/web/messages/ko.json` | `debug.*` 키 추가 |
| 3 | `apps/web/messages/en.json` | 동일 |
| 4 | `apps/web/messages/vi.json` | 동일 |
| 5 | `apps/web/messages/zh-CN.json` | 동일 |
| 6 | `.env.example` (있다면) | `DEBUG_PANEL_ENABLED=false` 라인 추가 |

### 4.3 DB 마이그레이션

**없음**. UI/dev 전용 작업.

### 4.4 외부 영향

- production 빌드: tree-shake 로 `DebugContextPanel` 컴포넌트 자체가 번들에서 제거되어야 함 → Next.js dynamic import + `process.env` 분기로 구현

---

## 5. 사용자 플로우

### 5.1 dev 환경 (NODE_ENV=development)

```
[ 개발자: /login?ama_token=<JWT>&locale=ko 접근 ]
        │
        │ middleware.ts: ama_token 감지 → cookie 발급 → /login 으로 redirect (URL 정리)
        ▼
[ /login 페이지 렌더 ]
        │
        │ Server: DebugContextProvider
        │   - NODE_ENV !== 'production' → enabled
        │   - getCurrentUser() → ent_id, userId, role
        │   - cookies().get('amb_session') → exp 까지 남은 시간
        │   - Pass props to <DebugContextPanel />
        ▼
[ <DebugContextPanel /> (client) ]
        │
        ├─ Referrer / Query / Session / Cookie / Error 섹션 표시
        ├─ 토글 펼치기/접기
        ├─ 복사 버튼 (cookie value 는 표시 안 함, ent_id 등은 복사 가능)
        ▼
[ 개발자 자체 시나리오 디버깅 진행 ]
```

### 5.2 staging 환경 (DEBUG_PANEL_ENABLED=true)

dev 와 동일 — 단 활성화는 명시적 env 설정 시에만.

### 5.3 production 환경

```
[ 일반 사용자: /login 접근 ]
        │
        │ Server: DebugContextProvider
        │   - NODE_ENV === 'production' && DEBUG_PANEL_ENABLED !== 'true'
        │   - return null (또는 dynamic import skip)
        ▼
[ Panel 렌더 안 됨 — 사용자에게 노출 없음 ]
```

---

## 6. 기술 제약사항

### 6.1 보안

- HttpOnly cookie 값 자체는 클라이언트로 절대 노출 금지
- JWT claims 는 dev/staging 에서만 노출 가능 (`exp`, `iat`, `sub`, `entityId` 등은 디버깅에 필요)
- production 빌드 시 `DebugContextPanel` 코드가 번들에서 완전 제거되어야 (tree-shake or `next/dynamic` 분기)

### 6.2 호환성

- Next.js 15 / React 19 RSC 패턴: Client/Server boundary 명확 분리
- next-intl 14.x ← 메시지 키 추가만, locale 정적 import 영향 없음
- shadcn/ui · lucide-react 의존 (이미 설치)

### 6.3 성능

- production 에선 영향 0 (코드 제거)
- dev 에선 첫 렌더 시 JWT decode 1회 (수십 µs) — 무시 가능

### 6.4 비범위 (Non-goals)

- N-1: Floating 전역 위젯 (옵션 B/D) — 본 REQ 에서 제외, 후속 검토
- N-2: 로그인 후 세션 상태 변경 시 실시간 업데이트 (WebSocket / SSE) — 정적 mount 시점 스냅샷
- N-3: 백엔드 에러코드 catalog API (`/api/v1/error-codes`) — 별건
- N-4: app-academy 와 정확히 동일 UI 픽셀 매칭 — 의미 전달 우선

---

## 7. 옵션 비교 (검토 결과)

| 옵션 | 작업량 | 디버깅 가치 | 보안 위험 | 추천도 |
|------|--------|-----------|----------|--------|
| **단순 이식** (app-academy 코드 그대로 복사) | 1h | ❌ JWT 원본 표시 불가 (HttpOnly cookie 제약) | 🔴 활성화 게이트 없음 — production 위험 | ❌ 비추 |
| **적응 이식** (Server Component 게이팅 + 헤더 기반 context) | **4~6h** | ✅ ent_id/role/cookie 메타/URL ama_token 모두 표시 | ✅ NODE_ENV + DEBUG_PANEL_ENABLED 이중 게이트 | ✅ **권장** |
| **간소화** (URL query + Referrer 만 표시) | 1h | ⚠️ 가장 흔한 SSO 진입 추적은 가능, 세션 정보 부재 | ✅ 노출 정보 최소 | △ 차선책 |
| **미도입** | 0 | — AMA SSO 진입 디버깅 시 매번 console.log/cookie 수동 확인 | — | ❌ 비추 (반복적 디버깅 비용) |

---

## 8. 권고안

**적응 이식**(옵션 2) 으로 진행할 것을 권장합니다.

### 근거

1. **AMA SSO 진입 디버깅 가치**: app-academy 사례에서 이미 검증됨 (referer/query/JWT 추적이 토큰 교환 실패 원인 1차 분석에 결정적)
2. **car-manager-v2 의 보안 제약 반영 가능**: Server Component 게이팅 + HttpOnly cookie 우회 패턴 명확
3. **재사용 가치**: 다른 앱(app-hscode-manager 등)에도 동일 패턴 확장 가능 — 패키지화 검토 여지
4. **작업 비용 합리적**: 4~6시간 — 분석/계획/구현/테스트 포함

### 우려 사항 (사전 합의 필요)

- **production tree-shake 검증**: `next build` 결과 번들에서 컴포넌트가 완전 제거되는지 확인 필요. 만약 잔존 시 dynamic import 패턴 추가 적용
- **JWT 원본 표시 정책**: `?ama_token=` 이 URL 에 보이는 짧은 순간(middleware 가 정리하기 전)에만 캐치. 캐치 후 즉시 client-only state 로 저장 (localStorage 미사용)
- **i18n 작업량**: 4 locale × 11 키 = 44 번역 단위 — 영어 외 vi/zh-CN 은 자동 번역 또는 임시 영문 후 사용자 검수

---

## 9. 결정 게이트 (사용자 입력 필요)

다음 항목에 대해 결정해주시면 PLN(작업계획서) → TC(테스트케이스) 단계로 진행하겠습니다.

| # | 결정 항목 | 옵션 |
|---|----------|------|
| D-1 | **도입 여부** | (a) 적응 이식 진행 / (b) 간소화 버전만 / (c) 미도입 / (d) 후속 검토 |
| D-2 | **임베드 위치** | (A) 로그인 페이지만 / (B) 전역 floating / (C) 별도 `/debug` 라우트 / (D) A+B 혼합 |
| D-3 | **환경 활성화 정책** | (a) dev only / (b) dev + staging(DEBUG_PANEL_ENABLED=true) / (c) prod 포함 시크릿 게이트 |
| D-4 | **JWT 원본 표시** | (a) URL 쿼리 캡처 시점만 / (b) 표시 안 함 (디코드 claims 만) |
| D-5 | **i18n 번역 우선순위** | (a) 4 locale 모두 / (b) ko + en 만, 나머지는 영문 fallback |

기본 권고 묶음(권장 진행안):
- D-1 (a) 적응 이식
- D-2 (A) 로그인 페이지만
- D-3 (b) dev + staging
- D-4 (a) URL 쿼리 캡처 시점만
- D-5 (a) 4 locale 모두

위 권고대로 진행하시면 PLN/TC 작성 즉시 착수하겠습니다.

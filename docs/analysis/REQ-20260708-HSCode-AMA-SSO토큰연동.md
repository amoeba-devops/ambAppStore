# 요구사항분석서 — HS Code Manager AMA SSO 토큰 연동 (401 인증 누락 수정)

- **문서 ID**: REQ-20260708-HSCode-AMA-SSO토큰연동
- **작성일**: 2026-07-08
- **대상 앱**: HS Code Manager (`/app-hscode`)
- **유형**: 버그 수정 / 인증 기능 누락
- **관련 증상**: `stg-apps.amoeba.site/app-hscode/api/v1/excel/classify` → **HTTP 401**

---

## 1. 요구사항 요약

| # | 요구사항 | 유형 |
|---|----------|------|
| R1 | AMA iframe 진입 시 전달되는 `ama_token`(JWT)을 프론트엔드가 수신·저장하여 API 호출에 `Authorization: Bearer` 헤더로 첨부한다 | 버그/필수 |
| R2 | 토큰 저장 후 모든 `@Auth()` 보호 엔드포인트(excel/classify 포함)가 401 없이 정상 동작한다 | 버그/필수 |
| R3 | 토큰 미존재/만료/부적합 시 명확한 안내 화면을 표시하고, 미구독 Entity는 플랫폼 앱 상세로 유도한다 | 기능 |
| R4 | 토큰 처리 완료 전까지 앱 본문 렌더링을 게이팅하여 인증 전 API 호출(=401)을 방지한다 | 기능 |
| R5 | 기존 car-manager SSO 패턴과 일관된 구조로 구현한다(유지보수성) | 비기능 |

> **핵심**: excel/classify 401은 특정 엔드포인트 결함이 아니라 **HS Code 프론트엔드에 AMA SSO 토큰 수신 로직이 통째로 누락**되어 발생하는 전역 인증 실패다.

---

## 2. AS-IS 현황 분석

### 2.1 백엔드 (인증 강제는 정상)

| 항목 | 파일 | 내용 |
|------|------|------|
| 전역 JWT 가드 | `apps/app-hscode-manager/backend/src/auth/guards/jwt-auth.guard.ts` | `JwtAuthGuard`(passport-jwt) 전역 적용. `@Public()`만 해제. Bearer 토큰 없거나 서명 불일치/만료 시 **401** |
| classify 엔드포인트 | `.../domain/excel/controller/excel.controller.ts:57-67` | `@Auth()` + `@Post('classify')`. `@CurrentUser('entityId')`로 `ent_id` 사용 |
| 토큰 검증 | `.../auth/jwt.strategy.ts:9-14` | `ExtractJwt.fromAuthHeaderAsBearerToken()`, `secretOrKey: process.env.JWT_SECRET \|\| 'default-secret'` |
| ent_id 격리 | `.../auth/guards/entity-scope.guard.ts` | `@Auth()`에 포함. `user.entityId` 없으면 403 |

→ 백엔드는 **정상**. Bearer 토큰만 도착하면 통과. (단, `JWT_SECRET`이 AMA 서명 키와 일치해야 함 — 인프라 확인 사항)

### 2.2 프론트엔드 (근본 원인 — 토큰 수신 로직 부재)

| 항목 | 파일 | 현재 상태 | 문제점 |
|------|------|-----------|--------|
| API 클라이언트 | `frontend/src/lib/api-client.ts:17-23` | 요청 인터셉터가 `useAuthStore.getState().token`이 있을 때만 `Authorization: Bearer` 첨부 | token=null이면 헤더 미첨부 |
| Auth 스토어 | `frontend/src/stores/auth.store.ts:21` | `token: localStorage.getItem('hsc_token')` (초기값 null) | 저장소를 채우는 코드 없음 |
| `setAuth` | `frontend/src/stores/auth.store.ts:23-26` | 정의만 존재 | **프론트 전체에서 호출 0건** (`grep setAuth` → 정의만) |
| SSO 핸들러 | (없음) | — | `ama_token` 수신/디코드/게이팅 컴포넌트 자체가 없음 |
| 라우터 | `frontend/src/router.tsx` | `App` 레이아웃 하위에 페이지 직접 배치 | 인증 게이팅 래퍼 없음 |
| lib 디렉토리 | `frontend/src/lib/` | `api-client.ts`만 존재 | `ama-token.ts` 없음 |

**결론(증거 체인):**
1. `classify`는 `@Auth()`로 Bearer 강제 →
2. 프론트는 token 있을 때만 헤더 첨부 →
3. token은 `hsc_token` localStorage에서만 로드(초기 null) →
4. `setAuth`가 어디서도 호출되지 않음 →
5. token 영구 null → 헤더 미첨부 → **모든 `@Auth()` 엔드포인트 401** (classify는 사용자가 처음 부딪힌 것)

### 2.3 참조 — 정상 동작하는 car-manager 패턴

| 파일 | 역할 |
|------|------|
| `apps/app-car-manager/frontend/src/lib/ama-token.ts` | `getAmaTokenFromUrl()`, `decodeAmaToken()`, `validateReferrer()`, `isTokenExpired()`, `isValidAppCode()`, `checkSubscription()` |
| `apps/app-car-manager/frontend/src/App.tsx` → `AmaTokenHandler` | 게이팅 컴포넌트: URL `?ama_token` 추출 → clearAuth → referrer 검증(soft) → JWT 디코드 → appCode 검증 → 구독 확인 → `setAuth` + URL 정리 → 렌더링. 미구독 시 플랫폼 리다이렉트 |
| `apps/app-car-manager/frontend/src/stores/auth.store.ts` | `savedToken = localStorage.getItem('ama_token')`, `setAuth`가 localStorage 저장 + `isAuthenticated` 설정 |

### 2.4 플랫폼 구독 확인 API (재사용 가능)

- `GET /api/v1/platform/subscriptions/entity/:entId` — **Public** (`apps/platform/backend/src/platform-subscription/subscription.controller.ts:27`)
- 응답: `{ data: { apps: [{ appSlug, subscription: { status } }] } }`

---

## 3. TO-BE 요구사항

### 3.1 AS-IS → TO-BE 매핑

| # | 영역 | AS-IS | TO-BE |
|---|------|-------|-------|
| 1 | 토큰 수신 | 없음 | `ama-token.ts` 신규 — URL `ama_token` 파싱/디코드/검증 |
| 2 | 게이팅 | 없음 | `AmaTokenHandler` 신규 — 인증 완료 전 본문 렌더링 차단 |
| 3 | 스토어 | `setAuth` 미사용, `isAuthenticated` 없음 | `setAuth` 실사용, 토큰 payload로 `user` 구성 |
| 4 | 라우터 | `App` 직접 렌더 | `AmaTokenHandler`로 `App`을 래핑 |
| 5 | i18n | 인증/게이팅 문구 없음 | `hscode` 네임스페이스에 `auth.*` 키 추가 (ko/en/vi) |

### 3.2 신규 파일/구성

- `frontend/src/lib/ama-token.ts` — car-manager 이식 (APP_SLUG=`app-hscode`, appCode 변형=`['app-hscode','hscode']`)
- `frontend/src/components/auth/AmaTokenHandler.tsx` — 게이팅 컴포넌트
- `frontend/src/stores/auth.store.ts` — `isAuthenticated` 추가, `setAuth`에서 `user` 세팅
- `frontend/src/router.tsx` — `element: <AmaTokenHandler><App/></AmaTokenHandler>`
- i18n `auth.*` 키 (ko/en/vi)

### 3.3 비즈니스 로직 (AmaTokenHandler)

```
mount:
  ama_token = URL.searchParams.get('ama_token')
  if !ama_token:
     기존 localStorage 토큰으로 통과 (ready=true)   ← 새로고침/재진입 지원
  else:
     clearAuth()
     locale 적용 (i18n.changeLanguage)
     referrer 검증 (soft: 빈 referrer 허용)
     payload = decode(ama_token); null/만료/appCode불일치 → 에러화면
     status = checkSubscription(payload.entityId, 'app-hscode')
     if status !== 'ACTIVE': 플랫폼 앱 상세로 리다이렉트 (soft 옵션 검토)
     setAuth(ama_token, user)  // localStorage 'hsc_token' 저장
     URL에서 ama_token/locale 제거 (history replace)
     ready = true
```

### 3.4 UI 설계 (게이팅 상태)

| 상태 | 화면 |
|------|------|
| 처리 중 | 로딩 스피너 + "인증 확인 중" (i18n) |
| 토큰 만료/부적합 | 에러 카드 + AMA 재로그인 안내 |
| 미구독 | 플랫폼 앱 상세 리다이렉트 (또는 구독 안내 카드) |
| 정상 | 앱 본문(`App` 레이아웃) 렌더 |

---

## 4. 갭 분석

### 4.1 변경 범위 요약

| 영역 | 현재 | 변경 | 영향도 |
|------|------|------|--------|
| FE lib | api-client만 | ama-token.ts 신규 | 낮음(신규) |
| FE 컴포넌트 | 게이팅 없음 | AmaTokenHandler 신규 | 중(진입 게이팅) |
| FE 스토어 | setAuth 미사용 | isAuthenticated 추가·setAuth 사용 | 낮음 |
| FE 라우터 | 직접 렌더 | 래핑 | 중(전 페이지 공통) |
| i18n | auth 키 없음 | auth.* 3개 언어 | 낮음 |
| BE | — | 변경 없음 | 없음 |
| DB | — | 변경 없음 | 없음 |

### 4.2 파일 변경 목록

| 구분 | 파일 | 변경유형 |
|------|------|----------|
| Frontend | `src/lib/ama-token.ts` | 신규 |
| Frontend | `src/components/auth/AmaTokenHandler.tsx` | 신규 |
| Frontend | `src/stores/auth.store.ts` | 수정 |
| Frontend | `src/router.tsx` | 수정 |
| i18n | `locales/{ko,en,vi}/hscode.json` | 수정(auth.* 추가) |

### 4.3 DB 마이그레이션

- **없음.** 인증 흐름 수정으로 스키마 변경 불필요.

### 4.4 재빌드 필요성

- 프론트엔드 전용 변경 → `web-app-hscode`(정적 SPA) 이미지 재빌드 필요.
- `deploy-staging.sh` 경유 빌드 (직접 `docker compose build` 금지, CLAUDE.md).

---

## 5. 사용자 플로우

### 5.1 정상 (AMA → HS Code 최초 진입)

```
AMA(ama.amoeba.site) 앱 카탈로그에서 HS Code 실행
  └─ iframe src = https://apps.amoeba.site/app-hscode/?ama_token=<JWT>&locale=ko
       └─ AmaTokenHandler: ama_token 추출
            ├─ referrer 검증(soft) → OK
            ├─ JWT 디코드 → payload(entityId, appCode…)
            ├─ 만료/appCode 검증 → OK
            ├─ checkSubscription(entityId,'app-hscode') → ACTIVE
            ├─ setAuth(token,user) → localStorage 'hsc_token' 저장
            ├─ URL에서 ama_token 제거 (replace)
            └─ ready=true → App 렌더
                 └─ excel/classify 호출 시 api-client가 Bearer 첨부 → 200 ✅
```

### 5.2 분기

```
ama_token 없음(새로고침/직접접근)
  ├─ localStorage 'hsc_token' 존재 & 유효 → 통과(App 렌더)
  └─ 없음/만료 → 에러 화면 + AMA 재로그인 안내

JWT 만료 / appCode 불일치
  └─ 에러 카드 (i18n auth.invalid)

구독 상태 ≠ ACTIVE
  └─ 플랫폼 앱 상세 리다이렉트 (또는 구독 안내)
```

---

## 6. 기술 제약사항

| 구분 | 내용 |
|------|------|
| 호환성 | car-manager와 동일 SSO 규약(`ama_token` 쿼리, `locale`) 준수. iframe `Referrer-Policy`로 referrer 빈 값 가능 → **soft 검증** 필수 |
| 보안 | 프론트 디코드는 서명 검증 없음(표시용). 실제 검증은 백엔드 `JwtStrategy`가 `JWT_SECRET`으로 수행. `JWT_SECRET`이 AMA 서명 키와 일치해야 함(스테이징 `.env` 확인 필요) |
| 멀티테넌시 | 토큰 payload의 `entityId`(=`ent_id`)로 서버 데이터 격리. entityId 없는 토큰은 백엔드 `EntityScopeGuard`가 403 |
| 토큰 저장 | localStorage `hsc_token` (car-manager는 `ama_token` 키). 앱별 격리 위해 `hsc_token` 유지 |
| 성능 | 게이팅은 최초 mount 1회. 구독 확인 1 API 호출 |
| 배포 | VITE base `/app-hscode/`, 프론트 재빌드 필수. 스테이징 우선 배포 원칙 준수 |

---

## 다음 단계

본 분석서 승인 후 → **작업계획서(PLAN-20260708)** → 테스트케이스(TC) → 구현 → 테스트 → TR → RPT.

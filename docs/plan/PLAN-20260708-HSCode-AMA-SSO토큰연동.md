# 작업계획서 — HS Code Manager AMA SSO 토큰 연동 (401 수정)

- **문서 ID**: PLAN-20260708-HSCode-AMA-SSO토큰연동
- **작성일**: 2026-07-08
- **선행 문서**: [REQ-20260708-HSCode-AMA-SSO토큰연동](../analysis/REQ-20260708-HSCode-AMA-SSO토큰연동.md)
- **대상 앱**: HS Code Manager (`/app-hscode`)

---

## 1. 시스템 개발 현황 분석

### 1.1 디렉토리 구조 (frontend/src)
```
lib/         api-client.ts          ← 요청 인터셉터(Bearer)만 존재, ama-token.ts 없음
stores/      auth.store.ts          ← token/user/setAuth/clear/isAdmin (setAuth 미사용)
components/  (auth/ 디렉토리 없음)
router.tsx   createBrowserRouter    ← App(레이아웃) 하위에 페이지 직접 배치, 게이팅 없음
i18n/        locales/{ko,en,vi}/hscode.json  ← auth.* 키 없음
App.tsx      NavLink + Outlet 레이아웃
main.tsx     RouterProvider(router)
```

### 1.2 기술 스택
- React 18 + TS5 + Vite5, react-router-dom v6 **데이터 라우터**(`createBrowserRouter`), Zustand, React Query 5, i18next.
- VITE base: `/app-hscode/` (빌드 시점 인라인).

### 1.3 기존 코드 상황
- **백엔드 인증 정상** — `JwtAuthGuard` 전역, `@Auth()`가 excel 전 엔드포인트 적용. 수정 불필요.
- **프론트 토큰 수신 로직 전무** — `setAuth` 호출 0건 → token 영구 null → 401.
- **재사용 자산** — car-manager `ama-token.ts` + `AmaTokenHandler`, 플랫폼 Public 구독 API `GET /api/v1/platform/subscriptions/entity/:entId`.

### 1.4 제약사항
- 데이터 라우터이므로 `AmaTokenHandler`(내부에서 `useSearchParams` 사용)는 **RouterProvider 컨텍스트 안**에 있어야 함 → 라우트 root element에서 `<App/>`을 래핑.
- iframe `Referrer-Policy` → referrer 빈 값 가능 → **soft 검증**.
- 프론트 전용 변경 → `web-app-hscode` 재빌드 필수, `deploy-staging.sh` 경유(직접 build 금지).
- 앱별 토큰 격리 위해 localStorage 키 `hsc_token` 유지.

---

## 2. 단계별 구현 계획

### Phase 1 — SSO 토큰 유틸 (lib)

**Step 1.1** `src/lib/ama-token.ts` 신규
- car-manager 이식. 상수만 변경: `APP_SLUG='app-hscode'`, `APP_CODE_VARIANTS=['app-hscode','hscode']`.
- export: `getAmaTokenFromUrl`, `decodeAmaToken`, `validateReferrer`(soft), `isTokenExpired`, `isValidAppCode`, `checkSubscription`.
- `PLATFORM_API_BASE` = localhost면 `http://localhost:3100/api/v1/platform`, 아니면 `/api/v1/platform`.
- └─ 사이드 임팩트: 신규 파일. 기존 코드 영향 없음. 빌드 의존성 추가 없음(순수 브라우저 API).

### Phase 2 — Auth 스토어 보강

**Step 2.1** `src/stores/auth.store.ts` 수정
- `isAuthenticated: boolean` 필드 추가(초기값 `!!savedToken`).
- `setAuth`에서 `isAuthenticated: true`, `clear`에서 `false`.
- 기존 `token`/`user`/`isAdmin` 유지, localStorage 키 `hsc_token` 유지.
- └─ 사이드 임팩트: `AuthState` 인터페이스 확장. `isAuthenticated`를 참조하는 신규 코드만 사용 → 기존 소비자 무영향(타입 하위호환).

### Phase 3 — 게이팅 컴포넌트

**Step 3.1** `src/components/auth/AmaTokenHandler.tsx` 신규
- car-manager `AmaTokenHandler` 로직 이식:
  1. URL `ama_token` 없으면 기존 토큰으로 통과(`ready=true`).
  2. 있으면 `clear()` → locale 적용 → referrer(soft) → decode → 만료/appCode 검증 → 구독 확인.
  3. ACTIVE → payload로 `AuthUser` 구성 후 `setAuth(token,user)` → URL에서 `ama_token`/`locale` 제거(replace) → `ready=true`.
  4. 미구독 → 플랫폼 앱 상세(`/apps/app-hscode?ent_id=...`) 리다이렉트.
  5. 에러/로딩 화면은 i18n `auth.*`/`common.loading` 사용.
- `hscode` i18n 네임스페이스 사용(`useTranslation('hscode')`).
- └─ 사이드 임팩트: 최초 mount 시 전 페이지 공통 게이팅. `ama_token` 처리 완료 전 본문 미렌더 → **인증 전 API 호출(=401) 원천 차단**. 새로고침(토큰 URL 없음+localStorage 유효) 정상 통과.

### Phase 4 — 라우터 배선

**Step 4.1** `src/router.tsx` 수정
- root 라우트 `element`를 `<AmaTokenHandler><App /></AmaTokenHandler>`로 변경.
- children/basename(`/app-hscode`) 유지.
- └─ 사이드 임팩트: `AmaTokenHandler`가 RouterProvider 하위에서 실행되어 `useSearchParams` 정상. App 레이아웃/Outlet 구조 불변.

### Phase 5 — i18n

**Step 5.1** `locales/{ko,en,vi}/hscode.json`에 키 추가
- `auth.checking`(인증 확인 중), `auth.invalidAccess`, `auth.tokenExpired`, `common.loading`(기존 없으면 추가).
- └─ 사이드 임팩트: 신규 키만 추가 → 기존 번역 무영향. 3개 언어 동시 추가(누락 방지).

### Phase 6 — 검증/빌드

**Step 6.1** 타입체크·빌드
- `cd apps/app-hscode-manager/frontend && npm run build` (tsc + vite) 그린 확인.
- └─ 사이드 임팩트: 없음(로컬 검증).

**Step 6.2** 로컬 동작 검증
- 목업 `ama_token`(JWT, entityId 포함)으로 `?ama_token=...` 진입 → 헤더 첨부 확인, excel/classify 200 경로 확인(백엔드 JWT_SECRET 일치 전제).
- └─ 사이드 임팩트: 없음.

---

## 3. 변경 파일 목록

| 구분 | 파일 | 변경유형 |
|------|------|----------|
| Frontend | `apps/app-hscode-manager/frontend/src/lib/ama-token.ts` | 신규 |
| Frontend | `apps/app-hscode-manager/frontend/src/components/auth/AmaTokenHandler.tsx` | 신규 |
| Frontend | `apps/app-hscode-manager/frontend/src/stores/auth.store.ts` | 수정 |
| Frontend | `apps/app-hscode-manager/frontend/src/router.tsx` | 수정 |
| i18n | `apps/app-hscode-manager/frontend/src/i18n/locales/ko/hscode.json` | 수정 |
| i18n | `apps/app-hscode-manager/frontend/src/i18n/locales/en/hscode.json` | 수정 |
| i18n | `apps/app-hscode-manager/frontend/src/i18n/locales/vi/hscode.json` | 수정 |
| Backend | — | 변경 없음 |
| DB | — | 변경 없음 |

---

## 4. 사이드 임팩트 분석

| 범위 | 위험도 | 설명 |
|------|--------|------|
| 전 페이지 진입 게이팅 | 중 | `AmaTokenHandler`가 root에서 모든 페이지를 감쌈. `ama_token` 없고 localStorage도 없으면 통과(ready)하지만 이후 API는 401 → 정상 UX(재로그인 유도)로 처리 |
| URL replace(param 제거) | 낮음 | `ama_token`/`locale`만 제거. 라우팅 경로 불변 |
| localStorage 키 | 낮음 | `hsc_token` 유지 → car-manager(`ama_token`)와 키 분리로 앱 간 토큰 오염 없음 |
| 구독 미등록 Entity | 중 | 플랫폼 구독 API에 `app-hscode` 미등록 시 status=null → 리다이렉트. **완화책**: 초기엔 미구독 시 리다이렉트 대신 통과(soft)하도록 상수 플래그 제공 검토 → TC에서 결정 |
| JWT_SECRET 불일치 | 높음(인프라) | 프론트 수정만으로 해결 불가. 스테이징 `.env`의 `JWT_SECRET`이 AMA 서명 키와 일치해야 최종 200. 배포 후 401 지속 시 이 항목 점검 |
| 백엔드 | 없음 | 변경 없음 |

---

## 5. DB 마이그레이션

- **불필요.** 스키마 변경 없음(인증 흐름 프론트 수정 only).

---

## 6. 배포 계획

1. 프론트 빌드 그린 확인(로컬).
2. `git push origin main`(feature→main PR) → 스테이징 배포:
   `ssh ambAppStore@stg-apps.amoeba.site "cd ~/ambAppStore && git pull origin main && bash platform/scripts/deploy-staging.sh"`
   - `VITE base`/정적 SPA 변경 → `web-app-hscode` 재빌드 필수.
3. `stg-apps.amoeba.site/app-hscode/?ama_token=...` 진입 → excel/classify 200 검증.
4. 401 지속 시 → 스테이징 `JWT_SECRET` vs AMA 서명 키 점검(§4).

---

## 다음 단계
→ 테스트케이스(TC-20260708) 작성 → 구현 → 테스트 → TR → RPT.

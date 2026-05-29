---
document_id: PLN-20260529-debug-context-panel
version: 1.0.0
status: Draft
created: 2026-05-29
author: 김익용 (Gray)
related:
  - apps/app-car-manager-v2/docs/analysis/REQ-20260529-debug-context-panel.md
---

# app-car-manager-v2 — Debug Context Panel 작업계획서

> 본 계획서는 [REQ-20260529-debug-context-panel](../analysis/REQ-20260529-debug-context-panel.md) 권고 진행안 기반:
> 적응 이식 / 진입 페이지 임베드 / dev+staging 활성화 / URL 쿼리 캡처 시점만 / 3 locale (ko/en/vi)

---

## 1. 시스템 개발 현황 분석

### 1.1 핵심 파일 확인 (REQ 보강)

| 항목 | 실측 경로 / 값 |
|------|----------------|
| 진입 페이지 | `apps/web/src/app/session-expired/page.tsx` (RSC, `getTranslations('sessionExpired')`) |
| Dev 로그인 라우트 | `apps/web/src/app/dev-login/route.ts` (`DEMO_AUTO_LOGIN=true`) |
| Middleware | `apps/web/src/middleware.ts` — `ama_token` → cookie 발급 → URL clean redirect |
| Cookie 이름 | `SESSION_COOKIE_NAME` env (기본 `amb_session`), `httpOnly: true`, `secure: IS_PROD` |
| User context | `apps/web/src/lib/auth/get-current-user.ts:22-38` — `headers()` 로 `x-ent-id`, `x-user-id`, `x-user-role` |
| JWT verify | `apps/web/src/lib/auth/verify-jwt.ts` (jose + Zod) |
| UI 패키지 | `@car-v2/ui` (Button, Card, CardContent) — shadcn 아님, custom |
| i18n | next-intl, `apps/web/messages/{ko,en,vi}.json` — **3 locale (zh-CN 없음)** |
| 기존 dev 도구 | dev-login 라우트, `format-action-error.ts` only |

### 1.2 REQ 정정 사항

| # | REQ 명시 | 실측 후 정정 |
|---|---------|-------------|
| 1 | 로그인 페이지에 임베드 | **별도 `/login` 페이지 없음** → `/session-expired` 페이지 (진입 페이지 역할) + `/dev-login` (선택) |
| 2 | 4 locale (ko/en/vi/zh-CN) | **3 locale** (ko/en/vi) — zh-CN 미설치 |
| 3 | shadcn/ui 사용 | `@car-v2/ui` custom 컴포넌트 — Button/Card는 사용 가능 |

### 1.3 제약사항

- **HttpOnly cookie**: 클라이언트 JS 가 `amb_session` 값을 못 읽음 → 디코드된 claims 는 RSC props 로 전달
- **JWT 원본 표시**: middleware 가 `?ama_token=` 을 즉시 정리하고 redirect 하므로, **URL clean redirect 이전 시점에만** 클라이언트가 캡처 가능. `/session-expired` 도달 시점에는 이미 정리된 상태
  - 대안: middleware 가 redirect 시 cleanUrl 에 `?ama_debug=1` 같은 신호 + (dev only) 디코드 결과를 session-expired 의 query 로 전달
  - 또는 단순화: 디코드된 claims 만 표시, 원본 token 은 cookie 가 있을 때만 서버에서 디코드 후 전달 (token 자체 노출 X)
- **React 19 + RSC boundary**: Provider(Server) → Panel(Client) 분리
- **Production tree-shake**: `process.env.NODE_ENV` 분기 → 빌드 시 dead code elimination 의존, dynamic import 보강

---

## 2. 단계별 구현 계획

### Phase 1 — 사전 분기 및 환경변수 정의

| Step | 작업 | 사이드 임팩트 |
|------|------|--------------|
| 1.1 | `.env.example` (또는 docs/.env 가이드) 에 `DEBUG_PANEL_ENABLED=false` 라인 추가 | └─ 사이드 임팩트: 운영자에게 새 변수 알림. 기본값 false → 명시 설정 없으면 staging/prod 미노출 |
| 1.2 | `apps/web/CLAUDE.md` 또는 README 에 활성화 정책 1단락 추가 (dev 자동 / staging `DEBUG_PANEL_ENABLED=true` / prod 불가) | └─ 사이드 임팩트: 운영 문서 정합 |

### Phase 2 — Core 컴포넌트 신규 작성

| Step | 작업 | 사이드 임팩트 |
|------|------|--------------|
| 2.1 | `apps/web/src/components/dev/decode-jwt.ts` — base64 디코드 유틸 (jose `decodeJwt` 또는 수동) | └─ 사이드 임팩트: 신규 유틸 — 다른 모듈 영향 없음 |
| 2.2 | `apps/web/src/components/dev/debug-context-panel.tsx` — `"use client"` 컴포넌트. props: `serverContext`, `cookieMeta`. 클라이언트 state: `referrer`, `urlQuery`, `urlAmaToken` (mount 시점 캡처) | └─ 사이드 임팩트: `lucide-react` (Bug, ChevronDown/Up, Copy, Check), `@car-v2/ui` (Card, Button) 의존 — 이미 설치 |
| 2.3 | `apps/web/src/components/dev/debug-context-provider.tsx` — Server Component. NODE_ENV/DEBUG_PANEL_ENABLED 게이팅 → 비활성 시 `return null`. 활성 시 `getCurrentUser()` + `cookies()` 호출 후 Panel 에 props 주입 | └─ 사이드 임팩트: `next/headers` import (server-only), 클라이언트 페이지엔 영향 없음 |

### Phase 3 — i18n 메시지 추가

| Step | 작업 | 사이드 임팩트 |
|------|------|--------------|
| 3.1 | `apps/web/messages/ko.json` 에 `debug` 네임스페이스 11 키 추가 (`title`, `referer`, `queryParams`, `session`, `entId`, `userId`, `role`, `cookieExpiresIn`, `amaTokenInUrl`, `decodedPayload`, `copy`, `copied`, `expand`, `collapse`, `disabled`) | └─ 사이드 임팩트: ko/en/vi 3 파일 모두 동일 키 구조 유지 — schema check 통과 |
| 3.2 | `apps/web/messages/en.json` 동일 키 추가 (영문) | └─ 사이드 임팩트: 동일 |
| 3.3 | `apps/web/messages/vi.json` 동일 키 추가 (베트남어) — 가능하면 사용자 검수, 임시 영문 fallback 허용 | └─ 사이드 임팩트: 검수 전엔 영문 표시 가능 |

### Phase 4 — 진입 페이지 임베드

| Step | 작업 | 사이드 임팩트 |
|------|------|--------------|
| 4.1 | `apps/web/src/app/session-expired/page.tsx` 에 `<DebugContextProvider />` 임베드 (Card 하단, demoEnabled 블록 아래 또는 별도) | └─ 사이드 임팩트: 페이지 레이아웃 변경 1곳, prod 에선 null 이라 영향 없음 |
| 4.2 | (선택) `apps/web/src/app/dev-login/route.ts` 가 redirect 하는 첫 페이지에도 노출 검토 — 현재 dev-login 은 cookie 발급 후 `/` 또는 `next` 로 redirect 하므로 별도 노출 어려움. **본 PLN 범위 제외** | └─ 사이드 임팩트: 후속 개선 여지 |

### Phase 5 — Production 안전성 검증

| Step | 작업 | 사이드 임팩트 |
|------|------|--------------|
| 5.1 | `next build` 실행 → 번들 분석 (`@next/bundle-analyzer` 또는 `.next/static/chunks/` grep) → `DebugContextPanel` 식별자가 production 번들에 포함되지 않는지 확인 | └─ 사이드 임팩트: 미제거 시 `next/dynamic({ ssr: false, loading: () => null })` 또는 별도 분기로 보강 |
| 5.2 | `process.env.NODE_ENV='production' next start` + 브라우저로 `/session-expired` 접근 → DOM 에 panel 흔적 없는지 확인 | └─ 사이드 임팩트: 보안 회귀 차단 |
| 5.3 | `DEBUG_PANEL_ENABLED=true NODE_ENV=production next start` 로 staging emulation → panel 노출 확인 | └─ 사이드 임팩트: staging 활성화 경로 검증 |

### Phase 6 — 코드 품질 검증

| Step | 작업 | 사이드 임팩트 |
|------|------|--------------|
| 6.1 | `pnpm typecheck` (또는 `tsc --noEmit`) | └─ 사이드 임팩트: React 19 / RSC boundary 위반 시 컴파일 에러 |
| 6.2 | `pnpm lint` | └─ 사이드 임팩트: eslint 규칙 (react-hooks, next/no-html-link-for-pages 등) 검증 |
| 6.3 | (있다면) `pnpm test` — 단위 테스트 — Provider 의 NODE_ENV 분기 로직 회귀 보호 | └─ 사이드 임팩트: 회귀 방지 |

### Phase 7 — 배포 검증 (사용자 수행)

| Step | 작업 | 사이드 임팩트 |
|------|------|--------------|
| 7.1 | feature 브랜치 push + PR 생성 (`huy/develop-car-manager-v2` 또는 main 대상 — 사용자 결정) | └─ 사이드 임팩트: CI 트리거 |
| 7.2 | 스테이징 배포 → `?ama_token=<JWT>` 진입 시나리오 → `/session-expired` 도달 시 panel 노출 확인 | └─ 사이드 임팩트: 실서비스 검증 |
| 7.3 | `?ama_token=` 없는 경우(만료) 진입 → panel 에서 cookie 메타 + URL 쿼리 = 없음 표시 확인 | └─ 사이드 임팩트: edge case 검증 |
| 7.4 | production 배포 (별건) → `/session-expired` 접근 → panel 미노출 확인 | └─ 사이드 임팩트: 보안 검증 |

---

## 3. 변경 파일 목록

### 신규 (Frontend 3 + i18n 0 = 3 파일)

| # | 파일 | 종류 |
|---|------|------|
| 1 | `apps/web/src/components/dev/decode-jwt.ts` | 유틸 |
| 2 | `apps/web/src/components/dev/debug-context-panel.tsx` | Client Component |
| 3 | `apps/web/src/components/dev/debug-context-provider.tsx` | Server Component |

### 수정 (Frontend 1 + i18n 3 + 문서 1~2 = 5~6 파일)

| # | 파일 | 변경 내용 |
|---|------|----------|
| 1 | `apps/web/src/app/session-expired/page.tsx` | `<DebugContextProvider />` 임베드 1라인 |
| 2 | `apps/web/messages/ko.json` | `debug` 네임스페이스 키 추가 |
| 3 | `apps/web/messages/en.json` | 동일 |
| 4 | `apps/web/messages/vi.json` | 동일 |
| 5 | `apps/web/CLAUDE.md` (또는 README) | 활성화 정책 단락 추가 |
| 6 | `apps/web/.env.example` (있다면) | `DEBUG_PANEL_ENABLED=false` 라인 추가 |

### Backend / DB / Server Action — 변경 없음

본 작업은 순수 frontend dev tooling — backend, DB, Server Action 변경 없음.

---

## 4. 사이드 임팩트 분석

| 범위 | 위험도 | 설명 |
|------|-------|------|
| **Production 번들 크기** | Low | `process.env.NODE_ENV` 분기 → dead code elimination 으로 제거. tree-shake 미제거 시 Phase 5.1 에서 발견 → dynamic import 보강 |
| **Production 보안 노출** | Critical (방어 완료) | NODE_ENV 게이트 + DEBUG_PANEL_ENABLED 이중 검증. Phase 5.2 로 회귀 차단 |
| **Server/Client boundary 위반** | Low | Provider 가 Server Component, Panel 만 Client — 명확 분리. typecheck 로 검출 |
| **i18n schema mismatch** | Low | 3 locale 동일 키 구조 유지 → next-intl 의 unknown key warning 으로 검출 |
| **세션 만료 페이지 UX 회귀** | Low | Card 하단에 추가 — 기존 LogIn 버튼 / dev-login 블록 위치 영향 없음 |
| **lucide-react 추가 import** | None | 이미 사용 중 (`LogIn`, `ShieldOff`) — 4개 아이콘만 추가 |
| **Backend / DB** | None | 변경 없음 |
| **다른 라우트 / 페이지** | None | session-expired 외 영향 없음 |
| **AMA token 흐름** | None | middleware 흐름 미변경 |

---

## 5. DB 마이그레이션

**해당 없음**. UI/dev 전용 작업, 스키마 변경 없음.

---

## 6. 롤백 전략

- 단일 커밋 PR 로 묶어 `git revert <merge-sha>` 한 번에 복구
- 환경변수는 `.env.example` 만 변경 → 운영 환경 영향 없음
- session-expired 페이지의 임베드 라인 1개 제거 + 신규 3 파일 삭제로 즉시 원상 복구 가능

---

## 7. 작업 추정

| Phase | 추정 시간 |
|-------|----------|
| Phase 1 환경변수·문서 | 20분 |
| Phase 2 Core 컴포넌트 3개 | 2시간 |
| Phase 3 i18n 메시지 3 locale | 30분 |
| Phase 4 session-expired 임베드 | 15분 |
| Phase 5 Production 안전성 검증 | 1시간 |
| Phase 6 typecheck/lint | 30분 |
| **합계 (Phase 1~6, 사용자 검증 제외)** | **~4시간 30분** |
| Phase 7 배포 검증 (사용자) | 별도 |

---

## 8. 의사결정 사항 (REQ §9 권고안 채택 확정)

| # | 결정 | 채택값 |
|---|------|--------|
| D-1 | 도입 여부 | 적응 이식 (옵션 a) |
| D-2 | 임베드 위치 | 진입 페이지(`/session-expired`) — REQ 의 "옵션 A" 를 실제 진입점으로 보정 |
| D-3 | 환경 활성화 정책 | dev + staging(DEBUG_PANEL_ENABLED=true), prod 불가 |
| D-4 | JWT 원본 표시 | URL 쿼리 캡처 시점만 — 단, middleware 가 즉시 정리하므로 실효성은 낮음. **Decoded claims 우선 표시** |
| D-5 | i18n 우선순위 | 3 locale (ko/en/vi) 모두 — zh-CN 은 미설치 |

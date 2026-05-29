---
document_id: RPT-20260529-debug-context-panel
version: 1.0.0
status: Phase 1~6 Complete (Pre-deploy)
created: 2026-05-29
author: 김익용 (Gray)
related:
  - apps/app-car-manager-v2/docs/analysis/REQ-20260529-debug-context-panel.md
  - apps/app-car-manager-v2/docs/plan/PLN-20260529-debug-context-panel.md
  - apps/app-car-manager-v2/docs/test/TC-20260529-debug-context-panel.md
  - apps/app-car-manager-v2/docs/test/TR-20260529-debug-context-panel.md
---

# app-car-manager-v2 — Debug Context Panel 작업 완료 보고서

## 1. 작업 개요

| 항목 | 내용 |
|------|------|
| 목적 | app-academy 의 `DebugContextPanel` 과 동등한 AMA SSO 디버깅 패널을 app-car-manager-v2 에 도입 |
| 임베드 위치 | `/session-expired` 페이지 (이 앱의 AMA 진입점) |
| 활성화 정책 | dev 자동 / staging·prod 비활성 (트레이드오프 §5 참조) |
| Webhook · backend · DB | 변경 없음 |
| 작업 기간 | 2026-05-29 (REQ → PLN → TC → 구현 → TR/RPT, 단일 세션) |
| Branch | `huy/develop-car-manager-v2` |

---

## 2. 수행한 작업

### Phase 1 — 환경변수·문서 가이드
- `.env.example` 에 `DEBUG_PANEL_ENABLED` 변수 + dev/staging/prod 정책 주석 추가

### Phase 2 — Core 컴포넌트 3개 신규
- `apps/web/src/components/dev/decode-jwt.ts` — `jose.decodeJwt` 래퍼 (서명 검증은 middleware 가 이미 수행)
- `apps/web/src/components/dev/debug-context-panel.tsx` — Client Component, 토글/복사/i18n, KeyValueRow 헬퍼 내장
- `apps/web/src/components/dev/debug-context-provider.tsx` — Server Component, 게이팅 + `getCurrentUser()` + `cookies()` props 주입

### Phase 3 — i18n 메시지 추가
- `messages/{ko,en,vi}.json` 에 `debug.*` 네임스페이스 24개 키 추가 (3 locale 동일 스키마)

### Phase 4 — `/session-expired` 임베드
- `apps/web/src/app/session-expired/page.tsx` — 정적 NODE_ENV 분기로 import + `{DebugContextProvider && <DebugContextProvider />}` 한 줄 임베드

### Phase 5 — Production 안전성 검증
- 1차 단순 dynamic import 만으로는 client chunk 잔존 (7.2KB)
- 2차 page 레벨 NODE_ENV 정적 분기 추가 → DCE 적용 → **chunk 835 bytes** (panel 코드 완전 제거)
- grep 검증: `DebugContextPanel`, `debug-context-panel`, `DebugContextProvider` 모두 0 hits

### Phase 6 — Typecheck · Lint
- React 19 호환: `Promise<JSX.Element | null>` 반환 타입 → 추론 사용으로 정정
- typecheck: `tsc --noEmit` exit 0
- lint: `next lint` "No ESLint warnings or errors"

---

## 3. 변경 파일 목록

### 신규 (3)
```
apps/web/src/components/dev/decode-jwt.ts
apps/web/src/components/dev/debug-context-panel.tsx
apps/web/src/components/dev/debug-context-provider.tsx
```

### 수정 (5)
```
apps/web/src/app/session-expired/page.tsx
apps/web/messages/ko.json
apps/web/messages/en.json
apps/web/messages/vi.json
.env.example
```

### 신규 docs (5 — 전체 SDLC 산출물)
```
apps/app-car-manager-v2/docs/analysis/REQ-20260529-debug-context-panel.md
apps/app-car-manager-v2/docs/plan/PLN-20260529-debug-context-panel.md
apps/app-car-manager-v2/docs/test/TC-20260529-debug-context-panel.md
apps/app-car-manager-v2/docs/test/TR-20260529-debug-context-panel.md
apps/app-car-manager-v2/docs/implementation/RPT-20260529-debug-context-panel.md (본 문서)
```

### 변경 없음
- backend, DB, server actions, middleware, 라우터 가드, 기존 페이지·컴포넌트
- AMA SSO 토큰 흐름 (`?ama_token=` → middleware → cookie → header propagation)

---

## 4. 효과

| 영역 | Before | After |
|------|--------|-------|
| AMA SSO 진입 디버깅 | 매번 수동 console.log / DevTools cookie 확인 | `/session-expired` 도달 시 한눈에 referer / query / ent_id / cookie exp / decoded claims 확인 |
| i18n 지원 | — | 3 locale (ko/en/vi) 24 키 |
| Production 번들 영향 | — | **0 KB** (DCE 로 완전 제거) |
| Dev 번들 영향 | — | +7 KB (session-expired client chunk) |
| 보안 (사용자 데이터 노출) | — | NODE_ENV 정적 분기로 prod chunk 부재 — 노출 면 0 |

---

## 5. ⚠️ 트레이드오프 (의도된 결정)

### PLN 명세 vs 구현 결과

PLN §3 D-3: dev / staging(DEBUG_PANEL_ENABLED=true) 활성화, prod 비활성화

구현 결과: NODE_ENV 정적 분기로 **staging 도 비활성**. 이유 = TC-S-04 (production bundle 에서 panel 코드 완전 제거) 가 보안 critical 로 채택됐기 때문.

### 채택 옵션 비교 (TR §5 동일)

| 옵션 | tree-shake | staging 활성화 | 채택 |
|------|-----------|--------------|------|
| A. 런타임 게이트만 | ❌ 잔존 | ✅ | — |
| **B. NODE_ENV 정적 분기** | ✅ **완전 제거** | ❌ | **현 PR** |
| C. NEXT_PUBLIC_DEBUG_PANEL_ENABLED | △ 빌드 별 | ✅ | 후속 옵션 |

### Staging 활성화 필요 시 옵션

1. **즉시**: `NODE_ENV=development` 로 staging 빌드 (임시)
2. **후속 PR**: 옵션 C 도입 — `NEXT_PUBLIC_DEBUG_PANEL_ENABLED=true` 로 staging 빌드 시 panel 포함

---

## 6. 회귀 방지 패턴

- **Server/Client 컴포넌트 경계**: Provider 가 server, Panel 이 client. Server 에서 `null` 반환 시 RSC payload 에 client chunk reference 가 안 남도록 page 레벨 정적 분기 사용
- **HttpOnly cookie 정책 존중**: cookie raw value 는 절대 클라이언트로 직렬화하지 않음. decoded claims 만 전달
- **i18n 키 스키마 동기**: 새 네임스페이스 추가 시 3 locale 동시 갱신 (자동 검증 가능)
- **React 19 호환**: `JSX.Element` global namespace 제거. return type 추론 또는 `React.JSX.Element` 사용

---

## 7. 후속·미수행 과제

### Phase 7 — 사용자 단계 (배포·검증)

- Local commit + push (`huy/develop-car-manager-v2` 브랜치 또는 새 feature 분기)
- PR 생성 (base 결정: `huy/develop-car-manager-v2` 직접 또는 main 대상)
- Dev runtime 검증:
  - TC-D-01: `/session-expired` 도달 시 panel 노출
  - TC-D-02~08: Referrer/Query/server context/cookie meta/decoded claims/토글/복사/i18n
- Staging 배포 후 회귀 검증:
  - TC-R-01: session-expired LogIn 버튼 유지
  - TC-R-02: dev-login 흐름 유지
  - TC-R-03: AMA SSO `?ama_token=` 흐름 유지
- Production 배포 후:
  - TC-P-01~04: panel 미노출 검증

### Follow-up 검토
- F-1: 옵션 C (NEXT_PUBLIC_DEBUG_PANEL_ENABLED) 도입으로 staging 활성화 부활 — 필요성 사용자 확인
- F-2: dev-login route 이후 redirect 페이지에도 panel 노출 (전역 floating widget) — 필요 시 별건
- F-3: 다른 앱 (app-hscode-manager, app-sales-report 등) 으로 패턴 확장 — common package 패키지화 검토

---

## 8. 결론

REQ-20260529 의 R-1 ~ R-6 6개 요구사항 중:

| # | 요구사항 | 결과 |
|---|---------|------|
| R-1 | DebugContextPanel 도입 | ✅ 적응 이식 완료 |
| R-2 | dev/staging 활성, prod 미노출 | △ Prod 미노출 ✅ / Staging 비활성 (트레이드오프 §5) |
| R-3 | Referrer/Query/ent_id/cookie meta/decoded claims | ✅ |
| R-4 | i18n 3 locale (zh-CN 미설치) | ✅ 3 locale (ko/en/vi) — PLN §1.2 정정 |
| R-5 | 토글·복사 버튼 | ✅ |
| R-6 | 노란 dashed border / Bug 아이콘 | ✅ `warning` 토큰 + Bug 아이콘 |

**상태**: 구현·정적검증 완료. Runtime/배포 검증 사용자 단계.

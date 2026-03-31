# Debug Context Panel — Task Plan (디버그 컨텍스트 패널 작업계획서)

---
- **document_id**: PLT-PLAN-20260331-DEBUG-PANEL
- **version**: 1.0.0
- **status**: Draft
- **created**: 2026-03-31
- **author**: AI Assistant
- **based_on**: PLT-REQ-20260331-DEBUG-PANEL
- **app**: platform + app-car-manager (cross-app)
---

## 1. System Development Status Analysis (시스템 개발 현황 분석)

### 1.1 Directory Structure

```
apps/platform/frontend/src/
├── App.tsx                          # Header + main(Routes) + Footer 레이아웃
├── components/
│   ├── layout/
│   │   ├── Header.tsx               # 네비게이션 헤더
│   │   └── Footer.tsx               # 단순 copyright footer
│   ├── admin/
│   │   ├── AdminLayout.tsx          # Admin 사이드바 + Outlet
│   │   └── AdminGuard.tsx           # Admin 인증 가드
│   └── common/                      # (DebugContextPanel 추가 위치)
├── stores/
│   ├── auth.store.ts                # JWT 토큰 관리 (localStorage: ama_token)
│   └── entity-context.store.ts      # Entity 쿼리파라미터 (Zustand)
└── i18n/locales/{ko,en,vi}/
    ├── platform.json                # 플랫폼 번역
    └── admin.json                   # 어드민 번역

apps/app-car-manager/frontend/src/
├── App.tsx                          # AppLayout 감싸기, basename="/app-car-manager"
├── components/
│   ├── layout/
│   │   └── AppLayout.tsx            # 사이드바 레이아웃 (Footer 없음)
│   └── common/                      # (DebugContextPanel 추가 위치)
├── stores/
│   └── auth.store.ts                # JWT or Entity context (sessionStorage)
└── i18n/locales/{ko,en,vi}/
    └── car.json                     # 차량관리 번역
```

### 1.2 Key Technical Context (기술 현황)

| Item | Detail |
|------|--------|
| JWT Storage | `localStorage.getItem('ama_token')` (both apps) |
| Entity Context (Platform) | `useEntityContextStore` (Zustand, memory only) |
| Entity Context (Car-Manager) | `sessionStorage.getItem('entity_context')` |
| Query Param Cleanup | `EntityContextInitializer`가 mount 시 URL에서 `ent_id` 등 제거 |
| Same Domain | `stg-apps.amoeba.site` → localStorage 공유 가능 |
| Admin Access | Platform only (car-manager에는 admin 없음) |
| i18n | Platform: `platform`+`admin` NS / Car: `car` NS |

### 1.3 Constraints (제약사항)

1. **Query Params 포착 타이밍**: `EntityContextInitializer`가 URL 파라미터를 clean하기 전에 초기 값을 캡처해야 함
2. **Cross-App Toggle**: 같은 도메인이므로 localStorage 하나로 두 앱 제어 가능
3. **프론트엔드 전용**: 백엔드 변경 없음

---

## 2. Step-by-Step Implementation Plan (단계별 구현 계획)

### Phase 1: Shared Debug Context Capture (디버그 컨텍스트 캡처)

#### Step 1.1: Platform — Initial Context Capture in App.tsx
- `App.tsx`에서 앱 시작 시점에 `document.referrer`와 초기 `window.location.search`를 캡처
- `EntityContextInitializer` **실행 전**에 캡처해야 하므로, 별도 initializer 또는 ref로 한 번만 저장
- └─ 사이드 임팩트: `EntityContextInitializer` 순서와 무관하게 동작해야 함 (useRef 사용)

#### Step 1.2: Car-Manager — Initial Context Capture in App.tsx
- 동일 로직 적용
- └─ 사이드 임팩트: 없음 (Platform과 동일한 패턴)

### Phase 2: DebugContextPanel Component (디버그 패널 컴포넌트)

#### Step 2.1: Platform — Create DebugContextPanel.tsx
- `components/common/DebugContextPanel.tsx` 신규 생성
- Props: `initialReferrer: string`, `initialQueryParams: string`
- 표시 항목:
  1. HTTP Referer (`document.referrer`)
  2. Initial Query Parameters (JSON)
  3. Current Query Parameters (현재 URL)
  4. JWT Token (Raw → `localStorage.getItem('ama_token')`)
  5. JWT Payload (Decoded, JSON.parse(atob(token.split('.')[1])))
  6. Entity Context (`useEntityContextStore` or `sessionStorage`)
- UI: collapsible panel, yellow/gray background, monospace textarea, copy button
- Toggle: `localStorage.getItem('debug_panel_enabled') === 'true'` 확인
- └─ 사이드 임팩트: 없음 (조건부 렌더링, 비활성 시 null 반환)

#### Step 2.2: Car-Manager — Create DebugContextPanel.tsx
- Platform과 거의 동일한 컴포넌트 (import 경로만 다름)
- Entity Context: `sessionStorage.getItem('entity_context')` 참조
- └─ 사이드 임팩트: 없음

### Phase 3: Layout Integration (레이아웃 통합)

#### Step 3.1: Platform — Add Panel to App.tsx
- `<Footer />` 바로 위에 `<DebugContextPanel />` 배치
- initialReferrer, initialQueryParams를 `useRef`로 캡처하여 전달
- └─ 사이드 임팩트: Footer 위치는 그대로, 패널이 그 위에 추가됨. 비활성 시 DOM 없음.

#### Step 3.2: Car-Manager — Add Panel to AppLayout.tsx
- `<main>` 영역 하단에 `<DebugContextPanel />` 배치
- └─ 사이드 임팩트: 사이드바 레이아웃 내부 콘텐츠 영역만 영향. 스크롤 가능 영역 내.

### Phase 4: Admin Toggle (어드민 토글)

#### Step 4.1: Platform — Add Toggle to AdminLayout.tsx
- AdminLayout 사이드바 하단 (backToStore 링크 아래)에 토글 스위치 추가
- `localStorage.setItem('debug_panel_enabled', value ? 'true' : 'false')`
- 토글 변경 시 페이지 새로고침 없이 반영 가능하도록 `useState` + `window.dispatchEvent` 사용
- └─ 사이드 임팩트: AdminLayout UI에 토글 1개 추가. 기존 네비게이션에 영향 없음.

### Phase 5: i18n Translations (번역)

#### Step 5.1: Platform i18n
- `platform.json`: `debug.title`, `debug.referer`, `debug.queryParams`, `debug.jwtToken`, `debug.jwtPayload`, `debug.entityContext`, `debug.copy`, `debug.copied`, `debug.noData`
- `admin.json`: `debug.toggleLabel`, `debug.toggleDescription`
- 3개 언어(ko/en/vi) 모두 추가
- └─ 사이드 임팩트: 기존 번역키에 영향 없음

#### Step 5.2: Car-Manager i18n
- `car.json`: `debug.*` 키 추가 (동일 구조)
- └─ 사이드 임팩트: 없음

---

## 3. File Change List (변경 파일 목록)

| # | Classification | File Path | Change Type |
|---|---------------|-----------|-------------|
| 1 | Platform FE | `apps/platform/frontend/src/components/common/DebugContextPanel.tsx` | **New** |
| 2 | Platform FE | `apps/platform/frontend/src/App.tsx` | Modify |
| 3 | Platform FE | `apps/platform/frontend/src/components/admin/AdminLayout.tsx` | Modify |
| 4 | Platform FE | `apps/platform/frontend/src/i18n/locales/ko/platform.json` | Modify |
| 5 | Platform FE | `apps/platform/frontend/src/i18n/locales/en/platform.json` | Modify |
| 6 | Platform FE | `apps/platform/frontend/src/i18n/locales/vi/platform.json` | Modify |
| 7 | Platform FE | `apps/platform/frontend/src/i18n/locales/ko/admin.json` | Modify |
| 8 | Platform FE | `apps/platform/frontend/src/i18n/locales/en/admin.json` | Modify |
| 9 | Platform FE | `apps/platform/frontend/src/i18n/locales/vi/admin.json` | Modify |
| 10 | Car-Manager FE | `apps/app-car-manager/frontend/src/components/common/DebugContextPanel.tsx` | **New** |
| 11 | Car-Manager FE | `apps/app-car-manager/frontend/src/App.tsx` | Modify |
| 12 | Car-Manager FE | `apps/app-car-manager/frontend/src/i18n/locales/ko/car.json` | Modify |
| 13 | Car-Manager FE | `apps/app-car-manager/frontend/src/i18n/locales/en/car.json` | Modify |
| 14 | Car-Manager FE | `apps/app-car-manager/frontend/src/i18n/locales/vi/car.json` | Modify |

**Total**: 2 new files + 12 modified files = **14 files**

---

## 4. Side Impact Analysis (사이드 임팩트 분석)

| Scope (범위) | Risk (위험도) | Description (설명) |
|--------------|-------------|-------------------|
| Platform App.tsx | **Low** | Footer 위에 컴포넌트 1개 추가. 비활성 시 null 반환으로 DOM 변경 없음 |
| Car-Manager AppLayout.tsx | **Low** | main 콘텐츠 영역 하단에 추가. 기존 레이아웃 구조 변경 없음 |
| AdminLayout.tsx | **Low** | 사이드바 하단에 토글 1개 추가. 기존 네비게이션에 영향 없음 |
| localStorage | **Low** | `debug_panel_enabled` 키만 사용. 기존 `ama_token`, `i18n_lng`과 충돌 없음 |
| Performance | **Low** | 비활성 시 early return (null). 활성 시에도 단순 DOM 1~2개 |
| Security | **Medium** | JWT 토큰 원본이 UI에 표시됨. 프로덕션에서는 기본 비활성(false) + 어드민만 토글 가능 |
| i18n | **Low** | 새 키 추가만. 기존 키 변경 없음 |

---

## 5. DB Migration (DB 마이그레이션)

**해당 없음** — 순수 프론트엔드 기능. 백엔드 API 추가 및 DB 변경 없음.

---

## 6. Implementation Order Summary (구현 순서 요약)

```
Phase 1 (Context Capture)
  └─ Step 1.1: Platform App.tsx에 초기 referrer/params 캡처
  └─ Step 1.2: Car-Manager App.tsx에 동일 적용

Phase 2 (Component)
  └─ Step 2.1: Platform DebugContextPanel.tsx 생성
  └─ Step 2.2: Car-Manager DebugContextPanel.tsx 생성

Phase 3 (Integration)
  └─ Step 3.1: Platform App.tsx에 패널 배치
  └─ Step 3.2: Car-Manager AppLayout.tsx에 패널 배치

Phase 4 (Admin)
  └─ Step 4.1: AdminLayout.tsx에 토글 추가

Phase 5 (i18n)
  └─ Step 5.1: Platform 번역 (6 files)
  └─ Step 5.2: Car-Manager 번역 (3 files)
```

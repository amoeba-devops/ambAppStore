# Debug Context Panel — Requirements Analysis (디버그 컨텍스트 패널 요구사항 분석서)

---
- **document_id**: PLT-REQ-20260331-DEBUG-PANEL
- **version**: 1.0.0
- **status**: Draft
- **created**: 2026-03-31
- **author**: AI Assistant
- **app**: platform + app-car-manager (cross-app)
---

## 1. Requirements Summary (요구사항 요약)

| # | Requirement (요구사항) | Type (유형) |
|---|----------------------|-------------|
| FR-001 | Display HTTP Referer, query parameters, and JWT token in a collapsible textarea above footer (모든 페이지 푸터 위에 referer, 쿼리파라미터, JWT 토큰 표시) | Functional |
| FR-002 | Apply to ALL pages in both `platform` and `app-car-manager` frontends (두 앱의 모든 페이지에 적용) | Functional |
| FR-003 | Admin toggle: enable/disable the debug panel from admin settings (어드민에서 사용/미사용 전환) | Functional |
| FR-004 | Setting persists in localStorage per browser (브라우저별 localStorage에 설정 저장) | Functional |
| NFR-001 | Must not affect production performance when disabled (비활성 시 성능 영향 없어야 함) | Non-Functional |
| NFR-002 | Sensitive JWT data displayed as-is for debugging purposes only (디버그 전용, JWT 원본 표시) | Non-Functional |

---

## 2. AS-IS Status Analysis (현황 분석)

### 2.1 Platform Frontend (`apps/platform/frontend/`)

#### Layout Structure
- **`App.tsx`**: `<Header />` + `<main><Routes/></main>` + `<Footer />` 순서로 렌더링
- **`components/layout/Footer.tsx`**: 단순 copyright 텍스트 (`© 2026 ...`)
  - `<footer className="border-t bg-gray-50 py-6">` 내 `<div>` 1개
- **Pages**: LandingPage, AppDetailPage, AppsLoginPage, MySubscriptionsPage + Admin 페이지 4개
- **Admin 페이지**: AdminLayout 내부에서 별도 레이아웃 사용 (AdminGuard → AdminLayout → Routes)

#### Auth & Token
- **`stores/auth.store.ts`**: `localStorage.getItem('ama_token')` 으로 JWT 토큰 저장
- **`stores/entity-context.store.ts`**: AMA 쿼리 파라미터 (`ent_id`, `ent_code`, `ent_name`, `email`) Zustand 저장
- **`lib/api-client.ts`**: `Authorization: Bearer {token}` 헤더 사용

#### i18n
- Namespaces: `platform`, `admin` (ko/en/vi)
- 설정 파일: `i18n/i18n.ts`

#### Admin Settings
- 현재 admin 기능: 구독 관리(`AdminSubscriptionListPage`), 앱 관리(`AdminAppListPage`), 통계(`AdminStatsPage`)
- **설정(Settings) 페이지 없음** — 새로 추가 필요 or 기존 어드민 레이아웃에 토글 추가

### 2.2 App-Car-Manager Frontend (`apps/app-car-manager/frontend/`)

#### Layout Structure
- **`App.tsx`**: `<AppLayout>` 감싸서 모든 페이지 렌더링, `basename="/app-car-manager"`
- **`components/layout/AppLayout.tsx`**: 고정 사이드바 + `<main>` 콘텐츠 영역
  - Footer 없음 — 사이드바 하단에 Language + User 정보만 표시
- **Pages**: DashboardPage, VehicleListPage/Detail/Form, DispatchList/Detail/Form, TripLogListPage (8개)
- **Admin 페이지 없음**

#### Auth & Token
- **`stores/auth.store.ts`**: JWT 토큰(`localStorage`) OR Entity 컨텍스트(`sessionStorage.entity_context`)
- **`lib/api-client.ts`**: JWT or `X-Entity-*` 헤더 fallback

#### i18n
- Namespace: `car` (ko/en/vi)

### 2.3 Current Problem Points (현재 문제점)
1. AMA에서 iframe으로 앱을 호출할 때 전달된 **referer, 쿼리 파라미터, JWT 토큰**을 확인할 수 있는 방법이 없음
2. 디버깅/테스트 시 브라우저 개발자 도구를 열어야 하므로 비개발자 테스터가 정보 확인 어려움
3. 어드민이 패널 표시를 제어할 수 있는 설정 기능이 없음

---

## 3. TO-BE Requirements (TO-BE 요구사항)

### 3.1 AS-IS → TO-BE Mapping

| Area (영역) | AS-IS (현재) | TO-BE (변경 후) |
|-------------|-------------|----------------|
| Platform Footer | copyright 텍스트만 표시 | Footer 위에 Debug Context Panel 표시 |
| Car-Manager Layout | 사이드바 + 콘텐츠만 | 콘텐츠 하단에 Debug Context Panel 표시 |
| Debug Info | 없음 | Referer, Query Params, JWT Token 표시 |
| Admin Settings | 설정 페이지 없음 | Admin 내 설정 토글 추가 (또는 별도 설정 UI) |
| Toggle State | 없음 | `localStorage('debug_panel_enabled')` 로 제어 |

### 3.2 Debug Context Panel Component

**표시 정보**:
1. **HTTP Referer**: `document.referrer` (페이지를 호출한 원본 URL)
2. **Query Parameters**: 현재 URL의 쿼리 파라미터 전체 (JSON 형태)
3. **JWT Token**: `localStorage.getItem('ama_token')` (Raw JWT 문자열)
4. **Entity Context**: Entity 관련 정보 (있는 경우)

**UI 설계**:
- 위치: 각 앱의 **푸터 영역 바로 위** (Platform: `<Footer>` 위, Car-Manager: 콘텐츠 하단)
- 형태: 접힌 상태로 시작, 클릭하면 열리는 collapsible textarea
- 배경: 연한 노란색/회색 배경 (디버그 느낌)
- textarea: `readOnly`, 모노스페이스 폰트, 전체 복사 버튼
- 닫기 버튼: 패널 접기

### 3.3 Admin Toggle

**방식**: Platform Admin 레이아웃의 사이드바에 토글 스위치 추가
- localStorage 키: `debug_panel_enabled` (값: `'true'` / `'false'`)
- 기본값: `'false'` (비활성)
- 별도 백엔드 API 불필요 — 순수 프론트엔드 localStorage 기반
- app-car-manager도 동일한 localStorage 키 사용 (같은 도메인이므로 공유됨)

> **참고**: `stg-apps.amoeba.site` 도메인 아래 platform과 app-car-manager 모두 동작하므로 `localStorage`가 공유됨. 하나의 어드민 토글로 두 앱 모두 제어 가능.

---

## 4. Gap Analysis (갭 분석)

### 4.1 Change Scope Summary (변경 범위 요약)

| Area (영역) | Current (현재) | Change (변경) | Impact (영향도) |
|-------------|---------------|---------------|----------------|
| Platform FE - Component | Footer.tsx만 존재 | DebugContextPanel.tsx 신규 | Low |
| Platform FE - App.tsx | Header + main + Footer | Footer 위에 DebugContextPanel 추가 | Low |
| Platform FE - Admin | 설정 페이지 없음 | AdminLayout 사이드바에 토글 추가 | Low |
| Platform FE - i18n | platform, admin NS | debug 관련 키 추가 | Low |
| Car-Manager FE - Component | AppLayout.tsx | DebugContextPanel 추가 | Low |
| Car-Manager FE - i18n | car NS | debug 관련 키 추가 | Low |

### 4.2 File Change List (파일 변경 목록)

| Classification | File | Change Type |
|---------------|------|-------------|
| **Platform FE** | `components/common/DebugContextPanel.tsx` | **New** |
| **Platform FE** | `App.tsx` | Modify (DebugContextPanel import + 배치) |
| **Platform FE** | `components/admin/AdminLayout.tsx` | Modify (토글 스위치 추가) |
| **Platform FE** | `i18n/locales/ko/platform.json` | Modify (debug 키 추가) |
| **Platform FE** | `i18n/locales/en/platform.json` | Modify (debug 키 추가) |
| **Platform FE** | `i18n/locales/vi/platform.json` | Modify (debug 키 추가) |
| **Car-Manager FE** | `components/common/DebugContextPanel.tsx` | **New** |
| **Car-Manager FE** | `components/layout/AppLayout.tsx` | Modify (DebugContextPanel 추가) |
| **Car-Manager FE** | `i18n/locales/ko/car.json` | Modify (debug 키 추가) |
| **Car-Manager FE** | `i18n/locales/en/car.json` | Modify (debug 키 추가) |
| **Car-Manager FE** | `i18n/locales/vi/car.json` | Modify (debug 키 추가) |

### 4.3 DB Migration
- **없음** — 순수 프론트엔드 변경 (localStorage 기반 설정)

---

## 5. User Flow (사용자 플로우)

### 5.1 Admin: Enable Debug Panel (어드민 패널 활성화)

```
Step 1: Admin → /admin/login → 로그인
Step 2: Admin Layout 사이드바 하단에 "Debug Panel" 토글 확인
Step 3: 토글 ON → localStorage.setItem('debug_panel_enabled', 'true')
Step 4: 모든 페이지(platform + car-manager)에서 Debug Panel 표시됨
```

### 5.2 User: View Debug Info (디버그 정보 확인)

```
Step 1: AMA에서 앱 페이지로 이동 (referer + query params + JWT 포함)
        예: https://stg-apps.amoeba.site/?ent_id=xxx&ent_code=VN01&token=yyy
Step 2: debug_panel_enabled === 'true' 이면 푸터 위에 디버그 패널 표시
Step 3: 패널 헤더 클릭 → 접힘/펼침 토글
Step 4: 펼쳐진 상태에서 textarea 내용 확인:
        ─── Referer ───
        https://ama.amoeba.site/entity/apps
        
        ─── Query Parameters ───
        {
          "ent_id": "acce6566-...",
          "ent_code": "VN01",
          ...
        }
        
        ─── JWT Token (Raw) ───
        eyJhbGciOiJIUzI1NiIs...
        
        ─── JWT Payload (Decoded) ───
        {
          "sub": "...",
          "ent_id": "...",
          ...
        }
        
        ─── Entity Context ───
        {
          "entId": "...",
          ...
        }
Step 5: "Copy" 버튼 → 전체 내용 클립보드 복사
```

### 5.3 Condition Flow (조건별 분기)

```
Page Load
  ├─ localStorage.getItem('debug_panel_enabled') === 'true'?
  │   ├─ YES → DebugContextPanel 렌더링
  │   │   ├─ document.referrer → Referer 섹션
  │   │   ├─ window.location.search → Query Params 섹션
  │   │   ├─ localStorage.getItem('ama_token') → JWT Token 섹션
  │   │   │   └─ JWT가 있으면 payload decode 표시
  │   │   └─ sessionStorage/Zustand entity context → Entity 섹션
  │   └─ 접힘/펼침 토글 (기본: 접힌 상태)
  └─ NO → 아무것도 렌더링하지 않음
```

---

## 6. Technical Constraints (기술 제약사항)

| # | Constraint (제약사항) | Description (설명) |
|---|------|------|
| 1 | Same-origin localStorage | platform과 car-manager가 같은 도메인(`stg-apps.amoeba.site`)이므로 localStorage 공유 가능 |
| 2 | document.referrer 제한 | 브라우저/보안 정책에 따라 `document.referrer`가 빈 문자열일 수 있음 (Referrer-Policy) |
| 3 | Query Params 순간 포착 | `EntityContextInitializer`가 쿼리 파라미터를 URL에서 제거하므로, **제거 전** 값을 캡처해야 함 |
| 4 | Security | JWT 원본 표시이므로 프로덕션에서는 반드시 비활성 상태로 운영 — admin 토글 off 기본값 |
| 5 | Cross-App Consistency | 두 앱(platform, car-manager)의 패널 UI/동작이 일관되어야 함 |
| 6 | No Backend Change | 순수 FE 기능 — BE API 추가 불필요 |

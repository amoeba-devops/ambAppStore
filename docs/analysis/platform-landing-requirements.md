---
document_id: APPSTORE-PLT-LANDING-REQ-1.0.0
version: 1.0.0
status: Draft
created: 2026-03-27
updated: 2026-03-27
author: Kim Igyong
reviewers: []
change_log:
  - version: 1.0.0
    date: 2026-03-27
    author: Kim Igyong
    description: Initial draft — Platform Landing & App Subscription Requirements Analysis
---

# ambAppStore — Platform Landing & App Subscription
# Requirements Analysis (플랫폼 서비스 안내 및 앱 구독 요구사항 분석서)

---

## 1. Overview (개요)

### 1.1 Document Purpose (문서 목적)

본 문서는 ambAppStore 플랫폼의 **서비스 안내 페이지**(Landing)와 **앱 사용 신청/구독 관리** 기능에 대한
요구사항을 정의하고 분석한다. AMA(ama.amoeba.site) Entity(법인) 사용자가 AppStore에 등록된 앱을 탐색하고,
Entity 단위로 앱 사용을 신청하며, 관리자가 이를 승인·관리하는 전체 흐름을 다룬다.

### 1.2 Scope (범위)

| In Scope | Out of Scope |
|----------|-------------|
| 앱스토어 서비스 안내 페이지 (카드뷰 목록) | 각 앱 내부 기능 (car-manager, hscode 등) |
| 개별 앱 기능 설명 페이지 | AMA 메인 시스템 코드 수정 |
| 앱 사용 신청 프로세스 (Entity 단위) | 결제/과금 시스템 |
| 어드민 — 신청 관리 (승인/반려/해제) | 앱별 세부 권한 관리 |
| Platform DB (plt_apps, plt_subscriptions) | 개별 앱 DB 스키마 |

### 1.3 Related Documents (관련 문서)

| Document | Path |
|----------|------|
| 요구사항정의서 | `reference/requirements.md` |
| 기능명세서 | `reference/func-definition.md` |
| 화면정의서 | `reference/ui-spec.md` |
| SKILL.md (AMA Integration) | `.github/skills/amb-app-store/SKILL.md` Section 2.5 |

### 1.4 User Types (사용자 유형)

| Type | Level | Description | Key Features |
|------|-------|-------------|-------------|
| **AMA Entity User (법인 사용자)** | USER | AMA에서 JWT 인증된 Entity 소속 사용자 | 앱 목록 조회, 앱 상세 조회, 앱 사용 신청 |
| **AppStore Admin (어드민)** | ADMIN | 앱스토어 관리자 (Amoeba Company 내부) | 신청 승인/반려, 구독 관리, 앱 등록/수정 |
| **Anonymous (비인증)** | — | 로그인하지 않은 방문자 | 앱 목록/상세 조회만 가능 (신청 불가) |

---

## 2. User Flow Analysis (사용자 흐름 분석)

### 2.1 App Discovery & Subscription Flow (앱 탐색 및 구독 흐름)

```
AMA Entity User
│
├── 1. AMA(ama.amoeba.site) 로그인 → JWT 발급
│
├── 2. AppStore 서비스 안내 페이지 접근 (apps.amoeba.site)
│      └── 앱 카드뷰 목록 (ACTIVE / COMING_SOON 앱 표시)
│
├── 3. 앱 카드 클릭 → 앱 기능 설명 페이지
│      ├── 앱 스크린샷, 기능 소개, 주요 특징
│      └── [앱 사용 신청] 버튼
│
├── 4. 앱 사용 신청
│      ├── Entity Code 입력 (AMA 법인 코드, 예: AMB-KR)
│      ├── Entity Name 입력 (법인 명칭)
│      ├── 신청자 정보 (JWT에서 자동 추출: 이름, 이메일)
│      └── 신청 사유 (선택)
│
├── 5. 신청 완료 → 상태: PENDING
│
└── 6. Admin 승인 후 → ACTIVE → 앱 사용 가능
       └── apps.amoeba.site/{slug} 접속 시 SubscriptionGuard 통과
```

### 2.2 Admin Management Flow (관리자 관리 흐름)

```
AppStore Admin
│
├── 1. 어드민 대시보드 접근 (apps.amoeba.site/admin)
│
├── 2. 구독 신청 목록 조회
│      ├── 상태별 필터: PENDING / ACTIVE / SUSPENDED / REJECTED / CANCELLED
│      ├── 앱별 필터
│      └── Entity별 검색
│
├── 3. 신청 상세 조회
│      ├── Entity 정보 (code, name)
│      ├── 신청자 정보
│      ├── 신청 사유
│      └── 신청 일시
│
├── 4. 승인/반려 처리
│      ├── 승인 → sub_status: ACTIVE, sub_approved_at 기록
│      └── 반려 → sub_status: REJECTED, 반려 사유 입력 필수
│
├── 5. 구독 관리
│      ├── 구독 일시 정지 (SUSPENDED)
│      ├── 구독 해제 (CANCELLED)
│      └── 구독 재활성화 (SUSPENDED → ACTIVE)
│
└── 6. 앱 마스터 관리
       ├── 앱 등록/수정 (이름, 설명, 아이콘, 상태)
       └── 앱 상태 변경 (ACTIVE / INACTIVE / COMING_SOON)
```

---

## 3. Functional Requirements (기능 요구사항)

### 3.1 Service Landing Page — App Card View (서비스 안내 페이지 — 앱 카드뷰)

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-PLT-101 | App card view displaying all registered apps in grid layout (등록된 앱을 카드 그리드로 표시) | P0 | 반응형: Desktop 3열, Tablet 2열, Mobile 1열 |
| FR-PLT-102 | Each card shows: app icon, name, short description, status badge (카드에 앱 아이콘, 이름, 요약 설명, 상태 뱃지 표시) | P0 | |
| FR-PLT-103 | Status badge: "Available" (ACTIVE), "Coming Soon" (COMING_SOON) — INACTIVE apps hidden (상태 뱃지: 사용가능, 출시예정 — 비활성 앱 미노출) | P0 | |
| FR-PLT-104 | Card click navigates to app detail page (카드 클릭 시 앱 상세 페이지 이동) | P0 | |
| FR-PLT-105 | Entity user's subscribed apps show "In Use" badge (이미 구독 중인 앱은 "사용중" 뱃지 표시) | P1 | JWT 인증 시에만 |
| FR-PLT-106 | Category/tag-based filtering if apps exceed 8 (앱 8개 초과 시 카테고리/태그 필터 추가) | P2 | Phase 2 |

### 3.2 App Detail Page (앱 기능 설명 페이지)

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-PLT-201 | App detail page with: name, full description, feature list, screenshots (앱 상세: 이름, 전체 설명, 기능 목록, 스크린샷) | P0 | |
| FR-PLT-202 | Screenshots displayed as image carousel/gallery (스크린샷 이미지 캐러셀/갤러리) | P1 | |
| FR-PLT-203 | Key features list with icons (주요 기능 아이콘 리스트) | P0 | |
| FR-PLT-204 | "Apply for this App" button — visible to authenticated users only (앱 사용 신청 버튼 — 인증 사용자에게만 노출) | P0 | |
| FR-PLT-205 | If already subscribed, show "In Use" status instead of apply button (이미 구독 중이면 신청 버튼 대신 "사용중" 표시) | P0 | |
| FR-PLT-206 | If subscription PENDING, show "Under Review" status (신청 대기중이면 "심사중" 표시) | P0 | |
| FR-PLT-207 | "Go to App" button for active subscribers — opens `/{slug}` (구독 활성 사용자에게 "앱 바로가기" 버튼 표시) | P1 | |
| FR-PLT-208 | Anonymous users see "Login to Apply" button linking to AMA login (비인증 사용자에게 "로그인 후 신청" 버튼 → AMA 로그인) | P0 | |

### 3.3 App Subscription Request (앱 사용 신청)

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-PLT-301 | Subscription request form: Entity Code (required), Entity Name (required), Reason (optional) (구독 신청 폼: Entity Code 필수, Entity Name 필수, 신청 사유 선택) | P0 | |
| FR-PLT-302 | Applicant info auto-filled from JWT: name, email (신청자 정보 JWT에서 자동 추출: 이름, 이메일) | P0 | |
| FR-PLT-303 | Duplicate subscription prevention — reject if same ent_id + app_id already ACTIVE or PENDING (중복 신청 방지 — 같은 Entity+앱 조합이 ACTIVE/PENDING이면 거부) | P0 | |
| FR-PLT-304 | Entity Code format validation (Entity Code 형식 검증) | P1 | 예: 영문+숫자+하이픈, 최대 20자 |
| FR-PLT-305 | Successful request → status PENDING, confirmation message displayed (신청 완료 → PENDING 상태, 완료 메시지 표시) | P0 | |
| FR-PLT-306 | Request history — user can view own entity's subscription requests (신청 이력 — 사용자가 자기 Entity의 신청 내역 조회 가능) | P1 | |

### 3.4 Admin — Subscription Management (어드민 — 구독 관리)

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-PLT-401 | Admin subscription list with status filter: ALL / PENDING / ACTIVE / SUSPENDED / REJECTED / CANCELLED (어드민 구독 목록 — 상태 필터) | P0 | |
| FR-PLT-402 | Search by Entity Code or Entity Name (Entity Code 또는 Name으로 검색) | P0 | |
| FR-PLT-403 | Filter by app (앱별 필터) | P0 | |
| FR-PLT-404 | Approve subscription — sets status ACTIVE, records approved_at (구독 승인 — ACTIVE로 변경, 승인일시 기록) | P0 | |
| FR-PLT-405 | Reject subscription — requires rejection reason (구독 반려 — 반려 사유 필수 입력) | P0 | |
| FR-PLT-406 | Suspend subscription — temporarily disable access (구독 일시 정지 — 임시 접근 차단) | P0 | |
| FR-PLT-407 | Cancel subscription — permanently deactivate (구독 해제 — 영구 비활성) | P0 | |
| FR-PLT-408 | Reactivate suspended subscription (정지된 구독 재활성화) | P1 | |
| FR-PLT-409 | Bulk approve/reject for multiple pending requests (다건 일괄 승인/반려) | P2 | |
| FR-PLT-410 | Subscription detail view: Entity info, applicant info, status history (구독 상세: Entity 정보, 신청자, 상태 변경 이력) | P0 | |

### 3.5 Admin — App Master Management (어드민 — 앱 마스터 관리)

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-PLT-501 | App list in admin panel (어드민 앱 목록) | P0 | |
| FR-PLT-502 | Register new app: slug, name, description, icon, status, features, screenshots (신규 앱 등록) | P0 | |
| FR-PLT-503 | Edit app info (앱 정보 수정) | P0 | |
| FR-PLT-504 | Change app status: ACTIVE / INACTIVE / COMING_SOON (앱 상태 변경) | P0 | |
| FR-PLT-505 | App soft delete (앱 소프트 삭제) | P0 | |
| FR-PLT-506 | Per-app subscription statistics: total entities, active, pending, suspended (앱별 구독 통계) | P1 | |

---

## 4. Data Model Analysis (데이터 모델 분석)

### 4.1 Database: `db_app_platform`

#### 4.1.1 plt_apps (앱 마스터)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `app_id` | CHAR(36) | PK, UUID v4 | App unique ID (앱 고유 ID) |
| `app_slug` | VARCHAR(50) | NOT NULL, UNIQUE | URL slug (예: 'app-car-manager') |
| `app_name` | VARCHAR(100) | NOT NULL | Display name (표시 이름) |
| `app_name_en` | VARCHAR(100) | | English name (영문 이름) |
| `app_short_desc` | VARCHAR(200) | | Short description for card view (카드뷰 요약 설명) |
| `app_description` | TEXT | | Full description for detail page (상세 설명) |
| `app_icon_url` | VARCHAR(500) | | App icon image URL (앱 아이콘) |
| `app_screenshots` | JSON | | Screenshot URLs array (스크린샷 URL 배열) |
| `app_features` | JSON | | Feature list with icons (기능 목록 JSON) |
| `app_category` | VARCHAR(50) | | Category tag (카테고리 태그) |
| `app_status` | ENUM | NOT NULL, DEFAULT 'COMING_SOON' | 'ACTIVE', 'INACTIVE', 'COMING_SOON' |
| `app_port_fe` | SMALLINT | | Frontend dev port (FE 개발 포트) |
| `app_port_be` | SMALLINT | | Backend BFF port (BE BFF 포트) |
| `app_sort_order` | SMALLINT | DEFAULT 0 | Display sort order (표시 정렬 순서) |
| `app_created_at` | DATETIME | NOT NULL, DEFAULT NOW | Created timestamp (생성일시) |
| `app_updated_at` | DATETIME | NOT NULL, DEFAULT NOW ON UPDATE | Updated timestamp (수정일시) |
| `app_deleted_at` | DATETIME | NULL | Soft delete (소프트 삭제) |

#### 4.1.2 plt_subscriptions (Entity별 앱 구독)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `sub_id` | CHAR(36) | PK, UUID v4 | Subscription unique ID (구독 고유 ID) |
| `ent_id` | CHAR(36) | NOT NULL | AMA Entity UUID (AMA 법인 UUID) |
| `ent_code` | VARCHAR(20) | NOT NULL | AMA Entity Code (AMA 법인 코드, 예: AMB-KR) |
| `ent_name` | VARCHAR(100) | NOT NULL | Entity display name (법인 표시명) |
| `app_id` | CHAR(36) | NOT NULL, FK → plt_apps | Target app (대상 앱) |
| `sub_status` | ENUM | NOT NULL, DEFAULT 'PENDING' | 'PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'CANCELLED' |
| `sub_requested_by` | CHAR(36) | NOT NULL | Applicant AMA user ID (신청자 AMA user_id) |
| `sub_requested_name` | VARCHAR(100) | NOT NULL | Applicant name (신청자 이름) |
| `sub_requested_email` | VARCHAR(200) | NOT NULL | Applicant email (신청자 이메일) |
| `sub_reason` | VARCHAR(500) | | Application reason (신청 사유) |
| `sub_reject_reason` | VARCHAR(500) | | Rejection reason (반려 사유) |
| `sub_approved_by` | CHAR(36) | | Approver admin user ID (승인자 ID) |
| `sub_approved_at` | DATETIME | | Approval timestamp (승인일시) |
| `sub_expires_at` | DATETIME | | Expiration — NULL = unlimited (만료일 — NULL = 무기한) |
| `sub_created_at` | DATETIME | NOT NULL, DEFAULT NOW | Created timestamp (생성일시) |
| `sub_updated_at` | DATETIME | NOT NULL, DEFAULT NOW ON UPDATE | Updated timestamp (수정일시) |
| `sub_deleted_at` | DATETIME | NULL | Soft delete (소프트 삭제) |

**Constraints**:
```sql
UNIQUE KEY uq_plt_subscriptions_ent_app (ent_id, app_id, sub_status)
  -- 동일 Entity+App 조합에서 ACTIVE/PENDING 중복 방지는 애플리케이션 레벨에서 처리
FOREIGN KEY (app_id) REFERENCES plt_apps(app_id)
```

**Indexes**:
```sql
CREATE INDEX idx_plt_subscriptions_ent ON plt_subscriptions(ent_id, sub_status);
CREATE INDEX idx_plt_subscriptions_app ON plt_subscriptions(app_id, sub_status);
CREATE INDEX idx_plt_subscriptions_status ON plt_subscriptions(sub_status, sub_created_at);
CREATE INDEX idx_plt_subscriptions_ent_code ON plt_subscriptions(ent_code);
```

### 4.2 Subscription Status State Machine (구독 상태 전이도)

```
                          ┌─────────────┐
                          │   PENDING    │ ← 신규 신청
                          └──────┬──────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            │             ▼
             ┌────────────┐     │      ┌─────────────┐
             │   ACTIVE   │     │      │  REJECTED   │ ← Admin 반려
             └──────┬─────┘     │      └─────────────┘
                    │           │
            ┌───────┼───────┐   │
            ▼       │       ▼   │
    ┌────────────┐  │  ┌──────────────┐
    │ SUSPENDED  │──┘  │  CANCELLED   │ ← Admin 해제 또는 Entity 요청
    └────────────┘     └──────────────┘
         │
         └── 재활성화 → ACTIVE
```

**Allowed Transitions (허용 상태 전이)**:

| From | To | Trigger | Note |
|------|----|---------|------|
| PENDING | ACTIVE | Admin approve (관리자 승인) | sub_approved_at, sub_approved_by 기록 |
| PENDING | REJECTED | Admin reject (관리자 반려) | sub_reject_reason 필수 |
| ACTIVE | SUSPENDED | Admin suspend (관리자 정지) | 임시 접근 차단 |
| ACTIVE | CANCELLED | Admin cancel or Entity request (해제) | 영구 비활성 |
| SUSPENDED | ACTIVE | Admin reactivate (재활성화) | |
| SUSPENDED | CANCELLED | Admin cancel (해제) | |

---

## 5. API Design (API 설계)

### 5.1 Public APIs (공개 — 인증 불필요)

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| GET | `/api/v1/platform/apps` | App list for landing page (서비스 안내 앱 목록) | `BaseListResponse<AppCardResponse>` |
| GET | `/api/v1/platform/apps/:slug` | App detail (앱 상세 정보) | `BaseSingleResponse<AppDetailResponse>` |
| GET | `/health` | Health check | `{ status: 'ok' }` |

### 5.2 Authenticated APIs (인증 필요 — AMA JWT)

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| POST | `/api/v1/platform/subscriptions` | Submit subscription request (앱 사용 신청) | `BaseSingleResponse<SubscriptionResponse>` |
| GET | `/api/v1/platform/subscriptions/my` | My entity's subscriptions (내 Entity 구독 목록) | `BaseListResponse<SubscriptionResponse>` |
| GET | `/api/v1/platform/subscriptions/check/:appSlug` | Check subscription status for current entity (현재 Entity의 특정 앱 구독 상태 확인) | `BaseSingleResponse<SubscriptionStatusResponse>` |

### 5.3 Admin APIs (어드민 전용)

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| GET | `/api/v1/admin/subscriptions` | All subscriptions with filters (전체 구독 목록 + 필터) | `BaseListResponse<AdminSubscriptionResponse>` |
| GET | `/api/v1/admin/subscriptions/:id` | Subscription detail (구독 상세) | `BaseSingleResponse<AdminSubscriptionDetailResponse>` |
| PATCH | `/api/v1/admin/subscriptions/:id/approve` | Approve subscription (구독 승인) | `BaseSingleResponse<SubscriptionResponse>` |
| PATCH | `/api/v1/admin/subscriptions/:id/reject` | Reject subscription (구독 반려) | `BaseSingleResponse<SubscriptionResponse>` |
| PATCH | `/api/v1/admin/subscriptions/:id/suspend` | Suspend subscription (구독 정지) | `BaseSingleResponse<SubscriptionResponse>` |
| PATCH | `/api/v1/admin/subscriptions/:id/cancel` | Cancel subscription (구독 해제) | `BaseSingleResponse<SubscriptionResponse>` |
| PATCH | `/api/v1/admin/subscriptions/:id/reactivate` | Reactivate subscription (구독 재활성화) | `BaseSingleResponse<SubscriptionResponse>` |
| GET | `/api/v1/admin/apps` | Admin app list (어드민 앱 목록) | `BaseListResponse<AdminAppResponse>` |
| POST | `/api/v1/admin/apps` | Register new app (앱 등록) | `BaseSingleResponse<AdminAppResponse>` |
| PATCH | `/api/v1/admin/apps/:id` | Update app (앱 수정) | `BaseSingleResponse<AdminAppResponse>` |
| DELETE | `/api/v1/admin/apps/:id` | Soft delete app (앱 삭제) | `BaseSingleResponse<void>` |
| GET | `/api/v1/admin/stats/subscriptions` | Subscription statistics (구독 통계) | `BaseSingleResponse<SubscriptionStatsResponse>` |

### 5.4 Request/Response DTO Samples

**POST /api/v1/platform/subscriptions** — Request (snake_case):
```json
{
  "app_slug": "app-car-manager",
  "ent_code": "AMB-KR",
  "ent_name": "Amoeba Company Korea",
  "reason": "법인차량 관리 디지털화를 위해 신청합니다"
}
```

**Response (camelCase)**:
```json
{
  "success": true,
  "data": {
    "subId": "uuid-...",
    "entCode": "AMB-KR",
    "entName": "Amoeba Company Korea",
    "appSlug": "app-car-manager",
    "appName": "법인차량관리",
    "status": "PENDING",
    "requestedBy": "Kim Igyong",
    "requestedEmail": "kim@amoeba.site",
    "createdAt": "2026-03-27T10:00:00Z"
  },
  "timestamp": "2026-03-27T10:00:00Z"
}
```

**PATCH /api/v1/admin/subscriptions/:id/reject** — Request:
```json
{
  "reject_reason": "현재 해당 앱은 내부 테스트 기간입니다. 4월 이후 재신청 바랍니다."
}
```

---

## 6. Screen Specification Summary (화면 명세 요약)

### 6.1 SCR-PLT-001: Service Landing Page (서비스 안내 페이지)

**URL**: `apps.amoeba.site/`

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER: ambAppStore 로고  |  [로그인] or [사용자명 ▼]               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🏪 AMA App Store                                                   │
│  AMA 생태계에서 사용할 수 있는 커스텀 앱을 만나보세요                  │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  🚗 아이콘    │  │  📦 아이콘    │  │  📊 아이콘    │              │
│  │              │  │              │  │              │              │
│  │ 법인차량관리  │  │ HS Code Tool │  │ 매출리포트    │              │
│  │              │  │              │  │              │              │
│  │ 법인 차량의   │  │ HS Code 검색 │  │ SocialBean   │              │
│  │ 배차, 운행,  │  │ 및 AI 품목   │  │ 매출 현황     │              │
│  │ 유지보수 관리 │  │ 분류 도구    │  │ 대시보드      │              │
│  │              │  │              │  │              │              │
│  │ [● 사용가능]  │  │ [● 사용가능]  │  │ [◐ 출시예정]  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                     │
│  ┌──────────────┐                                                  │
│  │  📈 아이콘    │                                                  │
│  │              │                                                  │
│  │ 재고관리예측  │                                                  │
│  │              │                                                  │
│  │ SocialBean   │                                                  │
│  │ 재고 관리 및 │                                                  │
│  │ AI 수요 예측 │                                                  │
│  │              │                                                  │
│  │ [◐ 출시예정]  │                                                  │
│  └──────────────┘                                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Card Component Spec**:
- Size: `min-w-[280px] max-w-[360px]`
- Layout: icon (48px) + name (text-lg font-bold) + description (text-sm text-gray-600, 2-line clamp) + status badge
- Status Badge: `Available` = green, `Coming Soon` = amber, `In Use` = blue (인증 시)
- Hover: `shadow-md → shadow-lg` transition
- Click: navigate to `/apps/{slug}`

### 6.2 SCR-PLT-002: App Detail Page (앱 기능 설명 페이지)

**URL**: `apps.amoeba.site/apps/{slug}`

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER                                                              │
├─────────────────────────────────────────────────────────────────────┤
│ ← 뒤로                                                             │
│                                                                     │
│  🚗  법인차량관리 Corporate Vehicle Manager                         │
│  ● Available                                                        │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │            스크린샷 캐러셀 (좌우 스와이프)                      │  │
│  │     [  ◀  ]   📸 Screenshot 1 / 4   [  ▶  ]                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ## 앱 소개                                                         │
│  법인 차량의 등록, 배차 신청/승인, 운행일지, 유지보수 비용을          │
│  통합 관리하는 앱입니다.                                            │
│                                                                     │
│  ## 주요 기능                                                       │
│  ✅ 차량 등록 및 상태 관리    ✅ 배차 신청/승인 워크플로우            │
│  ✅ 운행일지 자동 기록        ✅ 유지보수 비용 추적                   │
│  ✅ 배차 캘린더 뷰            ✅ 월간/연간 비용 리포트                │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                                                              │  │
│  │   [🚀 앱 사용 신청]        ← 인증 사용자에게 노출              │  │
│  │   [🔒 로그인 후 신청하기]   ← 비인증 사용자에게 노출            │  │
│  │   [✅ 사용중 — 앱 바로가기] ← 구독 활성 사용자에게 노출         │  │
│  │   [⏳ 심사중]              ← PENDING 상태 사용자에게 노출       │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.3 SCR-PLT-003: Subscription Request Modal (앱 사용 신청 모달)

```
┌──────────────────────────────────────────────┐
│  앱 사용 신청                           [✕]  │
├──────────────────────────────────────────────┤
│                                              │
│  앱: 🚗 법인차량관리                         │
│                                              │
│  ── 신청자 정보 (자동 입력) ──               │
│  이름:   Kim Igyong                          │
│  이메일: kim@amoeba.site                     │
│                                              │
│  ── Entity 정보 (직접 입력) ──               │
│  Entity Code *  [ AMB-KR          ]          │
│  Entity Name *  [ Amoeba Company Korea  ]    │
│                                              │
│  ── 신청 사유 (선택) ──                      │
│  [                                      ]    │
│  [                                      ]    │
│                                              │
│           [취소]    [신청하기]                │
└──────────────────────────────────────────────┘
```

### 6.4 SCR-PLT-004: Admin — Subscription List (어드민 구독 관리)

**URL**: `apps.amoeba.site/admin/subscriptions`

```
┌─────────────────────────────────────────────────────────────────────┐
│ ADMIN HEADER: ambAppStore Admin  |  [앱 관리] [구독 관리] [통계]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  구독 관리                                                          │
│                                                                     │
│  [전체] [대기중(5)] [활성] [정지] [반려] [해제]                     │
│  앱: [전체 ▼]   🔍 Entity Code/Name 검색                           │
│                                                                     │
├──────┬────────────┬──────────────┬──────┬──────────┬───────────────┤
│ App  │ Entity     │ 신청자       │ 상태 │ 신청일   │ 액션          │
├──────┼────────────┼──────────────┼──────┼──────────┼───────────────┤
│ 차량 │ AMB-KR     │ Kim Igyong   │ 대기 │ 03/27    │ [승인][반려]  │
│ 관리 │ Amoeba KR  │ kim@amoe..   │      │          │               │
├──────┼────────────┼──────────────┼──────┼──────────┼───────────────┤
│ HS   │ AMB-VN     │ Tran Minh    │ 활성 │ 03/25    │ [정지][해제]  │
│ Code │ Amoeba VN  │ tran@amoe..  │      │          │               │
└──────┴────────────┴──────────────┴──────┴──────────┴───────────────┘
│                               < 1 2 3 >                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Non-Functional Requirements (비기능 요구사항)

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-PLT-001 | Landing page load time ≤ 2s (first contentful paint) (랜딩 페이지 로딩 2초 이내) | P0 |
| NFR-PLT-002 | Responsive design: Desktop (≥1024px), Tablet (768~1023px), Mobile (<768px) (반응형 3단계) | P0 |
| NFR-PLT-003 | Server-side input validation for all subscription APIs (서버측 입력 검증) | P0 |
| NFR-PLT-004 | Rate limiting on subscription request API: max 5 requests per entity per hour (구독 신청 레이트 리밋) | P1 |
| NFR-PLT-005 | Admin pages accessible only with ADMIN role JWT (어드민 페이지 ADMIN 역할만 접근) | P0 |
| NFR-PLT-006 | All UI text internationalized via i18n (KO required, EN recommended) (i18n 처리) | P1 |
| NFR-PLT-007 | XSS prevention — sanitize all user inputs (XSS 방어 — 사용자 입력 필터링) | P0 |
| NFR-PLT-008 | CORS configured for ama.amoeba.site and apps.amoeba.site only (CORS 제한) | P0 |

---

## 8. Implementation Scope Summary (구현 범위 요약)

### 8.1 Backend Modules (NestJS — Platform BFF :3100)

| Module | Description |
|--------|-------------|
| `platform-app` | App master CRUD (plt_apps 관리) |
| `platform-subscription` | Subscription lifecycle management (plt_subscriptions 관리) |
| `admin` | Admin-only controllers and guards |
| `auth` | AMA JWT verification, CurrentUser decorator |

### 8.2 Frontend Routes (React — `apps.amoeba.site`)

| Route | Page | Auth |
|-------|------|------|
| `/` | Landing — App card view | Public |
| `/apps/:slug` | App detail page | Public (buttons differ by auth) |
| `/my/subscriptions` | My subscription list | Required |
| `/admin/subscriptions` | Admin subscription management | Admin only |
| `/admin/apps` | Admin app management | Admin only |
| `/admin/stats` | Admin statistics | Admin only |

### 8.3 Traceability Matrix (추적성 매트릭스)

| FR ID | API | Screen | DB Table |
|-------|-----|--------|----------|
| FR-PLT-101~106 | GET /platform/apps | SCR-PLT-001 | plt_apps |
| FR-PLT-201~208 | GET /platform/apps/:slug | SCR-PLT-002 | plt_apps |
| FR-PLT-301~306 | POST /platform/subscriptions | SCR-PLT-003 | plt_subscriptions |
| FR-PLT-401~410 | GET/PATCH /admin/subscriptions/* | SCR-PLT-004 | plt_subscriptions |
| FR-PLT-501~506 | GET/POST/PATCH/DELETE /admin/apps/* | (admin app page) | plt_apps |

---

*Document: APPSTORE-PLT-LANDING-REQ-1.0.0 | Project: ambAppStore | Author: Kim Igyong | Created: 2026-03-27*

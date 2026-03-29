---
document_id: ASM-ANALYSIS-1.0.0
version: 1.0.0
status: Draft
created: 2026-03-29
updated: 2026-03-29
author: AI Assistant
based_on: ASM-FDS-USR-001 v1.0, ASM-FDS-USR-002 v1.1
app: app-stock-management
phase: Phase 1 — Corporate User Management & Entity Access Control
---

# ambStockManagement Phase 1 — Requirements Analysis (요구사항분석서)
## Corporate User Management & Entity Access Control (법인 사용자 관리 & Entity 접근 제어)

---

## Table of Contents (목차)

1. [Requirements Summary (요구사항 요약)](#1-requirements-summary-요구사항-요약)
2. [AS-IS Analysis (현황 분석)](#2-as-is-analysis-현황-분석)
3. [TO-BE Requirements (TO-BE 요구사항)](#3-to-be-requirements-to-be-요구사항)
4. [Gap Analysis (갭 분석)](#4-gap-analysis-갭-분석)
5. [User Flow (사용자 플로우)](#5-user-flow-사용자-플로우)
6. [Technical Constraints (기술 제약사항)](#6-technical-constraints-기술-제약사항)

---

## 1. Requirements Summary (요구사항 요약)

`reference/req/ambStockManagement_CorporateUser_FDS_SCR_v1.0.md`와  
`reference/req/ambStockManagement_EntityAccess_FDS_SCR_v1.1.md`를 기반으로  
**app-stock-management** 앱의 Phase 1 — 법인 사용자 관리 및 Entity 접근 제어 기능을 신규 구현한다.

### 1.1 Project Context (프로젝트 컨텍스트)

| Item | Value |
|------|-------|
| Project Name | ambStockManagement |
| Project Code | ASM |
| App Slug | `app-stock-management` |
| Database | `db_app_stock` |
| Table Prefix | `asm_` |
| BE Port | :3104 |
| FE Port | :5204 |
| Error Code Prefix | `ASM-E{4digit}` |
| Nginx Path | `/app-stock-management/` |

### 1.2 Key Difference from Other Apps (다른 앱과의 차이점)

> **Critical**: app-stock-management는 기존 app-car-manager 등과 달리 **AMA JWT SSO Passthrough를 사용하지 않는다**.  
> 이 앱은 **독자적 인증 시스템** (법인 코드 + 이메일 + 비밀번호 로그인)을 사용하며, 자체 사용자 DB를 관리한다.

| Item | app-car-manager (기존) | app-stock-management (신규) |
|------|----------------------|---------------------------|
| Authentication | AMA JWT SSO Passthrough | Self-managed (Entity Code + Email + Password) |
| User Management | AMA에서 관리 | 자체 `asm_users` 테이블 |
| Entity Isolation | `ent_id` (AMA Entity ID) | `crp_id` (Corporation ID) |
| Login Flow | AMA 로그인 → JWT 전달 | Entity Code 진입 → 자체 로그인 |
| User Registration | AMA에 의존 | Corporation 담당자 → ADMIN 승인 → 계정 생성 |
| Role System | AMA roles | ADMIN / OPERATOR / MANAGER / VIEWER |

### 1.3 Requirements List (요구사항 목록)

| # | Requirement (요구사항) | Type (유형) | Priority | Source |
|---|----------------------|-------------|----------|--------|
| R-01 | app-stock-management 앱 초기 프로젝트 스캐폴딩 (BE+FE+Docker) | Infrastructure | P0 | — |
| R-02 | Corporation (법인) CRUD + 상태 관리 | Backend + Frontend | P0 | ASM-FDS-USR-001 E1 |
| R-03 | UserApplication (사용자 신청) 워크플로우 전체 | Backend + Frontend | P0 | ASM-FDS-USR-001 E2 |
| R-04 | User (사용자) 관리 + 자동 생성 | Backend + Frontend | P0 | ASM-FDS-USR-001 E3 |
| R-05 | Entity Code 기반 3-field 로그인 | Backend + Frontend | P0 | ASM-FDS-USR-002 F1 |
| R-06 | EntityScopeGuard — 데이터 격리 | Backend | P0 | ASM-FDS-USR-002 F2 |
| R-07 | Entity 안내 페이지 (entity-info) | Frontend | P0 | ASM-FDS-USR-002 F3 |
| R-08 | Frontend Route Guard | Frontend | P0 | ASM-FDS-USR-002 F3 |
| R-09 | 최초 비밀번호 변경 강제 | Backend + Frontend | P1 | ASM-FDS-USR-001 FR-USR-011 |
| R-10 | 로그인 실패 잠금 (5회) | Backend | P1 | ASM-FDS-USR-001 FR-USR-012 |
| R-11 | Entity Validation API | Backend | P0 | ASM-FDS-USR-002 F5 |
| R-12 | i18n 번역 파일 (ko/en/vi) | Frontend | P1 | Convention |
| R-13 | DB 초기화 스크립트 + Docker 구성 | Infrastructure | P0 | Convention |

---

## 2. AS-IS Analysis (현황 분석)

### 2.1 Current State (현재 상태)

**`apps/app-stock-management/` 디렉토리가 존재하지 않는다. 완전 신규 구현.**

### 2.2 Platform Infrastructure (플랫폼 인프라 현황)

| Component | Status | Path/Config |
|-----------|--------|-------------|
| Nginx Routing | ✅ 설정 완료 | `platform/nginx/apps.amoeba.site.conf` — `/app-stock-management/` + `/app-stock-management/api/` |
| Docker Network | ✅ 사용 가능 | `amb-network` (bridge) |
| Turborepo Workspace | ✅ 설정 완료 | `package.json` — `apps/*/frontend`, `apps/*/backend` |
| Shared tsconfig | ✅ 사용 가능 | `packages/tsconfig/` (base, nestjs, react) |
| Deploy Script | ⚠️ 업데이트 필요 | `platform/scripts/deploy-staging.sh` — stock-management 앱 추가 필요 |
| Platform Subscription | ⚠️ 등록 필요 | `plt_apps` 테이블에 `app-stock-management` 레코드 INSERT 필요 |

### 2.3 Reference App Structure — app-car-manager (참조 앱 구조)

기존 app-car-manager의 구조를 기반으로 동일한 패턴을 적용한다.

**Backend 구조:**
```
apps/app-car-manager/backend/src/
├── app.module.ts              # ConfigModule + TypeORM + 도메인 모듈 등록
├── main.ts                    # CORS, ValidationPipe, /api/v1 prefix, Swagger
├── health.controller.ts       # GET /api/v1/health
├── auth/                      # JWT Passport + @Auth() + @CurrentUser()
├── domain/{module}/           # entity/, dto/, mapper/, service/, controller/
└── common/                    # enums, base-response.dto, business.exception, filter
```

**Frontend 구조:**
```
apps/app-car-manager/frontend/src/
├── App.tsx                    # BrowserRouter basename="/app-car-manager"
├── i18n/                      # i18n.ts + locales/{ko,en,vi}/car.json
├── lib/                       # api-client.ts (axios + JWT interceptor) + query-client.ts
├── services/api.ts            # 모든 API 엔드포인트 중앙 관리
├── hooks/                     # React Query 훅 (query key factory)
├── stores/                    # Zustand (auth.store, toast.store)
├── pages/                     # {Domain}{Action}Page.tsx
└── components/                # common/ + layout/ + {domain}/
```

### 2.4 Key Differences Requiring New Implementation (신규 구현이 필요한 차이점)

| Aspect | app-car-manager (기존) | app-stock-management (신규) |
|--------|----------------------|---------------------------|
| Auth Module | AMA JWT 검증만 (단순) | 자체 로그인/JWT발급/비밀번호 관리 (풀스택) |
| Guard Stack | JwtAuthGuard + RoleGuard | JwtAuthGuard + EntityScopeGuard + RoleGuard |
| User Entity | 없음 (AMA에서 관리) | `asm_users` + `asm_corporations` + `asm_user_applications` |
| Login Page | 없음 (AMA 로그인으로 리다이렉트) | `/login?entity={crp_code}` 자체 페이지 |
| Entity Info Page | 없음 | `/entity-info` 안내 페이지 |
| Route Guard | 없음 (모든 라우트 동일) | EntityGuard (URL crp_code 검증, 강제 비밀번호 변경) |
| URL Structure | `/vehicles`, `/dispatches` | `/{crp_code}/dashboard`, `/admin/corporations` |
| Password Mgmt | 없음 | bcrypt hash, 임시 비밀번호, 5회 잠금 |
| Email Service | 없음 | 승인/반려 알림, 임시 비밀번호 발송 (Phase 2 또는 stub) |

---

## 3. TO-BE Requirements (TO-BE 요구사항)

### 3.1 Database Schema (DB 스키마)

#### E1. `asm_corporations` — Corporation (법인)

| Column | Type | Constraint | Description |
|--------|------|-----------|-------------|
| `crp_id` | CHAR(36) | PK, UUID | Corporation PK |
| `crp_name` | VARCHAR(100) | NOT NULL | Corporation name (법인명) |
| `crp_code` | VARCHAR(20) | UNIQUE, NOT NULL | Corporation code — login entry point (법인코드) |
| `crp_biz_no` | VARCHAR(20) | UNIQUE, NULL | Business registration number (사업자등록번호) |
| `crp_country` | VARCHAR(3) | NOT NULL, DEFAULT 'VNM' | ISO 3166-1 country code |
| `crp_contact_name` | VARCHAR(50) | NOT NULL | Contact person name (담당자명) |
| `crp_contact_email` | VARCHAR(100) | NOT NULL | Contact email |
| `crp_contact_phone` | VARCHAR(20) | NULL | Contact phone |
| `crp_status` | ENUM('ACTIVE','SUSPENDED','INACTIVE') | NOT NULL, DEFAULT 'ACTIVE' | Status |
| `crp_max_user_count` | INT | NOT NULL, DEFAULT 10 | Max user limit |
| `crp_created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Created at |
| `crp_updated_at` | DATETIME | NOT NULL, ON UPDATE CURRENT_TIMESTAMP | Updated at |
| `crp_deleted_at` | DATETIME | NULL | Soft delete |

#### E2. `asm_user_applications` — UserApplication (사용자 신청)

| Column | Type | Constraint | Description |
|--------|------|-----------|-------------|
| `uap_id` | CHAR(36) | PK, UUID | Application PK |
| `uap_no` | VARCHAR(20) | UNIQUE, NOT NULL | Auto-generated code (예: UAP-2026-000001) |
| `crp_id` | CHAR(36) | FK → asm_corporations, NOT NULL | Corporation |
| `uap_applicant_name` | VARCHAR(50) | NOT NULL | Applicant name (법인 담당자) |
| `uap_target_name` | VARCHAR(50) | NOT NULL | Target user name |
| `uap_target_email` | VARCHAR(100) | NOT NULL | Target user email (login ID) |
| `uap_target_role` | ENUM('OPERATOR','MANAGER','VIEWER') | NOT NULL | Requested role |
| `usr_id` | CHAR(36) | FK → asm_users, NULL | Created user (after approval) |
| `uap_status` | ENUM('PENDING','APPROVED','REJECTED','CANCELLED') | NOT NULL, DEFAULT 'PENDING' | Status |
| `uap_reject_reason` | TEXT | NULL | Rejection reason |
| `uap_note` | TEXT | NULL | Application memo |
| `uap_submitted_at` | DATETIME | NOT NULL | Submitted at |
| `uap_reviewed_at` | DATETIME | NULL | Reviewed at |
| `uap_reviewed_by` | CHAR(36) | FK → asm_users, NULL | Reviewer (ADMIN) |
| `uap_created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Created at |
| `uap_updated_at` | DATETIME | NOT NULL, ON UPDATE CURRENT_TIMESTAMP | Updated at |

#### E3. `asm_users` — User (사용자)

| Column | Type | Constraint | Description |
|--------|------|-----------|-------------|
| `usr_id` | CHAR(36) | PK, UUID | User PK |
| `usr_code` | VARCHAR(20) | UNIQUE, NOT NULL | Auto-generated code (예: USR-2026-000001) |
| `usr_name` | VARCHAR(50) | NOT NULL | Full name |
| `usr_email` | VARCHAR(100) | UNIQUE, NOT NULL | Email (login ID) |
| `usr_password_hash` | VARCHAR(255) | NOT NULL | bcrypt hash (rounds: 12) |
| `usr_role` | ENUM('OPERATOR','MANAGER','VIEWER') | NOT NULL | Role |
| `usr_is_admin` | BOOLEAN | NOT NULL, DEFAULT false | Admin flag (crp_id=NULL) |
| `crp_id` | CHAR(36) | FK → asm_corporations, NULL | Corporation (NULL for ADMIN) |
| `uap_id` | CHAR(36) | FK → asm_user_applications, NULL | Source application (NULL for ADMIN) |
| `usr_status` | ENUM('ACTIVE','INACTIVE','LOCKED') | NOT NULL, DEFAULT 'ACTIVE' | Status |
| `usr_temp_password` | BOOLEAN | NOT NULL, DEFAULT true | Temp password flag |
| `usr_last_login_at` | DATETIME | NULL | Last login |
| `usr_login_fail_count` | INT | NOT NULL, DEFAULT 0 | Consecutive login failures |
| `usr_locked_at` | DATETIME | NULL | Locked at |
| `usr_created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Created at |
| `usr_updated_at` | DATETIME | NOT NULL, ON UPDATE CURRENT_TIMESTAMP | Updated at |
| `usr_deleted_at` | DATETIME | NULL | Soft delete |

### 3.2 API Endpoints (API 엔드포인트)

#### Authentication & Entity (인증 & Entity)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/entities/:crp_code/validate` | Entity Code validation (사전 검증) | Public |
| POST | `/api/v1/auth/login` | Login (Entity Code + Email + Password) | Public |
| POST | `/api/v1/auth/refresh` | Refresh JWT token | JWT |
| POST | `/api/v1/auth/change-password` | Change password (최초/수동) | JWT |
| GET | `/api/v1/entities/me` | Current entity info | JWT |

#### Corporation Management (법인 관리) — ADMIN Only

| Method | Endpoint | Description | FR ID |
|--------|----------|-------------|-------|
| GET | `/api/v1/admin/corporations` | List corporations | FR-CRP-002 |
| POST | `/api/v1/admin/corporations` | Create corporation | FR-CRP-001 |
| GET | `/api/v1/admin/corporations/:crp_id` | Get corporation detail | FR-CRP-003 |
| PATCH | `/api/v1/admin/corporations/:crp_id` | Update corporation | FR-CRP-004 |
| PATCH | `/api/v1/admin/corporations/:crp_id/status` | Change status | FR-CRP-005 |
| DELETE | `/api/v1/admin/corporations/:crp_id` | Soft delete | FR-CRP-006 |

#### UserApplication Management (사용자 신청 관리)

| Method | Endpoint | Description | Role | FR ID |
|--------|----------|-------------|------|-------|
| GET | `/api/v1/admin/applications` | List all applications | ADMIN | FR-UAP-002 |
| GET | `/api/v1/admin/applications/:uap_id` | Application detail | ADMIN | FR-UAP-004 |
| PATCH | `/api/v1/admin/applications/:uap_id/approve` | Approve | ADMIN | FR-UAP-005 |
| PATCH | `/api/v1/admin/applications/:uap_id/reject` | Reject | ADMIN | FR-UAP-006 |
| GET | `/api/v1/corp/applications` | List my corp applications | Corp User | FR-UAP-003 |
| POST | `/api/v1/corp/applications` | Submit application | Corp User | FR-UAP-001 |
| PATCH | `/api/v1/corp/applications/:uap_id/cancel` | Cancel application | Corp User | FR-UAP-007 |

#### User Management (사용자 관리)

| Method | Endpoint | Description | Role | FR ID |
|--------|----------|-------------|------|-------|
| GET | `/api/v1/admin/users` | List all users | ADMIN | FR-USR-002 |
| GET | `/api/v1/admin/users/:usr_id` | User detail | ADMIN | FR-USR-003 |
| PATCH | `/api/v1/admin/users/:usr_id/role` | Change role | ADMIN | FR-USR-004 |
| PATCH | `/api/v1/admin/users/:usr_id/status` | Change status | ADMIN | FR-USR-005~007 |
| POST | `/api/v1/admin/users/:usr_id/reset-password` | Reset password | ADMIN | FR-USR-008 |
| DELETE | `/api/v1/admin/users/:usr_id` | Soft delete | ADMIN | FR-USR-009 |
| GET | `/api/v1/my/profile` | My profile | All | FR-USR-010 |
| PATCH | `/api/v1/my/profile` | Update my profile | All | FR-USR-010 |

### 3.3 Screen List (화면 목록)

| Screen ID | Screen Name | Route | Access Role |
|-----------|-------------|-------|-------------|
| SCR-AUTH-00 | Entity Info Page (Entity 안내) | `/entity-info` | Public |
| SCR-AUTH-01 | Login (로그인) | `/login?entity={crp_code}` | Public |
| SCR-AUTH-02 | Force Password Change (최초 비밀번호 변경) | `/{crp_code}/auth/change-password` | Logged in + temp_password |
| SCR-CRP-01 | Corporation List (법인 목록) | `/admin/corporations` | ADMIN |
| SCR-CRP-02 | Corporation Create (법인 등록) | `/admin/corporations/new` | ADMIN |
| SCR-CRP-03 | Corporation Detail/Edit (법인 상세·수정) | `/admin/corporations/:crp_id` | ADMIN |
| SCR-UAP-01 | Application List - Admin (신청 목록 ADMIN) | `/admin/applications` | ADMIN |
| SCR-UAP-02 | Application List - Corp (신청 목록 법인) | `/{crp_code}/applications` | Corp User |
| SCR-UAP-03 | Application Form (사용자 신청) | `/{crp_code}/applications/new` | Corp User |
| SCR-UAP-04 | Application Detail/Review (신청 상세·심사) | `/admin/applications/:uap_id` | ADMIN |
| SCR-USR-01 | User List (사용자 목록) | `/admin/users` | ADMIN |
| SCR-USR-02 | User Detail (사용자 상세) | `/admin/users/:usr_id` | ADMIN |
| SCR-USR-03 | My Profile (내 정보) | `/{crp_code}/my/profile` | All Users |
| SCR-DASH-00 | Main Dashboard (대시보드) | `/{crp_code}/dashboard` | All Users |

### 3.4 Error Code Definition (에러 코드 정의)

| Code | HTTP | Message | Condition |
|------|------|---------|-----------|
| `ASM-E1001` | 400 | Invalid Entity Code (유효하지 않은 Entity Code) | crp_code not found or deleted |
| `ASM-E1002` | 403 | Entity suspended (법인 정지) | crp_status ≠ ACTIVE |
| `ASM-E1003` | 400 | Invalid email or password (보안 마스킹) | usr_email not found |
| `ASM-E1004` | 400 | Invalid email or password (보안 마스킹) | Entity mismatch |
| `ASM-E1005` | 403 | Account inactive or locked | usr_status ≠ ACTIVE |
| `ASM-E1006` | 400 | Invalid email or password (보안 마스킹) | Wrong password |
| `ASM-E1007` | 401 | Session expired | JWT expired |
| `ASM-E1008` | 403 | Insufficient permissions | Role check failed |
| `ASM-E1009` | 403 | Entity required | crp_id missing for non-ADMIN |
| `ASM-E1010` | 403 | Entity code mismatch | URL crp_code ≠ JWT crp_code |
| `ASM-E2001` | 409 | Duplicate email | Email already registered or pending |
| `ASM-E2002` | 400 | User limit exceeded | crp_max_user_count reached |
| `ASM-E3001` | 404 | Corporation not found | crp_id not found |
| `ASM-E3002` | 409 | Duplicate corporation code | crp_code already exists |
| `ASM-E3003` | 400 | Cannot delete: active users exist | Active users under corporation |
| `ASM-E4001` | 404 | Application not found | uap_id not found |
| `ASM-E4002` | 400 | Invalid application status transition | Non-PENDING status |

### 3.5 JWT Payload (JWT 토큰 구조)

```typescript
interface JwtPayload {
  sub: string;         // usr_id (UUID)
  crp_id: string;      // Corporation ID (ADMIN: null)
  crp_code: string;    // Entity Code — URL matching (ADMIN: null)
  crp_name: string;    // Corporation name — GNB display
  role: 'OPERATOR' | 'MANAGER' | 'VIEWER' | 'ADMIN';
  name: string;        // usr_name
  temp_password: boolean;
  iat: number;
  exp: number;
}
```

---

## 4. Gap Analysis (갭 분석)

### 4.1 Change Scope Summary (변경 범위 요약)

| Area | Current State (현재) | Change Required (변경) | Impact |
|------|---------------------|----------------------|--------|
| Backend Project | 미존재 | NestJS 앱 전체 신규 생성 | 🔴 High |
| Frontend Project | 미존재 | React SPA 전체 신규 생성 | 🔴 High |
| Database | 미존재 | `db_app_stock` + 3 tables 신규 | 🔴 High |
| Docker | 미존재 | docker-compose + Dockerfile 신규 | 🟡 Medium |
| Nginx | ✅ 설정 완료 | 변경 없음 | 🟢 None |
| Platform `plt_apps` | 레코드 미등록 | INSERT 필요 | 🟢 Low |
| Deploy Script | stock-management 미포함 | 스크립트 업데이트 | 🟡 Medium |

### 4.2 File Change List (파일 변경 목록)

#### Backend — New Files (신규)

| Category | File Path | Description |
|----------|-----------|-------------|
| Config | `apps/app-stock-management/backend/package.json` | Dependencies |
| Config | `apps/app-stock-management/backend/tsconfig.json` | TypeScript config |
| Config | `apps/app-stock-management/backend/nest-cli.json` | NestJS CLI config |
| Config | `apps/app-stock-management/backend/Dockerfile` | Docker build |
| Bootstrap | `src/main.ts` | App bootstrap (port 3104) |
| Bootstrap | `src/app.module.ts` | Root module registration |
| Health | `src/health.controller.ts` | Health check endpoint |
| Auth | `src/auth/auth.module.ts` | Auth module |
| Auth | `src/auth/auth.service.ts` | Login, JWT issuance, password mgmt |
| Auth | `src/auth/auth.controller.ts` | Login/refresh/change-password APIs |
| Auth | `src/auth/jwt.strategy.ts` | JWT Passport strategy |
| Auth | `src/auth/guards/jwt-auth.guard.ts` | JWT validation guard |
| Auth | `src/auth/guards/entity-scope.guard.ts` | Entity scope isolation guard |
| Auth | `src/auth/guards/role.guard.ts` | Role-based access guard |
| Auth | `src/auth/decorators/auth.decorator.ts` | @Auth() decorator |
| Auth | `src/auth/decorators/current-user.decorator.ts` | @CurrentUser() decorator |
| Auth | `src/auth/decorators/public.decorator.ts` | @Public() decorator |
| Auth | `src/auth/decorators/roles.decorator.ts` | @Roles() decorator |
| Auth | `src/auth/interfaces/jwt-payload.interface.ts` | JWT payload type |
| Domain | `src/domain/corporation/corporation.module.ts` | Module |
| Domain | `src/domain/corporation/controller/corporation.controller.ts` | Controller |
| Domain | `src/domain/corporation/service/corporation.service.ts` | Service |
| Domain | `src/domain/corporation/entity/corporation.entity.ts` | TypeORM entity |
| Domain | `src/domain/corporation/dto/request/*.ts` | Request DTOs |
| Domain | `src/domain/corporation/dto/response/*.ts` | Response DTOs |
| Domain | `src/domain/corporation/mapper/corporation.mapper.ts` | Mapper |
| Domain | `src/domain/user-application/` | Same structure as corporation |
| Domain | `src/domain/user/` | Same structure as corporation |
| Domain | `src/domain/entity-access/` | Entity validation controller/service |
| Common | `src/common/constants/enums.ts` | All ENUMs |
| Common | `src/common/dto/base-response.dto.ts` | Standard response |
| Common | `src/common/exceptions/business.exception.ts` | Business exception |
| Common | `src/common/filters/global-exception.filter.ts` | Global exception filter |
| DB | `scripts/init-db.sql` | Database initialization |

#### Frontend — New Files (신규)

| Category | File Path | Description |
|----------|-----------|-------------|
| Config | `apps/app-stock-management/frontend/package.json` | Dependencies |
| Config | `apps/app-stock-management/frontend/vite.config.ts` | Vite (base: /app-stock-management, port: 5204) |
| Config | `apps/app-stock-management/frontend/tsconfig.json` | TypeScript |
| Config | `apps/app-stock-management/frontend/tailwind.config.ts` | Tailwind |
| Config | `apps/app-stock-management/frontend/postcss.config.js` | PostCSS |
| Config | `apps/app-stock-management/frontend/Dockerfile` | Docker build |
| Config | `apps/app-stock-management/frontend/nginx.conf` | SPA routing |
| Config | `apps/app-stock-management/frontend/index.html` | HTML entry |
| App | `src/App.tsx` | Router setup (EntityGuard, admin/corp routes) |
| App | `src/main.tsx` | React entry |
| App | `src/index.css` | Tailwind base styles |
| i18n | `src/i18n/i18n.ts` | i18next setup |
| i18n | `src/i18n/locales/{ko,en,vi}/stock.json` | Translation files (×3) |
| Lib | `src/lib/api-client.ts` | Axios instance + interceptors |
| Lib | `src/lib/query-client.ts` | React Query config |
| Store | `src/stores/auth.store.ts` | Auth state (JWT, crp_code) |
| Store | `src/stores/toast.store.ts` | Toast notifications |
| Service | `src/services/auth.service.ts` | Auth API calls |
| Service | `src/services/corporation.service.ts` | Corporation API calls |
| Service | `src/services/user-application.service.ts` | Application API calls |
| Service | `src/services/user.service.ts` | User API calls |
| Hook | `src/hooks/useAuth.ts` | Auth hooks (login, refresh, change-pwd) |
| Hook | `src/hooks/useCorporations.ts` | Corporation query hooks |
| Hook | `src/hooks/useUserApplications.ts` | Application query hooks |
| Hook | `src/hooks/useUsers.ts` | User query hooks |
| Guard | `src/components/guards/EntityGuard.tsx` | Route guard component |
| Guard | `src/components/guards/AdminGuard.tsx` | Admin-only route guard |
| Layout | `src/components/layout/AppLayout.tsx` | Main layout (header + sidebar) |
| Layout | `src/components/layout/AdminLayout.tsx` | Admin layout |
| Layout | `src/components/layout/AuthLayout.tsx` | Auth pages layout (center) |
| Layout | `src/components/layout/Sidebar.tsx` | Side navigation |
| Layout | `src/components/layout/Header.tsx` | Header (entity info) |
| Common | `src/components/common/PageHeader.tsx` | Page header |
| Common | `src/components/common/StatusBadge.tsx` | Status badge |
| Common | `src/components/common/DataTable.tsx` | Data table |
| Common | `src/components/common/FilterBar.tsx` | Filter bar |
| Common | `src/components/common/ConfirmModal.tsx` | Confirm dialog |
| Common | `src/components/common/ToastContainer.tsx` | Toast container |
| Pages | `src/pages/auth/EntityInfoPage.tsx` | SCR-AUTH-00 |
| Pages | `src/pages/auth/LoginPage.tsx` | SCR-AUTH-01 |
| Pages | `src/pages/auth/ChangePasswordPage.tsx` | SCR-AUTH-02 |
| Pages | `src/pages/admin/CorporationListPage.tsx` | SCR-CRP-01 |
| Pages | `src/pages/admin/CorporationFormPage.tsx` | SCR-CRP-02 |
| Pages | `src/pages/admin/CorporationDetailPage.tsx` | SCR-CRP-03 |
| Pages | `src/pages/admin/ApplicationListPage.tsx` | SCR-UAP-01 |
| Pages | `src/pages/admin/ApplicationDetailPage.tsx` | SCR-UAP-04 |
| Pages | `src/pages/admin/UserListPage.tsx` | SCR-USR-01 |
| Pages | `src/pages/admin/UserDetailPage.tsx` | SCR-USR-02 |
| Pages | `src/pages/corp/ApplicationListPage.tsx` | SCR-UAP-02 |
| Pages | `src/pages/corp/ApplicationFormPage.tsx` | SCR-UAP-03 |
| Pages | `src/pages/corp/ProfilePage.tsx` | SCR-USR-03 |
| Pages | `src/pages/corp/DashboardPage.tsx` | SCR-DASH-00 |

#### Docker & Infrastructure (인프라)

| Category | File Path | Description |
|----------|-----------|-------------|
| Docker | `apps/app-stock-management/docker-compose.app-stock-management.yml` | Docker Compose |
| Docker | `apps/app-stock-management/.env.example` | Environment template |
| Platform | `platform/scripts/deploy-staging.sh` | Update (add stock-management) |

### 4.3 DB Migration Strategy (마이그레이션 전략)

**신규 앱이므로 init-db.sql로 전체 스키마를 생성한다.**

TypeORM `synchronize: true`는 **개발 환경에서만** 활성화하고, 스테이징/프로덕션은 `synchronize: false`로 설정하여 수동 SQL(`scripts/init-db.sql`)로 관리한다.

---

## 5. User Flow (사용자 플로우)

### 5.1 Entity Access Flow (Entity 접근 흐름)

```
[User Access] ─── URL에 crp_code 포함?
    │                 │
    │ NO              │ YES: crp_code 추출
    ▼                 ▼
  /entity-info    GET /entities/{crp_code}/validate
  (SCR-AUTH-00)       │
                     ├── NOT_FOUND → /entity-info?reason=not_found
                     ├── SUSPENDED → /entity-info?reason=suspended
                     └── ACTIVE
                          │
                        JWT 있음?
                         ├── NO → /login?entity={crp_code} (SCR-AUTH-01)
                         └── YES
                              │
                            JWT crp_code = URL crp_code?
                              ├── NO → Logout → /login?entity={crp_code}
                              └── YES
                                   │
                                 temp_password?
                                   ├── YES → /{crp_code}/auth/change-password
                                   └── NO → /{crp_code}/dashboard
```

### 5.2 User Application Approval Flow (사용자 신청 승인 흐름)

```
Step 1. 법인 담당자 → /{crp_code}/applications/new 접근
Step 2. 대상자 정보 입력 (email, name, role)
        └ System: 이메일 중복 검증 + 사용자 한도 검증
Step 3. 신청 제출 → status: PENDING, uap_no 자동 채번
Step 4. ADMIN → /admin/applications 에서 PENDING 신청 확인
Step 5-A. ADMIN [승인] → asm_users INSERT + 임시 비밀번호 발급
          → status: APPROVED
Step 5-B. ADMIN [반려] → reject_reason 입력 필수
          → status: REJECTED
Step 6. 승인된 사용자 → /login?entity={crp_code} 접속
        → 최초 로그인 시 강제 비밀번호 변경
```

### 5.3 Login Flow (로그인 흐름)

```
Step 1. /login?entity=AMA-001 페이지 로드
        → Entity 정보 자동 조회 (법인명 표시)
Step 2. 사용자 이메일 + 비밀번호 입력
Step 3. POST /api/v1/auth/login
        ├── Step 3-1. Entity Code 검증 (crp_code 존재? ACTIVE?)
        ├── Step 3-2. Email 검증 → crp_id 매칭 확인
        ├── Step 3-3. Password 검증 (bcrypt)
        │         └── 실패 시 login_fail_count++ → 5회 → LOCKED
        └── Step 3-4. JWT 발급 (crp_id, crp_code, role, temp_password)
Step 4-A. temp_password=true → /{crp_code}/auth/change-password (강제)
Step 4-B. temp_password=false → /{crp_code}/dashboard
```

### 5.4 Corporation Management Flow — ADMIN (법인 관리 흐름)

```
Step 1. /admin/corporations 목록 조회
        └ 필터: crp_code, crp_name, crp_status / 검색 / 페이지네이션
Step 2. [+ 법인 등록] → /admin/corporations/new
        └ crp_code 유일성 실시간 검증, crp_biz_no 중복 검증
Step 3. 법인 상세 → /admin/corporations/:crp_id
        └ 탭: 기본 정보 | 소속 사용자 | 신청 이력
Step 4. 상태 변경: ACTIVE ↔ SUSPENDED ↔ INACTIVE
        └ SUSPENDED 전환 시 소속 사용자 전원 세션 무효화
Step 5. 삭제: 소속 활성 사용자 존재 시 차단
```

---

## 6. Technical Constraints (기술 제약사항)

### 6.1 Compatibility (호환성)

| Constraint | Detail |
|-----------|--------|
| Node.js | >= 20.0.0 (workspace 공통) |
| MySQL | 8.0 (Docker 내 독립 인스턴스 또는 공유 서버) |
| TypeORM | 0.3.x — nullable 컬럼에 반드시 `type:` 명시 (reflect-metadata 이슈) |
| NestJS | 10.x — ConfigModule, TypeOrmModule, PassportModule |
| Vite | 5.x — `base: '/app-stock-management'` |
| React | 18 — BrowserRouter `basename="/app-stock-management"` |
| Tailwind | 3.x |

### 6.2 Security (보안)

| Constraint | Detail |
|-----------|--------|
| Password Hashing | bcrypt (rounds: 12 이상) |
| JWT | Access Token (15min) + Refresh Token (7d) — httpOnly cookie 권장 |
| Login Brute Force | 연속 5회 실패 → 계정 잠금 (LOCKED) |
| Error Masking | E1003, E1004, E1006 → 동일 메시지 (이메일/PW 오류 구분 불가) |
| Entity Isolation | 모든 쿼리에 `crp_id` WHERE 조건 자동 주입 |
| CORS | `apps.amoeba.site`, `localhost:5204` 만 허용 |
| Input Validation | class-validator whitelist + forbidNonWhitelisted |

### 6.3 Performance (성능)

| Constraint | Detail |
|-----------|--------|
| Corporation Status Cache | Entity 상태 캐시 (in-memory 또는 Redis, TTL: 60s) |
| Pagination | 기본 20건, 최대 100건 |
| JWT Validation | 매 요청 검증 (stateless) |

### 6.4 Email Service (이메일 서비스)

> **Phase 1 제한사항**: 이메일 발송 서비스는 **Stub 구현**으로 시작한다.  
> 임시 비밀번호는 API 응답으로 반환하고, 실제 이메일 발송은 Phase 2에서 SMTP 연동 후 구현한다.  
> 콘솔 로그로 알림 내용을 출력하여 개발/테스트에 지장이 없도록 한다.

### 6.5 Convention Compliance (컨벤션 준수)

| Convention | Reference | Compliance Area |
|-----------|-----------|----------------|
| Code Convention v2 | `reference/amoeba_code_convention_v2.md` | DB Naming §4, Backend §5, Frontend §6~7, API §8, i18n §14 |
| Web Style Guide v2 | `reference/amoeba_web_style_guide_v2.md` | Layout §1~3, Color §5, Typography §6, Component §7, Responsive §10 |

---

## Document Change History (문서 변경 이력)

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0.0 | 2026-03-29 | AI Assistant | Initial creation based on ASM-FDS-USR-001 v1.0 and ASM-FDS-USR-002 v1.1 |

---

*— End of Document — ASM-ANALYSIS-1.0.0*

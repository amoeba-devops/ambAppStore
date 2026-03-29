---
document_id: ASM-TASK-PLAN-1.0.0
version: 1.0.0
status: Draft
created: 2026-03-29
updated: 2026-03-29
author: AI Assistant
based_on: ASM-ANALYSIS-1.0.0
app: app-stock-management
phase: Phase 1 — Corporate User Management & Entity Access Control
---

# ambStockManagement Phase 1 — Task Plan (작업계획서)
## Corporate User Management & Entity Access Control (법인 사용자 관리 & Entity 접근 제어)

---

## Table of Contents (목차)

1. [System Development Status Analysis (시스템 개발 현황 분석)](#1-system-development-status-analysis-시스템-개발-현황-분석)
2. [Step-by-Step Implementation Plan (단계별 구현 계획)](#2-step-by-step-implementation-plan-단계별-구현-계획)
3. [File Change List (변경 파일 목록)](#3-file-change-list-변경-파일-목록)
4. [Side Impact Analysis (사이드 임팩트 분석)](#4-side-impact-analysis-사이드-임팩트-분석)
5. [DB Migration (DB 마이그레이션)](#5-db-migration-db-마이그레이션)

---

## 1. System Development Status Analysis (시스템 개발 현황 분석)

### 1.1 Target Directory Structure (목표 디렉토리 구조)

```
apps/app-stock-management/
├── docker-compose.app-stock-management.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── nest-cli.json
│   ├── package.json
│   ├── tsconfig.json
│   ├── scripts/
│   │   └── init-db.sql
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── health.controller.ts
│       ├── auth/
│       │   ├── auth.module.ts
│       │   ├── auth.service.ts
│       │   ├── auth.controller.ts
│       │   ├── jwt.strategy.ts
│       │   ├── guards/
│       │   │   ├── jwt-auth.guard.ts
│       │   │   ├── entity-scope.guard.ts
│       │   │   └── role.guard.ts
│       │   ├── decorators/
│       │   │   ├── auth.decorator.ts
│       │   │   ├── current-user.decorator.ts
│       │   │   ├── public.decorator.ts
│       │   │   └── roles.decorator.ts
│       │   └── interfaces/
│       │       └── jwt-payload.interface.ts
│       ├── domain/
│       │   ├── corporation/
│       │   │   ├── corporation.module.ts
│       │   │   ├── controller/corporation.controller.ts
│       │   │   ├── service/corporation.service.ts
│       │   │   ├── entity/corporation.entity.ts
│       │   │   ├── dto/
│       │   │   │   ├── request/create-corporation.request.ts
│       │   │   │   ├── request/update-corporation.request.ts
│       │   │   │   └── response/corporation.response.ts
│       │   │   └── mapper/corporation.mapper.ts
│       │   ├── user-application/
│       │   │   ├── user-application.module.ts
│       │   │   ├── controller/user-application.controller.ts
│       │   │   ├── controller/corp-application.controller.ts
│       │   │   ├── service/user-application.service.ts
│       │   │   ├── entity/user-application.entity.ts
│       │   │   ├── dto/
│       │   │   │   ├── request/create-application.request.ts
│       │   │   │   ├── request/reject-application.request.ts
│       │   │   │   └── response/user-application.response.ts
│       │   │   └── mapper/user-application.mapper.ts
│       │   ├── user/
│       │   │   ├── user.module.ts
│       │   │   ├── controller/user.controller.ts
│       │   │   ├── controller/profile.controller.ts
│       │   │   ├── service/user.service.ts
│       │   │   ├── entity/user.entity.ts
│       │   │   ├── dto/
│       │   │   │   ├── request/update-user-role.request.ts
│       │   │   │   ├── request/update-user-status.request.ts
│       │   │   │   ├── request/update-profile.request.ts
│       │   │   │   ├── request/change-password.request.ts
│       │   │   │   └── response/user.response.ts
│       │   │   └── mapper/user.mapper.ts
│       │   └── entity-access/
│       │       ├── entity-access.module.ts
│       │       ├── controller/entity-access.controller.ts
│       │       └── service/entity-access.service.ts
│       └── common/
│           ├── constants/enums.ts
│           ├── dto/base-response.dto.ts
│           ├── exceptions/business.exception.ts
│           └── filters/global-exception.filter.ts
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── index.css
│       ├── vite-env.d.ts
│       ├── i18n/
│       │   ├── i18n.ts
│       │   └── locales/
│       │       ├── ko/stock.json
│       │       ├── en/stock.json
│       │       └── vi/stock.json
│       ├── lib/
│       │   ├── api-client.ts
│       │   └── query-client.ts
│       ├── services/
│       │   ├── auth.service.ts
│       │   ├── corporation.service.ts
│       │   ├── user-application.service.ts
│       │   └── user.service.ts
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   ├── useCorporations.ts
│       │   ├── useUserApplications.ts
│       │   └── useUsers.ts
│       ├── stores/
│       │   ├── auth.store.ts
│       │   └── toast.store.ts
│       ├── components/
│       │   ├── guards/
│       │   │   ├── EntityGuard.tsx
│       │   │   └── AdminGuard.tsx
│       │   ├── layout/
│       │   │   ├── AppLayout.tsx
│       │   │   ├── AdminLayout.tsx
│       │   │   ├── AuthLayout.tsx
│       │   │   ├── Sidebar.tsx
│       │   │   └── Header.tsx
│       │   └── common/
│       │       ├── PageHeader.tsx
│       │       ├── StatusBadge.tsx
│       │       ├── DataTable.tsx
│       │       ├── FilterBar.tsx
│       │       ├── ConfirmModal.tsx
│       │       └── ToastContainer.tsx
│       └── pages/
│           ├── auth/
│           │   ├── EntityInfoPage.tsx
│           │   ├── LoginPage.tsx
│           │   └── ChangePasswordPage.tsx
│           ├── admin/
│           │   ├── CorporationListPage.tsx
│           │   ├── CorporationFormPage.tsx
│           │   ├── CorporationDetailPage.tsx
│           │   ├── ApplicationListPage.tsx
│           │   ├── ApplicationDetailPage.tsx
│           │   ├── UserListPage.tsx
│           │   └── UserDetailPage.tsx
│           └── corp/
│               ├── DashboardPage.tsx
│               ├── ApplicationListPage.tsx
│               ├── ApplicationFormPage.tsx
│               └── ProfilePage.tsx
```

### 1.2 Tech Stack (기술 스택)

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend Framework | NestJS | 10.x |
| ORM | TypeORM | 0.3.x |
| Database | MySQL | 8.0 |
| Auth | Passport JWT + bcrypt | — |
| Frontend Framework | React | 18 |
| Build Tool | Vite | 5.x |
| CSS | TailwindCSS | 3.x |
| State (Global) | Zustand | 5.x |
| State (Server) | React Query (TanStack) | 5.x |
| Form | React Hook Form + Zod | — |
| i18n | react-i18next | — |
| Icons | lucide-react | — |
| HTTP Client | Axios | 1.x |
| Containerization | Docker + docker-compose | — |

### 1.3 Constraints (제약사항)

- **No existing code**: `apps/app-stock-management/` 디렉토리 미존재 — 완전 신규 생성
- **Independent auth**: AMA SSO 사용하지 않음 — 자체 로그인/JWT 발급 시스템 구현
- **Email stub**: Phase 1에서 이메일 발송은 Stub (콘솔 로그) 처리
- **Convention MUST**: `reference/amoeba_code_convention_v2.md` + `reference/amoeba_web_style_guide_v2.md` 준수
- **TypeORM nullable**: nullable 컬럼에 반드시 `type:` 명시 (reflect-metadata 이슈)

---

## 2. Step-by-Step Implementation Plan (단계별 구현 계획)

### Phase 1-1. Project Scaffolding & Infrastructure (프로젝트 스캐폴딩)

#### Step 1-1-1. Backend Scaffolding (백엔드 프로젝트 초기화)

- `apps/app-stock-management/backend/` 디렉토리 생성
- `package.json` — NestJS 10, TypeORM, Passport JWT, bcrypt, class-validator, mysql2, Swagger
- `tsconfig.json` — `packages/tsconfig/nestjs.json` 확장
- `nest-cli.json` — 표준 설정
- `src/main.ts` — CORS, ValidationPipe, GlobalPrefix `/api/v1`, Swagger `/api/docs`, Port 3104
- `src/app.module.ts` — ConfigModule + TypeOrmModule (MySQL 연결)
- `src/health.controller.ts` — `GET /api/v1/health`
- `└─ Side Impact`: Turborepo workspace 자동 인식 (`apps/*/backend` 패턴 매칭)

#### Step 1-1-2. Frontend Scaffolding (프론트엔드 프로젝트 초기화)

- `apps/app-stock-management/frontend/` 디렉토리 생성
- `package.json` — React 18, react-router-dom, @tanstack/react-query, zustand, react-hook-form, zod, axios, i18next, lucide-react
- `vite.config.ts` — `base: '/app-stock-management'`, port: 5204, proxy: `/api → http://localhost:3104`
- `tsconfig.json` — `packages/tsconfig/react.json` 확장
- `tailwind.config.ts` + `postcss.config.js` — 표준 설정
- `index.html` + `src/main.tsx` + `src/index.css` + `src/vite-env.d.ts`
- `└─ Side Impact`: Turborepo workspace 자동 인식

#### Step 1-1-3. Docker & DB Setup (Docker + DB 초기화)

- `docker-compose.app-stock-management.yml` — bff-app-stock-management(:3104) + web-app-stock-management(:5204) + mysql
- `backend/Dockerfile` — Multi-stage (builder → production)
- `frontend/Dockerfile` — Multi-stage (builder → nginx)
- `frontend/nginx.conf` — SPA routing `try_files /app-stock-management/index.html`
- `backend/scripts/init-db.sql` — `db_app_stock` 생성 + 3개 테이블 + 인덱스 + ADMIN 시드
- `.env.example` — 환경변수 템플릿
- `└─ Side Impact`: 기존 MySQL 포트 충돌 주의 (3306 공유 또는 별도 포트)

#### Step 1-1-4. Common Layer (공통 레이어)

- `src/common/constants/enums.ts` — CorporationStatus, UserApplicationStatus, UserStatus, UserRole
- `src/common/dto/base-response.dto.ts` — `successResponse()`, `successListResponse()`, `errorResponse()`
- `src/common/exceptions/business.exception.ts` — `ASM-E{code}` 에러 체계
- `src/common/filters/global-exception.filter.ts` — 전역 예외 처리
- `└─ Side Impact`: 없음 (독립 모듈)

---

### Phase 1-2. Authentication & Entity Access Control (인증 & Entity 접근 제어)

#### Step 1-2-1. Auth Module — Core (인증 모듈 핵심)

- `src/auth/interfaces/jwt-payload.interface.ts` — JwtPayload 타입 정의
- `src/auth/jwt.strategy.ts` — JWT Passport 전략 (자체 secret)
- `src/auth/guards/jwt-auth.guard.ts` — JWT 검증 Guard
- `src/auth/guards/role.guard.ts` — 역할 기반 접근 Guard
- `src/auth/decorators/auth.decorator.ts` — `@Auth()` = JwtAuthGuard + EntityScopeGuard
- `src/auth/decorators/current-user.decorator.ts` — `@CurrentUser()` 데코레이터
- `src/auth/decorators/public.decorator.ts` — `@Public()` 데코레이터
- `src/auth/decorators/roles.decorator.ts` — `@Roles('ADMIN')` 데코레이터
- `└─ Side Impact`: 없음 (독립 모듈)

#### Step 1-2-2. Auth Module — Login & Password (로그인 & 비밀번호)

- `src/auth/auth.service.ts` — 로그인 검증 (3-step), JWT 발급, 비밀번호 변경, 리프레시 토큰
  - Login: Entity Code 검증 → 사용자 검증 → Password 검증 → JWT 발급
  - Change Password: 현재 비밀번호 확인 → 새 비밀번호 해싱 → `usr_temp_password=false`
  - Failed login tracking: `usr_login_fail_count++` → 5회 시 `LOCKED`
- `src/auth/auth.controller.ts` — `POST /auth/login`, `POST /auth/refresh`, `POST /auth/change-password`
- `src/auth/auth.module.ts` — PassportModule + JwtModule 등록
- `└─ Side Impact`: User Module, Corporation Module 의존 (forwardRef 필요 가능)

#### Step 1-2-3. EntityScopeGuard (Entity 스코프 가드)

- `src/auth/guards/entity-scope.guard.ts`
  - ADMIN 계정(crp_id=null) → 통과
  - 비-ADMIN + crp_id 없음 → 403 ASM-E1009
  - Corporation 상태 검증 (ACTIVE 여부)
  - URL `crp_code` ↔ JWT `crp_code` 일치 여부 확인
  - `req.crpId` 주입 (하위 레이어 전달용)
- `└─ Side Impact`: Corporation Service 의존 (상태 조회 캐시)

#### Step 1-2-4. Entity Validation API

- `src/domain/entity-access/entity-access.module.ts`
- `src/domain/entity-access/service/entity-access.service.ts` — crp_code 유효성 검증
- `src/domain/entity-access/controller/entity-access.controller.ts`
  - `GET /api/v1/entities/:crp_code/validate` (Public)
  - `GET /api/v1/entities/me` (JWT required)
- `└─ Side Impact`: Corporation Module 의존

---

### Phase 1-3. Corporation Domain (법인 도메인)

#### Step 1-3-1. Corporation Entity & Module

- `src/domain/corporation/entity/corporation.entity.ts` — TypeORM entity (`asm_corporations`)
  - 모든 nullable 컬럼에 `type:` 명시
  - `@Index('idx_asm_corporations_code', ['crpCode'])` unique index
- `src/domain/corporation/corporation.module.ts` — TypeOrmModule.forFeature + 컨트롤러/서비스 등록
- `└─ Side Impact`: User Entity의 FK 참조 대상

#### Step 1-3-2. Corporation DTO & Mapper

- `dto/request/create-corporation.request.ts` — snake_case fields
  - `crp_code`, `crp_name`, `crp_biz_no`, `crp_country`, `crp_contact_name`, `crp_contact_email`, `crp_contact_phone`, `crp_max_user_count`
  - Validation: `@IsNotEmpty()`, `@MaxLength()`, `@IsEmail()`, `@IsOptional()` 등
- `dto/request/update-corporation.request.ts` — PartialType(Create...) - crp_code/crp_biz_no 제외
- `dto/request/update-corporation-status.request.ts` — `status` ENUM 필드
- `dto/response/corporation.response.ts` — camelCase fields
- `mapper/corporation.mapper.ts` — static `toResponse()`, `toDetailResponse()`, `toListResponse()`
- `└─ Side Impact`: 없음

#### Step 1-3-3. Corporation Service

- `service/corporation.service.ts`
  - `findAll(filters)` — 목록 조회 (검색 + 필터 + 페이지네이션)
  - `findById(crpId)` — 상세 조회 (소속 사용자 수 포함)
  - `findByCode(crpCode)` — Entity Code로 조회 (로그인용)
  - `create(request)` — crp_code 유일성 검증 → 등록
  - `update(crpId, request)` — 정보 수정 (crp_code/crp_biz_no 변경 불가)
  - `updateStatus(crpId, status)` — 상태 변경 + SUSPENDED 시 소속 사용자 영향
  - `softDelete(crpId)` — 활성 사용자 존재 시 차단
- `└─ Side Impact`: SUSPENDED 전환 시 소속 User 세션 무효화 (Phase 1에서는 JWT 만료로 대체)

#### Step 1-3-4. Corporation Controller

- `controller/corporation.controller.ts`
  - `@Auth()` + `@Roles('ADMIN')` 전체 적용
  - 6개 엔드포인트: GET list, POST create, GET :id, PATCH :id, PATCH :id/status, DELETE :id
  - 표준 응답 포맷 사용
- `└─ Side Impact`: 없음

---

### Phase 1-4. UserApplication Domain (사용자 신청 도메인)

#### Step 1-4-1. UserApplication Entity & Module

- `entity/user-application.entity.ts` — TypeORM entity (`asm_user_applications`)
  - `@ManyToOne(() => CorporationEntity)` — crp_id FK
  - `@OneToOne(() => UserEntity)` — usr_id FK (nullable)
  - auto-generated `uap_no` (UAP-YYYY-NNNNNN)
- `user-application.module.ts`
- `└─ Side Impact`: Corporation Entity, User Entity 참조

#### Step 1-4-2. UserApplication DTO & Mapper

- `dto/request/create-application.request.ts` — `target_name`, `target_email`, `target_role`, `note`
- `dto/request/reject-application.request.ts` — `reject_reason` (required)
- `dto/response/user-application.response.ts` — camelCase
- `mapper/user-application.mapper.ts`
- `└─ Side Impact`: 없음

#### Step 1-4-3. UserApplication Service

- `service/user-application.service.ts`
  - `submitApplication(crpId, request)` — 이메일 중복 검증 + 한도 검증 → PENDING
  - `findAllAdmin(filters)` — ADMIN 전체 신청 조회
  - `findAllByCorp(crpId, filters)` — 법인별 신청 조회
  - `findById(uapId)` — 상세 조회
  - `approve(uapId, adminUsrId)` — PENDING → APPROVED + User 자동 생성
  - `reject(uapId, adminUsrId, reason)` — PENDING → REJECTED
  - `cancel(uapId, crpId)` — PENDING → CANCELLED (법인 담당자)
  - **Auto-numbering**: `uap_no` 자동 채번 (UAP-{year}-{6digit sequence})
- `└─ Side Impact`: User Service 의존 (승인 시 User 자동 생성)

#### Step 1-4-4. UserApplication Controllers

- `controller/user-application.controller.ts` — ADMIN용: GET list, GET :id, PATCH approve, PATCH reject
- `controller/corp-application.controller.ts` — 법인용: GET list, POST submit, PATCH cancel
  - 법인용 컨트롤러는 `@Auth()` + EntityScopeGuard → JWT crp_id 기반 격리
- `└─ Side Impact`: 없음

---

### Phase 1-5. User Domain (사용자 도메인)

#### Step 1-5-1. User Entity & Module

- `entity/user.entity.ts` — TypeORM entity (`asm_users`)
  - `@ManyToOne(() => CorporationEntity)` — crp_id FK (nullable for ADMIN)
  - `@OneToOne(() => UserApplicationEntity)` — uap_id FK (nullable for ADMIN)
  - `usr_password_hash` 컬럼 — `select: false` (기본 쿼리에서 제외)
  - auto-generated `usr_code` (USR-YYYY-NNNNNN)
- `user.module.ts`
- `└─ Side Impact`: Auth Module, UserApplication Module 참조

#### Step 1-5-2. User DTO & Mapper

- `dto/request/update-user-role.request.ts` — `role` ENUM
- `dto/request/update-user-status.request.ts` — `status` ENUM + `reason`(optional)
- `dto/request/update-profile.request.ts` — `name`
- `dto/request/change-password.request.ts` — `current_password`, `new_password`, `new_password_confirm`
- `dto/response/user.response.ts` — camelCase (password 제외)
- `mapper/user.mapper.ts`
- `└─ Side Impact`: 없음

#### Step 1-5-3. User Service

- `service/user.service.ts`
  - `createFromApplication(uap)` — 신청 승인 → User 생성 + 임시 비밀번호 + usr_code 채번
  - `findAllAdmin(filters)` — ADMIN 전체 사용자 조회
  - `findById(usrId)` — 상세 조회
  - `findByEmail(email)` — 로그인용 (password_hash 포함)
  - `updateRole(usrId, role)` — 역할 변경
  - `updateStatus(usrId, status)` — 활성/비활성/잠금해제
  - `resetPassword(usrId)` — 임시 비밀번호 재발급
  - `updateProfile(usrId, request)` — 본인 정보 수정
  - `changePassword(usrId, request)` — 비밀번호 변경 + `usr_temp_password=false`
  - `softDelete(usrId)` — Soft Delete
  - `incrementFailCount(usrId)` — 실패 횟수 + 잠금 로직
  - **Auto-numbering**: `usr_code` 자동 채번 (USR-{year}-{6digit sequence})
- `└─ Side Impact`: Auth Service에서 참조 (login, password 관련)

#### Step 1-5-4. User Controllers

- `controller/user.controller.ts` — ADMIN용: GET list, GET :id, PATCH role, PATCH status, POST reset-password, DELETE
- `controller/profile.controller.ts` — 본인용: GET /my/profile, PATCH /my/profile
- `└─ Side Impact`: 없음

---

### Phase 1-6. Frontend — Core Setup (프론트엔드 코어)

#### Step 1-6-1. Project Core Files

- `src/main.tsx` — React DOM render + i18n import
- `src/index.css` — Tailwind directives + 커스텀 베이스 스타일
- `src/vite-env.d.ts` — Vite 타입
- `src/lib/api-client.ts` — Axios instance (`VITE_API_BASE_URL`), JWT interceptor, 401 → entity-info redirect
- `src/lib/query-client.ts` — React Query (staleTime: 30s, refetchOnWindowFocus: true)
- `└─ Side Impact`: 없음

#### Step 1-6-2. i18n Setup

- `src/i18n/i18n.ts` — i18next init (ns: `stock`, fallbackLng: `ko`)
- `src/i18n/locales/ko/stock.json` — 한국어 번역 (~200키)
- `src/i18n/locales/en/stock.json` — 영어 번역
- `src/i18n/locales/vi/stock.json` — 베트남어 번역
- 번역 키 그룹: `common`, `nav`, `auth`, `corporation`, `application`, `user`, `dashboard`, `error`
- `└─ Side Impact`: 없음

#### Step 1-6-3. Stores (Zustand)

- `src/stores/auth.store.ts` — JWT 토큰, 사용자 정보 (crp_id, crp_code, crp_name, role), login/logout 액션
- `src/stores/toast.store.ts` — Toast 알림 (success/error/info/warning, 4초 자동 해제)
- `└─ Side Impact`: 없음

#### Step 1-6-4. Service Layer (API 서비스)

- `src/services/auth.service.ts` — login, refresh, changePassword, validateEntity, getMyEntity
- `src/services/corporation.service.ts` — CRUD + status + delete
- `src/services/user-application.service.ts` — admin list/detail/approve/reject + corp list/submit/cancel
- `src/services/user.service.ts` — admin list/detail/role/status/reset-password/delete + profile
- `└─ Side Impact`: 없음

#### Step 1-6-5. React Query Hooks

- `src/hooks/useAuth.ts` — useLogin, useRefresh, useChangePassword, useValidateEntity
- `src/hooks/useCorporations.ts` — query key factory + useCorporations, useCorporation, useCreateCorporation, useUpdateCorporation, useUpdateCorporationStatus, useDeleteCorporation
- `src/hooks/useUserApplications.ts` — useAdminApplications, useCorpApplications, useApplication, useSubmitApplication, useApproveApplication, useRejectApplication, useCancelApplication
- `src/hooks/useUsers.ts` — useAdminUsers, useUser, useUpdateUserRole, useUpdateUserStatus, useResetPassword, useDeleteUser, useMyProfile, useUpdateProfile
- `└─ Side Impact`: 없음

---

### Phase 1-7. Frontend — Layout & Guards (레이아웃 & 가드)

#### Step 1-7-1. Route Guards

- `src/components/guards/EntityGuard.tsx` — JWT 검증 + crp_code 매칭 + temp_password 강제 이동
- `src/components/guards/AdminGuard.tsx` — ADMIN 역할 체크 → `/admin/*` 보호
- `└─ Side Impact`: Auth Store 의존

#### Step 1-7-2. Layout Components

- `src/components/layout/AuthLayout.tsx` — 로그인/Entity Info 페이지용 (중앙 정렬, 로고)
- `src/components/layout/AppLayout.tsx` — 법인 사용자용 (Header + Sidebar + Content)
- `src/components/layout/AdminLayout.tsx` — ADMIN용 (Header + Admin Sidebar + Content)
- `src/components/layout/Header.tsx` — GNB (Entity 정보, 알림, 사용자 메뉴, 언어 선택)
- `src/components/layout/Sidebar.tsx` — 네비게이션 (역할별 메뉴 분기)
- **Web Style Guide 준수**: Header 64px, Sidebar 240px(접힘 64px), Content 가변
- `└─ Side Impact`: 없음

#### Step 1-7-3. Common UI Components

- `PageHeader.tsx` — 제목, 뒤로가기, 액션 버튼
- `StatusBadge.tsx` — 상태별 색상 뱃지 (ACTIVE:green, SUSPENDED:yellow, INACTIVE:gray, PENDING:orange, APPROVED:green, REJECTED:red, LOCKED:red)
- `DataTable.tsx` — 데이터 테이블 (정렬, 페이지네이션)
- `FilterBar.tsx` — 검색 + 필터 영역
- `ConfirmModal.tsx` — 확인/취소 다이얼로그
- `ToastContainer.tsx` — Toast 알림 렌더링
- **Web Style Guide 준수**: Button, Input, Card, Modal, Table 스타일 §7
- `└─ Side Impact`: 없음

#### Step 1-7-4. Router Setup (App.tsx)

- `src/App.tsx` — BrowserRouter `basename="/app-stock-management"`
- Route 구조:
  ```
  /entity-info                    → EntityInfoPage (Public)
  /login                          → LoginPage (Public)
  /admin/*                        → AdminGuard + AdminLayout
    /admin/corporations            → CorporationListPage
    /admin/corporations/new        → CorporationFormPage
    /admin/corporations/:crp_id    → CorporationDetailPage
    /admin/applications            → ApplicationListPage
    /admin/applications/:uap_id    → ApplicationDetailPage
    /admin/users                   → UserListPage
    /admin/users/:usr_id           → UserDetailPage
  /:crp_code/*                    → EntityGuard + AppLayout
    /:crp_code/auth/change-password → ChangePasswordPage
    /:crp_code/dashboard           → DashboardPage
    /:crp_code/applications        → ApplicationListPage (Corp)
    /:crp_code/applications/new    → ApplicationFormPage
    /:crp_code/my/profile          → ProfilePage
  ```
- `└─ Side Impact`: 없음

---

### Phase 1-8. Frontend — Auth Pages (인증 페이지)

#### Step 1-8-1. EntityInfoPage (SCR-AUTH-00)

- Entity Code 입력 → 유효성 검증 → 로그인 페이지 이동
- `reason` 파라미터별 상태 메시지 (not_found, suspended, inactive, expired)
- 고객 지원 이메일 안내
- `└─ Side Impact`: 없음

#### Step 1-8-2. LoginPage (SCR-AUTH-01)

- URL `?entity={crp_code}` → Entity 정보 자동 로드 (법인명 표시)
- 이메일 + 비밀번호 폼 (React Hook Form + Zod)
- 에러 메시지 인라인 표시
- 로그인 성공 → temp_password 체크 → dashboard 또는 change-password
- `└─ Side Impact`: Auth Store 업데이트

#### Step 1-8-3. ChangePasswordPage (SCR-AUTH-02)

- 현재(임시) 비밀번호 + 새 비밀번호 + 확인
- 실시간 비밀번호 규칙 체크 (8자+, 영문, 숫자, 특수문자)
- 변경 완료 → dashboard 이동
- `└─ Side Impact`: Auth Store 업데이트 (temp_password=false)

---

### Phase 1-9. Frontend — Admin Pages (관리자 페이지)

#### Step 1-9-1. Corporation Pages (법인 관리)

- `CorporationListPage.tsx` (SCR-CRP-01) — 검색/필터/페이지네이션 + [법인 등록] 버튼
- `CorporationFormPage.tsx` (SCR-CRP-02) — 등록 폼 + crp_code 실시간 중복 검증
- `CorporationDetailPage.tsx` (SCR-CRP-03) — 탭: 기본 정보 | 소속 사용자 | 신청 이력 + 상태 변경/삭제
- `└─ Side Impact`: 없음

#### Step 1-9-2. Application Pages (신청 관리 — ADMIN)

- `ApplicationListPage.tsx` (SCR-UAP-01) — 전체 법인 신청 목록 + 상태/법인 필터
- `ApplicationDetailPage.tsx` (SCR-UAP-04) — 신청 상세 + [승인]/[반려] 심사
- `└─ Side Impact`: 없음

#### Step 1-9-3. User Management Pages (사용자 관리)

- `UserListPage.tsx` (SCR-USR-01) — 전체 사용자 목록 + 역할/상태/법인 필터
- `UserDetailPage.tsx` (SCR-USR-02) — 상세 + 역할 변경/상태 변경/비밀번호 초기화
- `└─ Side Impact`: 없음

---

### Phase 1-10. Frontend — Corp Pages (법인 사용자 페이지)

#### Step 1-10-1. Corp Application Pages (법인 신청)

- `corp/ApplicationListPage.tsx` (SCR-UAP-02) — 본인 법인 신청만 조회 + [신청하기] 버튼
- `corp/ApplicationFormPage.tsx` (SCR-UAP-03) — 사용자 신청 폼 + 이메일 중복 검증 + 한도 표시
- `└─ Side Impact`: 없음

#### Step 1-10-2. Profile & Dashboard

- `corp/ProfilePage.tsx` (SCR-USR-03) — 내 정보 수정 + 비밀번호 변경
- `corp/DashboardPage.tsx` (SCR-DASH-00) — 메인 대시보드 (Entity 컨텍스트 표시, 기본 통계)
  - Phase 1에서는 간단한 환영 메시지 + 법인 정보 + 사용자 현황 카드
- `└─ Side Impact`: 없음

---

## 3. File Change List (변경 파일 목록)

### 3.1 Backend Files (신규)

| # | Category | File | Type |
|---|----------|------|------|
| 1 | Config | `apps/app-stock-management/backend/package.json` | New |
| 2 | Config | `apps/app-stock-management/backend/tsconfig.json` | New |
| 3 | Config | `apps/app-stock-management/backend/nest-cli.json` | New |
| 4 | Config | `apps/app-stock-management/backend/Dockerfile` | New |
| 5 | Bootstrap | `backend/src/main.ts` | New |
| 6 | Bootstrap | `backend/src/app.module.ts` | New |
| 7 | Health | `backend/src/health.controller.ts` | New |
| 8 | Auth | `backend/src/auth/auth.module.ts` | New |
| 9 | Auth | `backend/src/auth/auth.service.ts` | New |
| 10 | Auth | `backend/src/auth/auth.controller.ts` | New |
| 11 | Auth | `backend/src/auth/jwt.strategy.ts` | New |
| 12 | Auth | `backend/src/auth/guards/jwt-auth.guard.ts` | New |
| 13 | Auth | `backend/src/auth/guards/entity-scope.guard.ts` | New |
| 14 | Auth | `backend/src/auth/guards/role.guard.ts` | New |
| 15 | Auth | `backend/src/auth/decorators/auth.decorator.ts` | New |
| 16 | Auth | `backend/src/auth/decorators/current-user.decorator.ts` | New |
| 17 | Auth | `backend/src/auth/decorators/public.decorator.ts` | New |
| 18 | Auth | `backend/src/auth/decorators/roles.decorator.ts` | New |
| 19 | Auth | `backend/src/auth/interfaces/jwt-payload.interface.ts` | New |
| 20 | Corporation | `backend/src/domain/corporation/corporation.module.ts` | New |
| 21 | Corporation | `backend/src/domain/corporation/controller/corporation.controller.ts` | New |
| 22 | Corporation | `backend/src/domain/corporation/service/corporation.service.ts` | New |
| 23 | Corporation | `backend/src/domain/corporation/entity/corporation.entity.ts` | New |
| 24 | Corporation | `backend/src/domain/corporation/dto/request/create-corporation.request.ts` | New |
| 25 | Corporation | `backend/src/domain/corporation/dto/request/update-corporation.request.ts` | New |
| 26 | Corporation | `backend/src/domain/corporation/dto/request/update-corporation-status.request.ts` | New |
| 27 | Corporation | `backend/src/domain/corporation/dto/response/corporation.response.ts` | New |
| 28 | Corporation | `backend/src/domain/corporation/mapper/corporation.mapper.ts` | New |
| 29 | UserApp | `backend/src/domain/user-application/user-application.module.ts` | New |
| 30 | UserApp | `backend/src/domain/user-application/controller/user-application.controller.ts` | New |
| 31 | UserApp | `backend/src/domain/user-application/controller/corp-application.controller.ts` | New |
| 32 | UserApp | `backend/src/domain/user-application/service/user-application.service.ts` | New |
| 33 | UserApp | `backend/src/domain/user-application/entity/user-application.entity.ts` | New |
| 34 | UserApp | `backend/src/domain/user-application/dto/request/create-application.request.ts` | New |
| 35 | UserApp | `backend/src/domain/user-application/dto/request/reject-application.request.ts` | New |
| 36 | UserApp | `backend/src/domain/user-application/dto/response/user-application.response.ts` | New |
| 37 | UserApp | `backend/src/domain/user-application/mapper/user-application.mapper.ts` | New |
| 38 | User | `backend/src/domain/user/user.module.ts` | New |
| 39 | User | `backend/src/domain/user/controller/user.controller.ts` | New |
| 40 | User | `backend/src/domain/user/controller/profile.controller.ts` | New |
| 41 | User | `backend/src/domain/user/service/user.service.ts` | New |
| 42 | User | `backend/src/domain/user/entity/user.entity.ts` | New |
| 43 | User | `backend/src/domain/user/dto/request/update-user-role.request.ts` | New |
| 44 | User | `backend/src/domain/user/dto/request/update-user-status.request.ts` | New |
| 45 | User | `backend/src/domain/user/dto/request/update-profile.request.ts` | New |
| 46 | User | `backend/src/domain/user/dto/request/change-password.request.ts` | New |
| 47 | User | `backend/src/domain/user/dto/response/user.response.ts` | New |
| 48 | User | `backend/src/domain/user/mapper/user.mapper.ts` | New |
| 49 | EntityAccess | `backend/src/domain/entity-access/entity-access.module.ts` | New |
| 50 | EntityAccess | `backend/src/domain/entity-access/controller/entity-access.controller.ts` | New |
| 51 | EntityAccess | `backend/src/domain/entity-access/service/entity-access.service.ts` | New |
| 52 | Common | `backend/src/common/constants/enums.ts` | New |
| 53 | Common | `backend/src/common/dto/base-response.dto.ts` | New |
| 54 | Common | `backend/src/common/exceptions/business.exception.ts` | New |
| 55 | Common | `backend/src/common/filters/global-exception.filter.ts` | New |
| 56 | DB | `backend/scripts/init-db.sql` | New |

### 3.2 Frontend Files (신규)

| # | Category | File | Type |
|---|----------|------|------|
| 57 | Config | `apps/app-stock-management/frontend/package.json` | New |
| 58 | Config | `frontend/vite.config.ts` | New |
| 59 | Config | `frontend/tsconfig.json` | New |
| 60 | Config | `frontend/tailwind.config.ts` | New |
| 61 | Config | `frontend/postcss.config.js` | New |
| 62 | Config | `frontend/index.html` | New |
| 63 | Config | `frontend/Dockerfile` | New |
| 64 | Config | `frontend/nginx.conf` | New |
| 65 | App | `frontend/src/App.tsx` | New |
| 66 | App | `frontend/src/main.tsx` | New |
| 67 | App | `frontend/src/index.css` | New |
| 68 | App | `frontend/src/vite-env.d.ts` | New |
| 69 | i18n | `frontend/src/i18n/i18n.ts` | New |
| 70 | i18n | `frontend/src/i18n/locales/ko/stock.json` | New |
| 71 | i18n | `frontend/src/i18n/locales/en/stock.json` | New |
| 72 | i18n | `frontend/src/i18n/locales/vi/stock.json` | New |
| 73 | Lib | `frontend/src/lib/api-client.ts` | New |
| 74 | Lib | `frontend/src/lib/query-client.ts` | New |
| 75 | Store | `frontend/src/stores/auth.store.ts` | New |
| 76 | Store | `frontend/src/stores/toast.store.ts` | New |
| 77 | Service | `frontend/src/services/auth.service.ts` | New |
| 78 | Service | `frontend/src/services/corporation.service.ts` | New |
| 79 | Service | `frontend/src/services/user-application.service.ts` | New |
| 80 | Service | `frontend/src/services/user.service.ts` | New |
| 81 | Hook | `frontend/src/hooks/useAuth.ts` | New |
| 82 | Hook | `frontend/src/hooks/useCorporations.ts` | New |
| 83 | Hook | `frontend/src/hooks/useUserApplications.ts` | New |
| 84 | Hook | `frontend/src/hooks/useUsers.ts` | New |
| 85 | Guard | `frontend/src/components/guards/EntityGuard.tsx` | New |
| 86 | Guard | `frontend/src/components/guards/AdminGuard.tsx` | New |
| 87 | Layout | `frontend/src/components/layout/AppLayout.tsx` | New |
| 88 | Layout | `frontend/src/components/layout/AdminLayout.tsx` | New |
| 89 | Layout | `frontend/src/components/layout/AuthLayout.tsx` | New |
| 90 | Layout | `frontend/src/components/layout/Sidebar.tsx` | New |
| 91 | Layout | `frontend/src/components/layout/Header.tsx` | New |
| 92 | Common | `frontend/src/components/common/PageHeader.tsx` | New |
| 93 | Common | `frontend/src/components/common/StatusBadge.tsx` | New |
| 94 | Common | `frontend/src/components/common/DataTable.tsx` | New |
| 95 | Common | `frontend/src/components/common/FilterBar.tsx` | New |
| 96 | Common | `frontend/src/components/common/ConfirmModal.tsx` | New |
| 97 | Common | `frontend/src/components/common/ToastContainer.tsx` | New |
| 98 | Page | `frontend/src/pages/auth/EntityInfoPage.tsx` | New |
| 99 | Page | `frontend/src/pages/auth/LoginPage.tsx` | New |
| 100 | Page | `frontend/src/pages/auth/ChangePasswordPage.tsx` | New |
| 101 | Page | `frontend/src/pages/admin/CorporationListPage.tsx` | New |
| 102 | Page | `frontend/src/pages/admin/CorporationFormPage.tsx` | New |
| 103 | Page | `frontend/src/pages/admin/CorporationDetailPage.tsx` | New |
| 104 | Page | `frontend/src/pages/admin/ApplicationListPage.tsx` | New |
| 105 | Page | `frontend/src/pages/admin/ApplicationDetailPage.tsx` | New |
| 106 | Page | `frontend/src/pages/admin/UserListPage.tsx` | New |
| 107 | Page | `frontend/src/pages/admin/UserDetailPage.tsx` | New |
| 108 | Page | `frontend/src/pages/corp/ApplicationListPage.tsx` | New |
| 109 | Page | `frontend/src/pages/corp/ApplicationFormPage.tsx` | New |
| 110 | Page | `frontend/src/pages/corp/ProfilePage.tsx` | New |
| 111 | Page | `frontend/src/pages/corp/DashboardPage.tsx` | New |

### 3.3 Infrastructure Files (인프라)

| # | Category | File | Type |
|---|----------|------|------|
| 112 | Docker | `apps/app-stock-management/docker-compose.app-stock-management.yml` | New |
| 113 | Config | `apps/app-stock-management/.env.example` | New |
| 114 | Deploy | `platform/scripts/deploy-staging.sh` | Modify |

---

## 4. Side Impact Analysis (사이드 임팩트 분석)

| # | Scope | Risk | Description |
|---|-------|------|-------------|
| 1 | Turborepo Workspace | 🟢 Low | `apps/*/backend`, `apps/*/frontend` glob 패턴이 자동 매칭. `npm run dev` 시 즉시 인식. |
| 2 | MySQL Port | 🟡 Medium | Docker Compose에서 기존 MySQL 인스턴스와 포트 충돌 가능. 공유 MySQL 사용 권장 (db_app_stock DB만 추가). |
| 3 | Deploy Script | 🟡 Medium | `deploy-staging.sh`에 app-stock-management 컨테이너 빌드/실행 로직 추가 필요. |
| 4 | Platform plt_apps | 🟢 Low | `plt_apps` 테이블에 app-stock-management 레코드 INSERT 필요 (시드 SQL). |
| 5 | Nginx | 🟢 None | 이미 `/app-stock-management/` 라우팅 설정 완료. 변경 불필요. |
| 6 | npm install | 🟡 Medium | 루트에서 `npm install` 시 workspace 전체 설치. backend에 bcrypt 네이티브 빌드 의존성 필요 (node-gyp). |
| 7 | Auth Independence | 🟢 None | 자체 JWT 시스템이므로 기존 AMA SSO에 영향 없음. |
| 8 | Entity Naming | 🟡 Medium | `asm_` prefix 사용 (CLAUDE.md의 `stk_`와 다름). Reference FDS 문서 기준 준수. |
| 9 | Corporation SUSPENDED | 🟡 Medium | 법인 정지 시 소속 사용자 세션 무효화 필요. Phase 1에서는 JWT 만료 의존 (토큰 블랙리스트 미구현). |
| 10 | Email Stub | 🟢 Low | 이메일 미발송 (콘솔 로그). 실제 운영 시 SMTP 연동 필요 (Phase 2). |

---

## 5. DB Migration (DB 마이그레이션)

### 5.1 Initial Schema — `scripts/init-db.sql`

```sql
-- ============================================
-- ambStockManagement — Database Initialization
-- DB: db_app_stock
-- Project Code: ASM
-- Table Prefix: asm_
-- ============================================

CREATE DATABASE IF NOT EXISTS db_app_stock
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE db_app_stock;

-- ============================================
-- E1. asm_corporations (법인)
-- ============================================
CREATE TABLE asm_corporations (
  crp_id              CHAR(36)     NOT NULL PRIMARY KEY,
  crp_name            VARCHAR(100) NOT NULL,
  crp_code            VARCHAR(20)  NOT NULL,
  crp_biz_no          VARCHAR(20)  NULL,
  crp_country         VARCHAR(3)   NOT NULL DEFAULT 'VNM',
  crp_contact_name    VARCHAR(50)  NOT NULL,
  crp_contact_email   VARCHAR(100) NOT NULL,
  crp_contact_phone   VARCHAR(20)  NULL,
  crp_status          ENUM('ACTIVE','SUSPENDED','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  crp_max_user_count  INT          NOT NULL DEFAULT 10,
  crp_created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  crp_updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  crp_deleted_at      DATETIME     NULL DEFAULT NULL,

  UNIQUE KEY uq_asm_corporations_code (crp_code),
  UNIQUE KEY uq_asm_corporations_biz_no (crp_biz_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_asm_corporations_status ON asm_corporations(crp_status);

-- ============================================
-- E3. asm_users (사용자) — E2보다 먼저 생성 (FK 참조용)
-- ============================================
CREATE TABLE asm_users (
  usr_id              CHAR(36)     NOT NULL PRIMARY KEY,
  usr_code            VARCHAR(20)  NOT NULL,
  usr_name            VARCHAR(50)  NOT NULL,
  usr_email           VARCHAR(100) NOT NULL,
  usr_password_hash   VARCHAR(255) NOT NULL,
  usr_role            ENUM('OPERATOR','MANAGER','VIEWER') NOT NULL,
  usr_is_admin        BOOLEAN      NOT NULL DEFAULT FALSE,
  crp_id              CHAR(36)     NULL,
  uap_id              CHAR(36)     NULL,
  usr_status          ENUM('ACTIVE','INACTIVE','LOCKED') NOT NULL DEFAULT 'ACTIVE',
  usr_temp_password   BOOLEAN      NOT NULL DEFAULT TRUE,
  usr_last_login_at   DATETIME     NULL,
  usr_login_fail_count INT         NOT NULL DEFAULT 0,
  usr_locked_at       DATETIME     NULL,
  usr_created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usr_updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  usr_deleted_at      DATETIME     NULL DEFAULT NULL,

  UNIQUE KEY uq_asm_users_code (usr_code),
  UNIQUE KEY uq_asm_users_email (usr_email),
  CONSTRAINT fk_asm_users_corporation
    FOREIGN KEY (crp_id) REFERENCES asm_corporations(crp_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_asm_users_crp_status ON asm_users(crp_id, usr_status);
CREATE INDEX idx_asm_users_email ON asm_users(usr_email);

-- ============================================
-- E2. asm_user_applications (사용자 신청)
-- ============================================
CREATE TABLE asm_user_applications (
  uap_id              CHAR(36)     NOT NULL PRIMARY KEY,
  uap_no              VARCHAR(20)  NOT NULL,
  crp_id              CHAR(36)     NOT NULL,
  uap_applicant_name  VARCHAR(50)  NOT NULL,
  uap_target_name     VARCHAR(50)  NOT NULL,
  uap_target_email    VARCHAR(100) NOT NULL,
  uap_target_role     ENUM('OPERATOR','MANAGER','VIEWER') NOT NULL,
  usr_id              CHAR(36)     NULL,
  uap_status          ENUM('PENDING','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  uap_reject_reason   TEXT         NULL,
  uap_note            TEXT         NULL,
  uap_submitted_at    DATETIME     NOT NULL,
  uap_reviewed_at     DATETIME     NULL,
  uap_reviewed_by     CHAR(36)     NULL,
  uap_created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  uap_updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_asm_user_applications_no (uap_no),
  CONSTRAINT fk_asm_uap_corporation
    FOREIGN KEY (crp_id) REFERENCES asm_corporations(crp_id),
  CONSTRAINT fk_asm_uap_user
    FOREIGN KEY (usr_id) REFERENCES asm_users(usr_id),
  CONSTRAINT fk_asm_uap_reviewer
    FOREIGN KEY (uap_reviewed_by) REFERENCES asm_users(usr_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_asm_uap_crp_status ON asm_user_applications(crp_id, uap_status);
CREATE INDEX idx_asm_uap_status ON asm_user_applications(uap_status);

-- ============================================
-- asm_users.uap_id FK (순환 참조 해결)
-- ============================================
ALTER TABLE asm_users
  ADD CONSTRAINT fk_asm_users_application
    FOREIGN KEY (uap_id) REFERENCES asm_user_applications(uap_id);

-- ============================================
-- Seed: ADMIN 계정
-- ============================================
-- Password: Admin@2026 (bcrypt hash, rounds: 12)
INSERT INTO asm_users (
  usr_id, usr_code, usr_name, usr_email, usr_password_hash,
  usr_role, usr_is_admin, crp_id, uap_id,
  usr_status, usr_temp_password
) VALUES (
  UUID(), 'USR-ADMIN-000001', 'System Admin', 'admin@amoeba.site',
  '$2b$12$LJ3m/RhcPcCL.dFpHyas/ePL.y9E8MJnQeK7xL0dN/J5Hv/kQVvK.',
  'VIEWER', TRUE, NULL, NULL,
  'ACTIVE', FALSE
);

-- ============================================
-- TypeORM metadata table (optional)
-- ============================================
CREATE TABLE IF NOT EXISTS typeorm_metadata (
  type VARCHAR(255) NOT NULL,
  database_name VARCHAR(255) DEFAULT NULL,
  schema_name VARCHAR(255) DEFAULT NULL,
  table_name VARCHAR(255) DEFAULT NULL,
  name VARCHAR(255) DEFAULT NULL,
  value TEXT DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 5.2 Platform Seed — plt_apps Registration

```sql
-- platform DB (db_app_platform) 에서 실행
INSERT INTO plt_apps (
  app_id, app_slug, app_name, app_description,
  app_icon_url, app_status, app_port_fe, app_port_be
) VALUES (
  UUID(), 'app-stock-management', '재고관리',
  'ambStockManagement — 법인 단위 재고 관리 시스템. 재고 현황, 입출고, 안전재고 설정, 수요 예측 기능을 제공합니다.',
  NULL, 'ACTIVE', 5204, 3104
);
```

### 5.3 Migration Strategy (마이그레이션 전략)

| Environment | Strategy | Note |
|-------------|----------|------|
| Local Dev | `synchronize: true` | TypeORM 자동 동기화 (편의) |
| Staging | `synchronize: false` | `init-db.sql` 수동 실행 |
| Production | `synchronize: false` | `init-db.sql` 수동 실행 + 검증 |

---

## Document Change History (문서 변경 이력)

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0.0 | 2026-03-29 | AI Assistant | Initial creation. 10 phases, 111+ files, 3 DB tables, full API/screen list. |

---

*— End of Document — ASM-TASK-PLAN-1.0.0*

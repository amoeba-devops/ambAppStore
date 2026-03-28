---
document_id: AMA-VEH-TASK-PLAN-1.0.0
version: 1.0.0
status: Draft
created: 2026-03-28
updated: 2026-03-28
author: Kim Igyong
based_on: AMA-VEH-ANALYSIS-1.1.0
app: app-car-manager
phase: 1-2
---

# AMA 법인차량관리 (car-manager) — 작업계획서

---

## 목차

1. [문서 개요](#1-문서-개요)
2. [구현 범위](#2-구현-범위)
3. [기술 설계 요약](#3-기술-설계-요약)
4. [태스크 분해 (WBS)](#4-태스크-분해-wbs)
5. [일정 계획](#5-일정-계획)
6. [의존성 및 전제조건](#6-의존성-및-전제조건)
7. [리스크 대응 계획](#7-리스크-대응-계획)

---

## 1. 문서 개요

### 1.1 문서 정보

| 항목 | 내용 |
|------|------|
| **문서명** | AMA 법인차량관리 작업계획서 |
| **문서 ID** | AMA-VEH-TASK-PLAN-1.0.0 |
| **버전** | v1.0.0 |
| **작성일** | 2026-03-28 |
| **작성자** | Kim Igyong |
| **입력물** | AMA-VEH-ANALYSIS-1.1.0 (요구사항분석서) |
| **상태** | Draft |

### 1.2 문서 목적

본 문서는 `AMA-VEH-ANALYSIS-1.1.0` 요구사항분석서를 기반으로 법인차량관리 앱(car-manager)의 **Phase 1(MVP)** 및 **Phase 2(확장)** 구현을 위한 태스크 분해, 기술 설계 결정사항, 일정 계획, 리스크 대응 방안을 정의한다.

### 1.3 대상 Phase 및 목표

| Phase | 목표 | 예상 총 공수 |
|:-----:|------|:----------:|
| **Phase 0** | AMA API 연동 프로토콜 확정 (BLOCKER 해소) | 협의 |
| **Phase 1** | 차량 등록 → 배차 → 운행 완료 전체 워크플로우 MVP 동작 | **9~12인일** |
| **Phase 2** | 유지관리, 알림, Excel 출력, 지도, 대시보드 확장 | **5~7인일** |

> Phase 3(GPS, AI, 정기운행)은 별도 스프린트로 별개 TASK-PLAN에서 다룬다.

---

## 2. 구현 범위

### 2.1 Phase 1 — MVP 범위

**목표:** 차량 등록부터 배차 완료까지 핵심 비즈니스 플로우가 동작하는 최소 기능 제품

**포함 FR (35개 P0)**:

| 도메인 | 포함 FR | FR 수 |
|--------|---------|:-----:|
| 차량 관리 | FR-VEH-001 ~ 006 | 6 |
| 기사 관리 | FR-DRV-001 ~ 004 | 4 |
| 배차 관리 | FR-DSP-001 ~ 016 | 15* |
| 운행일지 | FR-LOG-001 ~ 003 | 3 |
| 관제 모니터링 | FR-MON-001 ~ 003 | 3 |
| **합계** | | **31** |

> *FR-DSP-014(신청 취소)는 P1이나 핵심 워크플로우 완결을 위해 Phase 1에 포함. FR-DSP-017(비상배차), FR-DSP-018(정기운행)은 제외.

**필수 적용 BR**: BR-001 ~ 009, BR-011 ~ 017 (17개 중 15개, BR-010/BR-006 제외)

**핵심 화면**:
- 메인 대시보드 (`/`)
- 차량 목록/상세/등록 (`/vehicles`, `/vehicles/new`, `/vehicles/:id`)
- 배차 현황판/신청/상세 (`/dispatch-requests`, `/dispatch-requests/new`, `/dispatch-requests/:id`)
- 배차 이력 (`/dispatch-requests/my`)
- 운행일지 목록/상세 (`/trip-logs`, `/trip-logs/:id`)
- 관제 모니터링 (`/monitor`)

### 2.2 Phase 2 — 확장 범위

**목표:** 유지관리, 알림 시스템, 리포팅, 지도 연동으로 운영 완성도 향상

**포함 FR (19개 P1 + Phase 1 미포함)**:

| 도메인 | 포함 FR | FR 수 |
|--------|---------|:-----:|
| 차량 관리 | FR-VEH-007 ~ 009 | 3 |
| 기사 관리 | FR-DRV-005 ~ 006 | 2 |
| 배차 관리 | FR-DSP-017 | 1 |
| 운행일지 | FR-LOG-004 ~ 007 | 4 |
| 유지관리 | FR-MNT-001 ~ 005 | 5 |
| 관제 모니터링 | FR-MON-004, FR-MON-006 | 2 |
| **합계** | | **17** |

**추가 적용 BR**: BR-006(비상배차), BR-010(운행일지 24h 수정 제한)

### 2.3 제외 항목 (Phase 3 이후)

| 항목 | FR | 사유 |
|------|-----|------|
| GPS 실시간 위치 | FR-MON-005 | 외부 GPS 연동 기술 선택 필요 |
| AI 이상 감지 | FR-LOG-008 | AI 엔진 의존 |
| AI 정비 시기 예측 | FR-MNT-006 | AI 엔진 의존 |
| AI 차량 상태 요약 | FR-VEH-010 | AI 엔진 의존 |
| 정기 운행 설정 | FR-DSP-018 | MVP 복잡도 관리 (OQ-3) |
| 모바일 PWA/앱 최적화 | — | OQ-1 결정 후 |

---

## 3. 기술 설계 요약

### 3.1 아키텍처 결정사항

| # | 결정 | 근거 | 대안 |
|---|------|------|------|
| AD-01 | **NestJS BFF + React SPA** 격리 구조 | 플랫폼 표준 (SKILL §2) | — |
| AD-02 | **TypeORM 0.3.x** Entity-first 접근 | `autoLoadEntities`, Migration 기반 스키마 관리 | Prisma (학습 비용) |
| AD-03 | **AMA JWT Passthrough** 인증 | AMA SSO 활용, 자체 회원가입 불필요 | — |
| AD-04 | **상태 머신 패턴** 배차 워크플로우 | 9개 상태 전이의 명확한 규칙 관리 (R-004 대응) | 단순 if-else (유지보수 불량) |
| AD-05 | **React Query 5** 서버 상태 관리 | 캐시/무효화 자동화, staleTime 30초 | SWR (기능 부족) |
| AD-06 | **Zustand** 클라이언트 상태 | 경량, 보일러플레이트 최소 | Redux (과도) |
| AD-07 | **i18n 3개 언어** (ko/en/vi) | 한국+베트남 법인 동시 지원 | — |
| AD-08 | **Soft Delete** 전 테이블 적용 | SKILL §5 DB 규칙, 데이터 감사 추적 | Hard Delete (복구 불가) |
| AD-09 | **Docker 격리** (BFF 3101 + Web 별도) | 앱별 독립 배포, 플랫폼 표준 | — |
| AD-10 | **멀티테넌시 Guard 패턴** | `ent_id` 기반 데이터 격리를 Guard 레벨에서 강제 (BR-011) | Service 레벨만 (누락 위험) |

### 3.2 DB 스키마 요약

**데이터베이스**: `db_app_car` (MySQL 8.0)

| # | 테이블 | Prefix | 주요 역할 | 예상 컬럼 수 |
|---|--------|--------|---------|:----------:|
| 1 | `car_vehicles` | `cvh_` | 차량 기본/운용 정보 | ~30 |
| 2 | `car_vehicle_managers` | `cvm_` | 차량 관리 책임자 (N:M) | 7 |
| 3 | `car_vehicle_drivers` | `cvd_` | 기사 풀, 역할/상태 (N:M) | 11 |
| 4 | `car_dispatch_requests` | `cdr_` | 배차 신청/처리 | ~25 |
| 5 | `car_trip_logs` | `ctl_` | 운행일지 | ~20 |
| 6 | `car_maintenance_records` | `cmr_` | 정비/검사/보험 이력 | 12 |

**ERD 관계**:

```
car_vehicles ─┬──< car_vehicle_managers
              ├──< car_vehicle_drivers (POOL: cvh_id = NULL)
              ├──< car_dispatch_requests ──< car_trip_logs
              └──< car_maintenance_records
```

**핵심 인덱스**:
- `car_vehicles(cvh_ama_entity_id, cvh_status)` — 법인별 상태 필터
- `car_vehicles(cvh_plate_number)` UNIQUE — 중복 번호판 방지
- `car_dispatch_requests(cvh_id, cdr_depart_at, cdr_return_at)` — 가용성 중복 검사
- `car_vehicle_drivers(cvh_id, cvd_status)` — 가용 기사 조회

### 3.3 API 설계 요약

**Base Path**: `/api/v1`
**인증**: 전 엔드포인트 `@Auth()` 데코레이터 (JWT 검증 + ent_id 추출)
**표준 응답**: `{ success: boolean, data: T, error?: { code, message }, timestamp: string }`

**Phase 1 API (26개 엔드포인트)**:

| 도메인 | Method 분포 | 엔드포인트 수 |
|--------|-----------|:----------:|
| 차량 관리 | 1 POST, 2 GET, 3 PATCH | 6 |
| 기사 관리 | 2 POST, 2 GET, 1 PATCH | 5 |
| 배차 관리 | 1 POST, 3 GET, 7 PATCH | 11 |
| 운행일지 | 1 GET, 1 PATCH | 2 |
| 관제 모니터링 | 2 GET | 2 |
| **합계** | | **26** |

**Phase 2 추가 API (8개 엔드포인트)**:

| 도메인 | 엔드포인트 수 |
|--------|:----------:|
| 유지관리 CRUD | 4 |
| Excel 출력 | 1 |
| 타임라인/달력 | 2 |
| 파일 업로드 | 1 |
| **합계** | **8** |

### 3.4 프론트엔드 모듈 구조

```
apps/app-car-manager/frontend/src/
├── components/
│   ├── vehicles/          # 차량 관련 컴포넌트
│   ├── drivers/           # 기사 관련 컴포넌트
│   ├── dispatch/          # 배차 관련 컴포넌트
│   ├── trip-logs/         # 운행일지 관련 컴포넌트
│   ├── maintenance/       # 유지관리 (Phase 2)
│   ├── monitor/           # 관제 모니터링
│   └── common/            # 공용 UI (Badge, Status, Card 등)
├── hooks/
│   ├── useVehicles.ts     # 차량 React Query 훅
│   ├── useDrivers.ts      # 기사 React Query 훅
│   ├── useDispatch.ts     # 배차 React Query 훅
│   ├── useTripLogs.ts     # 운행일지 React Query 훅
│   └── useMonitor.ts      # 관제 React Query 훅
├── pages/
│   ├── DashboardPage.tsx
│   ├── VehicleListPage.tsx
│   ├── VehicleDetailPage.tsx
│   ├── VehicleCreatePage.tsx
│   ├── DispatchListPage.tsx
│   ├── DispatchCreatePage.tsx
│   ├── DispatchDetailPage.tsx
│   ├── DispatchMyPage.tsx
│   ├── TripLogListPage.tsx
│   ├── TripLogDetailPage.tsx
│   └── MonitorPage.tsx
├── stores/
│   └── auth.store.ts      # JWT 토큰/사용자 정보
├── i18n/
│   └── locales/
│       ├── ko/            # 한국어
│       ├── en/            # 영어
│       └── vi/            # 베트남어
└── lib/
    ├── api-client.ts      # axios 인스턴스
    └── dispatch-state.ts  # 배차 상태 전이 헬퍼
```

### 3.5 백엔드 모듈 구조

```
apps/app-car-manager/backend/src/
├── auth/                  # AMA JWT 인증 모듈
│   ├── auth.module.ts
│   ├── auth.guard.ts      # @Auth() 데코레이터
│   ├── entity.guard.ts    # ent_id 격리 Guard
│   └── auth.service.ts
├── vehicles/              # 차량 관리 모듈
│   ├── vehicles.module.ts
│   ├── vehicles.controller.ts
│   ├── vehicles.service.ts
│   ├── entities/
│   │   ├── vehicle.entity.ts
│   │   └── vehicle-manager.entity.ts
│   └── dto/
├── drivers/               # 기사 관리 모듈
│   ├── drivers.module.ts
│   ├── drivers.controller.ts
│   ├── drivers.service.ts
│   ├── entities/
│   │   └── vehicle-driver.entity.ts
│   └── dto/
├── dispatch/              # 배차 관리 모듈
│   ├── dispatch.module.ts
│   ├── dispatch.controller.ts
│   ├── dispatch.service.ts
│   ├── dispatch-state-machine.ts  # 상태 전이 엔진
│   ├── entities/
│   │   └── dispatch-request.entity.ts
│   └── dto/
├── trip-logs/             # 운행일지 모듈
│   ├── trip-logs.module.ts
│   ├── trip-logs.controller.ts
│   ├── trip-logs.service.ts
│   ├── entities/
│   │   └── trip-log.entity.ts
│   └── dto/
├── maintenance/           # 유지관리 모듈 (Phase 2)
│   ├── maintenance.module.ts
│   ├── maintenance.controller.ts
│   ├── maintenance.service.ts
│   ├── entities/
│   │   └── maintenance-record.entity.ts
│   └── dto/
├── monitor/               # 관제 모듈
│   ├── monitor.module.ts
│   ├── monitor.controller.ts
│   └── monitor.service.ts
├── notifications/         # 알림 모듈
│   ├── notifications.module.ts
│   └── notifications.service.ts
└── common/
    ├── dto/               # 공용 DTO (페이징, 응답 래퍼)
    ├── filters/           # 예외 필터
    └── interceptors/      # 응답 변환 인터셉터
```

---

## 4. 태스크 분해 (WBS)

### 4.1 Phase 0 — AMA API 확정 (사전 조건)

| Task ID | 태스크 | 관련 FR | 예상 공수 | 의존성 | 담당자 | 상태 |
|---------|--------|---------|----------|--------|--------|------|
| T-001 | AMA SSO 인증 방식 협의 및 확정 (OQ-0) | — | 협의 | — | PM | TODO |
| T-002 | AMA Asset API VEHICLE 필터 확인 (OQ-0a) | FR-VEH-001 | 협의 | — | PM | TODO |
| T-003 | AMA Members API 공개 범위 확인 | FR-DRV-001 | 협의 | — | PM | TODO |
| T-004 | Mock JWT + Mock AMA API 환경 구축 | — | 0.5d | — | dev-A | TODO |

### 4.2 Phase 1 — MVP (9~12인일)

#### 4.2.1 인프라 & 공통 (2d)

| Task ID | 태스크 | 관련 FR | 예상 공수 | 의존성 | 담당자 | 상태 |
|---------|--------|---------|----------|--------|--------|------|
| T-101 | 프로젝트 스캐폴딩 (NestJS + React + Vite + Docker) | — | 0.5d | — | dev-A | TODO |
| T-102 | DB 스키마 생성 (6 테이블) + TypeORM Entity 정의 | — | 0.5d | T-101 | dev-A | TODO |
| T-103 | AMA JWT 인증 미들웨어 (`@Auth()`, Entity Guard) | — | 0.5d | T-004, T-102 | dev-A | TODO |
| T-104 | 공통 모듈: 응답 래퍼, 예외 필터, 페이징 DTO | — | 0.5d | T-101 | dev-A | TODO |

#### 4.2.2 차량 관리 (2.5d)

| Task ID | 태스크 | 관련 FR | 예상 공수 | 의존성 | 담당자 | 상태 |
|---------|--------|---------|----------|--------|--------|------|
| T-111 | 차량 CRUD API (등록/목록/상세/수정) | FR-VEH-001~004 | 1d | T-102, T-103 | dev-A | TODO |
| T-112 | 차량 상태 변경 API + 지정 운용 설정 API | FR-VEH-005~006 | 0.5d | T-111 | dev-A | TODO |
| T-113 | AMA Asset API 연동 (차량 등록 시 자산 선택) | FR-VEH-001 | 0.5d | T-002, T-111 | dev-A | TODO |
| T-114 | 차량 목록 페이지 (카드뷰, 필터) | FR-VEH-002 | 0.5d | T-111, T-104 | dev-A | TODO |
| T-115 | 차량 등록 페이지 (2단계: AMA 자산 선택 → 확장 정보 입력) | FR-VEH-001 | 0.5d | T-113, T-114 | dev-A | TODO |
| T-116 | 차량 상세 페이지 (6탭 뼈대 + 기본정보 탭) | FR-VEH-003~006 | 0.5d | T-112, T-115 | dev-A | TODO |

#### 4.2.3 기사 관리 (1.5d)

| Task ID | 태스크 | 관련 FR | 예상 공수 | 의존성 | 담당자 | 상태 |
|---------|--------|---------|----------|--------|--------|------|
| T-121 | 기사 풀 CRUD API (등록/목록/상태변경) | FR-DRV-001~003 | 0.5d | T-102, T-103 | dev-A | TODO |
| T-122 | POOL_DRIVER 관리 API | FR-DRV-004 | 0.25d | T-121 | dev-A | TODO |
| T-123 | AMA Members API 연동 (기사/담당자 선택) | FR-DRV-001 | 0.25d | T-003, T-121 | dev-A | TODO |
| T-124 | 차량 상세 — 기사관리 탭 UI | FR-DRV-001~004 | 0.5d | T-121, T-116 | dev-A | TODO |

#### 4.2.4 배차 관리 — 핵심 워크플로우 (3.5d)

| Task ID | 태스크 | 관련 FR | 예상 공수 | 의존성 | 담당자 | 상태 |
|---------|--------|---------|----------|--------|--------|------|
| T-131 | 배차 상태 전이 엔진 구현 (State Machine) | FR-DSP 전체 | 0.5d | T-102 | dev-A | TODO |
| T-132 | 배차 신청 API + 유효성 검증 (BR-001~003, BR-015~017) | FR-DSP-001~004 | 0.5d | T-131 | dev-A | TODO |
| T-133 | 차량 가용성 조회 API (시간 중복 검사, 지정 운용 차단) | FR-DSP-002~003 | 0.5d | T-132 | dev-A | TODO |
| T-134 | 배차 확정/반려 API + 기사 가용성 판단 로직 | FR-DSP-006~007 | 0.5d | T-121, T-132 | dev-A | TODO |
| T-135 | 기사 응답 API (수락/거절/출발/도착/완료) | FR-DSP-008~013 | 0.5d | T-134 | dev-A | TODO |
| T-136 | 배차 취소/이력 조회 API | FR-DSP-014~015 | 0.25d | T-132 | dev-A | TODO |
| T-137 | 배차 신청 페이지 (폼 + 실시간 가용 차량 표시) | FR-DSP-001~004 | 0.5d | T-133 | dev-A | TODO |
| T-138 | 배차 현황판 페이지 (보드 뷰: 대기/진행중/완료) | FR-DSP-016 | 0.5d | T-136 | dev-A | TODO |
| T-139 | 배차 상세 페이지 (확정/반려/기사응답/완료 액션) | FR-DSP-006~013 | 0.5d | T-135, T-138 | dev-A | TODO |
| T-140 | 배차 이력 페이지 (본인 신청 이력) | FR-DSP-015 | 0.25d | T-136, T-139 | dev-A | TODO |

#### 4.2.5 운행일지 (1d)

| Task ID | 태스크 | 관련 FR | 예상 공수 | 의존성 | 담당자 | 상태 |
|---------|--------|---------|----------|--------|--------|------|
| T-151 | 운행일지 자동 생성 + CRUD API | FR-LOG-001~003 | 0.5d | T-135 | dev-A | TODO |
| T-152 | 운행일지 목록 페이지 (필터/집계) | FR-LOG-003 | 0.25d | T-151 | dev-A | TODO |
| T-153 | 운행일지 상세/작성 페이지 (기사 입력 폼) | FR-LOG-001~002 | 0.25d | T-151, T-152 | dev-A | TODO |

#### 4.2.6 관제 모니터링 (0.5d)

| Task ID | 태스크 | 관련 FR | 예상 공수 | 의존성 | 담당자 | 상태 |
|---------|--------|---------|----------|--------|--------|------|
| T-161 | 관제 API (현황 카드 + 운행 중 목록) | FR-MON-001~003 | 0.25d | T-111, T-132 | dev-A | TODO |
| T-162 | 메인 대시보드 + 관제 모니터링 페이지 | FR-MON-001~003 | 0.25d | T-161 | dev-A | TODO |

#### 4.2.7 알림 & 마무리 (1d)

| Task ID | 태스크 | 관련 FR | 예상 공수 | 의존성 | 담당자 | 상태 |
|---------|--------|---------|----------|--------|--------|------|
| T-171 | 인앱 알림 서비스 (배차 접수/확정/기사지시) | FR-DSP-005, FR-DSP-008 | 0.5d | T-135 | dev-A | TODO |
| T-172 | i18n 번역 파일 작성 (ko/en/vi) | — | 0.25d | T-162 | dev-A | TODO |
| T-173 | Phase 1 통합 테스트 + 버그 수정 | — | 0.5d | T-162, T-171 | dev-A | TODO |
| T-174 | Docker 배포 설정 (docker-compose, Nginx 라우팅) | — | 0.25d | T-173 | dev-A | TODO |

### 4.3 Phase 2 — 확장 (5~7인일)

#### 4.3.1 유지관리 (2d)

| Task ID | 태스크 | 관련 FR | 예상 공수 | 의존성 | 담당자 | 상태 |
|---------|--------|---------|----------|--------|--------|------|
| T-201 | 유지관리 CRUD API (정비/검사/보험) | FR-MNT-001~004 | 0.5d | Phase 1 완료 | dev-A | TODO |
| T-202 | 정비 예약 → 차량 자동 차단 로직 (BR-007) | FR-MNT-002 | 0.25d | T-201 | dev-A | TODO |
| T-203 | 차량 상세 — 유지관리 탭 UI | FR-MNT-001~004 | 0.5d | T-201 | dev-A | TODO |
| T-204 | 만료 알림 시스템 (D-30/D-7 스케줄러) | FR-VEH-007, FR-MNT-003~004, FR-DRV-005 | 0.5d | T-201 | dev-A | TODO |
| T-205 | 유지비 집계 대시보드 | FR-MNT-005 | 0.25d | T-201 | dev-A | TODO |

#### 4.3.2 운행일지 확장 (1.5d)

| Task ID | 태스크 | 관련 FR | 예상 공수 | 의존성 | 담당자 | 상태 |
|---------|--------|---------|----------|--------|--------|------|
| T-211 | 운행일지 수정 24h 제한 로직 (BR-010) | FR-LOG-004 | 0.25d | Phase 1 완료 | dev-A | TODO |
| T-212 | 운행기록부 Excel 출력 (법적 양식) | FR-LOG-006 | 0.5d | T-211, OQ-4 확인 | dev-A | TODO |
| T-213 | 월간 운행 리포트 | FR-LOG-007 | 0.25d | T-211 | dev-A | TODO |
| T-214 | 지도 스냅샷 (Google Maps 연동) | FR-LOG-005 | 0.5d | OQ-2 결정 | dev-A | TODO |

#### 4.3.3 관제 확장 & 기타 (1.5d)

| Task ID | 태스크 | 관련 FR | 예상 공수 | 의존성 | 담당자 | 상태 |
|---------|--------|---------|----------|--------|--------|------|
| T-221 | 당일 배차 타임라인 (Gantt 뷰) | FR-MON-004 | 0.5d | Phase 1 완료 | dev-A | TODO |
| T-222 | 차량 이력 달력 뷰 | FR-MON-006 | 0.5d | T-221 | dev-A | TODO |
| T-223 | 비상 배차 기능 (OVERRIDE + 관리자 알림) | FR-DSP-017 | 0.25d | Phase 1 완료 | dev-A | TODO |
| T-224 | 차량 사진/문서 업로드 (Google Drive) | FR-VEH-008~009 | 0.25d | Google Drive API | dev-A | TODO |

#### 4.3.4 기사 확장 & 마무리 (1d)

| Task ID | 태스크 | 관련 FR | 예상 공수 | 의존성 | 담당자 | 상태 |
|---------|--------|---------|----------|--------|--------|------|
| T-231 | 운전면허 관리 + 만료 알림 | FR-DRV-005 | 0.25d | T-204 | dev-A | TODO |
| T-232 | 기사 운행 이력 집계 | FR-DRV-006 | 0.25d | Phase 1 완료 | dev-A | TODO |
| T-233 | Phase 2 i18n 번역 추가 (ko/en/vi) | — | 0.25d | T-224 | dev-A | TODO |
| T-234 | Phase 2 통합 테스트 + 버그 수정 | — | 0.5d | T-233 | dev-A | TODO |
| T-235 | Phase 2 배포 (Docker 업데이트 + Nginx) | — | 0.25d | T-234 | dev-A | TODO |

### 4.4 태스크 요약

| Phase | 태스크 수 | 예상 총 공수 |
|:-----:|:-------:|:----------:|
| Phase 0 | 4 | 0.5d + 협의 |
| Phase 1 | 25 | **10.5d** |
| Phase 2 | 15 | **6.25d** |
| **합계** | **44** | **~17d** |

---

## 5. 일정 계획

### 5.1 주차별 마일스톤

```
Week 0 ─── Phase 0: AMA API 확정
  ├── [T-001~003] AMA 팀 협의 (SSO, Asset API, Members API)
  └── [T-004] Mock JWT + Mock AMA API 환경 구축

Week 1 ─── Phase 1 인프라 + 차량 관리
  ├── [T-101~104] 프로젝트 설정, DB 스키마, 인증, 공통 모듈 (2d)
  ├── [T-111~113] 차량 CRUD API + AMA 연동 (2d)
  └── [T-114~116] 차량 Frontend (1.5d)
  * 마일스톤: 차량 등록/목록/상세 동작

Week 2 ─── Phase 1 기사 + 배차 (1)
  ├── [T-121~124] 기사 관리 전체 (1.5d)
  ├── [T-131~133] 배차 상태 엔진 + 신청 + 가용성 API (1.5d)
  └── [T-134~136] 배차 확정/기사응답/취소 API (1.25d)
  * 마일스톤: 배차 신청→확정→기사응답 API 동작

Week 3 ─── Phase 1 배차 FE + 운행일지 + 관제 + 마무리
  ├── [T-137~140] 배차 Frontend 전체 (1.75d)
  ├── [T-151~153] 운행일지 전체 (1d)
  ├── [T-161~162] 관제 모니터링 (0.5d)
  ├── [T-171~172] 알림 + i18n (0.75d)
  └── [T-173~174] 통합 테스트 + Docker 배포 (0.75d)
  * 마일스톤: Phase 1 MVP 완료 — 전체 워크플로우 E2E 동작

Week 4~5 ─── Phase 2 유지관리 + 운행일지 확장
  ├── [T-201~205] 유지관리 전체 (2d)
  ├── [T-211~214] 운행일지 확장 (1.5d)
  └── [T-221~222] 관제 확장 (1d)
  * 마일스톤: 유지관리/리포팅/지도 동작

Week 5~6 ─── Phase 2 기타 + 마무리
  ├── [T-223~224] 비상배차 + 파일 업로드 (0.5d)
  ├── [T-231~232] 기사 확장 (0.5d)
  └── [T-233~235] i18n + 테스트 + 배포 (1d)
  * 마일스톤: Phase 2 완료 — 스테이징 배포
```

### 5.2 마일스톤 체크포인트

| # | 마일스톤 | 시점 | 완료 기준 | 관련 태스크 |
|---|---------|------|---------|-----------|
| M-0 | AMA API 프로토콜 확정 | Week 0 | OQ-0, OQ-0a 결정 완료 | T-001~003 |
| M-1 | 차량 CRUD 동작 | Week 1 완료 | 차량 등록/목록/상세/수정 E2E 동작 | T-101~116 |
| M-2 | 배차 워크플로우 API 동작 | Week 2 완료 | 신청→확정→수락→출발→도착→완료 API 검증 | T-121~136 |
| M-3 | **Phase 1 MVP 완료** | Week 3 완료 | 전체 워크플로우 E2E, 스테이징 배포 | T-137~174 |
| M-4 | 유지관리/리포팅 동작 | Week 4~5 | 정비 등록, Excel 출력, 관제 확장 동작 | T-201~222 |
| M-5 | **Phase 2 완료** | Week 5~6 | 전체 Phase 2 기능 동작, 스테이징 배포 | T-223~235 |

### 5.3 크리티컬 패스

```
T-001(SSO 확정) → T-004(Mock 환경) → T-103(인증 미들웨어) → T-111(차량 API)
  → T-121(기사 API) → T-131(상태 엔진) → T-132(배차 신청) → T-134(배차 확정)
  → T-135(기사 응답) → T-151(운행일지) → T-173(통합 테스트)
```

> 크리티컬 패스 상 **배차 상태 전이 엔진(T-131)**과 **배차 확정 로직(T-134)**이 복잡도 핵심. 이 구간에서 지연 발생 가능성이 가장 높다.

---

## 6. 의존성 및 전제조건

### 6.1 외부 의존성 (BLOCKER)

| # | 의존성 | 제공자 | 영향 범위 | OQ 참조 | 대체 방안 | 확인 상태 |
|---|--------|--------|---------|---------|---------|---------|
| D-01 | AMA SSO 인증 프로토콜 | AMA 팀 | Phase 1 전체 | OQ-0 | Mock JWT로 개발 선행 | **미확정** |
| D-02 | AMA Asset API `type=VEHICLE` 필터 | AMA 팀 | FR-VEH-001 (차량 등록) | OQ-0a | 전체 조회 후 프론트 필터링 | **미확정** |
| D-03 | AMA Members API 공개 범위 | AMA 팀 | FR-DRV-001 (기사 등록) | — | 직접 입력 폴백 | **미확정** |

### 6.2 외부 의존성 (Phase 2)

| # | 의존성 | 제공자 | 영향 범위 | OQ 참조 | 대체 방안 |
|---|--------|--------|---------|---------|---------|
| D-04 | 지도 API (Google Maps 추정) | Google | FR-LOG-005 (지도 스냅샷) | OQ-2 | Static Map Image API |
| D-05 | Google Drive API | Google | FR-VEH-008~009 (파일) | — | 자체 파일 서버 |
| D-06 | 한국 운행기록부 법적 양식 | 국세청 | FR-LOG-006 (Excel 출력) | OQ-4 | 일반 집계 Excel |

### 6.3 내부 의존성

| 의존 관계 | 설명 |
|---------|------|
| 배차 → 차량 + 기사 | 배차 API는 차량/기사 모듈이 먼저 구현되어야 함 |
| 운행일지 → 배차 | 운행일지는 배차 완료 후 자동 생성 |
| 관제 → 차량 + 배차 | 현황 집계를 위해 차량/배차 데이터 필요 |
| 유지관리 → 차량 + 배차 | 정비 예약 시 차량 가용성 차단 |
| 알림 → 배차 + 유지관리 | 알림 트리거는 배차/정비 이벤트 |

### 6.4 전제조건

| # | 전제 | 영향 |
|---|------|------|
| P-01 | ambAppStore 플랫폼 인프라 구동 중 (MySQL, Docker, Nginx) | 모든 태스크 |
| P-02 | AMA 스테이징 환경 접근 가능 (SSO 토큰 발급) | T-103 이후 |
| P-03 | `apps/app-car-manager/` 디렉토리 및 Docker 구성 완료 | T-101 |
| P-04 | POOL_DRIVER 스코프 = 법인(entity) 단위 확정 (OQ-6) | T-122 |

---

## 7. 리스크 대응 계획

### 7.1 리스크별 대응 방안

| ID | 리스크 | 수준 | 발생 시점 | 대응 전략 | 구체적 행동 | 담당자 |
|----|--------|:----:|---------|---------|-----------|--------|
| R-001 | AMA SSO 연동 프로토콜 미확정 | **Critical** | Phase 0 | **회피 + 완화** | ① Phase 0에서 AMA팀과 조기 미팅 (Week 0) ② Mock JWT 발급 서비스 구축(T-004)하여 개발 선행 ③ SSO 확정 시점에서 인증 모듈만 교체 | PM + dev-A |
| R-002 | AMA Asset API VEHICLE 필터 미지원 | **High** | Phase 1 차량 등록 | **완화** | ① AMA팀에 API 확장 요청 ② 미지원 시 전체 자산 조회(`GET /api/v1/assets`) 후 `type=VEHICLE` 프론트 필터링으로 대체 ③ 응답 캐싱(5분 TTL)으로 성능 보완 | dev-A |
| R-003 | AmoebaTalk 알림 연동 지연 | Medium | Phase 1 알림 | **완화** | ① Phase 1에서는 인앱 알림(DB 폴링)만 구현 ② AmoebaTalk 연동은 API 확정 후 Phase 2 초에 통합 ③ 이메일 알림은 보조 채널로 Phase 2에서 구현 | dev-A |
| R-004 | 배차 워크플로우 복잡도 (9개 상태 전이) | Medium | Phase 1 Week 2 | **완화** | ① 상태 전이 엔진(T-131)을 별도 모듈로 분리하여 단위 테스트 가능하게 설계 ② 상태 전이 테이블을 데이터 드리븐으로 구현 (하드코딩 방지) ③ 각 전이별 Guard 메서드 + 단위 테스트 필수 | dev-A |
| R-005 | 한국 법인 운행기록부 법적 양식 미확정 | Low | Phase 2 Excel 출력 | **수용** | ① Phase 1에서는 일반 집계 Excel 출력 ② Phase 2 시작 전 국세청 양식 사전 확인(PM) ③ 양식 미확정 시 커스텀 양식으로 출시 후 업데이트 | PM |
| R-006 | GPS 연동 기술 선택 지연 | Low | Phase 3 | **수용** | Phase 1~2에 영향 없음. Phase 3 TASK-PLAN 작성 시 기술 검토 착수 | PM |

### 7.2 BLOCKER 에스컬레이션 기준

| 조건 | 에스컬레이션 행동 |
|------|----------------|
| Week 0 종료까지 OQ-0(SSO) 미확정 | PM → AMA 팀 리드에 에스컬레이션, Mock JWT로 Phase 1 강행 |
| Week 1 종료까지 OQ-0a(Asset API) 미확정 | 프론트 필터링 대안 확정, AMA 측 피드백 없으면 수동 입력 폴백 구현 |
| 배차 상태 엔진(T-131) 2일 이상 지연 | 상태 전이 범위를 축소 (CANCELLED 관련 전이 Phase 2로 이관) |
| Phase 1 통합 테스트에서 Critical 버그 3건 이상 | 배포 1주 연기, 버그 수정 우선 |

### 7.3 품질 게이트

| 게이트 | 시점 | 기준 | 미달 시 행동 |
|--------|------|------|------------|
| GQ-1 | M-1 (차량 CRUD) | 차량 등록/수정/조회 정상 동작, 멀티테넌시 격리 검증 | 기사 관리 착수 보류 |
| GQ-2 | M-2 (배차 API) | 9개 상태 전이 전체 단위 테스트 통과, BR-001~003 검증 | Frontend 작업 보류 |
| GQ-3 | M-3 (Phase 1 MVP) | E2E 핵심 시나리오 5개 통과, 스테이징 배포 정상 | Phase 2 착수 보류 |
| GQ-4 | M-5 (Phase 2) | Phase 2 전체 기능 동작, 스테이징 배포 정상 | 프로덕션 배포 보류 |

---

*문서 끝 — AMA-VEH-TASK-PLAN-1.0.0*

---
document_id: AMA-VEH-ANALYSIS-1.1.0
version: 1.1.0
status: Draft
created: 2026-03-28
updated: 2026-03-28
author: Kim Igyong
based_on: AMA-VEH-REQ-1.1.0
app: app-car-manager
phase: 1-3
---

# AMA 법인차량관리 (car-manager) — 요구사항분석서

---

## 목차

1. [문서 개요](#1-문서-개요)
2. [시스템 개요 및 범위](#2-시스템-개요-및-범위)
3. [이해관계자 분석](#3-이해관계자-분석)
4. [기능 요구사항 분석](#4-기능-요구사항-분석)
5. [비기능 요구사항 분석](#5-비기능-요구사항-분석)
6. [데이터 모델 분석](#6-데이터-모델-분석)
7. [외부 인터페이스 분석](#7-외부-인터페이스-분석)
8. [핵심 비즈니스 규칙](#8-핵심-비즈니스-규칙)
9. [리스크 및 제약사항](#9-리스크-및-제약사항)
10. [구현 우선순위 매트릭스](#10-구현-우선순위-매트릭스)
11. [Open Questions 분석](#11-open-questions-분석)
12. [추적 매트릭스](#12-추적-매트릭스)

---

## 1. 문서 개요

### 1.1 문서 정보

| 항목 | 내용 |
|------|------|
| **문서명** | AMA 법인차량관리 요구사항분석서 |
| **문서 ID** | AMA-VEH-ANALYSIS-1.1.0 |
| **버전** | v1.1.0 |
| **작성일** | 2026-03-28 |
| **작성자** | Kim Igyong (PM) |
| **참조 문서** | AMA-VEH-REQ-1.1.0 (요구사항정의서) |
| **상태** | Draft |

### 1.2 문서 목적

본 문서는 `AMA-VEH-REQ-1.1.0` 요구사항정의서를 기반으로 기능 분해, 우선순위 분석, 인터페이스 의존성 정리, 비즈니스 규칙 도출, 리스크 식별을 수행하여 **설계 및 구현 단계의 입력물**로 활용한다.

### 1.3 용어 정의

| 용어 | 정의 |
|------|------|
| AMA | Amoeba Management Application — 본사 통합 관리 플랫폼 |
| car-manager | AMA Custom App으로 개발되는 법인차량관리 앱 |
| 기사 풀 (Driver Pool) | 차량에 배정된 운행 가능 기사 그룹 (PRIMARY / SUB / POOL) |
| 배차 (Dispatch) | 차량과 기사를 요청자에게 배정하는 행위 |
| BFF | Backend For Frontend — 앱 전용 NestJS 백엔드 |
| SSO | AMA Single Sign-On — JWT 기반 통합 인증 |
| ODO | 주행 거리계 (Odometer) 수치 |

---

## 2. 시스템 개요 및 범위

### 2.1 시스템 위치

car-manager는 ambAppStore 플랫폼 위에서 동작하는 **독립 Custom App**이다.

```
┌─────────────────────────────────────────────────────┐
│  AMA (ama.amoeba.site)                              │
│   ├── SSO 인증 (JWT 발급)                            │
│   ├── Assets API (차량 자산 조회)                     │
│   └── Members API (구성원 조회)                       │
└──────────────┬──────────────────────────────────────┘
               │  JWT 검증 / API 호출
┌──────────────▼──────────────────────────────────────┐
│  ambAppStore 플랫폼 (apps.amoeba.site)              │
│   └── car-manager (/car-manager)                    │
│        ├── Frontend: React + Vite                   │
│        ├── BFF: NestJS                              │
│        └── DB: MySQL (db_app_car)           │
└─────────────────────────────────────────────────────┘
```

### 2.2 시스템 범위 (In/Out Scope)

#### In Scope (개발 범위)

| 영역 | 설명 |
|------|------|
| 차량 관리 | 등록, 수정, 삭제, 상태 관리, 지정 운용 설정 |
| 기사 관리 | 기사 풀 등록/변경, 역할(PRIMARY/SUB/POOL), 상태 관리 |
| 배차 관리 | 신청 → 확정 → 기사 수락 → 출발 → 도착 → 완료 전체 워크플로우 |
| 운행일지 | 자동 생성, 기사 수기 입력, 조회/집계/Excel 출력 |
| 유지관리 | 정비 이력, 정기 검사, 보험 갱신 관리 |
| 관제 모니터링 | 차량 현황 요약, 운행 중 차량 목록, 타임라인 뷰 |
| 한국 법인 특수 | 법인차량 비용인증, 운행기록부 법정 양식 출력 |

#### Out of Scope (개발 범위 외)

| 영역 | 사유 |
|------|------|
| AMA 자산/멤버 데이터 직접 관리 | AMA 소유 데이터 — 읽기만 허용 |
| GPS 실시간 트래킹 (Phase 3) | Phase 1~2 범위 외 별도 스프린트 |
| AI 이상감지/정비예측 (Phase 3) | Phase 1~2 범위 외 별도 스프린트 |
| 모바일 네이티브 앱 | PWA 우선, Capacitor 래핑은 OQ-1 결정 후 |
| 결제/과금 시스템 | 내부 도구로 과금 없음 |

### 2.3 플랫폼 공통 요구사항 준수

본 앱은 `APPSTORE-REQ-1.0.0` 플랫폼 공통 요구사항(FR-PLT-001 ~ FR-PLT-012)을 모두 준수한다.

| 플랫폼 요구사항 | car-manager 적용 |
|---------------|-----------------|
| FR-PLT-001 독립 Vite 빌드 | `base: '/car-manager'` |
| FR-PLT-002 독립 Docker 컨테이너 | BFF 독립 컨테이너 |
| FR-PLT-003 독립 MySQL DB | `db_app_car` |
| FR-PLT-004 `/api/v1` base path | 모든 엔드포인트 적용 |
| FR-PLT-005 표준 응답 형식 | `{ success, data, error?, timestamp }` |
| FR-PLT-006 Clean Architecture | domain / application / infrastructure / presentation |
| FR-PLT-007 AMA JWT 인증 | SSO 토큰 검증 미들웨어 |
| FR-PLT-011 Soft Delete | `{prefix}_deleted_at` |
| FR-PLT-012 UUID PK | 전 테이블 `{prefix}_id UUID PK` |

---

## 3. 이해관계자 분석

### 3.1 사용자 역할 정의

| 역할 | 코드 | 권한 범위 | 주요 유스케이스 |
|------|------|---------|-------------|
| **관리자 (Admin Manager)** | `VEHICLE_ADMIN` | 차량 CRUD, 기사 풀 관리, 지정 운용, 전체 이력 조회, 리포트 | 차량 등록, 기사 배정, 운영 리포트 |
| **유지관리 담당자 (Maintenance Mgr)** | `VEHICLE_ADMIN` | 차량 정비/검사/보험 관리, 정비 비용 집계 | 정비 이력 등록, 검사 일정 관리 |
| **배차 담당자 (Dispatcher)** | `DISPATCHER` | 배차 승인/반려, 기사 지정, 배차 현황판, 전체 운행일지 조회 | 배차 확정, 기사 선택, 현황 모니터링 |
| **기사 (Driver)** | `DRIVER` | 운행 수락/거절, 출발/도착 확인, 운행일지 작성 | 운행 지시 응답, 운행일지 제출 |
| **일반 사용자 (General User)** | `USER` | 배차 신청, 본인 신청 이력 조회 | 배차 신청서 작성 |

### 3.2 핵심 제약사항

> **기사 본인 배차 신청 불가** — 기사가 자신을 위해 차량을 배차 신청하는 것은 시스템 레벨에서 차단. 별도 사용자가 배차를 신청하고, 배차 담당자가 기사를 배정하는 분리 구조.

### 3.3 역할별 화면 접근 매트릭스

| 화면 | VEHICLE_ADMIN | DISPATCHER | DRIVER | USER |
|------|:---:|:---:|:---:|:---:|
| 메인 대시보드 | ✅ | ✅ | ✅ (제한) | ✅ (제한) |
| 차량 목록/상세 | ✅ 전체 | ✅ 조회 | ✅ 담당만 | ❌ |
| 차량 등록/수정 | ✅ | ❌ | ❌ | ❌ |
| 기사 관리 | ✅ | ❌ | ❌ | ❌ |
| 배차 현황판 | ✅ | ✅ | ❌ | ❌ |
| 배차 신청 | ✅ | ✅ | ❌ | ✅ |
| 배차 확정/반려 | ❌ | ✅ | ❌ | ❌ |
| 운행 수락/거절 | ❌ | ❌ | ✅ | ❌ |
| 운행일지 목록 | ✅ 전체 | ✅ 전체 | ✅ 본인만 | ❌ |
| 운행일지 작성 | ❌ | ❌ | ✅ | ❌ |
| 유지관리 | ✅ | ❌ | ❌ | ❌ |
| 관제 모니터링 | ✅ | ✅ | ❌ | ❌ |

---

## 4. 기능 요구사항 분석

### 4.1 기능 도메인 분류

총 **6개 도메인**, **54개 기능 요구사항**으로 구성된다.

| 도메인 | ID Prefix | P0 | P1 | P2 | 합계 |
|--------|-----------|:--:|:--:|:--:|:----:|
| 차량 관리 | FR-VEH | 6 | 3 | 1 | **10** |
| 기사 관리 | FR-DRV | 4 | 2 | 0 | **6** |
| 배차 관리 | FR-DSP | 15 | 2 | 1 | **18** |
| 운행일지 | FR-LOG | 3 | 4 | 1 | **8** |
| 유지관리 | FR-MNT | 4 | 1 | 1 | **6** |
| 관제 모니터링 | FR-MON | 3 | 2 | 1 | **6** |
| **합계** | | **35** | **14** | **5** | **54** |

### 4.2 도메인별 기능 상세 분석

#### 4.2.1 차량 관리 (FR-VEH)

**핵심 엔티티:** `car_vehicles`

**분류 체계:**
- 승용차 (`PASSENGER`) — 좌석 수 기반
- 승합차 (`VAN`) — 좌석 수 + 적재공간 (골프백/박스 환산)
- 화물차 (`TRUCK`) — 적재톤수 + 차체형태 (카고/탑차/냉동탑/윙바디)

**데이터 그룹:**

| 그룹 | 항목 | 소스 |
|------|------|------|
| 기본 정보 | 차량번호, 제조사, 모델, 연식, 색상, VIN | 직접 입력 |
| 기술 사양 | 배기량, 연료, 변속기, 구동, 최대탑승/적재 | 직접 입력 |
| 취득 정보 | 구입일, 구입가, 취득방법, 리스/할부 상세 | AMA Asset API 참조 |
| 운용 정보 | 상태, 지정운용 설정 | 직접 관리 |
| 검사/보험 | 보험 만료일, 정기검사 예정일 | 직접 입력 |
| 한국 법인 전용 | 전용보험, 운행기록부 의무, 비용인증 | 조건부 표시 |

**기능 목록:**

| ID | 기능 | 우선순위 | 의존성 | 분석 노트 |
|----|------|:-------:|--------|---------|
| FR-VEH-001 | 차량 등록 (AMA 자산 연결) | P0 | AMA Asset API | 자산 선택 → 확장 정보 입력 2단계 UI |
| FR-VEH-002 | 차량 목록 (필터/카드뷰) | P0 | — | 차종/상태/담당자 필터, 카드에 번호판·상태 표시 |
| FR-VEH-003 | 차량 상세 (6탭 구조) | P0 | FR-DRV, FR-DSP, FR-LOG, FR-MNT | 탭: 기본정보/기사관리/배차이력/운행일지/유지관리/문서 |
| FR-VEH-004 | 차량 수정 | P0 | 권한 검증 | 관리 책임자 또는 배차 담당자만 |
| FR-VEH-005 | 차량 상태 변경 | P0 | — | AVAILABLE↔MAINTENANCE 수동, 사유 필수 |
| FR-VEH-006 | 지정 운용 설정 | P0 | — | 부서/프로젝트/기간 지정 → 타 신청 차단 |
| FR-VEH-007 | 검사/보험 만료 알림 | P1 | AmoebaTalk API | D-30/D-7, AmoebaTalk + 이메일 |
| FR-VEH-008 | 차량 사진 등록 | P1 | Google Drive API | 다중 업로드, 외관 사진 |
| FR-VEH-009 | 차량 문서 보관 | P1 | Google Drive API | 등록증/보험증서/검사증 PDF |
| FR-VEH-010 | AI 차량 상태 요약 | P2 | AI 엔진 | 운행/정비 이력 기반 컨디션 리포트 |

#### 4.2.2 기사 관리 (FR-DRV)

**핵심 엔티티:** `car_vehicle_drivers`, `car_vehicle_managers`

**기사 풀 구조:**
- `PRIMARY_DRIVER` — 주 기사 (배차 우선, 상단 표시)
- `SUB_DRIVER` — 보조 기사 (주 기사 부재 시)
- `POOL_DRIVER` — 공용 기사 (차량 미고정, `cvh_id = NULL`)

**기사 상태 전이:**

```
ACTIVE ──(휴가 등록)──→ ON_LEAVE ──(복귀)──→ ACTIVE
  │                                            │
  └──(퇴사/장기부재)──→ INACTIVE ←──(장기부재)──┘
```

| 상태 | 자동 배차 포함 | 수동 선택 |
|------|:---:|:---:|
| ACTIVE | ✅ | ✅ |
| ON_LEAVE | ❌ | ✅ (사유 필수) |
| INACTIVE | ❌ | ❌ |

**기능 목록:**

| ID | 기능 | 우선순위 | 의존성 | 분석 노트 |
|----|------|:-------:|--------|---------|
| FR-DRV-001 | 기사 등록 (AMA 멤버 선택 + 역할 지정) | P0 | AMA Members API | 멤버 검색 UI 필요 |
| FR-DRV-002 | 기사 목록 (차량별 풀 조회) | P0 | — | 역할/상태 필터 기능 |
| FR-DRV-003 | 기사 상태 변경 | P0 | — | ON_LEAVE 시 기간 입력 필수 |
| FR-DRV-004 | POOL_DRIVER 관리 | P0 | — | 차량 미고정, 법인 전체 공용 |
| FR-DRV-005 | 운전면허 관리 | P1 | 알림 시스템 | 면허번호, 만료일, D-30 알림 |
| FR-DRV-006 | 기사 운행 이력 집계 | P1 | FR-LOG | 운행 횟수/거리/기간별 집계 |

#### 4.2.3 배차 관리 (FR-DSP) — 핵심 워크플로우

**배차 상태 전이도:**

```
                                ┌──────────┐
                                │ CANCELLED│
                                └──────────┘
                                    ↑ (신청자 취소 / 담당자 승인)
                                    │
┌─────────┐    신청    ┌─────────┐    확정    ┌──────────┐
│         │──────────→│ PENDING │──────────→│ APPROVED │
│  (신규) │           └─────────┘           └──────────┘
│         │               │                      │
└─────────┘          반려  │                 기사  │
                          ▼                 응답  │
                     ┌──────────┐                 │
                     │ REJECTED │            ┌────┴─────┐
                     └──────────┘            │          │
                                      수락   ▼    거절   ▼
                                 ┌──────────────┐ ┌──────────────┐
                                 │DRIVER_ACCEPTED│ │DRIVER_REJECTED│
                                 └──────────────┘ └──────────────┘
                                       │               │
                                  출발  │               │ 재배정
                                       ▼               ▼
                                 ┌──────────┐    (APPROVED 복귀)
                                 │ DEPARTED │
                                 └──────────┘
                                       │
                                  도착  │
                                       ▼
                                 ┌──────────┐
                                 │ ARRIVED  │
                                 └──────────┘
                                       │
                                  완료  │ (운행일지 작성)
                                       ▼
                                 ┌──────────┐
                                 │COMPLETED │
                                 └──────────┘
```

**배차 신청서 데이터 분석:**

| 구분 | 항목 | 필수 | 입력 주체 |
|------|------|:---:|---------|
| 필수 | 신청자 (자동) | ✅ | 시스템 |
| 필수 | 사용 목적 + 분류 | ✅ | 신청자 |
| 필수 | 출발/복귀 예정 일시 | ✅ | 신청자 |
| 필수 | 출발지, 목적지 | ✅ | 신청자 |
| 필수 | 탑승인원 + 명단 | ✅ | 신청자 |
| 선택 | 희망 차종/차량 | | 신청자 |
| 선택 | 적재물 정보 | | 신청자 (승합/화물일 때) |
| 선택 | 추가 요청 사항 | | 신청자 |
| 대리 | 대리 신청 플래그 + 실사용자 | 조건부 | 신청자 |
| 대리 | 외부 고객 정보 (JSONB) | 조건부 | 신청자 |

**기능 목록:**

| ID | 기능 | 우선순위 | 의존성 | 분석 노트 |
|----|------|:-------:|--------|---------|
| FR-DSP-001 | 배차 신청서 작성 | P0 | — | 입력 중 가용 차량 실시간 표시 |
| FR-DSP-002 | 차량 가용성 확인 | P0 | — | 일시+인원 기준 자동 필터링 |
| FR-DSP-003 | 지정 운용 차량 차단 | P0 | FR-VEH-006 | 지정 기간 내 타 사용자 신청 불가 |
| FR-DSP-004 | 기사 본인 배차 차단 | P0 | — | **시스템 레벨 비즈니스 규칙** |
| FR-DSP-005 | 배차 담당자 알림 | P0 | AmoebaTalk API | 접수 즉시 알림 |
| FR-DSP-006 | 배차 확정 (기사 지정) | P0 | FR-DRV | 차량 + 기사 + 메모 |
| FR-DSP-007 | 배차 반려 | P0 | — | 사유 필수, 신청자 알림 |
| FR-DSP-008 | 운행 지시 수신 (기사) | P0 | 알림 시스템 | 앱 알림 + 수락/거절 |
| FR-DSP-009 | 기사 수락 | P0 | — | 수락 시각 기록, 담당자 알림 |
| FR-DSP-010 | 기사 거절 | P0 | — | 사유 입력, 즉시 알림 → 재배정 |
| FR-DSP-011 | 출발 확인 | P0 | — | 기사 "출발" 버튼, 시각 자동 기록 |
| FR-DSP-012 | 도착 확인 | P0 | — | 기사 "도착" 버튼, 시각 자동 기록 |
| FR-DSP-013 | 운행 완료 | P0 | FR-LOG-002 | 운행일지 완료 후 차량 AVAILABLE 복귀 |
| FR-DSP-014 | 신청 취소 | P1 | — | 확정 전 자유, 확정 후 담당자 승인 필요 |
| FR-DSP-015 | 신청 이력 조회 | P0 | — | 본인 전체 이력 + 상태 |
| FR-DSP-016 | 배차 현황판 | P0 | — | 대기/진행중/완료 보드 뷰 |
| FR-DSP-017 | 비상 배차 | P1 | — | OVERRIDE 플래그 + 사유 + 관리자 알림 |
| FR-DSP-018 | 정기 운행 설정 | P2 | — | 반복 일정 생성 |

**기사 가용성 판단 로직:**

```
1. 해당 차량 기사 풀 조회 + POOL_DRIVER 전체
2. 필터 적용:
   ├── ✅ 가용: ACTIVE + 해당 일시 미배정
   ├── ⚠️ 선택 가능 (확인 필요): ON_LEAVE / 타 차량 PRIMARY
   └── ❌ 불가: INACTIVE / 해당 일시 이미 배정
3. 표시 순서: PRIMARY → SUB → POOL → ON_LEAVE (경고 뱃지)
4. ON_LEAVE 기사 선택 시 사유 입력 필수
```

#### 4.2.4 운행일지 (FR-LOG)

**데이터 구조:**

| 구분 | 항목 | 입력 방식 |
|------|------|---------|
| 자동 기록 | 차량번호, 기사, 배차 FK, 출발/도착 시각, 출발지/목적지 | 시스템 자동 |
| 기사 입력 | 출발/도착 ODO, 유류량, 주유여부/량/금액, 통행료, 메모, 사고 여부 | 수기 입력 |
| 자동 계산 | 운행거리 (ODO 차이), 운행시간 (시각 차이) | Generated |
| 한국 전용 | 운행 목적 코드, 업무 관련성 비율 (%) | 조건부 |
| Phase 2 | GPS 경로, 지도 스냅샷 | 자동 |

**기능 목록:**

| ID | 기능 | 우선순위 | 의존성 | 분석 노트 |
|----|------|:-------:|--------|---------|
| FR-LOG-001 | 운행일지 자동 생성 | P0 | FR-DSP-006 | 배차 확정 시 초안, 출발/도착 시 타임스탬프 |
| FR-LOG-002 | 운행일지 작성 완료 | P0 | FR-DSP-012 | 기사 ODO/주유/특이사항 입력 후 제출 |
| FR-LOG-003 | 운행일지 목록/집계 | P0 | — | 차량별/기사별/기간별 필터, 월간 집계 |
| FR-LOG-004 | 운행일지 수정 | P1 | — | 제출 후 24h 내 수정, 이후 담당자 승인 |
| FR-LOG-005 | 지도 스냅샷 | P1 | 지도 API (OQ-2) | 출발/목적지 좌표→경로 시각화 |
| FR-LOG-006 | Excel 출력 | P1 | — | 법인차량 운행기록부 양식 (OQ-4) |
| FR-LOG-007 | 월간 운행 리포트 | P1 | — | 차량별 거리/유류비/통행료/업무율 |
| FR-LOG-008 | AI 이상 감지 | P2 | AI 엔진 | ODO 감소, 이례적 장거리 탐지 |

#### 4.2.5 유지관리 (FR-MNT)

**기능 목록:**

| ID | 기능 | 우선순위 | 의존성 | 분석 노트 |
|----|------|:-------:|--------|---------|
| FR-MNT-001 | 정비 이력 등록 | P0 | — | 유형/정비소/비용/날짜/다음 예정 |
| FR-MNT-002 | 정비 예약 (운행 차단) | P0 | FR-DSP-002 | 예약 기간 동안 해당 차량 가용성 자동 차단 |
| FR-MNT-003 | 정기 검사 관리 | P0 | 알림 시스템 | D-30/D-7 알림 |
| FR-MNT-004 | 보험 갱신 관리 | P0 | 알림 시스템 | D-30/D-7 알림 |
| FR-MNT-005 | 유지비 집계 | P1 | FR-LOG | 연간 정비+보험+유류+통행료 통계 |
| FR-MNT-006 | AI 정비 시기 예측 | P2 | AI 엔진 | 누적 거리+이력 기반 자동 추천 |

#### 4.2.6 관제 모니터링 (FR-MON)

**기능 목록:**

| ID | 기능 | 우선순위 | 의존성 | 분석 노트 |
|----|------|:-------:|--------|---------|
| FR-MON-001 | 차량 현황 요약 (4개 카드) | P0 | — | 보유/운행중/대기/정비중 숫자 카드 |
| FR-MON-002 | 운행 중 차량 목록 | P0 | — | 번호판/기사/탑승자/출발지→목적지/시각 |
| FR-MON-003 | 운행 중 차량 상세 | P0 | — | 탑승자 명단, 적재화물, 연락처 |
| FR-MON-004 | 당일 배차 타임라인 (Gantt) | P1 | — | 시간대별 차량 운행 Gantt 뷰 |
| FR-MON-005 | GPS 실시간 위치 | P2 | GPS 연동 (Phase 3) | 지도에 현재 위치 표시 |
| FR-MON-006 | 차량 이력 달력 | P1 | — | 월간 달력에 운행/정비 색상 표시 |

---

## 5. 비기능 요구사항 분석

### 5.1 성능 요구사항

| 항목 | 기준 | 측정 방식 |
|------|------|---------|
| 페이지 로드 | ≤ 2초 | Lighthouse Performance score |
| API 응답 | ≤ 500ms | P95 응답시간 (관제 조회 포함) |
| 가용 차량 조회 | ≤ 300ms | 실시간 필터링 목표 |

### 5.2 보안 요구사항

| 항목 | 기준 |
|------|------|
| 인증 | AMA SSO JWT (access 15분 / refresh 7일) |
| 데이터 격리 | `cvh_ama_entity_id` 기반 법인별 완전 격리 |
| 개인정보 | AMA 원본 참조만, car-manager DB에 복제 금지 |
| HTTPS | Nginx SSL (Let's Encrypt) 강제 |
| SQL Injection | TypeORM 파라미터 바인딩 |
| XSS | React 자동 이스케이프 + CSP |

### 5.3 데이터 보호 원칙

```
[AMA 소유 — 읽기만]              [car-manager 소유 — 직접 관리]
─────────────────────            ─────────────────────────────
amb_assets (구입일, 구입가)       car_vehicles (스펙/운용)
amb_users (이름, 이메일)          car_vehicle_managers (관리 책임)
                                 car_vehicle_drivers (기사 풀)
→ AMA ID 참조만 저장              car_dispatch_requests (배차)
→ 원본 데이터 복제 금지           car_trip_logs (운행일지)
                                 car_maintenance_records (정비)
```

### 5.4 멀티테넌시

- `cvh_ama_entity_id` 기반으로 법인(entity) 단위 데이터 격리
- 모든 조회 쿼리에 entity_id WHERE 조건 필수
- 한국 법인 특수 필드는 entity_id 기반 조건부 표시

---

## 6. 데이터 모델 분석

### 6.1 ERD 요약

```
car_vehicles (cvh_)
    ├──< car_vehicle_managers (cvm_)     // 관리 책임 (N:M)
    ├──< car_vehicle_drivers (cvd_)      // 기사 풀 (N:M)
    │       └── POOL_DRIVER: cvh_id = NULL
    ├──< car_dispatch_requests (cdr_)    // 배차 신청
    │       └── cvd_id FK               // 확정 시 기사 지정
    │       └──< car_trip_logs (ctl_)    // 운행일지
    └──< car_maintenance_records (cmr_)  // 정비 이력
```

### 6.2 테이블별 분석

| 테이블 | Prefix | 주요 역할 | 컬럼 수 | 외부 참조 |
|--------|--------|---------|:-------:|---------|
| car_vehicles | `cvh_` | 차량 기본/운용 정보 | ~30 | AMA asset_id, entity_id |
| car_vehicle_managers | `cvm_` | 차량 관리 책임자 | 7 | AMA user_id |
| car_vehicle_drivers | `cvd_` | 기사 풀 (역할/상태) | 11 | AMA user_id |
| car_dispatch_requests | `cdr_` | 배차 신청/처리 | ~25 | AMA user_id, entity_id |
| car_trip_logs | `ctl_` | 운행일지 | ~20 | 배차/차량/기사 FK |
| car_maintenance_records | `cmr_` | 정비 이력 | 12 | AMA user_id |

### 6.3 ENUM 값 목록

| 테이블 | 컬럼 | 값 |
|--------|------|-----|
| car_vehicles | cvh_type | `PASSENGER`, `VAN`, `TRUCK` |
| car_vehicles | cvh_fuel_type | `GASOLINE`, `DIESEL`, `LPG`, `ELECTRIC`, `HYBRID` |
| car_vehicles | cvh_transmission | `MANUAL`, `AUTOMATIC` |
| car_vehicles | cvh_cargo_type | `CARGO`, `TOP`, `FROZEN_TOP`, `WING` |
| car_vehicles | cvh_purchase_type | `OWNED`, `LEASE`, `INSTALLMENT` |
| car_vehicles | cvh_status | `AVAILABLE`, `IN_USE`, `MAINTENANCE`, `DISPOSED` |
| car_vehicle_managers | cvm_role | `ADMIN_MANAGER`, `MAINTENANCE_MGR` |
| car_vehicle_drivers | cvd_role | `PRIMARY_DRIVER`, `SUB_DRIVER`, `POOL_DRIVER` |
| car_vehicle_drivers | cvd_status | `ACTIVE`, `ON_LEAVE`, `INACTIVE` |
| car_dispatch_requests | cdr_purpose_type | `BUSINESS`, `CLIENT`, `TRANSFER`, `OTHER` |
| car_dispatch_requests | cdr_status | `PENDING`, `APPROVED`, `REJECTED`, `DRIVER_ACCEPTED`, `DRIVER_REJECTED`, `DEPARTED`, `ARRIVED`, `COMPLETED`, `CANCELLED` |
| car_trip_logs | ctl_status | `IN_PROGRESS`, `COMPLETED`, `VERIFIED` |
| car_trip_logs | ctl_kr_purpose_code | `BUSINESS`, `COMMUTE`, `OTHER` |
| car_maintenance_records | cmr_type | `REGULAR`, `TIRE`, `OIL`, `BRAKE`, `INSURANCE`, `INSPECTION`, `OTHER` |

### 6.4 인덱스 설계 포인트

| 테이블 | 인덱스 | 용도 |
|--------|--------|------|
| car_vehicles | `(cvh_ama_entity_id, cvh_status)` | 법인별 상태 필터 (메인 조회) |
| car_vehicles | `(cvh_plate_number)` UNIQUE | 차량번호 중복 방지 |
| car_vehicle_drivers | `(cvh_id, cvd_status)` | 차량별 가용 기사 조회 |
| car_vehicle_drivers | `(cvd_ama_user_id, cvd_status)` | 기사별 배정 조회 |
| car_dispatch_requests | `(cdr_ama_entity_id, cdr_status)` | 법인별 배차 현황 |
| car_dispatch_requests | `(cvh_id, cdr_depart_at, cdr_return_at)` | 차량 가용성 중복 확인 |
| car_trip_logs | `(cvh_id, ctl_depart_actual)` | 차량별 운행 이력 조회 |

---

## 7. 외부 인터페이스 분석

### 7.1 AMA API 의존성 매트릭스

| API | Endpoint | 사용 시점 | 호출 빈도 | 실패 시 영향 | 대체 방안 |
|-----|----------|---------|---------|-----------|---------|
| SSO 토큰 검증 | `GET /api/v1/auth/verify` | 모든 API 요청 | 매 요청 | **앱 전체 사용 불가** | 캐시 토큰 + Grace Period |
| 자산 목록 (VEHICLE) | `GET /api/v1/assets?type=VEHICLE` | 차량 등록 | 낮음 | 차량 등록 불가 | 수동 입력 폴백 |
| 자산 상세 | `GET /api/v1/assets/:id` | 차량 상세 (취득정보) | 중간 | 취득 정보 미표시 | Graceful degradation |
| 멤버 목록 | `GET /api/v1/members` | 기사/담당자 선택 | 중간 | 기사 등록/배차 불가 | 캐시 + 재시도 |
| 멤버 상세 | `GET /api/v1/members/:id` | 기사 프로필 표시 | 중간 | 프로필 미표시 | ID만 표시 (이름 미노출) |

### 7.2 AMA API 선행 조건 (Phase 0 — BLOCKER)

| # | 필요 사항 | 상태 | OQ 참조 | 영향 |
|---|---------|------|---------|------|
| 1 | SSO 연동 프로토콜 확정 | **미확정** | OQ-0 | Phase 1 전체 차단 |
| 2 | Asset API `type=VEHICLE` 필터 지원 | **미확정** | OQ-0a | 차량 등록 차단 |
| 3 | Members API 공개 범위 확정 | **미확정** | — | 기사/담당자 선택 UI |

### 7.3 알림 채널

| 채널 | 사용 시점 | 우선순위 |
|------|---------|:-------:|
| AmoebaTalk | 배차 접수/확정/거절, 운행 지시, 만료 알림 | P0 |
| 이메일 | 배차 접수/확정, 만료 알림 (보조) | P1 |
| 인앱 알림 | 기사 운행 지시 수신/확인 | P0 |

### 7.4 외부 서비스 의존성 (Phase 2+)

| 서비스 | 용도 | Phase | OQ 참조 | 영향도 |
|--------|------|:-----:|---------|:------:|
| Google Drive API | 차량 사진/문서 업로드 | 2 | — | 낮음 (대체 가능) |
| 지도 API | 경로 시각화, 스냅샷 | 2 | OQ-2 | 중간 |
| GPS 연동 | 실시간 위치 트래킹 | 3 | OQ-1 | 낮음 (Phase 3) |

---

## 8. 핵심 비즈니스 규칙

### 8.1 비즈니스 규칙 목록

| ID | 규칙 | 도메인 | 시행 수준 | 관련 FR |
|----|------|--------|---------|---------|
| BR-001 | **기사 본인 배차 신청 불가** — DRIVER 역할 사용자는 배차 신청 API/UI 접근 차단 | 배차 | 시스템 (API Guard) | FR-DSP-004 |
| BR-002 | **지정 운용 기간 내 타 신청 차단** — `cvh_is_dedicated=true` + 기간 내 다른 사용자 배차 불가 | 배차/차량 | 시스템 (Service 로직) | FR-VEH-006, FR-DSP-003 |
| BR-003 | **배차 일시 중복 차단** — 동일 차량의 겹치는 시간대 배차 불가 (`cdr_depart_at` ~ `cdr_return_at` 오버랩 검사) | 배차 | 시스템 (DB 쿼리) | FR-DSP-002 |
| BR-004 | **INACTIVE 기사 선택 불가** — INACTIVE 상태 기사는 배차 기사 목록에서 제외 | 기사 | 시스템 (Service 필터) | FR-DRV-003 |
| BR-005 | **ON_LEAVE 기사 수동 선택 시 사유 필수** — 휴가 중 기사 선택 시 사유 입력 텍스트 required | 기사/배차 | UI (필수값) + API (검증) | FR-DSP-006 |
| BR-006 | **비상 배차 (OVERRIDE) 시 사유 + 관리자 알림** — 기사 풀 외 기사 지정 시 `cdr_driver_override=true` + 사유 + VEHICLE_ADMIN 알림 | 배차 | UI + API + 알림 | FR-DSP-017 |
| BR-007 | **정비 예약 기간 차량 자동 차단** — 정비 예약 등록 시 해당 기간 차량 `cvh_status`를 `MAINTENANCE`로 전환, 가용성 조회에서 제외 | 유지관리 | 시스템 (Service 로직) | FR-MNT-002 |
| BR-008 | **차량 상태 수동 변경 시 사유 필수** — AVAILABLE↔MAINTENANCE 수동 변경 시 사유 텍스트 required | 차량 | UI + API | FR-VEH-005 |
| BR-009 | **운행 완료 시 차량 자동 AVAILABLE 복귀** — `cdr_status=COMPLETED` 전환 시 `cvh_status=AVAILABLE` 자동 설정 | 배차 | 시스템 (Service 트랜잭션) | FR-DSP-013 |
| BR-010 | **운행일지 수정 24시간 제한** — 제출 후 24h 내 자유 수정, 이후 DISPATCHER 승인 필요 | 운행일지 | 시스템 (시간 검증) | FR-LOG-004 |
| BR-011 | **법인별 데이터 격리** — 모든 데이터 조회/생성에 `ent_id` 조건 필수, Guard 레벨 적용 | 전체 | 시스템 (Guard + Service) | — |
| BR-012 | **AMA 데이터 복제 금지** — `user_id`, `asset_id` 참조만 저장, 이름/이메일 등 원본 데이터 테이블 복제 금지 | 전체 | 설계 원칙 | — |
| BR-013 | **배차 확정 후 취소 시 담당자 승인 필요** — `PENDING` 상태에서는 자유 취소, `APPROVED` 이후 취소 시 DISPATCHER 승인 필수 | 배차 | UI + API | FR-DSP-014 |
| BR-014 | **기사 거절 시 배차 담당자 즉시 알림 + 재배정** — `DRIVER_REJECTED` 전환 시 DISPATCHER에게 즉시 알림, 다른 기사 재배정 플로우 진입 | 배차 | 시스템 (알림 + 상태 전이) | FR-DSP-010 |
| BR-015 | **차량번호(번호판) 법인 내 유니크** — 동일 `ent_id` 내 `cvh_plate_number` 중복 불가 | 차량 | DB (UNIQUE 제약) | FR-VEH-001 |
| BR-016 | **탑승인원 차량 최대 초과 불가** — 배차 신청 탑승인원 ≤ 차량 `cvh_max_passengers` | 배차 | API (검증) | FR-DSP-002 |
| BR-017 | **적재물 중량 허용 톤수 초과 불가** — 화물차 적재 중량 ≤ `cvh_max_load_ton` | 배차 | API (검증) | FR-DSP-002 |

### 8.2 유효성 검사 규칙

| 대상 | 규칙 | 검증 위치 |
|------|------|---------|
| 배차 신청 일시 | `cdr_depart_at` > 현재 시각 | API |
| 배차 신청 일시 | `cdr_return_at` > `cdr_depart_at` | API + UI |
| 탑승인원 | `cdr_passenger_count` ≥ 1, ≤ `cvh_max_passengers` | API (BR-016) |
| 적재물 (화물) | 적재 중량 ≤ `cvh_max_load_ton` | API (BR-017) |
| 차량번호 | `cvh_plate_number` UNIQUE per `ent_id` | DB (BR-015) |
| ODO (운행일지) | `ctl_odo_end` > `ctl_odo_start` | API + UI |
| 기사 휴가 기간 | `cvd_leave_end` ≥ `cvd_leave_start` | API + UI |
| 정비 예약 기간 | 종료일 ≥ 시작일 | API + UI |
| 지정 운용 기간 | `cvh_dedicated_end` ≥ `cvh_dedicated_start` | API + UI |
| 필수 입력 | 배차 목적, 출발지, 목적지 — 빈 문자열 불가 | API + UI |

---

## 9. 리스크 및 제약사항

### 9.1 기술 리스크 레지스터

| ID | 리스크 | 영향도 | 발생 가능성 | 리스크 수준 | 완화 방안 | OQ 참조 |
|----|--------|:------:|:---------:|:---------:|---------|---------|
| R-001 | AMA SSO 연동 프로토콜 미확정 | **높음** | 높음 | **Critical** | Phase 0에서 AMA팀과 조기 확정, Mock JWT로 개발 선행 | OQ-0 |
| R-002 | AMA Asset API VEHICLE 필터 미지원 | **높음** | 중간 | **High** | AMA팀 API 추가 요청, 미지원 시 전체 자산 조회 후 클라이언트 필터링 | OQ-0a |
| R-003 | AmoebaTalk 알림 연동 지연 | 중간 | 중간 | Medium | 이메일 알림 우선 구현, AmoebaTalk 후순위 | — |
| R-004 | 배차 워크플로우 복잡도 (9개 상태 전이) | 중간 | 높음 | Medium | 상태 전이 룰 엔진 설계, 단위 테스트 필수 | — |
| R-005 | 한국 법인 운행기록부 법적 양식 미확정 | 낮음 | 높음 | Low | Phase 2 전까지 국세청 양식 확인 | OQ-4 |
| R-006 | GPS 연동 기술 선택 지연 | 낮음 | 낮음 | Low | Phase 1~2에 영향 없음 | — |

### 9.2 일정 리스크

| Phase | 예상 공수 | 선행 조건 | 핵심 리스크 |
|:-----:|---------|---------|-----------|
| 0 | AMA 팀 협의 | — | **BLOCKER**: AMA API 미확정 시 Phase 1 시작 불가 |
| 1 | 7~9인일 | Phase 0 완료 | 배차 워크플로우 9개 상태 전이 복잡도 (R-004) |
| 2 | 4~5인일 | Phase 1 완료 | Excel 법정 양식(OQ-4), 지도 API 선택(OQ-2) |
| 3 | 별도 스프린트 | Phase 2 완료 | GPS+AI — 기술 난이도, 외부 서비스 의존 |

### 9.3 제약사항

| 제약 | 설명 | 영향 |
|------|------|------|
| AMA 데이터 읽기 전용 | 자산/멤버 정보 API 조회만, 쓰기 불가 | 차량 등록 시 AMA 자산 선택 → 자체 DB 확장 정보 저장 패턴 |
| 독립 DB | MySQL `db_app_car` — AMA PostgreSQL 직접 접근 불가 | 조인 불가, API 호출 필수 |
| 인증 의존 | AMA JWT 토큰에 전적으로 의존 | AMA 인증 서버 장애 시 앱 전체 사용 불가 |
| 법인 격리 필수 | 한국/베트남 법인 간 데이터 완전 격리 | 모든 테이블 `ent_id` 필수, 쿼리 조건 누락 방지 |
| 앱 슬러그 고정 | `/app-car-manager` | Vite base, Nginx routing, BFF 포트(3101) |

---

## 10. 구현 우선순위 매트릭스

### 10.1 Phase 1 — MVP (7~9인일)

**목표:** 차량 등록부터 배차 완료까지 전체 워크플로우 동작

| 순서 | 작업 | 관련 FR | 예상 공수 | 비고 |
|:----:|------|---------|:--------:|------|
| 1 | DB 스키마 생성 (6 테이블) + TypeORM Entity | — | 0.5d | SKILL §5 DB 규칙 준수 |
| 2 | AMA 인증 미들웨어 (`@Auth()`) | — | 1d | OQ-0 확정 후. Mock 선행 가능 |
| 3 | 차량 CRUD + AMA Asset 연동 | FR-VEH-001~006 | 2d | 등록 2단계 UI |
| 4 | 기사 풀 관리 + AMA Members 연동 | FR-DRV-001~004 | 1.5d | PRIMARY/SUB/POOL 역할 |
| 5 | 배차 전체 워크플로우 (핵심) | FR-DSP-001~016 | 3d | 9개 상태 전이, 가용성 판단 로직 |
| 6 | 운행일지 기본 | FR-LOG-001~003 | 1d | 자동 생성 + 수기 입력 |
| 7 | 관제 현황판 | FR-MON-001~003 | 0.5d | 요약 카드 + 운행 중 목록 |
| 8 | 알림 기본 (인앱) | FR-DSP-005,008 | 0.5d | AmoebaTalk 연동은 별도 |

### 10.2 Phase 2 — 확장 (4~5인일)

| 순서 | 작업 | 관련 FR | 예상 공수 |
|:----:|------|---------|:--------:|
| 1 | 정비 이력/검사/보험 관리 | FR-MNT-001~004 | 1.5d |
| 2 | 만료 알림 (D-30/D-7) | FR-VEH-007, FR-MNT-003~004, FR-DRV-005 | 0.5d |
| 3 | 운행기록부 Excel 출력 | FR-LOG-006~007 | 1d |
| 4 | 지도 스냅샷 | FR-LOG-005 | 0.5d |
| 5 | 타임라인 Gantt / 달력 뷰 | FR-MON-004, FR-MON-006 | 1d |
| 6 | 운행일지 수정/검증 (24h 규칙) | FR-LOG-004 | 0.5d |
| 7 | 차량 사진/문서 (Google Drive) | FR-VEH-008~009 | 0.5d |
| 8 | 유지비 집계 대시보드 | FR-MNT-005 | 0.5d |

### 10.3 Phase 3 — 고급 (별도 스프린트)

| 작업 | 관련 FR | 비고 |
|------|---------|------|
| GPS 실시간 연동 | FR-MON-005 | 기사 앱 GPS 수집 |
| AI 이상 감지 | FR-LOG-008 | ODO 역행, 이례적 장거리 |
| AI 정비 시기 예측 | FR-MNT-006 | 누적 거리+이력 기반 |
| AI 차량 상태 요약 | FR-VEH-010 | 컨디션 리포트 |
| 정기 운행 설정 | FR-DSP-018 | 정기 노선 반복 일정 |
| 모바일 PWA/앱 최적화 | — | OQ-1 결정 반영 |

---

## 11. Open Questions 분석

### 11.1 BLOCKER (Phase 1 시작 전 필수)

| # | 질문 | 영향 범위 | 권장 결정 | 대안 | 결정 기한 |
|---|------|---------|---------|------|---------|
| **OQ-0** | AMA Custom App 인증 방식 확정 — SSO 리다이렉트 vs API Key vs iframe 토큰 | 전체 API | SSO 리다이렉트 + JWT Bearer | Mock JWT로 개발 선행 | Phase 0 |
| **OQ-0a** | AMA Asset API에 `type=VEHICLE` 필터 지원 여부 | 차량 등록 (FR-VEH-001) | AMA 측 필터 추가 | 전체 조회 후 프론트 필터링 | Phase 0 |

### 11.2 P0 (Phase 1 설계 영향)

| # | 질문 | 영향 범위 | 권장 결정 | 근거 |
|---|------|---------|---------|------|
| **OQ-6** | POOL_DRIVER 스코프 — 법인 단위 vs 시스템 전체 | 기사 관리, 배차 | **법인(entity) 단위** 관리 | 멀티테넌시 원칙(BR-011) 일관성 |

### 11.3 P1 (Phase 1~2 설계 영향)

| # | 질문 | 영향 범위 | 권장 결정 | 근거 |
|---|------|---------|---------|------|
| **OQ-1** | 기사 운행앱 방식 — PWA vs Capacitor 하이브리드 | 기사 UI (출발/도착/일지) | **PWA 우선** → Capacitor 래핑 | 즉시 적용 가능, 앱스토어 배포 불필요 |
| **OQ-2** | 지도 API 선택 — Google Maps vs Kakao Map | 지도 스냅샷 (FR-LOG-005), GPS (FR-MON-005) | **Google Maps** | 글로벌 대응 (한국+베트남 모두) |
| **OQ-3** | 정기 운행 Phase 1 포함 여부 | FR-DSP-018 | **Phase 3 유지** (현재 P2) | MVP 복잡도 관리, 9개 상태 전이만으로 충분히 복잡 |
| **OQ-4** | 한국 법인차량 운행기록부 법적 양식 확정 | FR-LOG-006 Excel 출력 | Phase 2 전 **국세청 양식 사전 확인** | 법적 요구 준수 필수 |
| **OQ-7** | 면허 만료 정책 — 알림만 vs 배차 차단 | FR-DRV-005, 배차 확정 | **Phase 1: 알림만** → Phase 2: 만료 기사 배차 시 경고 표시 | 점진적 적용 |

### 11.4 P2 (장기)

| # | 질문 | 영향 범위 | 비고 |
|---|------|---------|------|
| **OQ-5** | 베트남 법인 법인차량 관련 규정 적용 여부 | 법인별 기능 분기 | 한국 전용 필드 외 베트남 전용 필드 필요 여부 확인 |

---

## 12. 추적 매트릭스

### 12.1 REQ 섹션 → FR 도메인 매핑

| REQ (AMA-VEH-REQ-1.1.0) 섹션 | FR 도메인 | FR ID 범위 | FR 수 |
|------------------------------|---------|----------|:-----:|
| §4.1 차량 등록 및 기본 정보 관리 | 차량 관리 | FR-VEH-001 ~ 010 | 10 |
| §4.2 기사 관리 | 기사 관리 | FR-DRV-001 ~ 006 | 6 |
| §4.3 배차 신청 및 처리 워크플로우 | 배차 관리 | FR-DSP-001 ~ 018 | 18 |
| §4.4 운행일지 | 운행일지 | FR-LOG-001 ~ 008 | 8 |
| §4.5 유지관리 | 유지관리 | FR-MNT-001 ~ 006 | 6 |
| §4.6 운행 관제 모니터링 | 관제 모니터링 | FR-MON-001 ~ 006 | 6 |
| | | **합계** | **54** |

### 12.2 FR → API 엔드포인트 매핑

**차량 관리**:

| FR ID | Method | Endpoint | 비고 |
|-------|--------|----------|------|
| FR-VEH-001 | POST | `/api/v1/vehicles` | AMA Asset API 연동 |
| FR-VEH-002 | GET | `/api/v1/vehicles` | 쿼리: type, status, managerId |
| FR-VEH-003 | GET | `/api/v1/vehicles/:id` | 탭별 데이터 sub-endpoint |
| FR-VEH-004 | PATCH | `/api/v1/vehicles/:id` | 권한 검증 |
| FR-VEH-005 | PATCH | `/api/v1/vehicles/:id/status` | body: { status, reason } |
| FR-VEH-006 | PATCH | `/api/v1/vehicles/:id/dedicated` | body: { isDedicated, start, end, deptId } |
| FR-VEH-008~009 | POST | `/api/v1/vehicles/:id/files` | Google Drive 연동 (Phase 2) |

**기사 관리**:

| FR ID | Method | Endpoint | 비고 |
|-------|--------|----------|------|
| FR-DRV-001 | POST | `/api/v1/vehicles/:id/drivers` | AMA Members API 연동 |
| FR-DRV-002 | GET | `/api/v1/vehicles/:id/drivers` | 쿼리: role, status |
| FR-DRV-003 | PATCH | `/api/v1/vehicles/:id/drivers/:dvId` | body: { status, leaveStart, leaveEnd } |
| FR-DRV-004 | GET | `/api/v1/drivers/pool` | POOL_DRIVER 전체 |
| FR-DRV-004 | POST | `/api/v1/drivers/pool` | POOL_DRIVER 등록 |

**배차 관리**:

| FR ID | Method | Endpoint | 비고 |
|-------|--------|----------|------|
| FR-DSP-001 | POST | `/api/v1/dispatch-requests` | 신청 생성 |
| FR-DSP-002 | GET | `/api/v1/vehicles/availability` | 쿼리: departAt, returnAt, type, passengerCount |
| FR-DSP-002 | GET | `/api/v1/dispatch/available-drivers` | 쿼리: vehicleId, departAt, returnAt |
| FR-DSP-006 | PATCH | `/api/v1/dispatch-requests/:id/approve` | body: { vehicleId, driverId, note } |
| FR-DSP-007 | PATCH | `/api/v1/dispatch-requests/:id/reject` | body: { reason } |
| FR-DSP-009 | PATCH | `/api/v1/dispatch-requests/:id/driver-accept` | |
| FR-DSP-010 | PATCH | `/api/v1/dispatch-requests/:id/driver-reject` | body: { reason } |
| FR-DSP-011 | PATCH | `/api/v1/dispatch-requests/:id/depart` | |
| FR-DSP-012 | PATCH | `/api/v1/dispatch-requests/:id/arrive` | |
| FR-DSP-014 | PATCH | `/api/v1/dispatch-requests/:id/cancel` | |
| FR-DSP-015 | GET | `/api/v1/dispatch-requests/my` | 본인 이력 |
| FR-DSP-016 | GET | `/api/v1/dispatch-requests` | 쿼리: status (보드 뷰) |

**운행일지**:

| FR ID | Method | Endpoint | 비고 |
|-------|--------|----------|------|
| FR-LOG-001~002 | PATCH | `/api/v1/trip-logs/:id` | 운행일지 작성/수정 |
| FR-LOG-003 | GET | `/api/v1/trip-logs` | 쿼리: vehicleId, driverId, from, to |
| FR-LOG-006 | GET | `/api/v1/trip-logs/export` | Excel 다운로드 (Phase 2) |

**유지관리**:

| FR ID | Method | Endpoint | 비고 |
|-------|--------|----------|------|
| FR-MNT-001 | POST | `/api/v1/vehicles/:id/maintenance` | 정비 등록 |
| FR-MNT-001 | GET | `/api/v1/vehicles/:id/maintenance` | 정비 이력 조회 |
| FR-MNT-001 | PATCH | `/api/v1/vehicles/:id/maintenance/:mid` | 정비 수정 |
| FR-MNT-001 | DELETE | `/api/v1/vehicles/:id/maintenance/:mid` | 정비 삭제 (soft) |

**관제 모니터링**:

| FR ID | Method | Endpoint | 비고 |
|-------|--------|----------|------|
| FR-MON-001 | GET | `/api/v1/monitor/status` | 4개 숫자 카드 |
| FR-MON-002~003 | GET | `/api/v1/monitor/active` | 운행 중 상세 목록 |
| FR-MON-004 | GET | `/api/v1/monitor/timeline` | 당일 Gantt (Phase 2) |

### 12.3 FR → UI 화면 매핑

| 화면 경로 | 관련 FR | Phase |
|----------|---------|:-----:|
| `/` (메인 대시보드) | FR-MON-001~003 | 1 |
| `/vehicles` | FR-VEH-002 | 1 |
| `/vehicles/new` | FR-VEH-001 | 1 |
| `/vehicles/:id` (기본정보 탭) | FR-VEH-003~006 | 1 |
| `/vehicles/:id` (기사관리 탭) | FR-DRV-001~004 | 1 |
| `/vehicles/:id` (배차이력 탭) | FR-DSP-015 | 1 |
| `/vehicles/:id` (운행일지 탭) | FR-LOG-003 | 1 |
| `/vehicles/:id` (유지관리 탭) | FR-MNT-001~004 | 2 |
| `/vehicles/:id` (문서 탭) | FR-VEH-008~009 | 2 |
| `/dispatch-requests` (현황판) | FR-DSP-016 | 1 |
| `/dispatch-requests/new` | FR-DSP-001~004 | 1 |
| `/dispatch-requests/my` | FR-DSP-015 | 1 |
| `/dispatch-requests/:id` (상세/확정) | FR-DSP-006~013 | 1 |
| `/trip-logs` | FR-LOG-003, FR-LOG-006~007 | 1, 2 |
| `/trip-logs/:id` | FR-LOG-001~002, FR-LOG-004 | 1, 2 |
| `/monitor` | FR-MON-001~006 | 1, 2, 3 |

### 12.4 BR → FR 역추적

| BR ID | 관련 FR |
|-------|---------|
| BR-001 | FR-DSP-004 |
| BR-002 | FR-VEH-006, FR-DSP-003 |
| BR-003 | FR-DSP-002 |
| BR-004 | FR-DRV-003 |
| BR-005 | FR-DSP-006 |
| BR-006 | FR-DSP-017 |
| BR-007 | FR-MNT-002 |
| BR-008 | FR-VEH-005 |
| BR-009 | FR-DSP-013 |
| BR-010 | FR-LOG-004 |
| BR-011 | 전체 (서비스 레벨) |
| BR-012 | 전체 (설계 원칙) |
| BR-013 | FR-DSP-014 |
| BR-014 | FR-DSP-010 |
| BR-015 | FR-VEH-001 |
| BR-016 | FR-DSP-002 |
| BR-017 | FR-DSP-002 |

---

*문서 끝 — AMA-VEH-ANALYSIS-1.1.0*

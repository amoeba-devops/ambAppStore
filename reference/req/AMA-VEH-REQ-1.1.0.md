# AMA 법인차량관리 모듈 — 요구사항 정의서
# (AMA Corporate Vehicle Management — Requirements Definition)

---

| 항목 | 내용 |
|------|------|
| **문서 ID** | AMA-VEH-REQ-1.1.0 |
| **버전** | 1.1.0 |
| **작성일** | 2026-03-20 |
| **상태** | Draft |
| **작성자** | Kim Igyong |
| **변경 이력** | v1.0.0 초안 → v1.1.0 아키텍처 변경 (Standalone Custom App), 기사-차량 관계 모델 수정, 도메인 변경 반영 |

---

## 목차

1. [개요 및 범위](#1-개요-및-범위)
2. [아키텍처 설계](#2-아키텍처-설계)
3. [기사-차량 관계 모델](#3-기사-차량-관계-모델)
4. [기능 요구사항](#4-기능-요구사항)
5. [데이터 모델](#5-데이터-모델)
6. [API 설계](#6-api-설계)
7. [UI 구성](#7-ui-구성)
8. [비기능 요구사항](#8-비기능-요구사항)
9. [구현 단계 (Phase 계획)](#9-구현-단계-phase-계획)
10. [개방 결정 사항 (Open Questions)](#10-개방-결정-사항-open-questions)

---

## 1. 개요 및 범위

### 1.1 배경

법인 소유 차량은 일반 자산과 달리 **운행이라는 동적 활동**이 지속적으로 발생하며, 배차 승인·운행일지·유지보수·정기검사·한국 법인차량 비용인증 등 별도의 관리 체계가 필요하다.

본 시스템은 AMA 플랫폼의 자산관리 모듈과 API로 연동하되, **독립 Custom App**으로 개발·배포되는 스탠드얼론 서비스다.

### 1.2 핵심 이해관계자 역할

| 역할 | 설명 | 권한 범위 |
|------|------|---------|
| **차량 관리 책임자** (Admin Manager) | 행정적 차량 관리, 자산 등록/폐기, 보험/검사 관리 | FULL |
| **유지관리 담당자** (Maintenance Mgr) | 정비 일정, 차량 컨디션 관리 | 유지관리 FULL |
| **배차 담당자** (Dispatcher) | 배차 신청 심사, 기사 지정, 배차 확정/반려 | 배차 FULL |
| **기사** (Driver) | 운행 지시 수락/거절, 출발/도착 확인, 운행일지 작성 | 담당 차량 WRITE |
| **일반 사용자** | 배차 신청, 본인 신청 이력 조회 | 신청/조회 |

> **제약:** 기사 본인은 자기 차량 배차 신청 불가 (시스템 레벨 차단)

---

## 2. 아키텍처 설계

### 2.1 시스템 포지셔닝

```
AMA Platform (ama.amoeba.site)              Custom App (apps.amoeba.site/car-manager)
─────────────────────────────               ──────────────────────────────────────────
자산관리 모듈                                차량 고유 데이터 (자체 DB 보유)
  amb_assets (자산 원본 소유)    API 참조 →   car_vehicles
  amb_hr_entities (법인)        ─────────→   car_vehicle_drivers
  amb_users (사용자/기사)                     car_dispatch_requests
  amb_hr_departments (부서)                  car_trip_logs
                                             car_maintenance_records
```

### 2.2 앱 개요

| 항목 | 내용 |
|------|------|
| **앱 유형** | AMA Custom App — Amoeba Partner 개발 앱 |
| **서비스 URL** | `https://apps.amoeba.site/car-manager` |
| **API URL** | `https://apps.amoeba.site/car-manager/api` |
| **인증** | AMA SSO (JWT 토큰 공유) |
| **데이터 소유** | 차량 운영 데이터 → 자체 DB / 자산·멤버 기본 정보 → AMA API 참조 (읽기 전용) |
| **배포** | 독립 배포 (AMA 릴리즈 주기와 무관) |
| **기술 스택 권장** | React 18 + TypeScript + TailwindCSS (AMA 동일) / NestJS + PostgreSQL |

### 2.3 AMA 연동 범위

```
┌──────────────────────────────────────────────────────────────────────┐
│                     AMA (ama.amoeba.site)                            │
│                                                                      │
│  자산관리 API                         인사/멤버 API                   │
│  GET /api/v1/assets?type=VEHICLE  →  GET /api/v1/members             │
│  GET /api/v1/assets/:id           →  GET /api/v1/members/:id         │
│                    인증 검증 API                                       │
│                    GET /api/v1/auth/verify                            │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ AMA Public API (Bearer Token)
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│              차량관리 앱 (apps.amoeba.site/car-manager)               │
│                                                                      │
│  자체 DB:  car_vehicles / car_vehicle_drivers                        │
│            car_dispatch_requests / car_trip_logs                     │
│            car_maintenance_records / car_vehicle_managers            │
│                                                                      │
│  AMA 참조 ID 보관 (복제 금지):                                        │
│    cvh_ama_asset_id → amb_assets.ast_id                              │
│    cvd_ama_user_id  → amb_users.usr_id                               │
│    cvh_ama_entity_id → amb_hr_entities.ent_id                        │
└──────────────────────────────────────────────────────────────────────┘
```

#### AMA API 호출 항목

| 항목 | Endpoint | 사용 목적 | 호출 시점 |
|------|----------|---------|---------|
| 자산 목록 (차량) | `GET /api/v1/assets?type=VEHICLE` | 차량 등록 시 자산 연결 | 차량 등록 |
| 자산 상세 | `GET /api/v1/assets/:id` | 구입일·취득가·취득형태 표시 | 차량 상세 페이지 |
| 멤버 목록 | `GET /api/v1/members` | 기사/담당자 선택 | 차량 등록, 배차 확정 |
| 멤버 상세 | `GET /api/v1/members/:id` | 기사 프로필·연락처 | 배차/운행일지 상세 |
| SSO 토큰 검증 | `GET /api/v1/auth/verify` | 앱 접근 인증 | 모든 API 요청 |

### 2.4 데이터 소유 원칙

```
[AMA 소유 — 읽기만]             [car-manager 소유 — 직접 관리]
───────────────────────         ──────────────────────────────
amb_assets                      car_vehicles (차량 스펙/운용 정보)
  구입일, 구입가, 감가상각         car_vehicle_managers (관리 책임자)
                                  car_vehicle_drivers (기사 풀)
amb_users                       car_dispatch_requests (배차 신청)
  이름, 이메일, 부서               car_trip_logs (운행일지)
  (참조 ID만 저장, 복제 금지)      car_maintenance_records (정비 이력)
```

---

## 3. 기사-차량 관계 모델

### 3.1 설계 원칙

차량과 기사는 1:1 고정이 아니다. 관리 책임(행정)과 실제 운행(운용)을 분리하고, 기사 휴가·퇴사 등 상황에 따라 다른 기사가 유연하게 배차받을 수 있도록 **기사 풀(Driver Pool)** 구조를 채택한다.

```
차량 (car_vehicles)
│
├── 관리 책임 (1:N → car_vehicle_managers)
│     ├── ADMIN_MANAGER    행정 관리 책임자 (보험/검사/자산 담당)
│     └── MAINTENANCE_MGR  유지관리 담당 (정비 일정/컨디션 관리)
│         ※ 역할별 1명 이상 지정 가능
│
└── 운행 기사 풀 (1:N → car_vehicle_drivers)
      ├── PRIMARY_DRIVER   주 기사 (배차 우선 대상, 상단 표시)
      ├── SUB_DRIVER       보조 기사 (주 기사 부재 시)
      └── POOL_DRIVER      공용 기사 (법인 내 모든 차량 운행 가능, 차량 미고정)
```

### 3.2 기사 상태 관리

| 상태 | 설명 | 자동 배차 포함 | 수동 선택 |
|------|------|:----------:|:-------:|
| `ACTIVE` | 정상 근무 | ✅ | ✅ |
| `ON_LEAVE` | 휴가/일시 부재 | ❌ | ✅ (사유 필수) |
| `INACTIVE` | 퇴사/장기 부재 | ❌ | ❌ |

### 3.3 배차 시 기사 가용성 판단 흐름

```
배차 확정 화면 진입
    │
    ▼
[시스템] 해당 차량의 기사 풀 조회
  car_vehicle_drivers WHERE (cvh_id = :vehicleId) OR (cvd_role = 'POOL_DRIVER')
    │
    ▼
[시스템] 필터 적용
  ┌─────────────────────────────────────────────────────────┐
  │  ✅ 가용                                                │
  │    - cvd_status = 'ACTIVE'                              │
  │    - 해당 일시 다른 운행 배정 없음 (trip_logs 확인)      │
  │                                                         │
  │  ⚠️ 선택 가능 (담당자 확인 필요)                        │
  │    - cvd_status = 'ON_LEAVE'                            │
  │    - 다른 차량의 PRIMARY_DRIVER                         │
  │                                                         │
  │  ❌ 선택 불가                                           │
  │    - cvd_status = 'INACTIVE'                            │
  │    - 해당 일시 이미 운행 배정됨                          │
  └─────────────────────────────────────────────────────────┘
    │
    ▼
[배차 담당자] 목록에서 기사 선택
  PRIMARY_DRIVER → 최상단 강조
  SUB_DRIVER     → 두 번째 그룹
  POOL_DRIVER    → 세 번째 그룹
  ON_LEAVE       → 최하단, 경고 뱃지 (선택 시 사유 입력 required)
    │
    ▼
[시스템] 배차 확정 저장 + 기사에게 운행 지시 알림
```

### 3.4 기사 수락/거절 처리

```
기사: 운행 지시 수신 (앱 알림)
  ├── [수락] → cdr_status = 'DRIVER_ACCEPTED'
  │            수락 시각 기록 / 배차 담당자에게 알림
  │
  └── [거절] → cdr_status = 'DRIVER_REJECTED'
               거절 사유 입력 (optional)
               배차 담당자 즉시 알림 → 담당자가 다른 기사 재배정
```

---

## 4. 기능 요구사항

### 4.1 차량 등록 및 기본 정보 관리

#### 차량 분류 체계

| 차종 | 코드 | 주요 특성 | 추가 스펙 |
|------|------|---------|---------|
| 승용차 | `PASSENGER` | 최대 탑승인원 중심 | 좌석 수 |
| 승합차 | `VAN` | 탑승인원 + 화물 혼용 | 좌석 수, 적재공간 (골프백 N개 / 박스 N개 환산) |
| 화물차 | `TRUCK` | 순수 화물 | 적재허용 톤수, 차체 형태 (카고/탑차/냉동탑/윙바디) |

#### 차량 상세 스펙 항목

**기본 정보**
- 차량번호(번호판), 제조사/브랜드, 모델명/트림, 연식, 색상, 차대번호(VIN)

**기술 사양**
- 배기량(cc), 연료 유형 (가솔린/디젤/LPG/전기/하이브리드), 변속기 (수동/자동), 구동 방식 (2WD/4WD)
- 최대 탑승인원 (승용/승합), 적재 허용 톤수 및 차체 형태 (화물)

**취득 정보** ← AMA Asset API 참조
- 구입일, 구입가격, 취득 방법 (현금구매/리스/할부)
- 리스/할부 시: 계약기간, 월 납부액, 잔여기간, 계약 만료일, 리스 회사명/계약번호

**운용 정보**
- 차량 상태: `AVAILABLE` / `IN_USE` / `MAINTENANCE` / `DISPOSED`
- 지정 운용 여부 (특정 부서/프로젝트/기간 전용 설정 시 타 신청 차단)

**검사/보험**
- 자동차 보험 만료일/보험사, 정기검사 예정일/최근 완료일

**한국 법인 전용**
- 법인차량 전용보험 가입 여부
- 운행기록부 의무 작성 여부 (업무용 사용 비율 인증)
- 비용인증 적용 여부 (법인세법상 손금 처리)

#### FR-VEH: 차량 CRUD

| ID | 기능 | 우선순위 |
|----|------|:-------:|
| FR-VEH-001 | 차량 등록 — AMA 자산에서 VEHICLE 유형 선택 후 차량 확장 정보 입력 | P0 |
| FR-VEH-002 | 차량 목록 — 차종/상태/담당자 필터, 카드 뷰 (번호판·현재상태 표시) | P0 |
| FR-VEH-003 | 차량 상세 — 탭 구조: 기본정보 / 기사관리 / 배차이력 / 운행일지 / 유지관리 / 문서 | P0 |
| FR-VEH-004 | 차량 수정 — 관리 책임자 또는 배차 담당자만 수정 가능 | P0 |
| FR-VEH-005 | 차량 상태 변경 — AVAILABLE↔MAINTENANCE 수동 변경 (사유 필수) | P0 |
| FR-VEH-006 | 차량 지정 운용 설정 — 특정 부서/프로젝트/기간 전용 지정, 해당 기간 타 신청 차단 | P0 |
| FR-VEH-007 | 검사/보험 만료 알림 — D-30/D-7 담당자 알림 (AmoebaTalk + 이메일) | P1 |
| FR-VEH-008 | 차량 사진 등록 — Google Drive 연동, 외관 사진 다중 업로드 | P1 |
| FR-VEH-009 | 차량 문서 보관 — 자동차등록증, 보험증서, 검사증 PDF 첨부 | P1 |
| FR-VEH-010 | AI 차량 상태 요약 — 최근 운행/정비 이력 기반 AI 컨디션 리포트 | P2 |

---

### 4.2 기사 관리

#### FR-DRV: 기사 풀 관리

| ID | 기능 | 우선순위 |
|----|------|:-------:|
| FR-DRV-001 | 기사 등록 — AMA 멤버에서 선택, 차량 배정 + 역할(PRIMARY/SUB/POOL) 지정 | P0 |
| FR-DRV-002 | 기사 목록 — 차량별 기사 풀 조회, 역할/상태 필터 | P0 |
| FR-DRV-003 | 기사 상태 변경 — ACTIVE / ON_LEAVE (기간 입력) / INACTIVE | P0 |
| FR-DRV-004 | POOL_DRIVER 관리 — 법인 공용 기사 등록/관리 (특정 차량 미고정) | P0 |
| FR-DRV-005 | 운전면허 관리 — 면허 번호, 만료일 등록, D-30 만료 알림 | P1 |
| FR-DRV-006 | 기사 운행 이력 — 기사별 운행 횟수, 총 거리, 기간별 집계 | P1 |

---

### 4.3 배차 신청 및 처리 워크플로우

#### 배차 프로세스 흐름

```
[사용자]     배차 신청서 작성 (기사 본인 신청 불가)
    │
    ▼
[시스템]     가용 차량 자동 필터링 (차종/인원/일시 중복 확인)
    │
    ▼
[배차 담당자] 신청 검토 → 차량 지정 + 기사 선택 → 배차 확정
    │
    ▼
[기사]       운행 지시 수신 → 수락 / 거절
    │                              │
    ▼                              ▼
[기사]       출발 확인         [담당자]  다른 기사 재배정
    │
    ▼
[기사]       도착 확인 → 운행일지 작성 → 완료
    │
    ▼
[시스템]     차량 상태 AVAILABLE 복귀
```

#### 배차 신청서 항목

**필수 항목**
- 신청자 (본인 자동), 사용 목적 (텍스트 + 분류: 업무/고객응대/이동지원/기타)
- 출발 예정 일시 ~ 복귀 예정 일시
- 출발지, 목적지
- 탑승인원 (본인 포함), 탑승자 명단

**선택 항목**
- 희망 차종 (PASSENGER/VAN/TRUCK), 희망 차량 (특정 차량 지정 요청)
- 적재물 정보 (승합/화물: 물품명, 수량, 중량)
- 추가 요청 사항

**대리 신청**
- 신청자 ≠ 실사용자인 경우 "대리 신청" 체크
- 실사용자: 멤버 선택 또는 외부 고객 정보 입력 (고객 제공 차량 표시)

#### FR-DSP: 배차 신청 및 처리

| ID | 기능 | 우선순위 |
|----|------|:-------:|
| FR-DSP-001 | 배차 신청서 작성 — 입력 중 가용 차량 실시간 표시 | P0 |
| FR-DSP-002 | 차량 가용성 확인 — 요청 일시 기준 가용 차량 자동 필터링 (인원 기준 포함) | P0 |
| FR-DSP-003 | 지정 운용 차량 신청 차단 — 지정 기간 내 타 사용자 신청 불가 + 안내 메시지 | P0 |
| FR-DSP-004 | 기사 본인 배차 신청 불가 — 시스템 레벨 차단 | P0 |
| FR-DSP-005 | 배차 담당자 알림 — 신청 접수 즉시 알림 (AmoebaTalk + 이메일) | P0 |
| FR-DSP-006 | 배차 확정 — 차량 지정 + 기사 선택 + 확정 메모 | P0 |
| FR-DSP-007 | 배차 반려 — 사유 입력 필수, 신청자 알림 | P0 |
| FR-DSP-008 | 운행 지시 수신 (기사) — 배차 확정 시 기사 앱 알림, 수락/거절 가능 | P0 |
| FR-DSP-009 | 기사 수락 — 수락 시각 기록, 담당자에게 알림 | P0 |
| FR-DSP-010 | 기사 거절 — 사유 입력, 담당자 즉시 알림 → 재배정 | P0 |
| FR-DSP-011 | 출발 확인 — 기사 "출발" 버튼 클릭, 출발 시각 자동 기록 | P0 |
| FR-DSP-012 | 도착 확인 — 기사 "도착" 버튼 클릭, 도착 시각 자동 기록 | P0 |
| FR-DSP-013 | 운행 완료 — 기사 운행일지 작성 완료 후 차량 AVAILABLE 복귀 | P0 |
| FR-DSP-014 | 신청 취소 — 배차 확정 전 신청자 취소 가능, 확정 후 담당자 승인 필요 | P1 |
| FR-DSP-015 | 배차 신청 이력 — 신청자 본인 전체 이력 + 상태 조회 | P0 |
| FR-DSP-016 | 배차 현황판 — 담당자용: 신청 대기 / 배차 진행중 / 금일 완료 보드 뷰 | P0 |
| FR-DSP-017 | 비상 배차 — 풀 외 기사 지정 시 OVERRIDE 플래그 + 사유 필수 + 관리자 알림 | P1 |
| FR-DSP-018 | 정기 운행 설정 — 특정 차량 정기 노선 고정 배차 (반복 일정 생성) | P2 |

---

### 4.4 운행일지

#### 운행일지 항목

**자동 기록**
- 차량번호, 기사, 배차 신청 연결 FK
- 출발 시각 (출발 버튼 클릭 시점), 도착 시각 (도착 버튼 클릭 시점)
- 운행 시간 자동 계산, 출발지/목적지

**기사 직접 입력**
- 출발/도착 시 주행계 ODO (km), 실제 운행 거리 (자동 계산)
- 사용 유류량, 주유 여부/주유량/금액
- 도로통행료, 탑승자 메모, 특이사항/사고 여부

**GPS 연동 (Phase 2)**
- 실시간 위치 트래킹 경로, GPS 기반 자동 거리 계산
- 출발지/목적지 지도 스냅샷 자동 보관

**한국 법인차량 전용**
- 운행 목적 코드 (업무/출퇴근/기타) — 법인차량 비용인증용
- 업무 관련성 비율 (%)

#### FR-LOG: 운행일지

| ID | 기능 | 우선순위 |
|----|------|:-------:|
| FR-LOG-001 | 운행일지 자동 생성 — 배차 확정 시 초안 생성, 출발/도착 시 타임스탬프 자동 기록 | P0 |
| FR-LOG-002 | 운행일지 작성 완료 — 기사 ODO/주유/특이사항 입력 후 제출 | P0 |
| FR-LOG-003 | 운행일지 목록 — 차량별/기사별/기간별 필터, 월간 집계 (총 거리, 총 횟수) | P0 |
| FR-LOG-004 | 운행일지 수정 — 제출 후 24시간 내 수정 가능, 이후 담당자 승인 필요 | P1 |
| FR-LOG-005 | 지도 스냅샷 — 출발지/목적지 좌표 저장, 지도 API 경로 시각화 | P1 |
| FR-LOG-006 | 운행일지 Excel 출력 — 기간 선택 후 법인차량 운행기록부 양식 다운로드 | P1 |
| FR-LOG-007 | 월간 운행 리포트 — 차량별 총 운행거리/유류비/통행료/업무 사용률 집계 | P1 |
| FR-LOG-008 | AI 이상 감지 — ODO 감소, 이례적 장거리 운행 등 이상값 탐지 및 알림 | P2 |

---

### 4.5 유지관리

#### FR-MNT: 유지관리

| ID | 기능 | 우선순위 |
|----|------|:-------:|
| FR-MNT-001 | 정비 이력 등록 — 정비 유형(정기/타이어/엔진오일/기타), 정비소, 비용, 날짜, 다음 예정 | P0 |
| FR-MNT-002 | 정비 예약 등록 — 예약 일정, 예약 정비소, 차량 운행 불가 기간 자동 차단 | P0 |
| FR-MNT-003 | 정기 검사 관리 — 법정 정기검사 일정 등록, D-30/D-7 알림 | P0 |
| FR-MNT-004 | 보험 갱신 관리 — 보험 만료일 등록, D-30/D-7 알림 | P0 |
| FR-MNT-005 | 유지비 집계 — 차량별 연간 유지비 (정비+보험+유류+통행료) 통계 | P1 |
| FR-MNT-006 | AI 정비 시기 예측 — 누적 운행거리 + 정비이력 기반 다음 정비 시기 자동 추천 | P2 |

---

### 4.6 운행 관제 모니터링

#### FR-MON: 관제 대시보드

| ID | 기능 | 우선순위 |
|----|------|:-------:|
| FR-MON-001 | 차량 현황 요약 — 총 보유 / 현재 운행중 / 대기 가용 / 정비중 운행불가 4개 숫자 카드 | P0 |
| FR-MON-002 | 운행 중 차량 목록 — 번호판, 기사명, 탑승자/인원, 출발지→목적지, 출발시각, 예상 복귀 | P0 |
| FR-MON-003 | 운행 중 차량 상세 — 탑승자 명단, 적재화물 내용, 운행 목적, 연락처 | P0 |
| FR-MON-004 | 당일 배차 타임라인 — 시간대별 차량 운행 현황 Gantt 뷰 | P1 |
| FR-MON-005 | GPS 실시간 위치 — 기사 앱 GPS 연동 시 지도에 현재 위치 표시 | P2 |
| FR-MON-006 | 차량 이력 달력 — 월간 달력에 차량별 운행/정비 이력 색상 표시 | P1 |

---

## 5. 데이터 모델

### 5.1 ERD 개요

```
car_vehicles (cvh_)
    ├──< car_vehicle_managers (cvm_)         관리 책임자 (N:M)
    ├──< car_vehicle_drivers (cvd_)          기사 풀 (N:M)
    │       └── POOL_DRIVER: cvh_id = NULL   (법인 공용)
    ├──< car_dispatch_requests (cdr_)        배차 신청
    │       └── cvd_id FK                   배차 확정 시 기사 지정
    │       └──< car_trip_logs (ctl_)        운행일지
    └──< car_maintenance_records (cmr_)      정비 이력
```

### 5.2 테이블 정의

#### car_vehicles (cvh_)

```sql
cvh_id                UUID        PK
cvh_ama_asset_id      UUID        NOT NULL          -- AMA amb_assets.ast_id 외부 참조
cvh_ama_entity_id     UUID        NOT NULL          -- AMA ent_id (법인 구분)
cvh_plate_number      VARCHAR(20) UNIQUE NOT NULL   -- 차량번호판
cvh_type              ENUM('PASSENGER','VAN','TRUCK')
cvh_maker             VARCHAR(100)
cvh_model             VARCHAR(100)
cvh_year              INT
cvh_color             VARCHAR(50)
cvh_vin               VARCHAR(50)                   -- 차대번호
cvh_displacement      INT                           -- 배기량(cc)
cvh_fuel_type         ENUM('GASOLINE','DIESEL','LPG','ELECTRIC','HYBRID')
cvh_transmission      ENUM('MANUAL','AUTOMATIC')
cvh_max_passengers    INT
cvh_cargo_type        ENUM('CARGO','TOP','FROZEN_TOP','WING') NULLABLE
cvh_max_load_ton      DECIMAL(6,2)                  NULLABLE
cvh_purchase_type     ENUM('OWNED','LEASE','INSTALLMENT')
cvh_lease_company     VARCHAR(200)                  NULLABLE
cvh_lease_contract_no VARCHAR(100)                  NULLABLE
cvh_lease_monthly     DECIMAL(12,2)                 NULLABLE
cvh_lease_end_date    DATE                          NULLABLE
cvh_insurance_expiry  DATE
cvh_insurance_company VARCHAR(200)
cvh_inspection_due    DATE
cvh_status            ENUM('AVAILABLE','IN_USE','MAINTENANCE','DISPOSED')
cvh_is_dedicated      BOOLEAN     DEFAULT FALSE
cvh_dedicated_start   DATE                          NULLABLE
cvh_dedicated_end     DATE                          NULLABLE
cvh_dedicated_dept_id UUID                          NULLABLE  -- AMA dept id 참조
cvh_kr_corp_cert      BOOLEAN     DEFAULT FALSE
cvh_notes             TEXT
cvh_created_at        TIMESTAMPTZ DEFAULT now()
cvh_updated_at        TIMESTAMPTZ DEFAULT now()
cvh_deleted_at        TIMESTAMPTZ
```

#### car_vehicle_managers (cvm_) — 차량 관리 책임자

```sql
cvm_id            UUID PK
cvh_id            UUID        FK → car_vehicles
cvm_ama_user_id   UUID        NOT NULL    -- AMA amb_users.usr_id 외부 참조
cvm_role          ENUM('ADMIN_MANAGER','MAINTENANCE_MGR')
cvm_is_active     BOOLEAN     DEFAULT TRUE
cvm_memo          TEXT
cvm_created_at    TIMESTAMPTZ DEFAULT now()
cvm_updated_at    TIMESTAMPTZ DEFAULT now()

UNIQUE (cvh_id, cvm_ama_user_id, cvm_role)
```

#### car_vehicle_drivers (cvd_) — 기사 풀

```sql
cvd_id            UUID PK
cvh_id            UUID        FK → car_vehicles NULLABLE  -- POOL_DRIVER는 NULL
cvd_ama_user_id   UUID        NOT NULL    -- AMA amb_users.usr_id 외부 참조
cvd_role          ENUM('PRIMARY_DRIVER','SUB_DRIVER','POOL_DRIVER')
cvd_status        ENUM('ACTIVE','ON_LEAVE','INACTIVE')
cvd_leave_start   DATE                   NULLABLE
cvd_leave_end     DATE                   NULLABLE
cvd_license_no    VARCHAR(100)
cvd_license_expiry DATE
cvd_memo          TEXT
cvd_created_at    TIMESTAMPTZ DEFAULT now()
cvd_updated_at    TIMESTAMPTZ DEFAULT now()

-- POOL_DRIVER: cvh_id = NULL 허용
-- PRIMARY/SUB_DRIVER: cvh_id 필수
INDEX (cvh_id, cvd_status)
INDEX (cvd_ama_user_id, cvd_status)
```

#### car_dispatch_requests (cdr_) — 배차 신청

```sql
cdr_id              UUID PK
cvh_id              UUID        FK → car_vehicles     NULLABLE  -- 확정 전 NULL
cvd_id              UUID        FK → car_vehicle_drivers NULLABLE
cdr_ama_entity_id   UUID        NOT NULL
cdr_requester_id    UUID        NOT NULL    -- 신청자 (AMA user id)
cdr_user_id         UUID        NOT NULL    -- 실제 사용자 (대리신청 시 상이)
cdr_is_proxy        BOOLEAN     DEFAULT FALSE
cdr_guest_info      JSONB       NULLABLE
  -- { name, company, phone, notes }        외부 고객 탑승 시
cdr_purpose         TEXT
cdr_purpose_type    ENUM('BUSINESS','CLIENT','TRANSFER','OTHER')
cdr_depart_at       TIMESTAMPTZ
cdr_return_at       TIMESTAMPTZ
cdr_origin          VARCHAR(500)
cdr_destination     VARCHAR(500)
cdr_origin_lat      DECIMAL(10,7)           NULLABLE
cdr_origin_lng      DECIMAL(10,7)           NULLABLE
cdr_dest_lat        DECIMAL(10,7)           NULLABLE
cdr_dest_lng        DECIMAL(10,7)           NULLABLE
cdr_passenger_count INT         DEFAULT 1
cdr_passengers      JSONB       NULLABLE
  -- [{ ama_user_id, name }, ...]            탑승자 목록
cdr_cargo_desc      TEXT        NULLABLE
cdr_pref_type       ENUM('PASSENGER','VAN','TRUCK') NULLABLE
cdr_status          ENUM(
                      'PENDING',          -- 신청 접수
                      'APPROVED',         -- 배차 확정 (기사 미응답)
                      'REJECTED',         -- 배차 반려
                      'DRIVER_ACCEPTED',  -- 기사 수락
                      'DRIVER_REJECTED',  -- 기사 거절
                      'DEPARTED',         -- 출발 확인
                      'ARRIVED',          -- 도착 확인
                      'COMPLETED',        -- 운행 완료
                      'CANCELLED'         -- 취소
                    )
cdr_dispatcher_id   UUID        NULLABLE    -- 배차 담당자 (AMA user id)
cdr_dispatch_note   TEXT
cdr_driver_override BOOLEAN     DEFAULT FALSE  -- 비상 배차 (풀 외 기사)
cdr_override_reason TEXT        NULLABLE
cdr_created_at      TIMESTAMPTZ DEFAULT now()
cdr_updated_at      TIMESTAMPTZ DEFAULT now()
cdr_deleted_at      TIMESTAMPTZ
```

#### car_trip_logs (ctl_) — 운행일지

```sql
ctl_id                   UUID PK
cdr_id                   UUID        FK → car_dispatch_requests
cvh_id                   UUID        FK → car_vehicles
cvd_id                   UUID        FK → car_vehicle_drivers   -- 실제 운행 기사
ctl_depart_actual        TIMESTAMPTZ
ctl_arrive_actual        TIMESTAMPTZ
ctl_duration_min         INT         GENERATED ALWAYS AS
                         (EXTRACT(EPOCH FROM (ctl_arrive_actual - ctl_depart_actual))/60) STORED
ctl_odo_start            INT
ctl_odo_end              INT
ctl_distance_km          DECIMAL(8,2) GENERATED ALWAYS AS (ctl_odo_end - ctl_odo_start) STORED
ctl_fuel_used_l          DECIMAL(6,2) NULLABLE
ctl_refuel               BOOLEAN     DEFAULT FALSE
ctl_refuel_liter         DECIMAL(6,2) NULLABLE
ctl_refuel_amount        DECIMAL(12,2) NULLABLE
ctl_toll_amount          DECIMAL(12,2) NULLABLE
ctl_origin_snapshot_url  TEXT        NULLABLE
ctl_dest_snapshot_url    TEXT        NULLABLE
ctl_gps_path             JSONB       NULLABLE    -- GPS 경로 포인트 배열 (Phase 2)
ctl_kr_purpose_code      ENUM('BUSINESS','COMMUTE','OTHER') NULLABLE
ctl_accident             BOOLEAN     DEFAULT FALSE
ctl_notes                TEXT
ctl_status               ENUM('IN_PROGRESS','COMPLETED','VERIFIED')
ctl_created_at           TIMESTAMPTZ DEFAULT now()
ctl_updated_at           TIMESTAMPTZ DEFAULT now()
```

#### car_maintenance_records (cmr_) — 정비 이력

```sql
cmr_id              UUID PK
cvh_id              UUID        FK → car_vehicles
cmr_type            ENUM('REGULAR','TIRE','OIL','BRAKE','INSURANCE','INSPECTION','OTHER')
cmr_date            DATE
cmr_shop_name       VARCHAR(200)
cmr_cost            DECIMAL(12,2)
cmr_odo_at_service  INT
cmr_next_due_date   DATE        NULLABLE
cmr_next_due_odo    INT         NULLABLE
cmr_notes           TEXT
cmr_created_by      UUID                        -- AMA user id
cmr_created_at      TIMESTAMPTZ DEFAULT now()
cmr_updated_at      TIMESTAMPTZ DEFAULT now()
cmr_deleted_at      TIMESTAMPTZ
```

---

## 6. API 설계

### 6.1 인증 구조

```
앱 접근 시:
  apps.amoeba.site/car-manager
  → AMA (ama.amoeba.site) SSO 로그인 → JWT access token 발급
  → Custom App API 요청 시 Authorization: Bearer {ama_token}
  → AMA /api/v1/auth/verify 로 토큰 검증 후 처리
```

### 6.2 엔드포인트 목록

```
[차량 관리]
GET    /api/vehicles                        차량 목록 (필터: 법인/차종/상태)
POST   /api/vehicles                        차량 등록
GET    /api/vehicles/:id                    차량 상세
PATCH  /api/vehicles/:id                    차량 수정
PATCH  /api/vehicles/:id/status             차량 상태 변경
DELETE /api/vehicles/:id                    차량 삭제 (soft delete)

[기사 관리]
GET    /api/vehicles/:id/drivers            차량 기사 풀 조회
POST   /api/vehicles/:id/drivers            기사 등록 (차량 배정)
PATCH  /api/vehicles/:id/drivers/:dvId      기사 상태 변경
DELETE /api/vehicles/:id/drivers/:dvId      기사 제거

GET    /api/drivers/pool                    POOL_DRIVER 전체 목록
POST   /api/drivers/pool                    POOL_DRIVER 등록

[배차 - 가용성 조회]
GET    /api/vehicles/availability           특정 일시 가용 차량 조회
  Query: departAt, returnAt, type, passengerCount
GET    /api/dispatch/available-drivers      특정 일시/차량 가용 기사 조회
  Query: vehicleId, departAt, returnAt

[배차 신청]
GET    /api/dispatch-requests               전체 신청 목록 (담당자)
POST   /api/dispatch-requests               배차 신청
GET    /api/dispatch-requests/my            내 신청 이력
GET    /api/dispatch-requests/:id           신청 상세
PATCH  /api/dispatch-requests/:id/approve   배차 확정 (기사 지정 포함)
PATCH  /api/dispatch-requests/:id/reject    배차 반려
PATCH  /api/dispatch-requests/:id/cancel    취소

[기사 응답]
PATCH  /api/dispatch-requests/:id/driver-accept    기사 수락
PATCH  /api/dispatch-requests/:id/driver-reject    기사 거절

[운행 처리]
PATCH  /api/dispatch-requests/:id/depart    출발 확인
PATCH  /api/dispatch-requests/:id/arrive    도착 확인

[운행일지]
GET    /api/trip-logs                       운행일지 목록 (필터: 차량/기사/기간)
GET    /api/trip-logs/:id                   운행일지 상세
PATCH  /api/trip-logs/:id                   운행일지 수정
GET    /api/trip-logs/export                운행기록부 Excel 다운로드
  Query: vehicleId, from, to

[유지관리]
GET    /api/vehicles/:id/maintenance        정비 이력 조회
POST   /api/vehicles/:id/maintenance        정비 이력 등록
PATCH  /api/vehicles/:id/maintenance/:mid   정비 이력 수정
DELETE /api/vehicles/:id/maintenance/:mid   정비 이력 삭제

[관제]
GET    /api/monitor/status                  차량 운용 현황 요약
GET    /api/monitor/active                  현재 운행 중 차량 상세 목록
GET    /api/monitor/timeline                당일 배차 타임라인
```

---

## 7. UI 구성

### 7.1 화면 구조

```
apps.amoeba.site/car-manager
├── /                         메인 대시보드 (관제 요약)
├── /vehicles                 차량 목록
├── /vehicles/:id             차량 상세 (탭: 기본정보/기사관리/배차이력/운행일지/유지관리/문서)
├── /dispatch-requests        배차 현황판 (담당자)
├── /dispatch-requests/new    배차 신청
├── /dispatch-requests/my     내 신청 이력
├── /dispatch-requests/:id    배차 신청 상세
├── /trip-logs                운행일지 목록
├── /trip-logs/:id            운행일지 상세/작성
└── /monitor                  운행 관제 모니터링
```

### 7.2 차량 목록 화면

```
┌──────────────────────────────────────────────────────────────────┐
│  법인차량 관리                              [+ 차량 등록]          │
│  [전체] [승용] [승합] [화물]   상태:[전체▼]  [검색_________]      │
├────────────┬────────────┬────────────┬───────────────────────────┤
│ 🚗 12가3456│ 🚐 34나7890│ 🚛 56다1234│                           │
│ 소나타      │ 스타리아    │ 포터2       │    + 차량 추가            │
│ ● 대기중   │ 🔵 운행중   │ 🔧 정비중  │                           │
│ 담당: 홍길동│ 김철수→강남 │ 복귀 16:00  │                           │
└────────────┴────────────┴────────────┴───────────────────────────┘
```

### 7.3 차량 상세 > 기사 관리 탭

```
┌──────────────────────────────────────────────────────────────────┐
│  [기본정보] [기사관리] [배차이력] [운행일지] [유지관리] [문서]    │
├──────────────────────────────────────────────────────────────────┤
│  기사 관리                                         [+ 기사 추가]  │
│                                                                  │
│  ── 주 기사 (PRIMARY) ─────────────────────────────────        │
│  👤 김철수   인사팀   ● ACTIVE    면허 ~2028.06  [수정] [삭제]   │
│                                                                  │
│  ── 보조 기사 (SUB) ───────────────────────────────────        │
│  👤 이영희   총무팀   🌴 ON_LEAVE  ~03/30 복귀예정 [수정] [삭제]  │
│  👤 박민준   IT팀    ● ACTIVE    면허 ~2027.12  [수정] [삭제]   │
│                                                                  │
│  ── 풀 기사 (POOL) — 법인 공용 ────────────────────────        │
│  👤 정대리   총무팀   ● ACTIVE    모든 차량 운행 가능             │
└──────────────────────────────────────────────────────────────────┘
```

### 7.4 배차 신청 화면

```
┌──────────────────────────────────────────────────────────────────┐
│  배차 신청                                                        │
├──────────────────────────────────────────────────────────────────┤
│  사용 목적  [_________________________________]  분류 [업무▼]    │
│  출발 일시  [2026-03-25] [09:00]  ~  복귀 예정 [      ] [18:00]  │
│  출발지     [_________________________________]  📍             │
│  목적지     [_________________________________]  📍             │
│  탑승인원   [1명▼]   탑승자 [+ 추가]                              │
│  희망 차종  [상관없음▼]                                           │
│                                                                  │
│  ── 가용 차량 ───────────────────────────────────             │
│  ✅ 12가3456  소나타   (승용 5인)                                │
│  ✅ 34나7890  스타리아  (승합 11인)                              │
│  ❌ 56다1234  포터2    정비중 (03/27 복귀 예정)                  │
│                                                                  │
│  [취소]                                        [신청하기]        │
└──────────────────────────────────────────────────────────────────┘
```

### 7.5 배차 확정 화면 — 기사 선택 영역

```
┌──────────────────────────────────────────────────────────────────┐
│  배차 확정                                                        │
│  신청: 홍길동  |  차량: 12가3456 소나타  |  03/25 09:00~18:00   │
├──────────────────────────────────────────────────────────────────┤
│  배정 기사 선택                                                   │
│                                                                  │
│  ★ 주 기사                                                       │
│  ◉ 김철수     ● 가용                                            │
│                                                                  │
│  보조 기사                                                        │
│  ○ 이영희     🌴 휴가중  ← 선택 시 사유 입력 required            │
│  ○ 박민준     ● 가용                                            │
│                                                                  │
│  풀 기사 (공용)                                                   │
│  ○ 정대리     ● 가용                                            │
│                                                                  │
│  배차 메모  [______________________________________________]     │
│                                          [반려]   [배차 확정]    │
└──────────────────────────────────────────────────────────────────┘
```

### 7.6 운행 관제 모니터링

```
┌──────────────────────────────────────────────────────────────────┐
│  차량 운행 관제                                    🔄 실시간       │
├───────────┬───────────┬───────────┬──────────────────────────────┤
│  보유 3대  │ 운행중 1대│ 대기 1대  │  정비중 1대                  │
├───────────┴───────────┴───────────┴──────────────────────────────┤
│                                                                  │
│  ── 현재 운행 중 ──────────────────────────────────────        │
│  [12가3456 소나타]   기사: 김철수   09:30 출발                   │
│  탑승: 홍길동 외 2명  |  본사 → 강남구청  |  예상 복귀: 11:30    │
│  [상세보기]                                                      │
│                                                                  │
│  ── 오늘 운행 완료 ──────────────────────────────────         │
│  [34나7890]   08:00~09:15   박지성 (3명 탑승)   김포공항→본사   │
│                                                                  │
│  ── 오늘 배차 예정 ──────────────────────────────────         │
│  [12가3456]   14:00~17:00   이영희 (2명)   본사→코엑스          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8. 비기능 요구사항

### 8.1 권한 체계

```
VEHICLE_ADMIN   차량 등록/수정/삭제, 기사 풀 관리, 지정 운용 설정, 전체 이력 조회
DISPATCHER      배차 승인/반려, 기사 지정, 배차 현황판, 전체 운행일지 조회
DRIVER          담당 차량 운행 수락/완료, 운행일지 작성
USER            배차 신청, 본인 신청 이력 조회
```

### 8.2 한국 법인 특수 요건

- **법인차량 비용인증** (업무용 자동차 관련 비용 손금산입) 요건: 연간 운행기록부 의무 작성
- 운행일지의 업무 목적 구분 필수 (업무 사용 비율 산출)
- 법정 양식 기반 운행기록부 Excel 출력
- `cvh_ama_entity_id` 기반 법인 구분으로 한국 법인에만 해당 필드 조건부 표시

### 8.3 성능 및 보안

| 항목 | 기준 |
|------|------|
| 페이지 로드 | 2초 이내 |
| API 응답 | 500ms 이내 (관제 조회 포함) |
| SSO 토큰 만료 | AMA와 동일 정책 (access 15분 / refresh 7일) 따름 |
| 데이터 격리 | `cvh_ama_entity_id` 기반 법인별 완전 격리 |
| 기사 개인정보 | AMA 원본에서 참조, Car-Manager DB에 복제 금지 |

---

## 9. 구현 단계 (Phase 계획)

| Phase | 주요 작업 | 선행 조건 | 예상 공수 |
|-------|---------|---------|---------|
| **Phase 0** | AMA 측 선행 개발: Asset API VEHICLE 필터, Members API 공개, SSO 연동 프로토콜 확정 | — | AMA 팀 협의 |
| **Phase 1** | 차량 CRUD, 기사 풀 관리 (PRIMARY/SUB/POOL), 배차 신청→확정→기사수락→출발→도착→완료 전체 워크플로우, 운행일지 기본 (수동 입력), 관제 현황판 | Phase 0 완료 | 7~9인일 |
| **Phase 2** | 정비 이력, 검사/보험 알림, 운행기록부 Excel 출력, 지도 스냅샷, 당일 타임라인 Gantt 뷰, 면허 만료 알림 | Phase 1 완료 | 4~5인일 |
| **Phase 3** | GPS 실시간 연동, AI 이상 감지, AI 정비 예측, 모바일 PWA/앱 최적화 | Phase 2 완료 | 별도 스프린트 |

---

## 10. 개방 결정 사항 (Open Questions)

| # | 질문 | 중요도 | 비고 |
|---|------|:------:|------|
| **OQ-0** | AMA Custom App 인증 방식 확정 — SSO 리다이렉트 vs API Key 발급 vs iframe 토큰 전달 | **BLOCKER** | Phase 1 시작 전 필수 결정 |
| **OQ-0a** | AMA Asset API VEHICLE 필터 지원 여부 — 미지원 시 AMA 측 API 추가 개발 필요 | **BLOCKER** | Phase 1 시작 전 필수 결정 |
| **OQ-1** | 기사용 운행앱 방식 — PWA (즉시 적용) vs Capacitor 하이브리드 앱 | P0 | PWA 우선 + Capacitor 래핑 권장 |
| **OQ-2** | 지도 API 선택 — Google Maps (글로벌) vs Kakao Map (한국 정밀도) | P1 | 한국/베트남 법인 모두 고려 |
| **OQ-3** | 정기 운행 기능 Phase 1 포함 여부 | P1 | 현재 Phase 2 배치 |
| **OQ-4** | 한국 법인차량 운행기록부 법적 요구 양식 확정 (국세청 양식 기준) | P1 | Phase 2 Excel 출력 설계 전 |
| **OQ-5** | 베트남 법인 법인차량 관련 규정 적용 여부 | P2 | 법인별 기능 분기 필요 여부 |
| **OQ-6** | POOL_DRIVER 스코프 — 법인 단위 관리 vs 시스템 전체 단위 | P0 | 멀티 테넌시 설계 영향 |
| **OQ-7** | 기사 면허 만료 정책 — 만료 임박 기사 알림만 vs 배차 차단 여부 | P1 | Phase 1 기사 관리 설계 전 |

---

*문서 끝 — AMA-VEH-REQ-1.1.0*

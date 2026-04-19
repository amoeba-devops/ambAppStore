# DB-SCHEMA-car-manager.md

> Source of truth: `backend/scripts/init-db.sql`, `backend/src/domain/**/entity/*.entity.ts`
> Generated: 2026-04-19

## 1. 테이블 개요

| 테이블 | 역할 | PK | 주요 FK |
|---|---|---|---|
| `car_vehicles` | 차량 기본/운용 정보 | `cvh_id` | - |
| `car_vehicle_managers` | 차량 관리 책임자 | `cvm_id` | `cvh_id` |
| `car_vehicle_drivers` | 기사 풀 | `cvd_id` | `cvh_id` |
| `car_dispatch_requests` | 배차 신청/처리 | `cdr_id` | `cvh_id`, `cvd_id` |
| `car_trip_logs` | 운행일지 | `ctl_id` | `cvh_id`, `cvd_id`, `cdr_id` |
| `car_maintenance_records` | 정비/검사/보험 이력 | `cmr_id` | `cvh_id` |

## 2. `car_trip_logs` 컬럼 상세

| 컬럼 | 타입 | Null | 의미 |
|---|---|---|---|
| `ctl_id` | CHAR(36) | N | PK (UUID) |
| `ent_id` | CHAR(36) | N | 기업(테넌트) ID |
| `cvh_id` | CHAR(36) | N | 차량 ID (FK) |
| `cvd_id` | CHAR(36) | N | 기사 ID (FK) |
| `cdr_id` | CHAR(36) | **N** | 배차 ID (FK) ← **엑셀 import 시 제약** |
| `ctl_origin` | VARCHAR(200) | N | 출발지 |
| `ctl_destination` | VARCHAR(200) | N | 도착지 |
| `ctl_depart_actual` | DATETIME | Y | 실제 출발 |
| `ctl_arrive_actual` | DATETIME | Y | 실제 도착 |
| `ctl_odo_start` | INT | Y | 출발 오도미터(km) |
| `ctl_odo_end` | INT | Y | 도착 오도미터(km) |
| `ctl_distance_km` | DECIMAL(8,1) | Y | 구간 주행거리 |
| `ctl_refueled` | BOOLEAN | N | 주유 여부 |
| `ctl_fuel_amount` | DECIMAL(6,2) | Y | 주유량(L) |
| `ctl_fuel_cost` | INT | Y | 주유비 |
| `ctl_toll_cost` | INT | Y | 통행료 |
| `ctl_has_accident` | BOOLEAN | N | 사고 여부 |
| `ctl_note` | TEXT | Y | 비고 |
| `ctl_kr_purpose_code` | ENUM | Y | (한국) 사용 목적: BUSINESS/COMMUTE/OTHER |
| `ctl_kr_business_ratio` | SMALLINT | Y | (한국) 업무사용비율 |
| `ctl_status` | ENUM | N | IN_PROGRESS / COMPLETED / VERIFIED |
| `ctl_submitted_at` | DATETIME | Y | 제출 시각 |
| `ctl_*_at` (감사) | DATETIME | - | 생성/수정/삭제 |

**인덱스**: `(cvh_id, ctl_depart_actual)`, `(ent_id)`

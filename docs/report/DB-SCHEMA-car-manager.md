# Car-Manager 앱 — 데이터베이스 테이블 명세서

**문서 ID**: DB-SCHEMA-car-manager
**작성일**: 2026-04-19
**DB**: `db_app_car` (MySQL 8.0)
**총 테이블**: 6개

---

## ERD 요약

```
car_vehicles (차량 마스터)
  │
  ├── 1:N → car_vehicle_managers (관리 책임자)
  ├── 1:N → car_vehicle_drivers (운전자 풀)
  ├── 1:N → car_dispatch_requests (배차 신청)
  ├── 1:N → car_trip_logs (운행일지)
  └── 1:N → car_maintenance_records (정비 이력)

car_dispatch_requests
  ├── N:1 → car_vehicles (배정 차량)
  ├── N:1 → car_vehicle_drivers (배정 운전자)
  └── 1:1 → car_trip_logs (운행일지)
```

---

## 1. car_vehicles (차량 마스터)

| 컬럼명 | 타입 | NULL | 기본값 | 설명 |
|--------|------|------|--------|------|
| `cvh_id` | CHAR(36) PK | NO | UUID | 차량 ID |
| `ent_id` | CHAR(36) | NO | | 법인 ID (멀티테넌시) |
| `cvh_ama_asset_id` | CHAR(36) | YES | NULL | AMA 자산 연동 ID |
| `cvh_plate_number` | VARCHAR(20) | NO | | 차량번호 |
| `cvh_type` | ENUM('PASSENGER','VAN','TRUCK') | NO | | 차종 |
| `cvh_make` | VARCHAR(50) | NO | | 제조사 |
| `cvh_model` | VARCHAR(50) | NO | | 모델 |
| `cvh_year` | SMALLINT | NO | | 연식 |
| `cvh_color` | VARCHAR(30) | YES | NULL | 색상 |
| `cvh_vin` | VARCHAR(30) | YES | NULL | 차대번호 |
| `cvh_displacement` | INT | YES | NULL | 배기량 (cc) |
| `cvh_fuel_type` | ENUM('GASOLINE','DIESEL','LPG','ELECTRIC','HYBRID') | NO | | 연료 |
| `cvh_transmission` | ENUM('MANUAL','AUTOMATIC') | YES | NULL | 변속기 |
| `cvh_max_passengers` | SMALLINT | NO | 5 | 최대 탑승인원 |
| `cvh_max_load_ton` | DECIMAL(5,2) | YES | NULL | 최대 적재량 (톤) |
| `cvh_cargo_type` | ENUM('CARGO','TOP','FROZEN_TOP','WING') | YES | NULL | 화물 유형 |
| `cvh_purchase_type` | ENUM('OWNED','LEASE','INSTALLMENT') | YES | NULL | 구매유형 |
| `cvh_purchase_date` | DATE | YES | NULL | 구입일 |
| `cvh_purchase_price` | BIGINT | YES | NULL | 구입가 |
| `cvh_status` | ENUM('AVAILABLE','IN_USE','MAINTENANCE','DISPOSED') | NO | AVAILABLE | 상태 |
| `cvh_status_reason` | TEXT | YES | NULL | 상태 변경 사유 |
| `cvh_is_dedicated` | BOOLEAN | NO | false | 전용차량 여부 |
| `cvh_dedicated_dept` | VARCHAR(100) | YES | NULL | 전용 부서명 |
| `cvh_dedicated_start` | DATE | YES | NULL | 전용 시작일 |
| `cvh_dedicated_end` | DATE | YES | NULL | 전용 종료일 |
| `cvh_insurance_expiry` | DATE | YES | NULL | 보험 만료일 |
| `cvh_inspection_date` | DATE | YES | NULL | 검사일 |
| `cvh_note` | TEXT | YES | NULL | 비고 |
| `cvh_created_at` | DATETIME | NO | CURRENT_TIMESTAMP | 생성일시 |
| `cvh_updated_at` | DATETIME | NO | CURRENT_TIMESTAMP ON UPDATE | 수정일시 |
| `cvh_deleted_at` | DATETIME | YES | NULL | 삭제일시 (Soft Delete) |

**인덱스:**
- `idx_car_vehicles_ent_status` (ent_id, cvh_status)
- `uq_car_vehicles_ent_plate` UNIQUE (ent_id, cvh_plate_number)

---

## 2. car_vehicle_managers (차량 관리 책임자)

| 컬럼명 | 타입 | NULL | 기본값 | 설명 |
|--------|------|------|--------|------|
| `cvm_id` | CHAR(36) PK | NO | UUID | 관리자 배정 ID |
| `cvh_id` | CHAR(36) FK | NO | | 차량 ID |
| `cvm_ama_user_id` | CHAR(36) | NO | | AMA 사용자 ID |
| `cvm_role` | ENUM('ADMIN_MANAGER','MAINTENANCE_MGR') | NO | | 관리 역할 |
| `cvm_created_at` | DATETIME | NO | CURRENT_TIMESTAMP | 생성일시 |
| `cvm_updated_at` | DATETIME | NO | CURRENT_TIMESTAMP ON UPDATE | 수정일시 |
| `cvm_deleted_at` | DATETIME | YES | NULL | 삭제일시 |

**인덱스:**
- `idx_car_vehicle_managers_cvh` (cvh_id)

**FK:** `cvh_id` → `car_vehicles(cvh_id)`

---

## 3. car_vehicle_drivers (운전자 풀)

| 컬럼명 | 타입 | NULL | 기본값 | 설명 |
|--------|------|------|--------|------|
| `cvd_id` | CHAR(36) PK | NO | UUID | 운전자 ID |
| `cvh_id` | CHAR(36) FK | YES | NULL | 배정 차량 ID (NULL=미배정) |
| `ent_id` | CHAR(36) | NO | | 법인 ID |
| `cvd_ama_user_id` | CHAR(36) | NO | | AMA 사용자 ID |
| `cvd_driver_name` | VARCHAR(100) | YES | NULL | 운전자 이름 |
| `cvd_driver_email` | VARCHAR(200) | YES | NULL | 운전자 이메일 |
| `cvd_role` | ENUM('PRIMARY_DRIVER','SUB_DRIVER','POOL_DRIVER') | NO | | 역할 |
| `cvd_status` | ENUM('ACTIVE','ON_LEAVE','INACTIVE') | NO | ACTIVE | 상태 |
| `cvd_leave_start` | DATE | YES | NULL | 휴가 시작일 |
| `cvd_leave_end` | DATE | YES | NULL | 휴가 종료일 |
| `cvd_note` | TEXT | YES | NULL | 비고 |
| `cvd_created_at` | DATETIME | NO | CURRENT_TIMESTAMP | 생성일시 |
| `cvd_updated_at` | DATETIME | NO | CURRENT_TIMESTAMP ON UPDATE | 수정일시 |
| `cvd_deleted_at` | DATETIME | YES | NULL | 삭제일시 |

**인덱스:**
- `idx_car_vehicle_drivers_cvh_status` (cvh_id, cvd_status)
- `idx_car_vehicle_drivers_user_status` (cvd_ama_user_id, cvd_status)
- `idx_car_vehicle_drivers_ent` (ent_id)

**FK:** `cvh_id` → `car_vehicles(cvh_id)` (nullable)

---

## 4. car_dispatch_requests (배차 신청)

| 컬럼명 | 타입 | NULL | 기본값 | 설명 |
|--------|------|------|--------|------|
| `cdr_id` | CHAR(36) PK | NO | UUID | 배차 신청 ID |
| `ent_id` | CHAR(36) | NO | | 법인 ID |
| `cvh_id` | CHAR(36) FK | YES | NULL | 배정 차량 ID |
| `cvd_id` | CHAR(36) FK | YES | NULL | 배정 운전자 ID |
| `cdr_requester_id` | CHAR(36) | NO | | 신청자 ID |
| `cdr_requester_name` | VARCHAR(100) | NO | | 신청자 이름 |
| `cdr_purpose_type` | ENUM('BUSINESS','CLIENT','TRANSFER','OTHER') | NO | | 목적 유형 |
| `cdr_purpose` | VARCHAR(500) | NO | | 목적 상세 |
| `cdr_depart_at` | DATETIME | NO | | 출발 예정일시 |
| `cdr_return_at` | DATETIME | NO | | 복귀 예정일시 |
| `cdr_origin` | VARCHAR(200) | NO | | 출발지 |
| `cdr_destination` | VARCHAR(200) | NO | | 목적지 |
| `cdr_passenger_count` | SMALLINT | NO | 1 | 탑승인원 |
| `cdr_passenger_list` | JSON | YES | NULL | 탑승자 목록 |
| `cdr_preferred_vehicle_type` | ENUM('PASSENGER','VAN','TRUCK') | YES | NULL | 희망 차종 |
| `cdr_cargo_info` | TEXT | YES | NULL | 화물 정보 |
| `cdr_is_proxy` | BOOLEAN | NO | false | 대리 신청 여부 |
| `cdr_actual_user_name` | VARCHAR(100) | YES | NULL | 실사용자 이름 |
| `cdr_external_guest` | JSON | YES | NULL | 외부 게스트 정보 |
| `cdr_note` | TEXT | YES | NULL | 비고 |
| `cdr_status` | ENUM('PENDING','APPROVED','REJECTED','DRIVER_ACCEPTED','DRIVER_REJECTED','DEPARTED','ARRIVED','COMPLETED','CANCELLED') | NO | PENDING | 상태 |
| `cdr_reject_reason` | TEXT | YES | NULL | 반려 사유 |
| `cdr_driver_reject_reason` | TEXT | YES | NULL | 운전자 거부 사유 |
| `cdr_cancel_reason` | TEXT | YES | NULL | 취소 사유 |
| `cdr_driver_override` | BOOLEAN | NO | false | 운전자 확인 생략 |
| `cdr_approved_at` | DATETIME | YES | NULL | 승인일시 |
| `cdr_driver_accepted_at` | DATETIME | YES | NULL | 운전자 수락일시 |
| `cdr_departed_at` | DATETIME | YES | NULL | 실제 출발일시 |
| `cdr_arrived_at` | DATETIME | YES | NULL | 실제 도착일시 |
| `cdr_completed_at` | DATETIME | YES | NULL | 완료일시 |
| `cdr_created_at` | DATETIME | NO | CURRENT_TIMESTAMP | 생성일시 |
| `cdr_updated_at` | DATETIME | NO | CURRENT_TIMESTAMP ON UPDATE | 수정일시 |
| `cdr_deleted_at` | DATETIME | YES | NULL | 삭제일시 |

**인덱스:**
- `idx_car_dispatch_requests_ent_status` (ent_id, cdr_status)
- `idx_car_dispatch_requests_cvh_time` (cvh_id, cdr_depart_at, cdr_return_at)

**FK:**
- `cvh_id` → `car_vehicles(cvh_id)` (nullable)
- `cvd_id` → `car_vehicle_drivers(cvd_id)` (nullable)

---

## 5. car_trip_logs (운행일지)

| 컬럼명 | 타입 | NULL | 기본값 | 설명 |
|--------|------|------|--------|------|
| `ctl_id` | CHAR(36) PK | NO | UUID | 운행일지 ID |
| `ent_id` | CHAR(36) | NO | | 법인 ID |
| `cvh_id` | CHAR(36) FK | NO | | 차량 ID |
| `cvd_id` | CHAR(36) FK | NO | | 운전자 ID |
| `cdr_id` | CHAR(36) FK UNIQUE | NO | | 배차 신청 ID (1:1) |
| `ctl_origin` | VARCHAR(200) | NO | | 출발지 |
| `ctl_destination` | VARCHAR(200) | NO | | 목적지 |
| `ctl_depart_actual` | DATETIME | YES | NULL | 실제 출발일시 |
| `ctl_arrive_actual` | DATETIME | YES | NULL | 실제 도착일시 |
| `ctl_odo_start` | INT | YES | NULL | 출발 주행거리 (km) |
| `ctl_odo_end` | INT | YES | NULL | 도착 주행거리 (km) |
| `ctl_distance_km` | DECIMAL(8,1) | YES | NULL | 운행 거리 (km) |
| `ctl_refueled` | BOOLEAN | NO | false | 주유 여부 |
| `ctl_fuel_amount` | DECIMAL(6,2) | YES | NULL | 주유량 (L) |
| `ctl_fuel_cost` | INT | YES | NULL | 주유비 (원) |
| `ctl_toll_cost` | INT | YES | NULL | 통행료 (원) |
| `ctl_has_accident` | BOOLEAN | NO | false | 사고 여부 |
| `ctl_note` | TEXT | YES | NULL | 비고 |
| `ctl_kr_purpose_code` | ENUM('BUSINESS','COMMUTE','OTHER') | YES | NULL | 한국 세무용 목적코드 |
| `ctl_kr_business_ratio` | SMALLINT | YES | NULL | 업무 사용 비율 (%) |
| `ctl_status` | ENUM('IN_PROGRESS','COMPLETED','VERIFIED') | NO | IN_PROGRESS | 상태 |
| `ctl_submitted_at` | DATETIME | YES | NULL | 제출일시 |
| `ctl_created_at` | DATETIME | NO | CURRENT_TIMESTAMP | 생성일시 |
| `ctl_updated_at` | DATETIME | NO | CURRENT_TIMESTAMP ON UPDATE | 수정일시 |
| `ctl_deleted_at` | DATETIME | YES | NULL | 삭제일시 |

**인덱스:**
- `idx_car_trip_logs_cvh_depart` (cvh_id, ctl_depart_actual)
- `idx_car_trip_logs_ent` (ent_id)

**FK:**
- `cvh_id` → `car_vehicles(cvh_id)`
- `cvd_id` → `car_vehicle_drivers(cvd_id)`
- `cdr_id` → `car_dispatch_requests(cdr_id)` (UNIQUE — 1:1 관계)

---

## 6. car_maintenance_records (정비 이력)

| 컬럼명 | 타입 | NULL | 기본값 | 설명 |
|--------|------|------|--------|------|
| `cmr_id` | CHAR(36) PK | NO | UUID | 정비 기록 ID |
| `ent_id` | CHAR(36) | NO | | 법인 ID |
| `cvh_id` | CHAR(36) FK | NO | | 차량 ID |
| `cmr_type` | ENUM('REGULAR','TIRE','OIL','BRAKE','INSURANCE','INSPECTION','OTHER') | NO | | 정비 유형 |
| `cmr_description` | TEXT | YES | NULL | 상세 설명 |
| `cmr_shop_name` | VARCHAR(100) | YES | NULL | 정비소명 |
| `cmr_cost` | INT | YES | NULL | 비용 (원) |
| `cmr_date` | DATE | NO | | 정비일 |
| `cmr_next_date` | DATE | YES | NULL | 다음 정비일 |
| `cmr_performed_by` | CHAR(36) | YES | NULL | 기록자 ID |
| `cmr_created_at` | DATETIME | NO | CURRENT_TIMESTAMP | 생성일시 |
| `cmr_updated_at` | DATETIME | NO | CURRENT_TIMESTAMP ON UPDATE | 수정일시 |
| `cmr_deleted_at` | DATETIME | YES | NULL | 삭제일시 |

**인덱스:**
- `idx_car_maintenance_records_cvh` (cvh_id)
- `idx_car_maintenance_records_ent` (ent_id)

**FK:** `cvh_id` → `car_vehicles(cvh_id)`

---

## 공통 규칙

| 규칙 | 적용 |
|------|------|
| PK | `{colPrefix}_id` CHAR(36) UUID v4 |
| FK | 참조 테이블 PK 컬럼명 그대로 사용 |
| 멀티테넌시 | 모든 테이블에 `ent_id` CHAR(36) NOT NULL |
| Soft Delete | `{colPrefix}_deleted_at` DATETIME NULL |
| Timestamp | `{colPrefix}_created_at`, `{colPrefix}_updated_at` |
| ENUM | SCREAMING_SNAKE_CASE |
| 인덱스 | `idx_{table}_{column(s)}` |

## ENUM 값 정리

| ENUM | 값 |
|------|---|
| VehicleType | PASSENGER, VAN, TRUCK |
| VehicleStatus | AVAILABLE, IN_USE, MAINTENANCE, DISPOSED |
| FuelType | GASOLINE, DIESEL, LPG, ELECTRIC, HYBRID |
| TransmissionType | MANUAL, AUTOMATIC |
| CargoType | CARGO, TOP, FROZEN_TOP, WING |
| PurchaseType | OWNED, LEASE, INSTALLMENT |
| DriverRole | PRIMARY_DRIVER, SUB_DRIVER, POOL_DRIVER |
| DriverStatus | ACTIVE, ON_LEAVE, INACTIVE |
| ManagerRole | ADMIN_MANAGER, MAINTENANCE_MGR |
| DispatchPurposeType | BUSINESS, CLIENT, TRANSFER, OTHER |
| DispatchStatus | PENDING, APPROVED, REJECTED, DRIVER_ACCEPTED, DRIVER_REJECTED, DEPARTED, ARRIVED, COMPLETED, CANCELLED |
| TripLogStatus | IN_PROGRESS, COMPLETED, VERIFIED |
| MaintenanceType | REGULAR, TIRE, OIL, BRAKE, INSURANCE, INSPECTION, OTHER |
| KrPurposeCode | BUSINESS, COMMUTE, OTHER |

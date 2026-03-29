-- ============================================================
-- ambAppStore — Car Manager DB Initialization
-- Database: db_app_car
-- ============================================================

CREATE DATABASE IF NOT EXISTS db_app_car
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

SET NAMES utf8mb4;
USE db_app_car;

-- ------------------------------------------------------------
-- car_vehicles (차량 기본/운용 정보)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS car_vehicles (
  cvh_id              CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)      NOT NULL,
  cvh_ama_asset_id    CHAR(36)      NULL,
  cvh_plate_number    VARCHAR(20)   NOT NULL,
  cvh_type            ENUM('PASSENGER','VAN','TRUCK') NOT NULL,
  cvh_make            VARCHAR(50)   NOT NULL,
  cvh_model           VARCHAR(50)   NOT NULL,
  cvh_year            SMALLINT      NOT NULL,
  cvh_color           VARCHAR(30)   NULL,
  cvh_vin             VARCHAR(30)   NULL,
  cvh_displacement    INT           NULL,
  cvh_fuel_type       ENUM('GASOLINE','DIESEL','LPG','ELECTRIC','HYBRID') NOT NULL,
  cvh_transmission    ENUM('MANUAL','AUTOMATIC') NULL,
  cvh_max_passengers  SMALLINT      NOT NULL DEFAULT 5,
  cvh_max_load_ton    DECIMAL(5,2)  NULL,
  cvh_cargo_type      ENUM('CARGO','TOP','FROZEN_TOP','WING') NULL,
  cvh_purchase_type   ENUM('OWNED','LEASE','INSTALLMENT') NULL,
  cvh_purchase_date   DATE          NULL,
  cvh_purchase_price  BIGINT        NULL,
  cvh_status          ENUM('AVAILABLE','IN_USE','MAINTENANCE','DISPOSED') NOT NULL DEFAULT 'AVAILABLE',
  cvh_status_reason   TEXT          NULL,
  cvh_is_dedicated    BOOLEAN       NOT NULL DEFAULT FALSE,
  cvh_dedicated_dept  VARCHAR(100)  NULL,
  cvh_dedicated_start DATE          NULL,
  cvh_dedicated_end   DATE          NULL,
  cvh_insurance_expiry DATE         NULL,
  cvh_inspection_date  DATE         NULL,
  cvh_note            TEXT          NULL,
  cvh_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cvh_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  cvh_deleted_at      DATETIME      NULL,

  INDEX idx_car_vehicles_ent_status (ent_id, cvh_status),
  UNIQUE KEY uq_car_vehicles_ent_plate (ent_id, cvh_plate_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- car_vehicle_managers (차량 관리 책임자)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS car_vehicle_managers (
  cvm_id              CHAR(36)      NOT NULL PRIMARY KEY,
  cvh_id              CHAR(36)      NOT NULL,
  cvm_ama_user_id     CHAR(36)      NOT NULL,
  cvm_role            ENUM('ADMIN_MANAGER','MAINTENANCE_MGR') NOT NULL,
  cvm_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cvm_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  cvm_deleted_at      DATETIME      NULL,

  INDEX idx_car_vehicle_managers_cvh (cvh_id),
  FOREIGN KEY fk_cvm_vehicles (cvh_id) REFERENCES car_vehicles(cvh_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- car_vehicle_drivers (기사 풀)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS car_vehicle_drivers (
  cvd_id              CHAR(36)      NOT NULL PRIMARY KEY,
  cvh_id              CHAR(36)      NULL,
  ent_id              CHAR(36)      NOT NULL,
  cvd_ama_user_id     CHAR(36)      NOT NULL,
  cvd_role            ENUM('PRIMARY_DRIVER','SUB_DRIVER','POOL_DRIVER') NOT NULL,
  cvd_status          ENUM('ACTIVE','ON_LEAVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  cvd_leave_start     DATE          NULL,
  cvd_leave_end       DATE          NULL,
  cvd_note            TEXT          NULL,
  cvd_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cvd_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  cvd_deleted_at      DATETIME      NULL,

  INDEX idx_car_vehicle_drivers_cvh_status (cvh_id, cvd_status),
  INDEX idx_car_vehicle_drivers_user_status (cvd_ama_user_id, cvd_status),
  INDEX idx_car_vehicle_drivers_ent (ent_id),
  FOREIGN KEY fk_cvd_vehicles (cvh_id) REFERENCES car_vehicles(cvh_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- car_dispatch_requests (배차 신청/처리)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS car_dispatch_requests (
  cdr_id                  CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id                  CHAR(36)      NOT NULL,
  cvh_id                  CHAR(36)      NULL,
  cvd_id                  CHAR(36)      NULL,
  cdr_requester_id        CHAR(36)      NOT NULL,
  cdr_requester_name      VARCHAR(100)  NOT NULL,
  cdr_purpose_type        ENUM('BUSINESS','CLIENT','TRANSFER','OTHER') NOT NULL,
  cdr_purpose             VARCHAR(500)  NOT NULL,
  cdr_depart_at           DATETIME      NOT NULL,
  cdr_return_at           DATETIME      NOT NULL,
  cdr_origin              VARCHAR(200)  NOT NULL,
  cdr_destination         VARCHAR(200)  NOT NULL,
  cdr_passenger_count     SMALLINT      NOT NULL DEFAULT 1,
  cdr_passenger_list      JSON          NULL,
  cdr_preferred_vehicle_type ENUM('PASSENGER','VAN','TRUCK') NULL,
  cdr_cargo_info          TEXT          NULL,
  cdr_is_proxy            BOOLEAN       NOT NULL DEFAULT FALSE,
  cdr_actual_user_name    VARCHAR(100)  NULL,
  cdr_external_guest      JSON          NULL,
  cdr_note                TEXT          NULL,
  cdr_status              ENUM('PENDING','APPROVED','REJECTED','DRIVER_ACCEPTED','DRIVER_REJECTED','DEPARTED','ARRIVED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  cdr_reject_reason       TEXT          NULL,
  cdr_driver_reject_reason TEXT         NULL,
  cdr_cancel_reason       TEXT          NULL,
  cdr_driver_override     BOOLEAN       NOT NULL DEFAULT FALSE,
  cdr_approved_at         DATETIME      NULL,
  cdr_driver_accepted_at  DATETIME      NULL,
  cdr_departed_at         DATETIME      NULL,
  cdr_arrived_at          DATETIME      NULL,
  cdr_completed_at        DATETIME      NULL,
  cdr_created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cdr_updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  cdr_deleted_at          DATETIME      NULL,

  INDEX idx_car_dispatch_requests_ent_status (ent_id, cdr_status),
  INDEX idx_car_dispatch_requests_cvh_time (cvh_id, cdr_depart_at, cdr_return_at),
  FOREIGN KEY fk_cdr_vehicles (cvh_id) REFERENCES car_vehicles(cvh_id),
  FOREIGN KEY fk_cdr_drivers (cvd_id) REFERENCES car_vehicle_drivers(cvd_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- car_trip_logs (운행일지)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS car_trip_logs (
  ctl_id              CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)      NOT NULL,
  cvh_id              CHAR(36)      NOT NULL,
  cvd_id              CHAR(36)      NOT NULL,
  cdr_id              CHAR(36)      NOT NULL,
  ctl_origin          VARCHAR(200)  NOT NULL,
  ctl_destination     VARCHAR(200)  NOT NULL,
  ctl_depart_actual   DATETIME      NULL,
  ctl_arrive_actual   DATETIME      NULL,
  ctl_odo_start       INT           NULL,
  ctl_odo_end         INT           NULL,
  ctl_distance_km     DECIMAL(8,1)  NULL,
  ctl_refueled        BOOLEAN       NOT NULL DEFAULT FALSE,
  ctl_fuel_amount     DECIMAL(6,2)  NULL,
  ctl_fuel_cost       INT           NULL,
  ctl_toll_cost       INT           NULL,
  ctl_has_accident    BOOLEAN       NOT NULL DEFAULT FALSE,
  ctl_note            TEXT          NULL,
  ctl_kr_purpose_code ENUM('BUSINESS','COMMUTE','OTHER') NULL,
  ctl_kr_business_ratio SMALLINT    NULL,
  ctl_status          ENUM('IN_PROGRESS','COMPLETED','VERIFIED') NOT NULL DEFAULT 'IN_PROGRESS',
  ctl_submitted_at    DATETIME      NULL,
  ctl_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ctl_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ctl_deleted_at      DATETIME      NULL,

  INDEX idx_car_trip_logs_cvh_depart (cvh_id, ctl_depart_actual),
  INDEX idx_car_trip_logs_ent (ent_id),
  FOREIGN KEY fk_ctl_vehicles (cvh_id) REFERENCES car_vehicles(cvh_id),
  FOREIGN KEY fk_ctl_drivers (cvd_id) REFERENCES car_vehicle_drivers(cvd_id),
  FOREIGN KEY fk_ctl_dispatch (cdr_id) REFERENCES car_dispatch_requests(cdr_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- car_maintenance_records (정비/검사/보험 이력)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS car_maintenance_records (
  cmr_id              CHAR(36)      NOT NULL PRIMARY KEY,
  ent_id              CHAR(36)      NOT NULL,
  cvh_id              CHAR(36)      NOT NULL,
  cmr_type            ENUM('REGULAR','TIRE','OIL','BRAKE','INSURANCE','INSPECTION','OTHER') NOT NULL,
  cmr_description     TEXT          NULL,
  cmr_shop_name       VARCHAR(100)  NULL,
  cmr_cost            INT           NULL,
  cmr_date            DATE          NOT NULL,
  cmr_next_date       DATE          NULL,
  cmr_performed_by    CHAR(36)      NULL,
  cmr_created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cmr_updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  cmr_deleted_at      DATETIME      NULL,

  INDEX idx_car_maintenance_records_cvh (cvh_id),
  INDEX idx_car_maintenance_records_ent (ent_id),
  FOREIGN KEY fk_cmr_vehicles (cvh_id) REFERENCES car_vehicles(cvh_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

# CR Truck Management 엑셀 → `car_trip_logs` 매핑 분석 / 요구사항 / 작업계획서

- **작성일**: 2026-04-19
- **작성자**: 김익용 (fremdung@gmail.com)
- **대상 소스**: `uploads/CR TRUCK MANAGEMENT SAMPLE (1).xls`
- **대상 테이블**: `car_trip_logs` (+ 인접 테이블)
- **참조 스키마**: `DB-SCHEMA-car-manager.md`, `backend/scripts/init-db.sql`, `backend/src/domain/trip-log/entity/trip-log.entity.ts`

---

## 1. 개념 정리

엑셀은 **베트남 Cargo Rush International**의 **트럭 1대 일일 운행 장부**다. 하루 안에서 발생한 **여러 구간(leg) 을 각 행으로 기록**하며, 고객 건별 선적·통관 번호와 구간별 비용(통행료·기타비·유가)을 함께 적는 물류 특화 양식이다.

반면 우리 앱의 `car_trip_logs`는 **"배차(cdr) 1건 → 운행일지(ctl) 1건"** 을 기본 전제로 하는 한국식 차량관리 모델이며, 물류(화주·선적번호·통관번호)와 기타비 분류(주차·세차·타이어·정비)를 담을 컬럼이 없다.

따라서 이번 과제는 단순 매핑이 아니라 **① 필드 매핑 + ② 스키마 확장 + ③ 배차 자동 생성 규칙 + ④ 텍스트 파싱 규칙**을 함께 정의해야 한다.

---

## 2. 엑셀 항목 인벤토리

| 영역 | 셀 | 내용 |
|---|---|---|
| 헤더 | A1~A3 | 회사명 · 주소 · 전화 |
| 요약 | F5 / F6 | 총 주유량(246.56 L) / 총 주행(1,345 km) |
| 요약 | N5 / N6 | 연비 5.455 km/L / 0.183 L/km |
| 본문 | 10~11행 | 2단 병합 헤더 |
| 본문 | 12~64행 | 53개 운행 레코드 (2026-02-02 ~ 2026-02-28) |
| 합계 | 65행 | I=1,345 km · M=238,000 · N=6,590,000 |

본문 컬럼:

| 컬럼 | 헤더 | 예시 | 형식 |
|---|---|---|---|
| A | NO | 1 | 일련번호 |
| B | DATE | 2026-02-02 | 날짜(일자만, 그룹 첫 행에만 기재) |
| C | START | `6h50` | 텍스트 시각 |
| D | FINISH | `8h00` | 텍스트 시각 (일부 `20h20\` 오타) |
| E | FROM | `bãi xe` | 소문자 텍스트, 비정규화 |
| F | TO | `cát lái` | 〃 |
| G | START (KM) | 11722 | 오도미터 시작 |
| H | FINISH (KM) | 11737 | 오도미터 종료 |
| I | TOTAL KM | 15 | `=H-G` |
| J | CUSTOMER | `VIVA` | 화주, 여러 구간 중 주로 첫/관련 행에만 |
| K | BILL / BOOK | `EG26011503` | 선적 번호 |
| L | CDF | `107944634710` | 통관서류 번호 |
| M | TOLL FEE | 10,000 | 통행료(VND) |
| N | OTHER FEE | 500,000 | 기타비(VND) |
| O | REMARK FOR OTHER FEE | `XANG` | 기타비 용도 코드 (아래 표) |
| P | OIL FEE | 18,657 | **리터당 단가(VND/L)** — 이름 오도 |
| Q | FUEL QUANTITY | 2.75 | 소비량(L) = `I × 0.1833` (실측 아님, 역산 추정치) |

**O열 용도 코드** (현장 표기):

| 코드 | 의미 | 권장 매핑 |
|---|---|---|
| `XANG` | 주유(gas) | `ctl_fuel_cost` + `ctl_refueled=TRUE` |
| `BAI` | 주차료 | 기타비 - PARKING |
| `RUA XE` | 세차 | 기타비 - WASH |
| `VA VO` | 타이어 | 정비 - TIRE |
| `CUNG XE` | 정비 | 정비 - REGULAR/OTHER |

---

## 3. 필드매핑 매트릭스

**범례**: ✅ 직결 / ⚠️ 변환 필요 / ❌ 스키마에 부재(확장 필요)

| # | 엑셀 원본 | 변환 규칙 | 매핑 대상 | 상태 |
|---|---|---|---|---|
| 1 | `A`(NO) | 미사용 | — | — |
| 2 | `B`(DATE) + `C`(START) | `YYYY-MM-DD` + `H'h'MM` → `DATETIME` | `ctl_depart_actual` | ⚠️ |
| 3 | `B`(DATE) + `D`(FINISH) | 〃 / 자정 넘김 시 +1일 보정 | `ctl_arrive_actual` | ⚠️ |
| 4 | `E` | trim · lower · 좌표 dictionary 정규화(선택) | `ctl_origin` | ⚠️ |
| 5 | `F` | 〃 | `ctl_destination` | ⚠️ |
| 6 | `G` | 그대로 | `ctl_odo_start` | ✅ |
| 7 | `H` | 그대로 | `ctl_odo_end` | ✅ |
| 8 | `I` | 없으면 `H-G` 로 계산 | `ctl_distance_km` | ✅ |
| 9 | `J`(CUSTOMER) | 대문자 정규화, 마스터 매칭 | **신규 `ctl_customer_name`** | ❌ |
| 10 | `K`(BILL/BOOK) | 공백 trim | **신규 `ctl_bill_no`** | ❌ |
| 11 | `L`(CDF) | 공백 trim, `/` 다건 분해 | **신규 `ctl_cdf_no`** | ❌ |
| 12 | `M`(TOLL) | 그대로 | `ctl_toll_cost` | ✅ |
| 13 | `N`+`O`(XANG) | XANG → 주유비 + 주유여부 | `ctl_fuel_cost`, `ctl_refueled=TRUE` | ⚠️ |
| 14 | `N`+`O`(BAI/RUA XE) | 주차·세차 분류 | **신규 `ctl_other_fee` + `ctl_other_fee_type`** | ❌ |
| 15 | `N`+`O`(VA VO/CUNG XE) | 정비성 비용은 운행일지 밖으로 이관 | `car_maintenance_records` (신규 레코드) | ⚠️ |
| 16 | `P`(리터당 단가) | 운행일지 본체에 저장 X | **신규 참조 `car_fuel_prices`** (또는 ctl 내 `ctl_fuel_unit_price`) | ❌ |
| 17 | `Q`(소비량) | 실측 아니면 보관만 (신뢰도↓) | `ctl_fuel_amount` | ⚠️ |
| 18 | (없음) | 기본 FALSE | `ctl_has_accident` | ✅ |
| 19 | `O`(전체 텍스트) | 매핑되지 않은 잔여는 여기로 | `ctl_note` | ⚠️ |
| 20 | (없음) | 고정 `BUSINESS` | `ctl_kr_purpose_code` | ✅ |
| 21 | (없음) | `COMPLETED` | `ctl_status` | ✅ |

---

## 4. GAP 분석 (스키마 확장 필요 항목)

### 4.1 화물 운송 특화 필드 부재
`car_trip_logs`에는 화주·선적서류·통관서류 개념이 없음.

제안 **Option A (컬럼 직접 추가)**:
```sql
ALTER TABLE car_trip_logs
  ADD COLUMN ctl_customer_name VARCHAR(100) NULL AFTER ctl_destination,
  ADD COLUMN ctl_bill_no       VARCHAR(100) NULL AFTER ctl_customer_name,
  ADD COLUMN ctl_cdf_no        VARCHAR(200) NULL AFTER ctl_bill_no;
```

제안 **Option B (JSON 확장 필드)**:
```sql
ALTER TABLE car_trip_logs
  ADD COLUMN ctl_logistics_meta JSON NULL;
-- {"customer":"VIVA","bill_no":"EG26011503","cdf_no":"107944634710"}
```

A는 인덱싱·쿼리 용이, B는 국가·고객사별 확장 유연. **A 권장** (고객/빌/CDF는 검색 대상이 됨).

### 4.2 기타비(OTHER FEE) 다분류 부재
현재는 `ctl_fuel_cost`, `ctl_toll_cost`만 존재. 주차·세차·타이어·정비·기타가 수용 불가.

제안: **子 테이블 `car_trip_log_fees`** 신규 생성 (1:N).
```sql
CREATE TABLE car_trip_log_fees (
  ctlf_id       CHAR(36)    NOT NULL PRIMARY KEY,
  ctl_id        CHAR(36)    NOT NULL,
  ctlf_type     ENUM('FUEL','TOLL','PARKING','WASH','TIRE','MAINTENANCE','OTHER') NOT NULL,
  ctlf_amount   INT         NOT NULL,
  ctlf_currency CHAR(3)     NOT NULL DEFAULT 'VND',
  ctlf_note     VARCHAR(200) NULL,
  ctlf_created_at DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ctlf_ctl (ctl_id),
  FOREIGN KEY fk_ctlf_ctl (ctl_id) REFERENCES car_trip_logs(ctl_id)
);
```
→ 엑셀의 `M(TOLL)`, `N+O(OTHER)`, `XANG(주유비)`을 모두 이 테이블에 **명세별**로 저장. 본체 `ctl_fuel_cost/ctl_toll_cost`는 호환을 위해 유지하되 트리거나 서비스 레이어에서 합계 동기화.

대안 A': 본체에 `ctl_parking_cost`, `ctl_wash_cost`, `ctl_misc_cost` 컬럼을 직접 추가(단순, 확장성 낮음).

### 4.3 연료 단가 부재
`car_vehicles`나 `car_trip_logs` 어디에도 리터당 단가 컬럼 없음. 엑셀 P열 `18,657 VND/L`를 저장할 곳 필요.

제안: 시점별 단가 마스터 테이블.
```sql
CREATE TABLE car_fuel_prices (
  cfp_id        CHAR(36) NOT NULL PRIMARY KEY,
  ent_id        CHAR(36) NOT NULL,
  cfp_fuel_type ENUM('GASOLINE','DIESEL','LPG') NOT NULL,
  cfp_currency  CHAR(3) NOT NULL,
  cfp_unit_price INT NOT NULL,
  cfp_valid_from DATE NOT NULL,
  cfp_valid_to   DATE NULL,
  INDEX idx_cfp_ent_type_date (ent_id, cfp_fuel_type, cfp_valid_from)
);
```
→ 주유비(FUEL) 레코드 생성 시 `amount / unit_price = liters` 로 `ctl_fuel_amount` 역산 가능.

### 4.4 `cdr_id` NOT NULL 제약 충돌
엑셀 레코드는 "사후 기록"이며 선행 배차 신청 개념이 없다.

해결안:
1. **`cdr_id`를 NULL 허용으로 스키마 변경** — 운행일지 단독 생성 허용. (단, 운영 워크플로우 정책 변경 필요)
2. **Synthetic Dispatch 자동 생성** — import 시 엑셀 1행당 `car_dispatch_requests` 레코드를 `status=COMPLETED, cdr_is_proxy=TRUE, cdr_note='IMPORTED_FROM_EXCEL'`로 생성하여 FK 만족.

→ **2안(Synthetic Dispatch)** 권장. 기존 스키마·비즈니스 로직 영향이 최소화되고, 앱 내에서 "배차→운행→일지" 일관성을 해치지 않는다.

### 4.5 시간 표기 변환
`"6h50"`, `"20h20\"` 같은 베트남식 텍스트. 공백/역슬래시/앞뒤 불순물 제거 후 정규식 `^\s*(\d{1,2})h\s*(\d{2})?\s*\\?$` 으로 파싱.

### 4.6 날짜 전파(Forward-Fill)
B열은 일자의 첫 행에만 값이 있음. 같은 일자 그룹에는 이전 non-null 값을 **정방향 채움**.

### 4.7 고객명 비정규화
`DAWON` vs `daiwon`, `VIVA` vs `VIVA - KIEM - PHU HUU`. 간이 표준화 → `customer_master`(신규 또는 enum 사전) 검토. 본 스코프에서는 `ctl_customer_name`에 UPPER·TRIM·공백·언더스코어 정규화만 적용.

### 4.8 오도미터 연속성
행 n+1의 `G` = 행 n의 `H`이어야 한다는 불변식을 import 시 체크, 불일치 행은 `import_errors` 로그로 보고(하드 실패는 아님; 차량 전환 등 가능).

### 4.9 한국식 과세 필드(`ctl_kr_purpose_code`)
베트남 엑셀에는 존재하지 않음. 일괄 `BUSINESS` / `ctl_kr_business_ratio=100` 기본값 주입. 추후 국가별 기본값 정책화.

---

## 5. 요구사항 분석

### 5.1 기능 요구사항 (FR)

| ID | 요구사항 | 우선순위 |
|---|---|---|
| FR-01 | `.xls/.xlsx` 파일 업로드 및 파싱 | H |
| FR-02 | 시트·헤더 자동 인식 + 매핑 프로파일 선택(CR-Vietnam-Truck-v1) | H |
| FR-03 | 날짜/시각 텍스트(`6h50`) → DATETIME 변환 | H |
| FR-04 | B열 날짜 Forward-Fill | H |
| FR-05 | 동일 차량·기사에 대해 운행일지 대량 생성 | H |
| FR-06 | 각 행에 대해 Synthetic Dispatch (`car_dispatch_requests`) 생성 후 `cdr_id` 연결 | H |
| FR-07 | 기타비(O열) 텍스트 코드 → `car_trip_log_fees` 분류 적재 | H |
| FR-08 | 주유 이벤트(XANG) → `ctl_refueled=TRUE`, `ctl_fuel_cost` 세팅 및 `car_fuel_prices` 참조 | H |
| FR-09 | 정비성(VA VO/CUNG XE) 항목은 `car_maintenance_records`로 분리 생성 | M |
| FR-10 | Dry-run 모드(미리보기) — 매핑 결과·경고·에러를 화면/리포트로 제공 | H |
| FR-11 | 중복 import 방지 — (cvh_id + ctl_depart_actual + odo_start) 기반 멱등 키 | H |
| FR-12 | 실패 레코드 CSV 다운로드 + 재업로드 | M |
| FR-13 | Import 이력 조회 (건수·성공/실패·실행자·파일명) | M |
| FR-14 | 고객명/장소명 정규화 사전(관리자 화면) | L |

### 5.2 비기능 요구사항 (NFR)

- 파일 1,000행 기준 60초 이내 처리.
- 트랜잭션: 파일 단위가 아닌 **행 단위 트랜잭션**(부분 실패 허용 + 이력화).
- 문자셋: `utf8mb4` — 베트남어 성조 부호(`bãi xe`, `cát lái`) 보존.
- 감사로그: 누가·언제·어떤 파일·몇 건 import 했는지 `cil_*`(car import logs) 별도 테이블.
- 권한: `ADMIN_MANAGER` 또는 기업(ent) 관리자만 import 가능.

### 5.3 데이터 품질 규칙 (DQ)

- `odo_end >= odo_start`
- `distance_km == odo_end - odo_start` (오차 1km 허용)
- 연속성: `next.odo_start == prev.odo_end` (경고 레벨)
- `fuel_amount > 0` 이면 `refueled=TRUE`
- 시각 파싱 실패 행은 **SKIP + 경고**
- 동일 (차량·날짜·출발시각·odo_start) 조합 중복 시 1건만 반영

---

## 6. 작업계획서 (WBS)

### Phase 0. 킥오프 & 합의 (0.5d)

| ID | 태스크 | 산출물 | 담당 |
|---|---|---|---|
| P0-1 | 본 문서 리뷰 및 의사결정 (옵션 A vs B, cdr 정책) | 회의록, 결정사항 | PM |
| P0-2 | 매핑 프로파일 명명 규칙(`CR-Vietnam-Truck-v1`) 확정 | 코드값 | BE |

### Phase 1. 스키마 확장 (1.5d)

| ID | 태스크 | 산출물 | 담당 |
|---|---|---|---|
| P1-1 | `car_trip_logs` 확장: `ctl_customer_name`, `ctl_bill_no`, `ctl_cdf_no` 컬럼 추가 | 마이그레이션 `2026xxxxxx_trip_logs_add_logistics.ts` | BE |
| P1-2 | `car_trip_log_fees` 신규 테이블 | 마이그레이션 | BE |
| P1-3 | `car_fuel_prices` 신규 테이블 (+ 시드: VND Diesel 18,657 등) | 마이그레이션 + seed | BE |
| P1-4 | `car_import_logs` 신규 테이블 (파일명/행수/성공/실패/실행자) | 마이그레이션 | BE |
| P1-5 | `cdr_id` 정책 결정: NOT NULL 유지 + Synthetic Dispatch 방식 채택 | ADR 기록 | Arch |
| P1-6 | TypeORM 엔티티/DTO 반영 | `*.entity.ts`, `dto/*.ts` | BE |

### Phase 2. Import 파이프라인 개발 (3d)

| ID | 태스크 | 산출물 | 담당 |
|---|---|---|---|
| P2-1 | 파서 모듈: `.xls/.xlsx` 로더 (SheetJS/exceljs) | `ExcelParserService` | BE |
| P2-2 | 매핑 프로파일 `CR-Vietnam-Truck-v1` 구현 (위 §3 규칙) | `mapping/cr-vn-truck-v1.ts` | BE |
| P2-3 | 날짜/시각/텍스트 정규화 유틸 (`6h50` → `HH:mm`, date forward-fill) | `util/normalize.ts` + 단위테스트 | BE |
| P2-4 | Fee 분해기: `N`+`O` → `ctl_fee_rows[]` + 정비성 분기 | `FeeClassifier` | BE |
| P2-5 | Synthetic Dispatch 생성기 | `DispatchBootstrapService` | BE |
| P2-6 | 멱등키(`cvh_id + depart_actual + odo_start`) 검사 | `ImportDedupService` | BE |
| P2-7 | 트랜잭션/에러 정책 (행 단위 try/catch, 누적 리포트) | `ImportOrchestrator` | BE |
| P2-8 | REST 엔드포인트 `POST /api/v1/car/trip-logs/import` (multipart) | Controller + Swagger | BE |
| P2-9 | Dry-run 모드 플래그 `?dryRun=true` | 동 | BE |

### Phase 3. 프론트엔드 (1.5d)

| ID | 태스크 | 산출물 | 담당 |
|---|---|---|---|
| P3-1 | 업로드 화면 (파일, 차량 선택, 기사 선택, 프로파일) | `TripLogImportPage.tsx` | FE |
| P3-2 | Dry-run 결과 미리보기 테이블 + 경고/에러 하이라이트 | 동 | FE |
| P3-3 | 실패 CSV 다운로드 | 동 | FE |
| P3-4 | Import 이력 페이지 | `TripLogImportHistoryPage.tsx` | FE |

### Phase 4. 테스트 & 데이터 검증 (1d)

| ID | 태스크 | 산출물 | 담당 |
|---|---|---|---|
| P4-1 | 유닛: 시각 파서, fee 분류기, forward-fill | Jest 케이스 | BE |
| P4-2 | 통합: 샘플 `.xls` 53행 → DB 적재 / 금액·거리 합계 일치 확인 | e2e 테스트 | QA |
| P4-3 | 회귀: 운행일지 기존 API 응답 구조 호환 | 기존 snapshot | QA |
| P4-4 | 데이터 검증 체크리스트: total km 1,345, total toll 238,000, total other 6,590,000 | 검증 리포트 | QA |

### Phase 5. 릴리즈 (0.5d)

| ID | 태스크 |
|---|---|
| P5-1 | 스테이징 마이그레이션 · 시드 |
| P5-2 | 샘플 파일 운영팀 합수 테스트 |
| P5-3 | 운영 배포 (feature flag: `TRIP_LOG_EXCEL_IMPORT`) |
| P5-4 | 운영자 매뉴얼 1장(업로드 절차, 오류 대응) |

**총 예상 공수: 약 7.5 man-day (BE 4.5 / FE 1.5 / QA 1 / PM·Arch 0.5)**

---

## 7. 검증 시나리오 (Acceptance Criteria)

1. 샘플 파일 업로드 → Dry-run 결과에 53행 중 매핑 성공 N건·경고 N건 표시.
2. 실제 import 후:
   - `car_trip_logs` 53건 생성 (또는 스킵 이유 로깅).
   - `SUM(ctl_distance_km) == 1345`
   - `SUM(CASE type='TOLL' ...) == 238000`
   - `SUM(CASE type IN ('PARKING','WASH','TIRE','MAINTENANCE','FUEL') ...) == 6590000`
   - 주유 이벤트 6건(XANG) 모두 `ctl_refueled=TRUE`.
3. 같은 파일을 재업로드 → 중복 생성 0건 (멱등).
4. 고의 오도미터 불연속 행 주입 → 경고 로그에 기록, 해당 행은 생성하되 `ctl_note`에 `[WARN] odo gap` 자동 추가.

---

## 8. 오픈 이슈 / 의사결정 필요

| ID | 이슈 | 대안 | 결정 필요자 |
|---|---|---|---|
| OI-1 | `cdr_id` NOT NULL 유지 vs Nullable | Synthetic Dispatch(권장) / 스키마 변경 | Arch |
| OI-2 | 기타비를 본체 컬럼 vs 서브테이블 | `car_trip_log_fees`(권장) / 컬럼 추가 | PM |
| OI-3 | 고객명 정규화 범위 | 이번 릴리즈에선 UPPER+TRIM만 / 사전 도입은 별도 스프린트 | PM |
| OI-4 | 정비성 비용(VA VO/CUNG XE)을 `car_maintenance_records`로 이관할지 | 이관(권장) / trip_log_fees에만 저장 | PM |
| OI-5 | `ctl_fuel_amount` 소스 — 엑셀 Q값은 역산 추정치 | `FUEL cost / fuel_unit_price`로 재계산(권장) / 엑셀 값 그대로 | BE |
| OI-6 | 시간 파싱 실패 행 처리 — Skip vs 최선추정 후 WARN | Skip + CSV 반환(권장) | PM |

---

## 9. 참고 — 샘플 파일 요약 수치

- 운행일수: 11일 (2026-02-02 ~ 2026-02-28, 부분 공백)
- 총 운행 건수: 53
- 시작 오도미터: 11,722 / 종료 오도미터: 13,067 → **1,345 km**
- 총 주유량(역산): **246.56 L**
- 연비: **5.455 km/L**
- 통행료 합계: **238,000 VND**
- 기타비 합계: **6,590,000 VND** (주유 XANG 포함 6건 + 주차·세차·정비 등)

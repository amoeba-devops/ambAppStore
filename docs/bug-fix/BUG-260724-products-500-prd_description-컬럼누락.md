# BUG-260724: 상품 API 500 에러 — `prd_description` 컬럼 누락 (스키마 드리프트)

## 1. 증상 / Symptom
- 페이지: https://stg-apps.amoeba.site/app-stock-management/products/new
- API: `GET/POST /app-stock-management/api/v1/products` → **500 Internal Server Error**
- 상품 목록 조회·상품 등록 모두 실패 (상품 도메인 전체 기능 불가)

## 2. 원인 분석 / Root Cause

### 에러 로그 (bff-stock-management)
```
QueryFailedError: Unknown column 'Product.prd_description' in 'field list'
code: 'ER_BAD_FIELD_ERROR', errno: 1054, sqlState: '42S22'
```
SELECT(목록 조회)와 INSERT(상품 등록) 쿼리 모두 동일 에러로 실패.

### 근본 원인: Entity ↔ DB DDL 스키마 드리프트
TypeORM Entity에는 `prd_description` 컬럼이 정의되어 있으나, 테이블 생성 SQL(`init-db.sql`)에는 해당 컬럼이 없음. 스테이징은 `synchronize` 비활성(수동 SQL 마이그레이션 원칙)이므로 컬럼이 자동 생성되지 않아, Entity 기준으로 생성되는 모든 쿼리가 실패.

| 구분 | 파일 | `prd_description` |
|------|------|------|
| Entity | `apps/app-stock-management/backend/src/domain/product/entity/product.entity.ts:24` | ✅ `@Column({ name: 'prd_description', type: 'text', nullable: true })` |
| DDL | `apps/app-stock-management/backend/scripts/init-db.sql:84-97` | ❌ 없음 (`prd_note`만 존재) |
| 스테이징 DB (`mysql-apps` / `db_app_stock.asm_products`) | 실 컬럼 확인 결과 | ❌ 없음 |

최초 구현 커밋(`0bee421 feat: app-stock-management 전체 구현`)부터 Entity에는 존재했으나 init-db.sql에 누락된 채 스테이징 DB가 생성됨.

### 부가 드리프트 (동일 에러는 아니나 함께 정리 권장)
| 컬럼 | Entity | DDL/DB |
|------|--------|--------|
| `prd_code` | varchar(50) | varchar(30) |
| `prd_name` | varchar(200) | varchar(100) |
| `prd_category` | varchar(100) | varchar(50) |
| `prd_brand` | varchar(100) | varchar(50) |

## 3. 해결 방안 / Proposed Fix

### 스테이징 DB 수동 마이그레이션 (필수)
```sql
ALTER TABLE db_app_stock.asm_products
  ADD COLUMN prd_description TEXT NULL AFTER prd_brand;
```

### 저장소 DDL 정합화 (재발 방지)
`init-db.sql`의 `asm_products`에 `prd_description TEXT NULL` 추가 (+ varchar 길이 Entity와 일치화 권장).

### 프로덕션
프로덕션 배포 시 동일 ALTER 문 사전 적용 필요 (스테이징 검증 후).

## 4. 변경 파일 목록 (수정 시)
- `apps/app-stock-management/backend/scripts/init-db.sql` — `prd_description` 컬럼 추가
- 스테이징 DB: `ALTER TABLE` 수동 실행

## 5. 재발 방지 패턴
- Entity 컬럼 추가/변경 시 **init-db.sql 및 마이그레이션 SQL 동시 갱신** 체크리스트 준수 (CLAUDE.md "스테이징/프로덕션 수동 SQL 마이그레이션 준비" 항목)
- 배포 전 Entity ↔ `SHOW COLUMNS` diff 검증 절차 권장

## 6. 수정 내용 / Applied Fix (2026-07-24)

### 스테이징 DB (`mysql-apps` / `db_app_stock`)
```sql
ALTER TABLE asm_products
  ADD COLUMN prd_description TEXT NULL AFTER prd_brand,
  MODIFY COLUMN prd_code VARCHAR(50) NOT NULL,
  MODIFY COLUMN prd_name VARCHAR(200) NOT NULL,
  MODIFY COLUMN prd_category VARCHAR(100) NULL,
  MODIFY COLUMN prd_brand VARCHAR(100) NULL;
```
- 적용 후 `SHOW COLUMNS` 로 Entity와 완전 일치 확인
- 기존 실패 SELECT 쿼리 재실행 → 정상 수행 확인 (에러 없음)

### 저장소
- `apps/app-stock-management/backend/scripts/init-db.sql` — `prd_description TEXT NULL` 추가, varchar 길이 Entity와 일치화 (30→50, 100→200, 50→100 ×2)

### 프로덕션 적용 시
프로덕션 배포 전 동일 ALTER 문을 `db_app_stock.asm_products`에 수동 실행 필요.

## 7. 추가 발견 및 2차 수정 (2026-07-24, 재발 확인 후)

### 증상 (2차)
`prd_description` 컬럼 추가 후에도 `POST /api/v1/products` 500 지속.

### 원인 2건 추가 확인

**(A) 스키마 드리프트가 4개 테이블에 더 존재 (전수 대조 결과)**
전체 18개 Entity ↔ 스테이징 DB 컬럼 전수 비교 결과, DB에 누락된 컬럼 4개 확인:
| 테이블 | 누락 컬럼 | 타입 |
|--------|-----------|------|
| `asm_channels` | `chn_note` | TEXT NULL |
| `asm_order_batches` | `obt_note` | TEXT NULL |
| `asm_receiving_schedules` | `rcv_note` | TEXT NULL |
| `asm_user_applications` | `uap_purpose` | TEXT NULL |

`GET /channels`가 `Unknown column 'Channel.chn_note'`로 이미 실패 중이었음.

**(B) product.service의 snake_case → camelCase 매핑 누락 (코드 버그)**
- 프론트(`ProductFormPage.tsx`)는 API 컨벤션대로 snake_case(`prd_code`, `prd_name`, …) 전송
- `product.service.ts`의 `create()`가 `repo.create({ ...data, entId })`로 raw body를 spread → Entity 프로퍼티는 camelCase(`prdCode`)라 **모든 필드가 무시**됨
- 결과: `INSERT ... VALUES (id, ent_id, DEFAULT, DEFAULT, ...)` → `Field 'prd_code' doesn't have a default value` (errno 1364) → 500
- `update()`의 `Object.assign(product, data)`도 동일 문제 (silent no-op)
- 참고: `sku/transaction/sales-order` 서비스는 명시적 매핑이 있어 정상, `channel/parameter` 페이지는 프론트가 camelCase를 보내 우연히 동작 (컨벤션 위반이나 동작함)

### 2차 수정 내용
1. **스테이징 DB**: 누락 컬럼 4개 ALTER ADD 적용 완료
   ```sql
   ALTER TABLE asm_channels ADD COLUMN chn_note TEXT NULL AFTER chn_type;
   ALTER TABLE asm_order_batches ADD COLUMN obt_note TEXT NULL AFTER obt_approved_at;
   ALTER TABLE asm_receiving_schedules ADD COLUMN rcv_note TEXT NULL AFTER rcv_supplier;
   ALTER TABLE asm_user_applications ADD COLUMN uap_purpose TEXT NULL AFTER uap_applicant_phone;
   ```
2. **`init-db.sql`**: 위 4개 컬럼 DDL 반영
3. **`product.service.ts`**: `create()`/`update()`에 snake_case → camelCase 명시적 매핑 추가 (sku.service 패턴 준수)
   - 필수값 검증(`ASM-E2101`) 및 상품코드 중복 검증(`ASM-E2102`, uq_prd_ent_code 제약 대응) 추가
4. **프로덕션**: 배포 시 위 4개 ALTER + 기존 asm_products ALTER 모두 수동 적용 필요

## 상태
- [x] 원인 확인 완료 (2026-07-24)
- [x] 스테이징 DB ALTER 적용 — asm_products (2026-07-24)
- [x] init-db.sql 수정 (1·2차)
- [x] 스테이징 DB ALTER 적용 — 누락 4컬럼 (2026-07-24)
- [x] product.service.ts 매핑 버그 수정
- [ ] 스테이징 BFF 재배포 (코드 반영)
- [ ] 프로덕션 DB ALTER 적용 (프로덕션 배포 시)

# REQ-20260402 — SKU/SPU List & Detail Enhancement
# SKU/SPU 목록 및 상세 기능 개선

## 1. 요구사항 요약 (Requirements Summary)

| # | Requirement | Type |
|---|-------------|------|
| R1 | SKU/SPU 목록에 한국어/영어/베트남어 상품명 모두 표시, 사용자 선택으로 언어 컬럼 표시/숨김 | Enhancement |
| R2 | SKU 목록에서 WMS 코드 클릭 시 SKU 상세 페이지 이동 링크 추가 | New Feature |
| R3 | SKU 상세 페이지: 모든 필드 표시 (GTIN, 외부연동용코드, HS Code 포함) | New Feature |
| R4 | SKU 상세 페이지: 상품명 한국어/영어/베트남어 각각 1라인씩 표시 | New Feature |
| R5 | SKU 엔티티에 상품 설명(description) 필드 추가 | New Feature |
| R6 | Variant에 color 값 포함 지원 | Enhancement |

---

## 2. AS-IS 현황 분석 (Current State Analysis)

### 2.1 Frontend — SKU 목록 페이지 (`SkuMasterListPage.tsx`)

| Column | 현황 |
|--------|------|
| WMS Code | 텍스트 표시 (클릭 불가) |
| SPU Code | 텍스트 표시 |
| **상품명** | **한국어(nameKr)만 표시** |
| Prime Cost | 숫자 표시 |
| Selling Price | 숫자 표시 |
| Actions | 원가이력/수정/삭제 |

- 영어(nameEn), 베트남어(nameVi) 컬럼 **미표시**
- 컬럼 표시/숨김 토글 기능 **없음**
- WMS코드 클릭 시 상세 이동 **불가**

### 2.2 Frontend — SPU 목록 페이지 (`SpuMasterListPage.tsx`)

| Column | 현황 |
|--------|------|
| SPU Code | 텍스트 표시 |
| Brand Code | 텍스트 표시 |
| **상품명** | **한국어(nameKr)만 표시** |
| Category | 텍스트 표시 |
| Active | 뱃지 표시 |
| Actions | 수정/삭제 |

- 영어(nameEn), 베트남어(nameVi) 컬럼 **미표시**

### 2.3 Backend — SKU Entity (`drd_sku_masters`)

기존 필드:
- `sku_wms_code`, `sku_spu_code`, `sku_name_kr/en/vi`
- `sku_variant_type`, `sku_variant_value` (variant 분리)
- `sku_sync_code` (외부연동용코드 ✅ 이미 존재)
- `sku_gtin_code` (GTIN ✅ 이미 존재)
- `sku_hs_code` (HS Code ✅ 이미 존재)
- `sku_description` **미존재**
- `sku_color` **미존재**

### 2.4 Frontend Type — `SkuMaster` interface

```typescript
// 현재 (sales.service.ts)
variant: string | null;          // ← 단일 필드 (backend는 variantType/variantValue 분리)
// gtinCode, hsCode, syncCode 이미 존재하나 목록에 미표시
```

**문제점**: Backend Mapper가 `variantType`/`variantValue` 분리 응답하나 Frontend type은 `variant` 단일 필드 → 불일치

### 2.5 SKU 상세 페이지

**미존재** — 현재 SKU 정보 확인은 목록+수정 모달에서만 가능

---

## 3. TO-BE 요구사항 (Target State)

### 3.1 SKU/SPU 목록 언어 컬럼 (R1)

| AS-IS | TO-BE |
|-------|-------|
| nameKr 단일 컬럼 | nameKr, nameEn, nameVi 3개 컬럼 |
| 컬럼 토글 불가 | 👁 아이콘으로 언어 컬럼 표시/숨김 |
| - | localStorage에 설정 저장 (세션 유지) |

### 3.2 SKU 상세 페이지 (R2, R3, R4)

- WMS코드 클릭 → `/sku/:skuId` 상세 페이지 이동
- **상품 기본정보**: 상품명 KR/EN/VI 각각 1라인씩
- **코드 정보**: WMS Code, SPU Code, GTIN Code, Sync Code (외부연동용), HS Code
- **가격 정보**: 원가, 공급가, 정가, 판매가
- **기타 정보**: Variant (type + value/color), 무게, 단위, Fulfillment Fee
- **상품 설명**: 텍스트 영역
- **상태**: Active/Inactive, 생성일, 수정일

### 3.3 신규 필드 (R5, R6)

| Field | DB Column | Type | 설명 |
|-------|-----------|------|------|
| 상품 설명 | `sku_description` | TEXT NULL | 상품 상세 설명 |
| 색상 | `sku_color` | VARCHAR(50) NULL | 색상 정보 |

### 3.4 Frontend Type 수정

```typescript
// SkuMaster interface 수정
variant: string | null;  →  variantType: string | null; variantValue: string | null;
// 추가
description: string | null;
color: string | null;
```

---

## 4. 갭 분석 (Gap Analysis)

| Area | Current | Change | Impact |
|------|---------|--------|--------|
| SKU Entity | 필드 없음 | `sku_description`, `sku_color` 추가 | Low |
| SKU Mapper | description/color 미포함 | 추가 | Low |
| SKU Create/Update DTO | description/color 미포함 | 추가 | Low |
| SKU Service | description/color 미처리 | 추가 | Low |
| Frontend SkuMaster type | variant 단일, description/color 없음 | 타입 수정 | Medium |
| SkuMasterListPage | nameKr만, WMS 텍스트 | 3언어+토글+링크 | Medium |
| SpuMasterListPage | nameKr만 | 3언어+토글 | Medium |
| SkuDetailPage | 미존재 | 신규 생성 | New |
| SkuFormModal | variant 단일 필드 | variantType/Value + color + description | Medium |
| App.tsx routes | /sku/:skuId 미존재 | 추가 | Low |
| i18n | 상세 관련 키 미존재 | 추가 | Low |

### DB 마이그레이션

```sql
ALTER TABLE drd_sku_masters
  ADD COLUMN sku_description TEXT NULL AFTER sku_hs_code,
  ADD COLUMN sku_color VARCHAR(50) NULL AFTER sku_description;
```

> 스테이징은 `DB_SYNC=true`이므로 자동 반영

---

## 5. 사용자 플로우 (User Flow)

### 5.1 SKU 목록 → 상세 조회

```
1. SKU 관리 페이지 진입
2. 테이블에 KR/EN/VI 상품명 컬럼 표시
3. 👁 아이콘 클릭 → EN/VI 컬럼 표시/숨김 토글
4. WMS 코드 클릭 → /sku/:skuId 상세 페이지 이동
5. 상세 페이지에서 모든 필드 확인
6. ← 뒤로가기로 목록 복귀
```

### 5.2 SPU 목록 언어 토글

```
1. SPU 관리 페이지 진입
2. 테이블에 KR/EN/VI 상품명 컬럼 표시
3. 👁 아이콘 클릭 → EN/VI 컬럼 표시/숨김 토글
```

---

## 6. 기술 제약사항 (Technical Constraints)

- DB_SYNC=true (스테이징) → TypeORM 자동 마이그레이션
- 프로덕션은 수동 ALTER TABLE 필요
- localStorage 사용으로 언어 가시성 설정 브라우저별 유지
- 기존 API 응답 구조 유지 (하위 호환)

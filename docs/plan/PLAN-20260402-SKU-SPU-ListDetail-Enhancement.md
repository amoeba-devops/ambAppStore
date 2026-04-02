# PLAN-20260402 — SKU/SPU List & Detail Enhancement
# SKU/SPU 목록 및 상세 기능 개선 작업계획서

## 1. 시스템 개발 현황 분석

### 현재 구조
- **Backend**: NestJS 11 + TypeORM 0.3.x + MySQL 8.0
- **Frontend**: React 18 + TypeScript 5 + TailwindCSS 3 + React Query 5
- **SKU Entity**: `drd_sku_masters` — 3언어 이름, variant_type/value, gtin/sync/hs code 이미 존재
- **SPU Entity**: `drd_spu_masters` — 3언어 이름 이미 존재
- **Frontend**: variant 단일 필드 타입 불일치, description/color 필드 미존재

### 제약사항
- 스테이징 DB_SYNC=true (TypeORM 자동 반영)
- 기존 API create/update 하위 호환 유지 필요
- SkuFormModal의 variant 단일 필드 → variantType/variantValue 분리 필요

---

## 2. 단계별 구현 계획

### Phase 1: Backend (Entity + DTO + Mapper + Service)

**Step 1.1**: Entity에 `sku_description`, `sku_color` 추가
- `sku-master.entity.ts`: 2개 `@Column` 추가
- └─ 사이드 임팩트: DB_SYNC=true 시 자동 컬럼 추가, 프로덕션은 수동 ALTER 필요

**Step 1.2**: Mapper에 description, color 추가
- `sku-master.mapper.ts`: toResponse에 2개 필드 추가
- └─ 사이드 임팩트: API 응답에 새 필드 추가 (하위 호환, 프론트엔드에서 무시 가능)

**Step 1.3**: Create/Update DTO에 필드 추가
- `create-sku-master.request.ts`: description, color 추가
- `update-sku-master.request.ts`: description, color 추가
- └─ 사이드 임팩트: Optional 필드이므로 기존 요청 호환

**Step 1.4**: Service에 새 필드 처리 추가
- `sku-master.service.ts`: create/update 메서드에 description, color 매핑
- └─ 사이드 임팩트: 없음

### Phase 2: Frontend Type + Service 수정

**Step 2.1**: SkuMaster 타입 수정
- `sales.service.ts`: variant → variantType/variantValue, description/color 추가
- └─ 사이드 임팩트: SkuFormModal, SkuMasterListPage에서 타입 참조 변경 필요

### Phase 3: SKU 상세 페이지 (신규)

**Step 3.1**: SkuDetailPage 생성
- `pages/SkuDetailPage.tsx`: 전체 필드 표시, KR/EN/VI 각 1라인
- └─ 사이드 임팩트: 없음

**Step 3.2**: Route 추가
- `App.tsx`: `/sku/:skuId` 라우트 추가
- └─ 사이드 임팩트: 없음

### Phase 4: SKU/SPU 목록 언어 토글

**Step 4.1**: SkuMasterListPage 개선
- 3언어 컬럼 추가 + 👁 토글 버튼 + WMS코드 클릭 링크
- localStorage로 설정 저장
- └─ 사이드 임팩트: 테이블 레이아웃 변경

**Step 4.2**: SpuMasterListPage 개선
- 3언어 컬럼 추가 + 👁 토글 버튼
- └─ 사이드 임팩트: 테이블 레이아웃 변경

### Phase 5: SkuFormModal 수정

**Step 5.1**: variant → variantType/variantValue 분리, description/color 추가
- └─ 사이드 임팩트: 수정 모달의 필드 레이아웃 변경

### Phase 6: i18n + 빌드 검증

**Step 6.1**: ko/en/vi에 새 i18n 키 추가
**Step 6.2**: tsc --noEmit 백엔드/프론트엔드 검증

---

## 3. 변경 파일 목록

| 구분 | 파일 | 변경유형 |
|------|------|---------|
| Backend | `domain/sku-master/entity/sku-master.entity.ts` | 수정 |
| Backend | `domain/sku-master/mapper/sku-master.mapper.ts` | 수정 |
| Backend | `domain/sku-master/dto/request/create-sku-master.request.ts` | 수정 |
| Backend | `domain/sku-master/dto/request/update-sku-master.request.ts` | 수정 |
| Backend | `domain/sku-master/sku-master.service.ts` | 수정 |
| Frontend | `services/sales.service.ts` | 수정 |
| Frontend | `pages/SkuDetailPage.tsx` | 신규 |
| Frontend | `pages/SkuMasterListPage.tsx` | 수정 |
| Frontend | `pages/SpuMasterListPage.tsx` | 수정 |
| Frontend | `App.tsx` | 수정 |
| i18n | `locales/ko/sales.json` | 수정 |
| i18n | `locales/en/sales.json` | 수정 |
| i18n | `locales/vi/sales.json` | 수정 |

---

## 4. 사이드 임팩트 분석

| 범위 | 위험도 | 설명 |
|------|--------|------|
| DB Schema | Low | 2개 nullable 컬럼 추가, 기존 데이터 영향 없음 |
| API Response | Low | 2개 필드 추가 (하위 호환) |
| SKU Form | Medium | variant 입력 방식 변경 (단일→분리), description/color 추가 |
| SKU/SPU List | Medium | 테이블 컬럼 구조 변경 (3언어 표시) |
| 기존 데이터 | None | 새 필드 모두 nullable, 기존 데이터 영향 없음 |

---

## 5. DB 마이그레이션

```sql
-- 스테이징: DB_SYNC=true → 자동
-- 프로덕션: 수동 실행
ALTER TABLE drd_sku_masters
  ADD COLUMN sku_description TEXT NULL AFTER sku_hs_code,
  ADD COLUMN sku_color VARCHAR(50) NULL AFTER sku_description;
```

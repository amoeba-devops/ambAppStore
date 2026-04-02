# PLAN-20260402 — Sales Order Excel Upload (판매 데이터 엑셀 업로드)

| 항목 | 내용 |
|------|------|
| 문서 ID | PLAN-20260402-SalesOrder-ExcelUpload |
| 작성일 | 2026-04-02 |
| 요구사항 | REQ-20260402-SalesOrder-ExcelUpload |

---

## 1. 시스템 개발 현황 분석

- Backend: RawOrderEntity / RawOrderItemEntity 존재, Controller/Service 없음
- Frontend: 4개 라우트, 업로드 페이지 없음
- DB: Shopee 3,600건 이미 임포트, TikTok 미임포트

---

## 2. 단계별 구현 계획

### Phase A: TikTok Seed 데이터 임포트

**Step A-1**: generate-tiktok-order-seed.py 작성
- TikTok 엑셀(54col) → drd_raw_orders + drd_raw_order_items SQL 생성
- Row 2 스킵, SKU 매칭, 상태 정규화
- └─ 사이드 임팩트: 없음 (독립 스크립트)

**Step A-2**: 스테이징 DB 임포트 및 검증
- └─ 사이드 임팩트: drd_raw_orders에 TIKTOK 채널 데이터 추가

### Phase B: Backend 엑셀 업로드 API

**Step B-1**: exceljs 패키지 설치 + multer 설정
- └─ 사이드 임팩트: package.json 의존성 추가

**Step B-2**: Excel Parser 인터페이스 + 구현
- `parser/excel-parser.interface.ts` — 공통 인터페이스
- `parser/shopee-excel.parser.ts` — Shopee 68-col 파서
- `parser/tiktok-excel.parser.ts` — TikTok 54-col 파서
- └─ 사이드 임팩트: 없음 (신규 파일)

**Step B-3**: RawOrder Service 구현
- SKU 매칭 로직 (sku_wms_code lookup)
- 중복 주문 처리 (UPSERT or skip)
- 트랜잭션 처리
- └─ 사이드 임팩트: raw-order.module.ts에 SkuMaster 의존성 추가

**Step B-4**: RawOrder Controller 구현
- `POST /v1/raw-orders/upload` (multipart)
- └─ 사이드 임팩트: 없음 (신규 엔드포인트)

### Phase C: Frontend 업로드 페이지

**Step C-1**: OrderUploadPage 컴포넌트 생성
- 채널 선택 드롭다운
- 파일 업로드 영역 (drag & drop)
- 업로드 결과 표시
- └─ 사이드 임팩트: 없음 (신규 파일)

**Step C-2**: API 서비스 + React Query 훅
- └─ 사이드 임팩트: 없음

**Step C-3**: 라우트 + 사이드바 메뉴 추가
- App.tsx에 `/upload` 라우트 추가
- AppLayout.tsx 사이드바에 업로드 메뉴 추가
- └─ 사이드 임팩트: App.tsx, AppLayout.tsx 수정

**Step C-4**: i18n 번역 키 추가 (ko/en/vi)
- └─ 사이드 임팩트: sales.json 3개 파일 수정

---

## 3. 변경 파일 목록

| 구분 | 파일 | 변경유형 |
|------|------|---------|
| Backend | `apps/app-sales-report/backend/package.json` | 수정 (exceljs, multer) |
| Backend | `apps/app-sales-report/backend/src/domain/raw-order/parser/excel-parser.interface.ts` | 신규 |
| Backend | `apps/app-sales-report/backend/src/domain/raw-order/parser/shopee-excel.parser.ts` | 신규 |
| Backend | `apps/app-sales-report/backend/src/domain/raw-order/parser/tiktok-excel.parser.ts` | 신규 |
| Backend | `apps/app-sales-report/backend/src/domain/raw-order/service/raw-order.service.ts` | 신규 |
| Backend | `apps/app-sales-report/backend/src/domain/raw-order/controller/raw-order.controller.ts` | 신규 |
| Backend | `apps/app-sales-report/backend/src/domain/raw-order/dto/request/upload-order.request.ts` | 신규 |
| Backend | `apps/app-sales-report/backend/src/domain/raw-order/dto/response/upload-result.response.ts` | 신규 |
| Backend | `apps/app-sales-report/backend/src/domain/raw-order/raw-order.module.ts` | 수정 |
| Script | `apps/app-sales-report/generate-tiktok-order-seed.py` | 신규 |
| Frontend | `apps/app-sales-report/frontend/src/pages/OrderUploadPage.tsx` | 신규 |
| Frontend | `apps/app-sales-report/frontend/src/App.tsx` | 수정 |
| Frontend | `apps/app-sales-report/frontend/src/components/layout/AppLayout.tsx` | 수정 |
| i18n | `apps/app-sales-report/frontend/src/i18n/locales/{ko,en,vi}/sales.json` | 수정 |

---

## 4. 사이드 임팩트 분석

| 범위 | 위험도 | 설명 |
|------|--------|------|
| drd_raw_orders 테이블 | 🟢 Low | 기존 Shopee 데이터 영향 없음 (chn_code=TIKTOK으로 분리) |
| RawOrderModule 의존성 | 🟢 Low | SkuMasterModule import 추가 |
| Frontend 라우트 | 🟢 Low | 기존 라우트 영향 없음 |

---

## 5. DB 마이그레이션

- 스키마 변경 없음 (기존 테이블 활용)
- TikTok 데이터 INSERT만 수행

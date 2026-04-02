# SB Data & Reporting System — Screen Specification (화면기획서)

---
```
document_id : DRD-SCR-2026-001
version     : 3.0.0
status      : Draft
created     : 2026-04-02
updated     : 2026-04-02
author      : Amoeba Company
change_log  :
  - version: 1.0.0 / 2.0.0 — 초기 작성 및 기존 화면 정의
  - version: 3.0.0
    date: 2026-04-02
    description: |
      DRD-ERD-2026-001 v2.0 반영
      - SCR-11: SPU Master 관리 화면 신규
      - SCR-12: SKU Master 관리 화면 신규 (MasterProductItemCode, 4단계 가격, 이력 탭)
      - SCR-13: 채널 상품 매핑 관리 화면 신규
      - SCR-02 상품별 상세: WMS Code / SPU Code / Variant 컬럼 추가
      - SCR-05 원가 관리: listing_price / selling_price / supply_price 필드 추가
      - 사이드바: 상품 마스터 메뉴 그룹 추가
      - 화면 맵 업데이트 (SCR-11~13 추가)
```
---

## 1. Overview (개요)

- **System**: SB Data & Reporting System
- **Project Code**: DRD
- **Framework**: React 18 + TypeScript + TailwindCSS
- **Design Token**: Primary `#6366F1` · Font: Pretendard · Header: 64px · Sidebar: 240px
- **Base URL**: `apps.amoeba.site/app-daily-report`
- **Reference**: DRD-FDS-2026-001 v3.0

---

## 2. Screen Map (화면 구성도 v3.0)

```
/app-daily-report/
│
├── /dashboard                     SCR-01  메인 대시보드 (KPI 카드)
│    ├── Modal: KPI 상세            SCR-01-M1
│    └── Panel: 7일 트렌드          SCR-01-P1
│
├── /product-breakdown             SCR-02  상품별 CM 상세 ← v3.0 컬럼 추가
│    └── Drawer: 상품 드릴다운      SCR-02-D1
│
├── /manual-input                  SCR-03  수동 비용 입력
│
├── /settings/
│    ├── /exchange-rate            SCR-04  환율 설정
│    └── /prime-cost               SCR-05  원가 관리 ← v3.0 가격 필드 확장
│
├── /alerts                        SCR-06  알림 센터
│
├── /weekly                        SCR-07  Weekly CM 리포트
├── /monthly                       SCR-08  Monthly CM 리포트
├── /livestream                    SCR-09  Livestream 리포트
├── /creator-outreach              SCR-10  Creator Outreach (TikTok)
│
├── /product-master/               ← v3.0 신규 메뉴 그룹
│    ├── /spu                      SCR-11  SPU Master 관리 ← v3.0 신규
│    ├── /sku                      SCR-12  SKU Master 관리 ← v3.0 신규
│    └── /channel-mapping          SCR-13  채널 상품 매핑 관리 ← v3.0 신규
```

---

## 3. Global Layout (공통 레이아웃 v3.0)

```
┌──────────────────────────────────────────────────────────────────┐
│  Header (64px)                                                   │
│  [≡] Daily Report Dashboard          [🔔 알림] [프로필] [설정]  │
├───────────────┬──────────────────────────────────────────────────┤
│  Sidebar      │  Content Area                                    │
│  (240px)      │                                                  │
│               │                                                  │
│  📊 대시보드   │                                                  │
│  📦 상품별     │                                                  │
│  📅 Weekly CM │                                                  │
│  📅 Monthly   │                                                  │
│  🎬 Livestream│                                                  │
│  👤 Creator   │                                                  │
│  ✏️ 수동 입력  │                                                  │
│               │                                                  │
│  ── 상품 마스터 ──  ← v3.0 신규 그룹                             │
│  🏷️ SPU 관리   │                                                  │
│  📋 SKU 관리   │                                                  │
│  🔗 채널 매핑  │                                                  │
│               │                                                  │
│  ⚙️ 설정       │                                                  │
│  🔔 알림       │                                                  │
└───────────────┴──────────────────────────────────────────────────┘
```

---

## 4. 기존 화면 업데이트 (v3.0)

---

### SCR-02: 상품별 CM 상세 (v3.0 컬럼 추가)

**URL**: `/product-breakdown`  
**Reference FN**: FN-07, FN-08  
**변경**: WMS Code / SPU Code / Variant 컬럼 추가

#### 4.1.1 Product Breakdown Table (v3.0 컬럼 구성)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [날짜 피커]  [채널 필터]  [🔍 WMS Code / 상품명 검색]  [📥 내보내기]        │
├──────────┬────────┬──────────────┬──────────────┬──────────┬──────┬────┬───┤
│WMS Code  │SPU Code│상품명(KR)    │Variant       │Net GMV   │CM    │CM% │상태│
├──────────┼────────┼──────────────┼──────────────┼──────────┼──────┼────┼───┤
│SAFG18U.. │SAFG18U │이중밀폐큐브4구│Pastel Pink   │58.2M     │24.3M │41.8│✅  │
│SAFG47U.. │SAFG47U │안심실리콘스푼1│Dry Rose      │32.1M     │13.7M │42.7│✅  │
│SAFG47U.. │SAFG47U │안심실리콘스푼2│Beige         │21.4M     │ *8.9M│41.6│⚠   │
└──────────┴────────┴──────────────┴──────────────┴──────────┴──────┴────┴───┘
```

전체 컬럼 (확장 뷰):

| 컬럼 | DB 출처 | 비고 |
|------|--------|------|
| WMS Code | `sku_wms_code` | 클릭 → SCR-12 SKU 상세 링크 |
| SPU Code | `sku_spu_code` | 클릭 → SCR-11 SPU 상세 링크 |
| 상품명 (KR) | `sku_name_kr` | |
| 상품명 (EN) | `sku_name_en` | |
| 상품명 (VI) | `sku_name_vi` | |
| Variant | `sku_variant_value` | |
| Channel | `chn_code` | |
| Items Sold | `prd_items_sold` | |
| Net GMV | `prd_net_gmv` | |
| NMV | `prd_nmv` | |
| Seller Discount | `prd_seller_discount` | 확정 |
| `*` Seller Voucher | `prd_seller_voucher` | 추정 (노란 배경) |
| AD Spend | `prd_ad_spend` | |
| Prime Cost | `prd_prime_cost_total` | sku_prime_cost × qty |
| Fulfillment | `prd_fulfillment_fee` | override or default |
| Platform Fee | `prd_platform_fee` | |
| **CM** | `prd_cm` | 음수 시 빨간 |
| **CM%** | `prd_cm_pct` | |
| 상태 | `prd_cm_status` | ✅/⚠/❗/🔴 |

#### 4.1.2 CM Status 표시

| `prd_cm_status` | 아이콘 | 색상 |
|----------------|--------|------|
| `NORMAL` | ✅ | 기본 |
| `NEGATIVE` | 🔴 | 빨간 강조 |
| `SKU_UNMAPPED` | ❗ | 빨간 경고 |
| `PRIME_COST_MISSING` | ⚠ | 주황 경고 |
| `INCOMPLETE` | ⚠ | 주황 |

---

### SCR-05: 원가 관리 (v3.0 가격 필드 확장)

**URL**: `/settings/prime-cost` → `/settings/sku-cost`  
**Reference FN**: FN-07, FN-19  
**변경**: prime_cost 단일 → 4단계 가격 구조

#### 4.2.1 Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ SKU 원가 관리              [+ SKU 추가]  [📥 일괄업로드]  [📤 템플릿]│
├──────────────────────────────────────────────────────────────────────┤
│ [🔍 WMS Code / 상품명 검색]  [SPU Code ▼]  [채널 ▼]                 │
├──────────┬────────┬────────┬──────────┬──────────┬──────────┬───────┤
│WMS Code  │Variant │매입원가 │  공급가   │ 등록정가  │ 실판매가  │최종수정│
├──────────┼────────┼────────┼──────────┼──────────┼──────────┼───────┤
│SAFG47U.. │Dry Rose│ 65,000 │ 153,000  │ 235,000  │ 153,000  │03-15  │
│SAFG18U.. │Pastel P│❗미입력  │    —     │    —     │    —     │  —    │
└──────────┴────────┴────────┴──────────┴──────────┴──────────┴───────┘
```

#### 4.2.2 인라인 편집 필드

| 필드 | DB 컬럼 | 규칙 |
|------|--------|------|
| 매입원가 (VND) | `sku_prime_cost` | > 0, 필수 |
| 공급가 (VND) | `sku_supply_price` | ≥ 0, 선택 |
| 등록 정가 (VND) | `sku_listing_price` | ≥ 0, 선택 |
| 실판매가 (VND) | `sku_selling_price` | ≥ 0, 선택 |
| Fulfillment Override | `sku_fulfillment_fee_override` | NULL = 채널 기본값 |

가격 수정 시 → `drd_sku_cost_histories` 자동 INSERT (이력 보존).

#### 4.2.3 이력 보기

SKU 행 클릭 → 우측 슬라이드 패널에 `drd_sku_cost_histories` 이력 표시  
(`sch_effective_date` 내림차순, 변경 사유 포함)

---

## 5. 신규 화면 (v3.0)

---

### SCR-11: SPU Master 관리

**URL**: `/product-master/spu`  
**Reference FN**: FN-18  
**Access**: 시스템 관리자, 운영팀

#### 5.1.1 Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ SPU Master 관리              [+ SPU 등록]  [📥 일괄업로드]          │
├──────────────────────────────────────────────────────────────────────┤
│ [🔍 SPU Code / 상품명 검색]  [브랜드 ▼]  [활성만 보기 □]            │
├────────┬────────────┬──────────────┬──────────────┬────────┬────────┤
│SPU Code│브랜드/서브 │상품명(KR)    │상품명(EN)    │SKU 수  │상태    │
├────────┼────────────┼──────────────┼──────────────┼────────┼────────┤
│SAFG18U │SB / Firgi  │이중밀폐 이유식큐브│Dual Lock Slim│ 17개   │✅ 활성 │
│SAFG47U │SB / Firgi  │안심 실리콘 스푼│Safe Silicone  │  6개   │✅ 활성 │
│SALC32U │SB / Little │곰돌이 흡착볼  │Bear Suction   │  2개   │✅ 활성 │
└────────┴────────────┴──────────────┴──────────────┴────────┴────────┘
```

#### 5.1.2 SPU 등록/수정 폼

| 필드 | DB 컬럼 | 필수 | 비고 |
|------|--------|:---:|------|
| SPU Code | `spu_code` | ✅ | 7자, 변경 불가 (등록 후) |
| 브랜드 코드 | `spu_brand_code` | ✅ | SB / MB 등 |
| 서브 브랜드 | `spu_sub_brand` | — | Firgi / LittleCloud |
| 상품명 (KR) | `spu_name_kr` | ✅ | |
| 상품명 (EN) | `spu_name_en` | ✅ | |
| 상품명 (VI) | `spu_name_vi` | ✅ | |
| 카테고리 코드 | `spu_category_code` | — | |

#### 5.1.3 Business Rules

- 하위 SKU 존재 시 Soft Delete 불가 → 오류 메시지 표시
- SPU Code는 WMS Code 입력 시 앞 7자리로 자동 도출 제안

---

### SCR-12: SKU Master 관리 (품목 관리)

**URL**: `/product-master/sku`  
**Reference FN**: FN-17, FN-19, FN-21  
**Access**: 시스템 관리자, 운영팀, Finance

#### 5.2.1 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SKU Master 관리    [+ SKU 등록]  [📥 일괄업로드]  [📤 템플릿 다운로드]  │
├─────────────────────────────────────────────────────────────────────────┤
│ [🔍 WMS Code / 상품명]  [SPU Code ▼]  [브랜드 ▼]  [활성만 □]           │
│                                                                         │
│  ⓘ 노란 셀은 미입력 가격 항목입니다. 클릭하여 입력하세요.              │
├──────────┬────────┬──────────────┬──────────┬──────────┬──────────┬──-─┤
│WMS Code  │Variant │상품명(KR)    │매입원가  │ 등록정가  │ 실판매가  │상태│
│          │        │              │(VND)     │  (VND)   │  (VND)   │    │
├──────────┼────────┼──────────────┼──────────┼──────────┼──────────┼────┤
│SAFG18U008│Pastel P│이중밀폐큐브4구│  65,000  │ 235,000  │ 153,000  │✅  │
│SAFG47U003│Dry Rose│안심스푼1호   │  65,000  │ 235,000  │ 153,000  │✅  │
│SAFG27U001│Bear PP │동물이유식스푼 │❗미입력   │    —     │    —     │⚠   │
└──────────┴────────┴──────────────┴──────────┴──────────┴──────────┴────┘
```

#### 5.2.2 SKU 상세 / 수정 드로어

SKU 행 클릭 → 우측 드로어 표시:

```
┌────────────────────────────────────────────────────────┐
│ SKU 상세                               [수정] [삭제] [×]│
├────────────────────────────────────────────────────────┤
│ WMS Code    SAFG47U0003                                │
│ SPU Code    SAFG47U  [→ SPU 상세 이동]                 │
│ sku_id      550e8400-e29b-41d4-a716-...  [복사]        │
│                                                        │
│ [기본 정보]                                             │
│ 상품명 (KR)  안심 실리콘 이유식 스푼 1호                │
│ 상품명 (EN)  Safe Silicone Baby Feeding Spoons Step 1  │
│ 상품명 (VI)  Muỗng ăn dặm bé tự chỉ huy silicone số 1 │
│ Variant     Dry Rose (Color)                           │
│ GTIN        8809123456789                              │
│ HS Code     3924.90                                    │
│ Sync Code   —                                          │
│                                                        │
│ [가격 정보]  ────────────────────────────── [이력 보기]│
│ 매입원가    65,000 VND  (₩2,815)                       │
│ 공급가      153,000 VND (₩6,630)                       │
│ 등록 정가   235,000 VND (₩10,181)  ← GMV 기준          │
│ 실판매가    153,000 VND (₩6,630)   ← Net GMV 기준       │
│ Fulfillment Override  — (채널 기본값 14,000 VND 적용)   │
│                                                        │
│ [채널 매핑]  ────────────────────────────── [매핑 추가]│
│ Shopee  / 채널ID: 44409... / Variation: 243646...      │
│ TikTok  / 채널ID: 17314... / Variation: 173372...      │
│                                                        │
│ [가격 이력] ← 탭                                        │
│ 2025-07-08  매입원가 65,000  등록정가 235,000           │
│ 2025-03-01  매입원가 60,000  (기존값)                   │
└────────────────────────────────────────────────────────┘
```

#### 5.2.3 일괄 업로드 (FN-17)

```
┌────────────────────────────────────────────────────────┐
│ SKU Master 일괄 업로드                          [×]    │
├────────────────────────────────────────────────────────┤
│  Step 1. 파일 선택                                      │
│  [📁 Excel / CSV 파일 선택]  또는 [📤 템플릿 다운로드] │
│                                                        │
│  Step 2. 컬럼 매핑 확인                                 │
│  파일 헤더      →  시스템 필드                          │
│  "WMS Code"    →  sku_wms_code       ✅               │
│  "상품명(KR)"  →  sku_name_kr        ✅               │
│  "Prime Cost"  →  sku_prime_cost     ✅               │
│  "List Price"  →  sku_listing_price  ✅               │
│                                                        │
│  Step 3. 검증 결과  (총 145건)                          │
│  ✅ 정상: 140건  ❌ 오류: 3건  ⚠ 경고: 2건             │
│  [오류 목록 보기]                                       │
│  중복 처리: [덮어쓰기 ●] / [건너뛰기 ○]               │
│                                                        │
│  [취소]                               [업로드 실행]   │
└────────────────────────────────────────────────────────┘
```

---

### SCR-13: 채널 상품 매핑 관리

**URL**: `/product-master/channel-mapping`  
**Reference FN**: FN-20  
**Access**: 시스템 관리자, 운영팀

#### 5.3.1 Layout (SKU 중심 뷰)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 채널 상품 매핑 관리    [+ 매핑 추가]  [📥 CSV 일괄업로드]            │
├──────────────────────────────────────────────────────────────────────┤
│ [🔍 WMS Code / 채널 상품 ID 검색]  [채널 ▼]  [미매핑 SKU만 □]       │
│                                                                      │
│  ⚠ 미매핑 SKU: 3개 (CM 산출 불가) [미매핑 목록 보기]               │
│                                                                      │
├──────────┬────────────┬────────────────────┬──────────────┬──-───┤
│WMS Code  │상품명(KR)  │채널                │채널 상품 ID  │상태  │
├──────────┼────────────┼────────────────────┼──────────────┼──────┤
│SAFG47U.. │안심스푼1호 │✅ Shopee           │44409304528   │✅    │
│          │            │✅ TikTok Shop      │173143212...  │✅    │
│SAFG18U.. │이유식큐브4 │✅ Shopee           │26373395973   │✅    │
│          │            │❌ TikTok 미매핑    │      —       │⚠    │
│SAFG27U.. │동물이유식  │❌ Shopee 미매핑    │      —       │❗    │
│          │            │❌ TikTok 미매핑    │      —       │❗    │
└──────────┴────────────┴────────────────────┴──────────────┴──────┘
```

#### 5.3.2 매핑 등록 폼

| 필드 | DB 컬럼 | 필수 | 비고 |
|------|--------|:---:|------|
| SKU (WMS Code) | `sku_wms_code` → `sku_id` | ✅ | 검색 선택 |
| 채널 | `chn_code` | ✅ | SHOPEE / TIKTOK 등 |
| 채널 상품 ID | `cpm_channel_product_id` | — | |
| 채널 옵션 ID | `cpm_channel_variation_id` | — | TikTok: 18자리 VARCHAR |
| 채널 등록명 (VI) | `cpm_channel_name_vi` | — | |
| 채널 정가 | `cpm_listing_price` | — | |
| 채널 판매가 | `cpm_selling_price` | — | |

#### 5.3.3 미매핑 SKU 알림 배너

```
┌────────────────────────────────────────────────────────────────────┐
│ ⚠ 미매핑 SKU 3개에서 판매가 발생했습니다.                          │
│ 해당 SKU의 CM을 산출할 수 없습니다. 채널 매핑을 등록해 주세요.     │
│ [미매핑 SKU 보기]                                    [닫기]        │
└────────────────────────────────────────────────────────────────────┘
```

#### 5.3.4 CSV 일괄 업로드

| 헤더 | 설명 |
|------|------|
| WMS Code | SKU 식별자 |
| Channel | SHOPEE / TIKTOK |
| Channel Product ID | 채널 상품 ID (VARCHAR) |
| Channel Variation ID | 채널 옵션 ID (VARCHAR) |
| Channel Name (VI) | 채널 등록 베트남어명 |

---

## 6. Component Spec Update (컴포넌트 변경)

### 6.1 상품 ID 표시 규칙

| 화면 | 표시 컬럼 | 설명 |
|------|---------|------|
| SCR-02 상품별 | WMS Code (클릭 → SCR-12 이동) | 기존 Product ID 대체 |
| SCR-12 SKU Master | WMS Code / SPU Code / sku_id | 전체 식별자 표시 |
| SCR-13 채널 매핑 | WMS Code + 채널 상품 ID | 양방향 표시 |

### 6.2 가격 표시 (SCR-12 / SCR-05)

| 표시 항목 | DB 컬럼 | 비고 |
|----------|--------|------|
| 매입원가 | `sku_prime_cost` | 필수 (미입력 시 ❗) |
| 공급가 | `sku_supply_price` | 선택 |
| 등록 정가 | `sku_listing_price` | GMV 기준 표시 |
| 실판매가 | `sku_selling_price` | Net GMV 기준 표시 |
| Fulfillment Override | `sku_fulfillment_fee_override` | NULL = 채널 기본값 (14,000) |

### 6.3 추정값 표시 (기존 규칙 유지)

| 항목 | 표시 방법 |
|------|----------|
| 배분 추정값 | 노란 배경 (#FEF9C3) + `*` 접두 |
| 수동 미입력 | "-" + ⚠ 아이콘 (주황) |
| SKU 미매핑 | ❗ 아이콘 + `SKU_UNMAPPED` 뱃지 |
| 원가 미입력 | ❗ 아이콘 + `PRIME_COST_MISSING` |
| CM 음수 | 빨간색 강조 |

---

## 7. Permission Matrix (권한 매트릭스 v3.0)

| 화면 | P-01 운영팀 | P-02 분석팀 | P-03 브랜드매니저 | P-04 시스템관리자 |
|------|:-----------:|:-----------:|:----------------:|:---------------:|
| SCR-01 대시보드 | ✅ | ✅ | ✅ | ✅ |
| SCR-02 상품별 상세 | ✅ | ✅ | ✅ | ✅ |
| SCR-03 수동 입력 | ✅ (입력) | ✅ (조회) | ❌ | ✅ |
| SCR-04 환율 설정 | ❌ | ✅ | ❌ | ✅ |
| SCR-05 원가 관리 | ✅ | ✅ | ❌ | ✅ |
| SCR-06 알림 센터 | ✅ | ✅ | ❌ | ✅ |
| SCR-07 Weekly CM | ✅ | ✅ | ✅ | ✅ |
| SCR-08 Monthly CM | ✅ | ✅ | ✅ | ✅ |
| SCR-09 Livestream | ✅ | ✅ | ✅ | ✅ |
| SCR-10 Creator Outreach | ✅ | ✅ | ❌ | ✅ |
| **SCR-11 SPU Master** | ✅ (등록/수정) | ✅ (조회) | ❌ | ✅ |
| **SCR-12 SKU Master** | ✅ (가격 수정) | ✅ (조회) | ❌ | ✅ |
| **SCR-13 채널 매핑** | ✅ (등록/수정) | ✅ (조회) | ❌ | ✅ |
| 내보내기 | ✅ | ✅ | ✅ | ✅ |

---

## 8. Traceability Matrix (추적성 매트릭스)

| SCR ID | 화면명 | FN | SCN |
|--------|--------|-----|-----|
| SCR-01 | 메인 대시보드 | FN-02, FN-05, FN-09, FN-11 | SCN-01, SCN-05, SCN-07, SCN-08 |
| SCR-02 | 상품별 CM 상세 (v3.0 컬럼 추가) | FN-07, FN-08 | SCN-04 |
| SCR-03 | 수동 비용 입력 | FN-03, FN-04 | SCN-02 |
| SCR-04 | 환율 설정 | FN-06 | SCN-03 |
| SCR-05 | 원가 관리 (v3.0 가격 확장) | FN-07, FN-19, FN-21 | SCN-01, SCN-04 |
| SCR-06 | 알림 센터 | FN-10 | SCN-06 |
| SCR-07 | Weekly CM 리포트 | FN-12 | SCN-01 |
| SCR-08 | Monthly CM 리포트 | FN-13 | SCN-01 |
| SCR-09 | Livestream 리포트 | FN-15 | SCN-01 |
| SCR-10 | Creator Outreach | FN-16 | SCN-02 |
| **SCR-11** | **SPU Master 관리** | **FN-18** | SCN-02 |
| **SCR-12** | **SKU Master 관리** | **FN-17, FN-19, FN-21** | SCN-02, SCN-04 |
| **SCR-13** | **채널 상품 매핑 관리** | **FN-20** | SCN-02 |

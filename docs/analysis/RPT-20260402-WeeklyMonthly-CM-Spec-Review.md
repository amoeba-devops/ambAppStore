# Weekly CM & Monthly CM — 기능 및 화면구성안 검토 리포트

> **작성일**: 2026-04-02  
> **대상**: FN-12 (Weekly CM), FN-13 (Monthly CM)  
> **참조 문서**: DRD-FDS-2026-001_functional-definition-v3.md, DRD-REQ-2026-001_requirements_v3.md, DRD-SCR-2026-001_screen-spec-v3.md, Shopee/TikTok Weekly_Monthly Report Excel

---

## 1. CM (Contribution Margin) 산출 공식 — FN-07

기획서 FN-07에서 정의된 공헌이익(CM) 계산 공식:

```
CM = Gross Revenue
   − (SKU Prime Cost × Items Sold)        ← drd_sku_masters.sku_prime_cost
   − Import Logistics Cost                 ← drd_logistics_costs
   − Fulfillment Fee × Items Sold          ← Override or Default (14,000₫)
   − Platform Commission                   ← chn_default_platform_fee_rate
   − AD Spending                           ← Ads API or Manual
   − Affiliate Commission                  ← NMV 배분
   − Affiliate Booking Fee                 ← NMV 배분, 수동 (추정)
   − Host Livestream Fee                   ← NMV 배분, 수동 (추정)
   − Seller Voucher                        ← NMV 배분 (추정)
   − Seller Discount                       ← 확정값
   − Free Gift                             ← 확정값
   ─────────────────────────────────
 = Contribution Margin (CM)

CM% = CM ÷ Gross Revenue × 100
```

### CM Status 분류

| Status | 조건 |
|--------|------|
| `NORMAL` | 정상 산출 |
| `NEGATIVE` | CM < 0 → CRITICAL 알림 |
| `SKU_UNMAPPED` | 채널 매핑 미등록 |
| `PRIME_COST_MISSING` | sku_prime_cost = 0 or NULL |
| `INCOMPLETE` | 기타 누락 |

---

## 2. 기획서 정의 — FN-12 / FN-13

### 2.1 FN-12: Weekly CM 리포트

| 항목 | 내용 |
|------|------|
| **FR ID** | FR-12 |
| **Priority** | **P0** (Phase 1) |
| **주기** | 주간 (월~일, 직전 주) |
| **생성 시점** | 다음 주 월요일 자동 |
| **핵심 KPI** | CM, Prime Cost, Platform Fee, Affiliate, Discount |
| **화면** | SCR-07 (`/weekly-cm`) |
| **API** | `GET /api/drd/weekly` |

### 2.2 FN-13: Monthly CM 리포트

| 항목 | 내용 |
|------|------|
| **FR ID** | FR-13 |
| **Priority** | **P1** (Phase 2) |
| **주기** | 월간 (1개월, 전월) |
| **생성 시점** | 익월 1일 자동 |
| **핵심 KPI** | CM + **전월 대비 변동 (MoM)** |
| **화면** | SCR-08 (`/monthly-cm`) |
| **API** | `GET /api/drd/monthly` |

---

## 3. 실제 Excel 데이터 구조 분석

### 3.1 Shopee Weekly CM 시트 구조

**시트명**: 날짜 범위 (예: `03.20 - 03.26`, `03.13 - 03.19`, ...)

| Row | 내용 |
|-----|------|
| Row 1 | 빈 행 |
| Row 2 | **Summary % (컬럼별 비율)** — CM%, Prime Cost%, AD%, Fee%, Voucher%, Livestream%, FreeGift%, Affiliates% 등 |
| Row 3 | **Summary Total (절대값)** — `{N} Orders`, 총 PV, CR, Items Sold, GMV, Net GMV/Discount, NMV, Prime Cost, AD, Fee, Voucher, Livestream, FreeGift, Affiliates Booking, Commission |
| Row 4 | **HEADER** (컬럼명) |
| Row 5+ | **제품별 데이터** |

**Shopee Weekly 컬럼 (48개):**

| # | 컬럼명 (영어) | 컬럼명 (한국어) | 설명 |
|---|---------------|----------------|------|
| 1 | NO. | - | 순번 |
| 2 | Product ID | - | Shopee 상품 ID |
| 3 | Product Name (VE) | - | 베트남어 상품명 |
| 4 | Product Name (EN) | - | 영어 상품명 |
| 5 | PV | - | Page Views |
| 6 | CR | - | Conversion Rate |
| 7 | Items Sold | 판매량 | 판매 수량 |
| 8 | GMV | 판매액 | 총 매출 |
| 9 | Net GMV | - | 순매출 (3월 시트) / Discount (2월 시트) |
| 10 | Seller Discount | 할인액 | 셀러 할인(3월) / NMV(2월) |
| 11 | NMV | 순결제액 | Net Merchandise Value |
| 12 | Prime Cost | 상품원가 | 제품 원가 |
| 13 | AD Spending | 광고비 | 광고 비용 |
| 14 | Fee | 수수료 | 플랫폼 수수료 |
| 15 | Seller Vouchers | - | 셀러 바우처 |
| 16 | Host Livestream | - | 라이브스트림 비용 |
| 17 | FreeGIFT | - | 무료 증정 비용 |
| 18 | Affiliates Booking | - | 어필리에이트 부킹비 |
| 19 | Affiliates Commission | - | 어필리에이트 수수료 |
| 20 | **Contribution Margin** | **공헌이익** | **CM 계산 결과** |
| 21-48 | (추가 28개 컬럼) | - | 상세 비용 분해, SKU별 breakdown 등 |

**참고**: 3월 시트(최신)에서 **Net GMV** 컬럼이 추가되고, 이전 시트에서는 **Discount** 컬럼이 사용됨 (시간에 따라 컬럼 구조가 약간 변경됨)

### 3.2 Shopee Monthly CM 시트 구조

**시트명**: 월 이름 (예: `FEBRUARY`, `JANUARY`)

| Row | 내용 |
|-----|------|
| Row 2 | Summary % (비율) |
| Row 3 | Summary Total — `{N} Orders`, aggregated KPIs |
| Row 4 | HEADER |
| Row 5+ | 제품별 데이터 |

**Monthly 컬럼** (Weekly와 동일한 구조, 47개):
- Weekly 대비 **Net GMV → Discount** 컬럼 차이만 존재
- CM (Contribution Margin) 컬럼 포함

**Summary Row 데이터 예시** (FEBRUARY):
```
1567 Orders | PV: 60,990 | CR: 3.53% | Items: 2,153
GMV: 657,129,000₫ | Discount: 55,383,005₫ | NMV: 602,204,995₫
Prime Cost: 201,600,800₫ | AD: 21,764,430₫ | Fee: 154,400,564₫
Voucher: 6,187,350₫ | Livestream: 920,000₫ | Affiliates: 7,960,200₫
```

### 3.3 TikTok Weekly CM 시트 구조

**시트명**: 주차명 (예: `Mar W4 (20-26.3)`, `Feb W4 (20-26.2)`, ...)

| Row | 내용 |
|-----|------|
| Row 1 | 기간 레이블 + Summary % |
| Row 2 | Summary Total — `{N} Orders`, aggregated KPIs |
| Row 3 | HEADER |
| Row 4+ | 제품별 데이터 |

**TikTok Weekly 컬럼 (44개):**

| # | 컬럼명 (영어) | 컬럼명 (한국어) | 설명 |
|---|---------------|----------------|------|
| 1 | NO. | - | 순번 |
| 2 | Product ID | - | TikTok 상품 ID |
| 3 | Product Name (VE) | - | 베트남어 상품명 |
| 4 | Product Name (EN) | - | 영어 상품명 |
| 5 | Impression | - | 노출 수 |
| 6 | PV | - | Page Views |
| 7 | Visitors | - | 방문자 수 |
| 8 | AOV | - | Average Order Value |
| 9 | CR | - | Conversion Rate |
| 10 | **CM** | **공헌이익** | **Contribution Margin (TikTok은 앞 열)** |
| 11 | Items Sold | 판매량 | 판매 수량 |
| 12 | GMV | 판매액 | 총 매출 |
| 13 | Net GMV | - | 순매출 |
| 14 | Seller Discount | - | 셀러 할인 |
| 15 | NMV | 순결제액 | Net Merchandise Value |
| 16 | Total Ad | - | 총 광고비 |
| 17 | Product GMV Max | - | 상품광고 GMV 최대 |
| 18 | Live GMV Max | - | 라이브 GMV 최대 |
| 19 | Platform Fee | - | 플랫폼 수수료 |
| 20 | Prime Cost | 상품원가 | 제품 원가 |
| 21-44 | (추가 25개 컬럼) | - | 상세 분석 |

**TikTok 특이사항**:
- **Impression**, **Visitors**, **AOV** 컬럼 추가 (Shopee에는 없음)
- TikTok은 **Product GMV Max** / **Live GMV Max** 분리 (광고 채널 구분)
- CM 컬럼이 Items Sold 앞에 위치 (Shopee는 맨 뒤)

### 3.4 TikTok Monthly CM 시트 구조

**시트명**: `1. JAN SALES`, `2. FEB SALES`

**Monthly 컬럼**: Weekly와 동일한 구조 (44개)

**Summary Row 데이터 예시** (FEB SALES):
```
694 Orders | Impression: 492,700 | PV: 32,936 | Visitors: 22,675
AOV: 300,777₫ | CR: 2.27% | Items: 747
GMV: 224,681,000₫ | Discount: 41,805,090₫ | NMV: 182,875,910₫
Total Ad: 3,423,449₫ | Platform Fee: 36,575,182₫ | Prime Cost: 62,583,000₫
```

### 3.5 TikTok 전용 추가 시트

TikTok Excel에는 Weekly/Monthly CM 외에 추가 분석 시트가 있음:

| 시트명 | 내용 |
|--------|------|
| `2026 Monthly Overview` | **월별 Overview** — MoM 비교 (Impression, PV, Order, GMV, CM, AD, Fee, Prime Cost) |
| `Weekly Overview` | **주별 Overview** — WoW 트렌드 (동일 KPI) |
| `ADVERTISEMENT` | 주간/월간 광고 성과 (Product별, Cost, ROI) |
| `CREATOR OUTREACH` | 크리에이터 협업 성과 (Invited → Collab → GMV) |
| `LIVESTREAM` | 라이브스트림 세션별 성과 (Duration, Revenue, Orders, Viewers) |
| `CS` | 고객서비스 이슈 추적 |
| `2025 Monthly` / `2025 Weekly` | **전년도 데이터** (MoM/YoY 비교용) |

### 3.6 공통 — COGS MASTER FILE 시트

두 Excel 모두 **COGS MASTER FILE** 시트를 포함:

| 컬럼 | 설명 |
|-------|------|
| PRODUCT ID | 플랫폼 상품 ID |
| VARIATION ID | SKU 변형 ID |
| PRODUCT NAME (VE) | 베트남어명 |
| PRODUCT NAME (EN) | 영어명 |
| SKU | SKU 코드 (예: `MBSD17U0019`) |
| PRIME COST (07.08 UPDATE) | 원가 (최종 업데이트일자) |

→ **drd_sku_masters** 테이블과 1:1 매핑. SKU 원가 마스터 데이터 소스.

---

## 4. 화면 구성안 분석

### 4.1 SCR-07: Weekly CM 화면 (기획서 + Excel 기반 도출)

**URL**: `/weekly-cm`  
**접근 권한**: 전 권한 (P-01~P-04)

#### 4.1.1 상단 필터 영역
```
┌─────────────────────────────────────────────────────────┐
│  주차 선택: [◀ 이전] 2026.03.20 ~ 03.26 [다음 ▶]        │
│  채널 필터: [ALL] [SHOPEE] [TIKTOK]                      │
│  [CSV 다운로드] [새로고침]                                 │
└─────────────────────────────────────────────────────────┘
```

#### 4.1.2 Summary Cards (Row 2-3 데이터 기반)
```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ 📦 Orders│ 📊 GMV   │ 💰 NMV   │ 🏷 CM    │ 📈 CM%   │
│   702    │ 354.4M₫  │ 286.6M₫  │ #REF!    │ #REF!    │
│          │          │          │ (계산필요) │         │
├──────────┼──────────┼──────────┼──────────┤──────────┤
│ Items    │ PV       │ CR       │Prime Cost│ AD Spend │
│   977    │  32,271  │  3.03%   │ 94.5M₫  │ 20.5M₫   │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

#### 4.1.3 비용 분해 바 차트 (Cost Breakdown)
```
Gross Revenue              ████████████████████████ 354.4M₫
├─ Prime Cost              ████████████             94.5M₫  (26.7%)
├─ Platform Fee            █████████████            73.1M₫  (20.6%)
├─ AD Spending             ███                      20.5M₫  (5.8%)
├─ Seller Discount         █                         6.2M₫  (1.7%)
├─ Seller Voucher          █                         3.1M₫  (0.9%)
├─ Affiliates Booking      ░                         1.9M₫  (0.5%)
├─ Affiliates Commission   ░                         0.6M₫  (0.2%)
├─ Host Livestream          ░                        0.6M₫  (0.2%)
├─ FreeGift                ░                            0₫  (0.0%)
└─ CM (Contribution Margin) █████                   ???M₫   (??%)
```

#### 4.1.4 제품별 CM 테이블
```
┌────┬─────────┬─────────────┬──────┬──────┬───────────┬──────────┬──────────┬────────┬─────────┬────────┬─────────┬───────────┬───────┐
│ No │Prod ID  │Product Name │  PV  │  CR  │Items Sold │   GMV    │Net GMV   │Discount│  NMV    │P.Cost  │AD Spend │  Fee      │  CM   │
├────┼─────────┼─────────────┼──────┼──────┼───────────┼──────────┼──────────┼────────┼─────────┼────────┼─────────┼───────────┼───────┤
│ 1  │277680.. │Spatula..    │10,474│4.08% │   427     │138.2M₫  │116.8M₫   │7.5M₫   │109.3M₫ │34.6M₫  │ 7.8M₫   │ 27.9M₫   │ ??   │
│ 2  │...      │...          │...   │...   │   ...     │...       │...       │...     │...     │...     │ ...     │ ...       │ ...  │
└────┴─────────┴─────────────┴──────┴──────┴───────────┴──────────┴──────────┴────────┴─────────┴────────┴─────────┴───────────┴───────┘
```

#### 4.1.5 비용 비율 Summary Row (%)
| 항목 | 비율 |
|------|------|
| Discount / GMV | 4.46% |
| Prime Cost / NMV | 31.5% |
| AD / NMV | 6.84% |
| Fee / NMV | 24.4% |
| Voucher / NMV | 1.04% |
| Livestream / NMV | 0.2% |
| Affiliates / NMV | 0.63% |

---

### 4.2 SCR-08: Monthly CM 화면 (기획서 + Excel 기반 도출)

**URL**: `/monthly-cm`  
**접근 권한**: 전 권한  
**핵심 차별점**: **전월 대비 변동 (MoM)** 표시

#### 4.2.1 상단 필터
```
┌─────────────────────────────────────────────────────────┐
│  월 선택: [◀ 이전] 2026년 02월 [다음 ▶]                  │
│  채널 필터: [ALL] [SHOPEE] [TIKTOK]                      │
│  [CSV 다운로드] [새로고침]                                 │
└─────────────────────────────────────────────────────────┘
```

#### 4.2.2 Summary Cards + MoM 변동
```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ 📦 Orders    │ 📊 GMV       │ 💰 NMV       │ 🏷 CM        │ 📈 CM%       │
│  1,567       │  657.1M₫     │  602.2M₫     │  (계산필요)   │  (계산필요)   │
│  ▲ +12% MoM  │  ▼ -32% MoM  │  ▼ -35% MoM  │              │              │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

#### 4.2.3 월별 트렌드 (TikTok's Monthly Overview 시트 참조)
```
           JAN        FEB        MAR
Orders    957        694        (진행중)
GMV       270.2M₫   224.7M₫    188.0M₫
CM%       ???%       ???%       ???%
AD Rate   2.4%       1.9%       2.0%
MoM       -          ▼ -17%     ▼ -16%
```

#### 4.2.4 제품별 CM 테이블
Monthly도 Weekly와 동일한 컬럼 구조 + **MoM 변동률** 컬럼 추가

---

## 5. 채널별 데이터 차이점 정리

| 항목 | Shopee | TikTok |
|------|--------|--------|
| **Impression** | ❌ 없음 | ✅ 있음 |
| **Visitors** | ❌ 없음 | ✅ 있음 |
| **AOV** | ❌ 없음 | ✅ 있음 |
| **Net GMV** | ✅ 있음 (3월~) | ✅ 있음 |
| **Product GMV Max** | ❌ 없음 | ✅ 있음 (광고 채널 구분) |
| **Live GMV Max** | ❌ 없음 | ✅ 있음 (광고 채널 구분) |
| **Affiliates Booking** | ✅ 별도 컬럼 | ✅ Total Ad에 통합 |
| **Affiliates Commission** | ✅ 별도 컬럼 | ✅ (raw affiliate 시트에서 별도 관리) |
| **FreeGIFT** | ✅ 있음 | ❌ 없음 |
| **CM 위치** | 마지막 그룹 (Col 20) | 앞쪽 (Col 10) |
| **Excel 시트명** | 날짜 범위 (`03.20 - 03.26`) | 주차명 (`Mar W4 (20-26.3)`) |
| **월별 Overview** | ❌ 없음 | ✅ 있음 (MoM 비교 시트) |
| **주별 Overview** | ❌ 없음 | ✅ 있음 (WoW 트렌드 시트) |
| **COGS Master** | ✅ 있음 | ✅ 있음 |
| **추가 시트** | 없음 | ADVERTISEMENT, CREATOR OUTREACH, LIVESTREAM, CS |

---

## 6. DB 스키마 (기획서 정의 + 추론)

### 6.1 기획서 정의 (확정)

```sql
-- drd_weekly_summaries  (colPrefix: wks_)  ← 테이블명+Prefix만 정의
-- drd_monthly_summaries (colPrefix: mts_)  ← 테이블명+Prefix만 정의
```

### 6.2 추정 스키마 (drd_daily_summaries 기반)

#### drd_weekly_summaries (wks_)

```sql
CREATE TABLE drd_weekly_summaries (
  wks_id          CHAR(36) PRIMARY KEY,
  ent_id          CHAR(36) NOT NULL,
  chn_code        VARCHAR(20) NOT NULL,       -- SHOPEE | TIKTOK
  
  -- 기간
  wks_year        INT NOT NULL,               -- 2026
  wks_week_no     INT NOT NULL,               -- ISO Week 1~53
  wks_start_date  DATE NOT NULL,              -- 주 시작일 (월)
  wks_end_date    DATE NOT NULL,              -- 주 종료일 (일)
  
  -- Traffic  
  wks_impressions    BIGINT DEFAULT 0,        -- TikTok only
  wks_page_views     BIGINT DEFAULT 0,
  wks_visitors       BIGINT DEFAULT 0,        -- TikTok only
  
  -- Sales
  wks_orders         INT DEFAULT 0,
  wks_items_sold     INT DEFAULT 0,
  wks_aov            DECIMAL(15,2) NULL,
  wks_cr             DECIMAL(10,8) NULL,
  
  -- Revenue
  wks_gmv            DECIMAL(18,2) DEFAULT 0,
  wks_net_gmv        DECIMAL(18,2) DEFAULT 0,
  wks_seller_discount DECIMAL(18,2) DEFAULT 0,
  wks_nmv            DECIMAL(18,2) DEFAULT 0,
  
  -- Costs
  wks_prime_cost     DECIMAL(18,2) DEFAULT 0,
  wks_ad_spend       DECIMAL(18,2) DEFAULT 0,
  wks_platform_fee   DECIMAL(18,2) DEFAULT 0,
  wks_seller_voucher DECIMAL(18,2) DEFAULT 0,
  wks_livestream_fee DECIMAL(18,2) DEFAULT 0,
  wks_free_gift      DECIMAL(18,2) DEFAULT 0,
  wks_affiliate_booking    DECIMAL(18,2) DEFAULT 0,
  wks_affiliate_commission DECIMAL(18,2) DEFAULT 0,
  wks_fulfillment_fee      DECIMAL(18,2) DEFAULT 0,
  wks_logistics_cost       DECIMAL(18,2) DEFAULT 0,
  
  -- CM
  wks_cm             DECIMAL(18,2) DEFAULT 0,
  wks_cm_pct         DECIMAL(8,4) NULL,
  wks_cm_status      ENUM('NORMAL','NEGATIVE','INCOMPLETE') DEFAULT 'INCOMPLETE',
  
  -- Meta
  wks_product_count  INT DEFAULT 0,           -- 해당 주 판매 제품 수
  wks_sku_count      INT DEFAULT 0,           -- 해당 주 판매 SKU 수
  wks_batch_status   ENUM('PENDING','PROCESSING','COMPLETED','FAILED') DEFAULT 'PENDING',
  wks_created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  wks_updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_ent_chn_week (ent_id, chn_code, wks_year, wks_week_no)
);
```

#### drd_monthly_summaries (mts_)

```sql
CREATE TABLE drd_monthly_summaries (
  mts_id          CHAR(36) PRIMARY KEY,
  ent_id          CHAR(36) NOT NULL,
  chn_code        VARCHAR(20) NOT NULL,
  
  -- 기간
  mts_year        INT NOT NULL,
  mts_month       INT NOT NULL,               -- 1~12
  
  -- Traffic
  mts_impressions    BIGINT DEFAULT 0,
  mts_page_views     BIGINT DEFAULT 0,
  mts_visitors       BIGINT DEFAULT 0,
  
  -- Sales
  mts_orders         INT DEFAULT 0,
  mts_items_sold     INT DEFAULT 0,
  mts_aov            DECIMAL(15,2) NULL,
  mts_cr             DECIMAL(10,8) NULL,
  
  -- Revenue
  mts_gmv            DECIMAL(18,2) DEFAULT 0,
  mts_net_gmv        DECIMAL(18,2) DEFAULT 0,
  mts_seller_discount DECIMAL(18,2) DEFAULT 0,
  mts_nmv            DECIMAL(18,2) DEFAULT 0,
  
  -- Costs (동일 구조)
  mts_prime_cost     DECIMAL(18,2) DEFAULT 0,
  mts_ad_spend       DECIMAL(18,2) DEFAULT 0,
  mts_platform_fee   DECIMAL(18,2) DEFAULT 0,
  mts_seller_voucher DECIMAL(18,2) DEFAULT 0,
  mts_livestream_fee DECIMAL(18,2) DEFAULT 0,
  mts_free_gift      DECIMAL(18,2) DEFAULT 0,
  mts_affiliate_booking    DECIMAL(18,2) DEFAULT 0,
  mts_affiliate_commission DECIMAL(18,2) DEFAULT 0,
  mts_fulfillment_fee      DECIMAL(18,2) DEFAULT 0,
  mts_logistics_cost       DECIMAL(18,2) DEFAULT 0,
  
  -- CM
  mts_cm             DECIMAL(18,2) DEFAULT 0,
  mts_cm_pct         DECIMAL(8,4) NULL,
  mts_cm_status      ENUM('NORMAL','NEGATIVE','INCOMPLETE') DEFAULT 'INCOMPLETE',
  
  -- MoM (Monthly CM만의 차별점)
  mts_prev_gmv       DECIMAL(18,2) NULL,       -- 전월 GMV
  mts_prev_cm        DECIMAL(18,2) NULL,       -- 전월 CM
  mts_prev_cm_pct    DECIMAL(8,4) NULL,        -- 전월 CM%
  mts_gmv_mom_rate   DECIMAL(8,4) NULL,        -- GMV MoM 변동률
  mts_cm_mom_rate    DECIMAL(8,4) NULL,        -- CM MoM 변동률
  
  -- Meta
  mts_product_count  INT DEFAULT 0,
  mts_sku_count      INT DEFAULT 0,
  mts_batch_status   ENUM('PENDING','PROCESSING','COMPLETED','FAILED') DEFAULT 'PENDING',
  mts_created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  mts_updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_ent_chn_month (ent_id, chn_code, mts_year, mts_month)
);
```

---

## 7. 현재 구현 상태

| 항목 | 상태 | 비고 |
|------|------|------|
| 프론트엔드 라우트 | ✅ `/weekly-cm`, `/monthly-cm` 존재 | AppLayout.tsx 사이드바 |
| i18n 키 | ✅ `nav.weeklyCm`, `nav.monthlyCm` | ko/en/vi |
| WeeklyCmPage.tsx | ❌ 미구현 | 페이지 파일 없음 |
| MonthlyCmPage.tsx | ❌ 미구현 | 페이지 파일 없음 |
| drd_weekly_summaries | ❌ 미구현 | 테이블 미생성 |
| drd_monthly_summaries | ❌ 미구현 | 테이블 미생성 |
| Weekly API | ❌ 미구현 | `GET /api/v1/weekly-summary` |
| Monthly API | ❌ 미구현 | `GET /api/v1/monthly-summary` |
| CM 계산 서비스 | ❌ 미구현 | FN-07 CM Engine |

---

## 8. 구현 전략 제안

### Phase 1 (즉시 구현 가능 — Raw Data 기반 집계)

현재 `drd_raw_orders` + `drd_raw_order_items` + `drd_sku_masters`에 임포트된 데이터를 기반으로 **실시간 집계** 방식으로 Weekly/Monthly CM을 구현할 수 있음:

1. **Weekly CM API**: `drd_raw_orders`를 주차별(ISO Week)로 GROUP BY → 제품별 GMV, Items, Discount, NMV 집계 + `drd_sku_masters`에서 Prime Cost JOIN → CM 계산
2. **Monthly CM API**: 동일 방식으로 월별 GROUP BY + 전월 비교 (MoM)
3. **화면**: Excel 레이아웃 기반 — Summary Cards + Cost Breakdown + 제품별 테이블

### Phase 2 (배치 → 스냅샷 테이블)

데이터량 증가 시 성능을 위해 `drd_weekly_summaries` / `drd_monthly_summaries` 배치 생성:
- 매주 월요일 자동 → `drd_weekly_summaries` 생성
- 매월 1일 자동 → `drd_monthly_summaries` 생성

### 주요 고려사항

1. **CM이 Excel에서 `#REF!`**: 현재 Excel에서 CM 값이 참조 오류 → **시스템에서 직접 계산**해야 함
2. **채널별 컬럼 차이**: Shopee/TikTok 고유 컬럼은 NULL 허용으로 통합 테이블에서 관리
3. **데이터 소스**: Raw Orders + SKU Masters + Channel Masters 3개 테이블 JOIN으로 모든 CM 항목 계산 가능
4. **누락 데이터**: AD Spending, Affiliates Booking, Livestream Fee 등은 Excel 업로드 시 수동 입력 또는 별도 관리 필요

---

## 9. 결론

### 기획서 정의 수준
- **FN-07 (CM 공식)**: ✅ 상세 정의 완료
- **FN-12 (Weekly CM)**: ⚠️ 요약 수준 (v3.0에서 "기존 유지")  
- **FN-13 (Monthly CM)**: ⚠️ 요약 수준 (MoM 비교가 핵심 차별점)
- **SCR-07/08**: ⚠️ URL + 기능 참조만 존재, 와이어프레임 미제공
- **DB DDL**: ⚠️ 테이블명+Prefix만 정의, 컬럼 상세 미정의

### Excel 레퍼런스가 실질적인 설계 기준
**기획서가 상세하지 않으므로, 실제 Excel 리포트 구조가 화면/데이터 설계의 주요 레퍼런스**:
- Shopee: 48개 컬럼 × 주간/월간 시트
- TikTok: 44개 컬럼 × 주간/월간 시트 + Overview/Advertisement/Creator/Livestream 부가 시트
- 두 채널의 컬럼 구조 차이 고려한 통합 설계 필요

### 즉시 구현 가능 여부
**✅ 가능** — Raw Orders 기반 실시간 집계로 Weekly/Monthly CM 구현 가능. 별도 배치 테이블 없이도 핵심 기능 제공 가능.

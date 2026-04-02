# SB Data & Reporting System — Requirements Definition (요구사항정의서)

---
```
document_id : DRD-REQ-2026-001
version     : 3.0.0
status      : Draft
created     : 2026-04-02
updated     : 2026-04-02
author      : Amoeba Company
change_log  :
  - version: 1.0.0 / 2.0.0 — 초기 작성 및 Shopee/TikTok 실데이터 반영
  - version: 3.0.0
    date: 2026-04-02
    description: |
      DRD-ERD-2026-001 v2.0 반영
      - 단일 drd_cogs_master → SPU/SKU/Channel Mapping 3계층 구조 전환
      - MasterProductItemCode (sku_id UUID) 도입
      - 가격 4단계: prime_cost / supply_price / listing_price / selling_price
      - 8개 채널 확장 계획 반영
      - FR-18~FR-21 신규 추가
      - 8.8 Master Data 전면 재작성
      - R-11 SKU 미등록 리스크 추가
```
---

## 1. Overview (개요)

- **System**: SB Data & Reporting System
- **Project Code**: DRD / **DB**: `db_drd`
- **Brands**: Firgi Vietnam, SocialBean
- **Current Channels**: Shopee Vietnam · TikTok Shop Vietnam
- **Planned Channels**: 자체몰 / 오프라인 / B2B / 인플루언서 / 아메바샵 / Amazon
- **Purpose**: 판매 플랫폼 원시 데이터를 자동 집계·산출하여 4종 리포트를 생성하는 통합 데이터 리포팅 시스템. 향후 멀티채널 확장에 대비한 **단일 상품 마스터(SPU/SKU)** 기반 구조 채택.

---

## 2. Report Type Overview (리포트 유형)

| 유형 | 주기 | 기간 범위 | 생성 시점 | 핵심 KPI |
|------|------|----------|----------|---------|
| **Daily** | 일간 | 1일 (기본: 전일) | 매일 자동 | 트래픽, 전환, GMV, ROAS, CM |
| **Weekly CM** | 주간 | 월~일 (직전 주) | 다음 주 월요일 자동 | CM, Prime Cost, Platform Fee, Affiliate, Discount |
| **Monthly CM** | 월간 | 1개월 (전월) | 익월 1일 자동 | CM + 전월 대비 변동 |
| **Inventory** | 실시간 | 현재 재고 | On-demand | 창고별 SKU 재고, 입출고 |

---

## 3. Product Master Architecture (상품 마스터 아키텍처) ← v3.0 신규

### 3.1 3계층 상품 코드 체계

```
drd_spu_masters (상품 그룹)
  └── drd_sku_masters (품목 = MasterProductItemCode)
        └── drd_channel_product_mappings (채널별 상품 ID 연결)
```

| 계층 | 테이블 | 키 | 역할 |
|------|--------|-----|------|
| SPU | `drd_spu_masters` | `spu_code` (WMS 앞 7자리) | 상품 그룹 |
| SKU | `drd_sku_masters` | `sku_id` (UUID) = **MasterProductItemCode** | 전 채널 공통 식별자 |
| Channel | `drd_channel_product_mappings` | `cpm_id` | 채널별 상품 ID 연결 |

### 3.2 WMS Code 구조

```
SAFG18U0008
SA=브랜드  FG=서브브랜드  18=제품번호  U=타입  0008=시퀀스
SPU Code = 앞 7자리 = SAFG18U
sku_wms_code = 전체 = SAFG18U0008  (Natural Key)
```

| WMS 접두사 | 서브브랜드 | 예시 |
|-----------|---------|------|
| `SAFG` | Firgi | 이유식큐브, 스푼 |
| `SALC` | LittleCloud | 흡착볼 |
| `SALM` | LeMade | 주방 나이프 |
| `SAAL` | AttiRabbit | 식판 |

### 3.3 가격 4단계 구조

| 단계 | DB 컬럼 | 설명 | 예시 |
|------|--------|------|------|
| 매입원가 | `sku_prime_cost` | FOB 기준 원가 | 65,000 VND |
| 공급가 | `sku_supply_price` | 플랫폼 수수료·할인 제외 수취가 | 153,000 VND |
| 등록 정가 | `sku_listing_price` | GMV 산정 기준가 | 235,000 VND |
| 실판매가 | `sku_selling_price` | 할인 적용 판매가 = Net GMV 기준 | 153,000 VND |

### 3.4 채널 확장 계획 (`drd_channel_masters`)

| chn_code | 채널명 | chn_type | 상태 |
|---------|--------|---------|------|
| `SHOPEE` | Shopee Vietnam | MARKETPLACE | ✅ 운영중 |
| `TIKTOK` | TikTok Shop VN | MARKETPLACE | ✅ 운영중 |
| `OWN_WEB` | 자체몰 | OWN | 🔜 예정 |
| `OFFLINE` | 오프라인 | OFFLINE | 🔜 예정 |
| `B2B` | B2B 도매 | B2B | 🔜 예정 |
| `INFLUENCER` | 인플루언서 판매 | INFLUENCER | 🔜 예정 |
| `AMOEBA_SHOP` | 아메바샵 | MARKETPLACE | 🔜 예정 |
| `AMAZON` | Amazon | MARKETPLACE | 🔜 예정 |

> ✅ 채널 추가 시 `drd_channel_masters` + `drd_channel_product_mappings`만 확장. SKU 마스터 변경 없음.

---

## 4. GMV Hierarchy & KPI Definitions

### 4.1 Revenue Hierarchy

```
GMV = sku_listing_price × 판매량             ← 정가 기준
  └── Net GMV (~GMV × 85%)                  ← sku_selling_price 기준
        └── NMV = Net GMV − Seller Discount  ← 배분 기준값 (핵심)
              └── Gross Revenue              ← 플랫폼 확인 최종 수익
```

> **핵심**: Net GMV ≠ NMV. NMV가 모든 비용 배분의 기준.

### 4.2 Cost & Margin Hierarchy

```
Gross Revenue
  − sku_prime_cost × items_sold              ← drd_sku_masters
  − Import Logistics Cost                    ← drd_logistics_costs
  − Fulfillment Fee                          ← sku_fulfillment_fee_override
                                               OR chn_default_fulfillment_fee
  − Platform Commission                      ← chn_default_platform_fee_rate
  − Advertising Spend                        ← Ads API
  − Affiliate Commission (NMV 배분)
  − Affiliate Booking Fee (NMV 배분, 수동)
  − Host Livestream Fee (NMV 배분, 수동)
  − Seller Voucher (NMV 배분 추정)
  − Seller Discount (확정)
  − Free Gift (확정)
  ──────────────────────────────────
= Contribution Margin (CM)
CM% = CM ÷ Gross Revenue × 100
```

> Fulfillment Fee 우선순위:  
> `sku_fulfillment_fee_override IS NOT NULL` → override 값  
> `IS NULL` → `chn_default_fulfillment_fee` (기본값 14,000 VND)

---

## 5. KPI Master Definition

### 5.1 Revenue KPIs

| KPI | 산출 | DB 연결 | 갱신 | 위험도 |
|-----|------|--------|------|--------|
| GMV (Each) | `sku_listing_price` × (판매량-취소량) | `drd_sku_masters` JOIN | Daily | 🔴 High |
| Net GMV | 플랫폼 직접 제공 | Platform API | Daily | 🔴 High |
| NMV | Net GMV − Seller Discount | Calculated | Daily | 🔴 High |
| Gross Revenue | 플랫폼 확인 수익 | Platform API | Daily | 🔴 High |
| GMV Ads | Ads-driven GMV | Ads API | Daily | 🔴 High |

### 5.2 Traffic & Conversion KPIs

| KPI | Shopee | TikTok | 갱신 |
|-----|--------|--------|------|
| 노출 | Page Views | Impressions | Daily |
| 방문 | Visitors | Visitor | Daily |
| CR | CR | CR Rate | Daily |
| AOV | Net GMV / Orders | Net GMV / Orders | Daily |
| Orders / Items Sold | Platform raw | Platform raw | Daily |

### 5.3 Cost KPIs

| KPI | DB 컬럼 | 소스 | 갱신 | 위험도 |
|-----|--------|------|------|--------|
| 매입원가 (COGS) | `sku_prime_cost` | `drd_sku_masters` | 변경 시 | 🔴 High |
| 공급가 | `sku_supply_price` | `drd_sku_masters` | 변경 시 | 🟡 Med |
| 등록 정가 | `sku_listing_price` | `drd_sku_masters` | 변경 시 | 🟡 Med |
| 실판매가 | `sku_selling_price` | `drd_sku_masters` | 변경 시 | 🟡 Med |
| Fulfillment Fee | `sku_fulfillment_fee_override` OR `chn_default_fulfillment_fee` | Override or Default | 변경 시 | 🟢 Low |
| Platform Fee | `chn_default_platform_fee_rate` × GMV | `drd_channel_masters` | Daily | 🔴 High |
| Affiliate Booking | 수동 입력 → NMV 배분 | `drd_manual_inputs` | Weekly | 🔴 High |
| Livestream Fee | 수동 입력 → NMV 배분 | `drd_manual_inputs` | Weekly | 🟡 Med |
| CM | 산출 | Calculated | Daily | 🔴 High |
| CM% | CM ÷ Gross Revenue × 100 | Calculated | Daily | 🔴 High |

---

## 6. Functional Requirements (기능 요구사항)

### 6.1 기존 FR

| FR ID | 요구사항 | Priority |
|-------|---------|---------|
| FR-01 | 플랫폼 데이터 자동 수집 (Shopee / TikTok) | P0 |
| FR-02 | 플랫폼별 필터 조회 | P0 |
| FR-03 | 수동 비용 주간 입력 (Booking / Livestream / TikTok Aff) | P0 |
| FR-04 | NMV 비율 배분 엔진 | P0 |
| FR-05 | Daily 리포트 KPI 표시 | P0 |
| FR-06 | VND/KRW 환율 설정 및 재산출 | P0 |
| FR-07 | 상품별 CM 산출 | P0 |
| FR-08 | 배분 추정값 시각 구분 표시 | P1 |
| FR-09 | 기간 비교 (DoD / WoW / MoM) | P1 |
| FR-10 | 이상값 자동 감지·알림 | P1 |
| FR-11 | Excel 내보내기 | P2 |
| FR-12 | Weekly CM 리포트 자동 생성 | P0 |
| FR-13 | Monthly CM 리포트 (전월 대비) | P1 |
| FR-14 | Flash Sale 집계 (Shopee only) | P1 |
| FR-15 | Livestream 성과 집계 | P1 |
| FR-16 | Creator Outreach 관리 (TikTok only) | P2 |
| FR-17 | SKU 원가 파일 업로드 | P0 |

### 6.2 신규 FR (v3.0 — ERD v2.0 반영)

| FR ID | 요구사항 | ERD 테이블 | Priority |
|-------|---------|-----------|---------|
| **FR-18** | SPU 마스터 관리 (등록/수정/조회/Soft Delete) | `drd_spu_masters` | P0 |
| **FR-19** | SKU 마스터 관리 — WMS Code 기준, 3개 언어 상품명, 4단계 가격, Variant | `drd_sku_masters` | P0 |
| **FR-20** | 채널 상품 매핑 관리 — SKU ↔ 채널 상품 ID 연결 | `drd_channel_product_mappings` | P0 |
| **FR-21** | 원가 변경 이력 조회 — SKU별 가격 변경 이력 추적 | `drd_sku_cost_histories` | P1 |

---

## 7. Data Source & Ingestion

### 7.1 Order / Ads / Affiliate Data

| Entity | Source | Method | 주기 |
|--------|--------|--------|------|
| Orders | Shopee, TikTok | API batch | Daily |
| Ads Data | Shopee Ads, TikTok Ads | API | Daily |
| Affiliate Booking | Manual | Admin | Weekly |
| Affiliate Commission (Shopee) | API | API | Daily |
| Affiliate Commission (TikTok) | **Manual** | Admin | Weekly |

### 7.2 Cost Data (v3.0 업데이트)

| Entity | DB Table.Column | Method | 주기 |
|--------|----------------|--------|------|
| 매입원가 (COGS) | `drd_sku_masters.sku_prime_cost` → `drd_sku_cost_histories` | Upload / Admin | 변경 시 |
| 공급가 | `drd_sku_masters.sku_supply_price` | Admin | 변경 시 |
| 등록 정가 | `drd_sku_masters.sku_listing_price` | Admin / TikTok COGS | 변경 시 |
| 실판매가 | `drd_sku_masters.sku_selling_price` | Admin | 변경 시 |
| Import Logistics | `drd_logistics_costs` | Invoice Upload | Per shipment |
| Fulfillment Fee | `sku_fulfillment_fee_override` / `chn_default_fulfillment_fee` | Config | 변경 시 |
| Host Livestream Fee | `drd_manual_inputs` | Admin | Weekly |

### 7.3 Master Data (v3.0 전면 재작성)

| Entity | DB Table | 등록 방법 | 주기 |
|--------|---------|----------|------|
| SPU 그룹 | `drd_spu_masters` | Admin 직접 / Excel Upload | 상품 신규 시 |
| SKU 품목 (MasterProductItemCode) | `drd_sku_masters` | Excel Upload (FR-17/FR-19) | 품목 추가/변경 시 |
| 채널 상품 ID 연결 | `drd_channel_product_mappings` | Admin / CSV Upload | 채널 등록 시 |
| 원가 변경 이력 | `drd_sku_cost_histories` | 자동 기록 (가격 변경 시) | 자동 |
| 채널 마스터 | `drd_channel_masters` | 시스템 관리자 | 신규 채널 추가 시 |
| VND/KRW 환율 | `drd_exchange_rates` | 운영팀 | 변경 시 |

---

## 8. Manual Input Summary

| 항목 | 주기 | 담당 | DB 저장 위치 | 처리 방식 | 위험도 |
|------|------|------|------------|----------|--------|
| Affiliate Booking Fee | 주간 | 운영팀 | `drd_manual_inputs` | ÷ 7 → 일 평균 → NMV 배분 | 🔴 High |
| Host Livestream Fee | 주간 | 운영팀 | `drd_manual_inputs` | ÷ 7 → 일 평균 → NMV 배분 | 🟡 Med |
| Affiliate Commission (TikTok) | 주간 | 운영팀 | `drd_manual_inputs` | NMV 비율 배분 | 🔴 High |
| SKU 가격 4종 | 변경 시 | Finance / 운영 | `drd_sku_masters` → `drd_sku_cost_histories` | 이력 자동 저장 | 🔴 High |
| Import Logistics | 선적 단위 | Finance | `drd_logistics_costs` | 단위 배분 | 🔴 High |
| VND/KRW 환율 | 변경 시 | 운영팀 | `drd_exchange_rates` | 고정 환율 적용 | 🟡 Med |
| Creator Outreach | 주간 | 마케팅팀 | `drd_creator_outreach_weeklies` | 크리에이터별 GMV | 🟡 Med |

---

## 9. Shopee vs TikTok Data Differences

| 항목 | Shopee | TikTok | 비고 |
|------|--------|--------|------|
| 채널 상품 ID | 숫자형 VARCHAR(50) | 18자리 VARCHAR(50) | `cpm_channel_product_id` |
| 트래픽 단위 | Page Views + Visitors | Impressions + Visitor | 컬럼명 상이 |
| Affiliate Commission | API 수집 | **수동 입력** | ⚠ |
| 플랫폼 할인 | Shopee Discount (참고) | 없음 | CM 제외 |
| 셀러 쿠폰 | Seller Voucher | 없음 | Shopee only |
| Flash Sale | 있음 | 없음 | Shopee only |
| Creator Outreach | 없음 | 있음 | TikTok only |
| Platform Fee Rate | `chn_default_platform_fee_rate` = 0.24 | 0.20 | Phase 1 추정 |

---

## 10. Risk Registry

| ID | 항목 | 위험도 | 설명 | 대응 방안 |
|----|------|--------|------|----------|
| R-01 | Order status 정의 | 🔴 High | 완료 주문 기준 미정 | 플랫폼별 상태 코드 확정 |
| R-02 | TikTok Affiliate Commission | 🔴 High | API 미제공 | 수동 입력 워크플로우 구축 |
| R-03 | Product Cost VAT | 🔴 High | HQ 파일 VAT 포함 여부 불명확 | Finance 팀 확인 |
| R-04 | Logistics Cost 배분 | 🔴 High | 선적 단위 배분 기준 불명확 | 부피/수량 기준 정책 확정 |
| R-05 | Seller Voucher 배분 | 🟡 Med | NMV 비율 추정 | 추정값 시각 구분 표시 |
| R-06 | Platform Fee 산출 | 🟡 Med | Phase 1 추정치 | Phase 2 API 연동 |
| R-07 | AD Attribution | 🟡 Med | 광고 기여 기준 불명확 | 플랫폼 기본 Attribution 적용 |
| R-08 | Gross Revenue 정의 | 🔴 High | 산출 공식 미확정 | Finance 팀 정의 확정 |
| R-09 | TikTok Product ID | 🟡 Med | 18자리 → VARCHAR(50) | ERD v2.0 준수 |
| R-10 | Affiliate vs Organic | 🟡 Med | 구분 기준 필요 | order_id 기반 태깅 |
| **R-11** | **SKU 미등록 상품 판매** | 🔴 High | `drd_channel_product_mappings` 미등록 시 CM 산출 불가 | WARNING 알림 + 미등록 SKU 목록 대시보드 |

---

## 11. Phase Plan

| Phase | 내용 | 우선순위 |
|-------|------|---------|
| **Phase 1** | SPU/SKU 마스터, 채널 매핑(Shopee/TikTok), Daily Report, Weekly CM, SKU 원가 업로드 | P0 |
| **Phase 2** | Monthly CM, Flash Sale, TikTok Live GMV, 원가 이력 조회 | P1 |
| **Phase 3** | Inventory Report, Creator Outreach, 자동 알림, 신규 채널 매핑 | P2 |
| **Phase 4** | KRW 환산, 고급 분석, 채널 확장 (OWN_WEB/B2B/Amazon) | P3 |

---

## 12. Non-Functional Requirements

| 항목 | 기준 |
|------|------|
| Daily 배치 완료 | 매일 오전 5시 이전 (GMT+7) |
| 대시보드 로딩 | ≤ 2초 |
| SKU 조회 응답 | ≤ 500ms (sku_wms_code 인덱스 기반) |
| 데이터 보존 | 원시 90일 / 집계 3년 / 원가 이력 영구 |
| 가용성 | 99.5% / 월 |
| 접근 권한 | Role-based (운영팀 / 분석팀 / 브랜드 매니저 / 시스템 관리자) |
| 언어 지원 | 한국어 (KR) / 영어 (EN) / 베트남어 (VI) 병기 |
| 멀티테넌시 | `ent_id` 기반 법인 데이터 격리 (Amoeba Convention v2 MUST) |

# ambStockManagement
## amoeba 인벤토리 재고관리 발주예측 시스템
### 요구사항정의서 / Requirements Definition Document

| 항목 / Item | 내용 / Content |
|-------------|---------------|
| **문서 번호** | ASM-REQ-2026-001 |
| **버전** | v1.1 |
| **작성일** | 2026-03-29 |
| **작성자** | Amoeba Company |
| **프로젝트 코드** | ASM |
| **DB** | `db_app_stock` |
| **테이블 Prefix** | `asm_` |
| **API Base Path** | `/api/v1` |
| **변경 이유** | 멀티 호스트 아키텍처 반영 (apps.amoeba.site 분리 호스트) |

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [호스트 아키텍처](#2-호스트-아키텍처)
3. [사용자 신청 및 접근 구조](#3-사용자-신청-및-접근-구조)
4. [인증 요구사항](#4-인증-요구사항)
5. [시스템 목표](#5-시스템-목표)
6. [기능 요구사항](#6-기능-요구사항)
7. [비기능 요구사항](#7-비기능-요구사항)
8. [데이터 요구사항](#8-데이터-요구사항)
9. [통합 연동 요구사항](#9-통합-연동-요구사항)
10. [제약사항](#10-제약사항)

---

# 1. 프로젝트 개요

## 1.1 목적

**amoeba 인벤토리 재고관리 발주예측 시스템(ambStockManagement)**은 `apps.amoeba.site`에서 운영되는 파트너 앱으로, AMA(Amoeba Company) 플랫폼 사용자가 법인(Entity) 단위로 신청하여 사용하는 다중 테넌트 재고관리 SaaS 애플리케이션이다.

Excel 기반 수동 재고관리·발주 프로세스를 자동화하며, 창고재고(WS)·판매가능재고(ATS) 2원화 관리, 수요 예측, 안전재고 산출, 발주 제안 자동화를 제공한다.

## 1.2 프로젝트 컨텍스트

| 항목 | 값 |
|------|----|
| **프로젝트명** | ambStockManagement |
| **시스템명** | amoeba 인벤토리 재고관리 발주예측 시스템 |
| **앱 슬러그** | `app-stock-management` |
| **운영 URL** | `https://apps.amoeba.site/app-stock-management` |
| **DB** | `db_app_stock` |
| **테이블 Prefix** | `asm_` |
| **BE Port** | 3104 |
| **FE Port** | 5204 |
| **에러 코드 Prefix** | `ASM-E{4digit}` |
| **멀티테넌시 키** | `ent_id` (= `crp_id`, Corporation ID) |

---

# 2. 호스트 아키텍처

## 2.1 도메인 구조 / Domain Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  ama.amoeba.site          apps.amoeba.site                          │
│  ─────────────────         ──────────────────────────────────────── │
│  AMA 본체 플랫폼            파트너 앱 포털 (별도 호스트)                │
│  · 사용자 인증              · /                     앱 목록/포털      │
│  · 법인 관리               · /login                통합 로그인        │
│  · AMA 서비스              · /app-stock-management ambStockManagement│
│  · JWT 발급 서버            · /app-car-manager      기타 파트너 앱    │
│                            · /app-xxx              ...              │
└─────────────────────────────────────────────────────────────────────┘
```

**핵심 원칙 / Key Principle:**
- `apps.amoeba.site`는 `ama.amoeba.site`와 **별도 호스트**에서 독립적으로 운영
- 각 파트너 앱은 `apps.amoeba.site/{app-slug}` 경로에서 독립 동작
- 앱 간 공유 세션 없음 — 각 앱이 자체 JWT 관리
- AMA JWT는 `ama.amoeba.site`에서 발급; `apps.amoeba.site`가 Public Key로 검증

## 2.2 ambStockManagement URL 구조 / URL Structure

| 경로 | 설명 |
|------|------|
| `https://apps.amoeba.site/` | 파트너 앱 포털 (앱 목록) |
| `https://apps.amoeba.site/login` | **통합 로그인** (Entity Code + email + pw) |
| `https://apps.amoeba.site/entity-info` | Entity 안내 페이지 |
| `https://apps.amoeba.site/app-stock-management` | ambStockManagement 앱 진입점 |
| `https://apps.amoeba.site/app-stock-management/{crp_code}/*` | Entity 스코프 앱 페이지 |
| `https://apps.amoeba.site/app-stock-management/admin/*` | 시스템 관리자 페이지 |

## 2.3 Cross-Domain 처리 / Cross-Domain Handling

```
ama.amoeba.site (발급자)     apps.amoeba.site (검증자)
─────────────────────        ──────────────────────────
AMA JWT 발급                  AMA JWT 검증 (Public Key)
  └─ Cookie: AMA_TOKEN   →    GET /api/v1/auth/ama-sso
     (SameSite=None,           Authorization: Bearer {AMA_TOKEN}
      Secure, Domain=.amoeba.site)
                                └─ 유효 → apps 내부 JWT 발급
                                └─ 무효 → /login 리다이렉트
```

**Cookie 설정:**
- AMA JWT: `Domain=.amoeba.site` (서브도메인 공유) → `apps.amoeba.site`에서 읽기 가능
- apps 내부 JWT: `Domain=apps.amoeba.site` (격리)

---

# 3. 사용자 신청 및 접근 구조

## 3.1 사용 신청 흐름 / App Usage Application Flow

```
[사용자]
    │
    ▼
① ama.amoeba.site 로그인 (AMA 계정)
    │
    ▼
② apps.amoeba.site 접속
   → AMA JWT 쿠키 존재 확인
   → 앱 포털 자동 진입 (별도 로그인 없음)
    │
    ▼
③ 앱 목록에서 "ambStockManagement" 선택
   → 사용 신청 폼: Entity 이름/코드 입력 + 사용 목적
    │
    ▼
④ ADMIN이 신청 검토 → 승인/반려
    │ 승인
    ▼
⑤ 승인된 Entity Code (crp_code) + 사용자 계정 생성
    │
    ▼
⑥ apps.amoeba.site/app-stock-management 접속
   → AMA JWT 있으면 자동 로그인
   → 없으면 /login 에서 Entity Code + email + pw 입력
```

## 3.2 멀티테넌시 구조 / Multi-Tenancy Structure

```
apps.amoeba.site (파트너 앱 포털)
  └── asm_corporations (법인 = Entity)
        crp_id = ent_id ── 모든 업무 데이터 격리 기준
        crp_code         ── URL 진입점 식별자 (예: AMA-001)
        │
        ├── SYSTEM_ADMIN — apps 전체 관리
        └── 법인 소속 사용자 (asm_users)
              ├── ADMIN    — 법인 내 최고 권한
              ├── MANAGER  — 발주 승인·매개변수 변경
              ├── OPERATOR — 일상 입출고·주문 처리
              └── VIEWER   — 조회 전용
```

## 3.3 사용자 역할 / User Roles

| 역할 | 레벨 | 권한 범위 |
|------|------|---------|
| **SYSTEM_ADMIN** | ADMIN_LEVEL | apps 전체 법인·시스템 관리 (`ent_id = NULL`) |
| **ADMIN** | USER_LEVEL | 법인 내 사용자·채널·설정 관리 |
| **MANAGER** | USER_LEVEL | 발주 승인, 매개변수 변경, 전체 리포트 |
| **OPERATOR** | USER_LEVEL | 상품·입출고·판매주문 등록, 발주 제안 조회 |
| **VIEWER** | USER_LEVEL | 대시보드·리포트 조회 전용 |

---

# 4. 인증 요구사항

## 4.1 인증 방식 정의 / Authentication Methods

ambStockManagement는 **두 가지 인증 경로**를 지원한다.

### Track 1 — AMA SSO 자동 로그인

**조건:** 사용자가 `ama.amoeba.site`에 이미 로그인된 상태에서 `apps.amoeba.site/app-stock-management` 접속

**흐름:**
```
① 브라우저가 apps.amoeba.site 요청 시
   Domain=.amoeba.site 쿠키에 AMA_TOKEN 자동 포함

② apps FE → POST /api/v1/auth/ama-sso
   { ama_token: "{AMA_JWT}" }

③ apps BE가 AMA Public Key로 AMA JWT 검증
   ├─ 유효 + ent_id 존재 → apps 내부 JWT 발급 → 앱 실행
   └─ 유효 + 사용 신청 안 됨 → "사용 신청" 안내 화면
   └─ 유효하지 않음 → /login 페이지

④ apps 내부 JWT payload:
   { sub: usr_id, ent_id, crp_code, role, name, temp_password, source: "AMA_SSO" }
```

### Track 2 — 직접 로그인 (Entity Code + Email + Password)

**조건:** AMA 로그인 없이 `apps.amoeba.site/login` 직접 접속

**URL:** `https://apps.amoeba.site/login?app=app-stock-management&entity={crp_code}`

**흐름:**
```
① 사용자 입력
   Entity Code: [AMA-001]
   이메일:      [hong@amoeba.site]
   비밀번호:    [••••••••]

② POST /api/v1/auth/login
   { entity_code, email, password }

③ 검증 단계 (순서 보장):
   Step 1. Entity Code 검증
           crp_code 존재? NO → ASM-E1001
           crp_status = ACTIVE? NO → ASM-E1002

   Step 2. 사용자 검증
           usr_email 존재? NO → ASM-E1003 (마스킹)
           usr.ent_id = corp.crp_id? NO → ASM-E1004 (마스킹)
           usr_status = ACTIVE? NO → ASM-E1005

   Step 3. 비밀번호 검증
           bcrypt.compare() NO → ASM-E1006 (실패횟수 +1)

   Step 4. apps 내부 JWT 발급
           payload: { sub: usr_id, ent_id, crp_code, role, name,
                      temp_password, source: "DIRECT" }
```

## 4.2 인증 관련 기능 요구사항

| REQ ID | 요구사항 | 우선순위 |
|--------|---------|---------|
| R-AUTH-001 | AMA SSO — `Domain=.amoeba.site` 쿠키의 AMA JWT 감지 및 자동 검증 | P0 |
| R-AUTH-002 | AMA SSO 성공 시 apps 내부 JWT 발급 (재로그인 불필요) | P0 |
| R-AUTH-003 | AMA SSO 실패(미신청/만료) 시 `/login?app=app-stock-management` 리다이렉트 | P0 |
| R-AUTH-004 | 직접 로그인: Entity Code + 이메일 + 비밀번호 3-field 인증 | P0 |
| R-AUTH-005 | 로그인 성공 후 `?entity={crp_code}` URL로 앱 진입 | P0 |
| R-AUTH-006 | apps 내부 JWT — Access Token 15분 / Refresh Token 7일 | P0 |
| R-AUTH-007 | Refresh Token rotation (갱신 시 이전 토큰 무효화) | P0 |
| R-AUTH-008 | 임시 비밀번호(`usr_temp_password=true`) 최초 로그인 시 변경 강제 | P1 |
| R-AUTH-009 | 로그인 5회 연속 실패 시 `usr_status=LOCKED` — ADMIN 해제 필요 | P1 |
| R-AUTH-010 | Entity Code 유효성 사전 검증 API (Public, 캐시 TTL 60s) | P0 |
| R-AUTH-011 | EntityScopeGuard — JWT `ent_id`를 모든 Repository WHERE에 자동 주입 | P0 |
| R-AUTH-012 | 법인 SUSPENDED 시 세션 실시간 감지 → 401 + `/entity-info?reason=suspended` | P0 |
| R-AUTH-013 | URL `crp_code` ↔ JWT `crp_code` 불일치 시 403 차단 | P0 |
| R-AUTH-014 | apps.amoeba.site 포털에서 앱 사용 신청 (AMA 로그인 상태) | P0 |
| R-AUTH-015 | 사용 신청 승인 후 AMA SSO로 자동 로그인 가능 | P0 |

## 4.3 에러 코드 / Error Codes

| 코드 | HTTP | 메시지 | 발생 조건 |
|------|------|--------|---------|
| ASM-E1001 | 400 | 유효하지 않은 Entity Code입니다. | crp_code 미존재 |
| ASM-E1002 | 403 | 법인 계정이 정지되었습니다. | crp_status ≠ ACTIVE |
| ASM-E1003 | 400 | 이메일 또는 비밀번호가 올바르지 않습니다. | 사용자 미존재 (마스킹) |
| ASM-E1004 | 400 | 이메일 또는 비밀번호가 올바르지 않습니다. | Entity 불일치 (마스킹) |
| ASM-E1005 | 403 | 계정이 비활성화 또는 잠금 상태입니다. | usr_status ≠ ACTIVE |
| ASM-E1006 | 400 | 이메일 또는 비밀번호가 올바르지 않습니다. | 비밀번호 불일치 |
| ASM-E1007 | 401 | 세션이 만료되었습니다. | JWT 만료 |
| ASM-E1008 | 403 | 접근 권한이 없습니다. | 역할 불충분 |
| ASM-E1009 | 403 | Entity 정보가 필요합니다. | ent_id 없이 비-ADMIN 접근 |
| ASM-E1010 | 403 | 접근하려는 Entity와 로그인 정보가 다릅니다. | URL ≠ JWT crp_code |
| ASM-E1011 | 403 | 앱 사용이 승인되지 않은 계정입니다. | 미승인 AMA 사용자 |

---

# 5. 시스템 목표

| Goal ID | 목표명 | 설명 |
|---------|-------|------|
| G-01 | 재고 가시성 | 창고재고(WS)와 판매가능재고(ATS) 실시간 구분 |
| G-02 | 수요 예측 자동화 | 과거 출고 + 계절지수 기반 주간/월간 수요 자동 예측 |
| G-03 | 발주 최적화 | ATS + SS + LT 반영 최적 발주량 자동 산출 |
| G-04 | 발주-입고 연결 | PO 승인 → 입고예정 자동 생성 → 입고 완료 시 재고 자동 반영 |
| G-05 | 품절 예방 | 예측 수요 + ATS 기준 품절 위험 조기 경보 |
| G-06 | 채널별 분석 | 판매 채널별 출고 패턴 분석으로 채널 수요 최적화 |
| G-07 | 법인별 데이터 격리 | 모든 업무 데이터를 `ent_id` 단위로 완전 격리 |
| G-08 | 원활한 AMA 연동 | AMA 로그인 사용자가 별도 인증 없이 앱 이용 가능 |

---

# 6. 기능 요구사항

## 6.1 앱 포털 (apps.amoeba.site)

| REQ ID | 요구사항 | 우선순위 |
|--------|---------|---------|
| R-PORTAL-001 | AMA 로그인 사용자가 apps.amoeba.site 접속 시 앱 목록 표시 | P0 |
| R-PORTAL-002 | 앱별 사용 신청: Entity 이름/코드 입력 + 사용 목적 | P0 |
| R-PORTAL-003 | SYSTEM_ADMIN이 신청 승인/반려 → 승인 시 asm_corporations + asm_users 자동 생성 | P0 |
| R-PORTAL-004 | 승인된 앱 목록에서 클릭 → 해당 앱 자동 로그인 진입 | P0 |
| R-PORTAL-005 | apps 통합 로그인 페이지 (`/login`): 앱 선택 + Entity Code + email + pw | P0 |

## 6.2 상품 마스터 (M1)

| REQ ID | 요구사항 | 우선순위 |
|--------|---------|---------|
| R-M1-001 | SPU/SKU 계층 상품 체계 관리 (1 SPU : N SKU) | P0 |
| R-M1-002 | SKU별 6종 식별코드 관리 | P0 |
| R-M1-003 | 통합 코드 검색 | P0 |
| R-M1-004 | SKU 상태 관리: PENDING_IN → ACTIVE → INACTIVE → DISCONTINUED | P0 |
| R-M1-005 | 최초 입고 시 ACTIVE 자동 전환 | P0 |
| R-M1-006 | SKU 물류 속성 (MOQ, 발주단위, 중량, CBM) | P0 |
| R-M1-007 | 채널별 판매가격 관리 | P1 |
| R-M1-008 | Excel 일괄 등록 | P1 |

## 6.3 입출고 트랜잭션 (M2)

| REQ ID | 요구사항 | 우선순위 |
|--------|---------|---------|
| R-M2-001 | IN/OUT 트랜잭션 단건·일괄 등록 | P0 |
| R-M2-002 | txn_source: WMS_AUTO / MANUAL / API_SYNC / EXCEL | P0 |
| R-M2-003 | 채널 FK(chn_id) — 채널별 출고 분석 | P0 |
| R-M2-004 | PO 확정 시 입고예정(RS) 자동 생성 | P0 |
| R-M2-005 | 검품·검수 등록 (합격/불합격/파손) | P0 |
| R-M2-006 | 이상 데이터 자동 탐지 (is_anomaly 플래그) | P0 |
| R-M2-007 | M11 출고완료 + M2 OUT 트랜잭션 = 단일 DB 트랜잭션 | P0 |

## 6.4 수요 집계·예측·안전재고·발주 (M3~M6)

| REQ ID | 요구사항 | 우선순위 |
|--------|---------|---------|
| R-M3-001 | 주간·월간 자동 집계 (월요일 01:02) | P0 |
| R-M4-001 | SMA + 계절지수 수요 예측 | P0 |
| R-M5-001 | `SS = Z × σ × √(LT+RP)` 자동 산출 | P0 |
| R-M5-002 | `TS = SS + (RP+LT) × adj_demand × SI` 목표재고 산출 | P0 |
| R-M6-001 | ATS 기준 발주 트리거: `ATS < SS` (URGENT) or `ATS < TS` (NORMAL) | P0 |
| R-M6-002 | 발주량 = `CEIL(MAX(0, TS-ATS)/MOQ) × MOQ` | P0 |
| R-M6-003 | PO 확정 즉시 asm_receiving_schedules 자동 INSERT | P0 |

## 6.5 판매주문 (M11)

| REQ ID | 요구사항 | 우선순위 |
|--------|---------|---------|
| R-M11-001 | B2C/B2B 주문 등록 | P0 |
| R-M11-002 | 주문 확정 시 `inv_pending_shipment_qty += qty` (ATS 감소) | P0 |
| R-M11-003 | 출고완료 확정 시 M2 OUT 자동 생성 (단일 DB txn) | P0 |
| R-M11-004 | 주문 취소 시 `inv_pending_shipment_qty -= qty` (ATS 복원) | P0 |

---

# 7. 비기능 요구사항

| NFR ID | 항목 | 기준값 | 비고 |
|--------|------|--------|------|
| NFR-001 | API 응답 시간 | P95 ≤ 500ms | 목록 조회 기준 |
| NFR-002 | 배치 파이프라인 | ≤ 5분 (200 SKU) | 매주 월요일 01:00 |
| NFR-003 | ATS 정합성 | 오류율 0% | 재고 2원화 핵심 |
| NFR-004 | 가용성 | ≥ 99% (월간) | |
| NFR-005 | 보안 | HTTPS/TLS 1.3, bcrypt rounds≥12 | |
| NFR-006 | CORS | `ama.amoeba.site` → `apps.amoeba.site` 허용 | Cross-domain SSO |
| NFR-007 | Cookie | `Domain=.amoeba.site`, SameSite=None, Secure | AMA JWT 공유 |
| NFR-008 | 멀티테넌시 | `ent_id` 기준 법인 간 완전 격리 | Convention v2 §12 |
| NFR-009 | i18n | KO/EN (Phase 1), VI (Phase 2+) | 하드코딩 금지 |
| NFR-010 | 데이터 보존 | 트랜잭션 최소 2년 | |
| NFR-011 | DB 백업 | 일 1회 자동 | RPO 24h, RTO 4h |

---

# 8. 데이터 요구사항

## 8.1 핵심 테이블 (db_app_stock, prefix: asm_)

| 테이블명 | Prefix | 설명 | ent_id |
|---------|--------|------|--------|
| `asm_corporations` | `crp_` | 법인 마스터 (Entity) | — |
| `asm_users` | `usr_` | 사용자 계정 | ✅ crp_id |
| `asm_user_applications` | `uap_` | 앱 사용 신청 | ✅ crp_id |
| `asm_products` | `prd_` | SPU 마스터 | ✅ |
| `asm_skus` | `sku_` | SKU 마스터 | ✅ |
| `asm_inventories` | `inv_` | 재고 현황 | ✅ |
| `asm_transactions` | `txn_` | 입출고 트랜잭션 | ✅ |
| `asm_receiving_schedules` | `rcv_` | 입고예정 | ✅ |
| `asm_sales_orders` | `sod_` | 판매주문 | ✅ |
| `asm_order_batches` | `obt_` | 발주 배치 | ✅ |
| `asm_forecasts` | `fct_` | 수요 예측 | ✅ |
| `asm_safety_stocks` | `sfs_` | 안전재고 | ✅ |
| `asm_parameters` | `prm_` | 매개변수 | ✅ |
| `asm_seasonality_indices` | `ssi_` | 계절지수 | ✅ |

## 8.2 핵심 공식

```
ATS         = inv_current_qty − inv_pending_shipment_qty
SS          = Z × σ_weekly × √(LT_weeks + RP_weeks)
TargetStock = SS + (RP + LT_weeks) × adj_demand × SI
Order Qty   = CEIL(MAX(0, TargetStock − ATS) / MOQ) × MOQ
Total LT(주) = (LT1+LT2+LT3+LT4+LT5)일 ÷ 7
```

---

# 9. 통합 연동 요구사항

| 연동 대상 | INT ID | 방식 | 설명 |
|---------|--------|------|------|
| **AMA Platform** | INT-000 | JWT SSO (Cross-domain Cookie) | AMA JWT → apps 내부 JWT 변환 |
| **apps 포털** | INT-001 | 내부 API | 사용 신청 승인 → 법인/사용자 자동 생성 |
| AMB WMS | INT-002 | REST API / Excel | 입출고 동기화 |
| Shopee | INT-003 | Open API (OAuth2.0) | 주문 → M11, 출고 → M2 |
| TikTok Shop | INT-004 | TikTok API (OAuth2.0) | 동일 |

---

# 10. 제약사항

| # | 제약사항 |
|---|---------|
| 1 | 운영 URL: `https://apps.amoeba.site/app-stock-management` |
| 2 | DB `db_app_stock`, 테이블 prefix `asm_`, 컬럼 prefix 3자 |
| 3 | CORS: `ama.amoeba.site` → `apps.amoeba.site` 허용 필수 |
| 4 | AMA JWT Cookie: `Domain=.amoeba.site`, `SameSite=None`, `Secure` |
| 5 | Convention v2 준수: `ent_id` FK 전체, snake_case Req, camelCase Res |
| 6 | Style Guide v2 준수: Primary `#6366F1`, Pretendard, Header 64px |
| 7 | 프론트엔드 i18n 필수 (하드코딩 금지) — ko/en/vi 3개 언어 |
| 8 | ATS 정합성: M2 OUT + M11 pending_qty 변경은 단일 DB 트랜잭션 |
| 9 | Phase 1: 이메일 발송 Stub (콘솔 로그) |

---

## 문서 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|---------|
| v1.0 | 2026-03-29 | Amoeba Company | 최초 작성 |
| **v1.1** | **2026-03-29** | **Amoeba Company** | **멀티 호스트 아키텍처 반영: apps.amoeba.site 별도 호스트 명시. AMA SSO Cross-domain Cookie 방식 정의. apps 포털 사용 신청 흐름 추가. URL 구조 재정의. CORS/Cookie 요구사항 추가. ASM-E1011 에러코드 추가.** |

*— 문서 끝 — ASM-REQ-2026-001 v1.1*

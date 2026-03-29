# ambStockManagement
## amoeba 인벤토리 재고관리 발주예측 시스템
### 화면기획서 / Screen Planning Document

| 항목 | 내용 |
|------|------|
| **문서 번호** | ASM-SCR-2026-001 |
| **버전** | v1.1 |
| **작성일** | 2026-03-29 |
| **작성자** | Amoeba Company |
| **운영 URL** | `https://apps.amoeba.site/app-stock-management` |
| **Style Guide** | amoeba_web_style_guide_v2.md |
| **변경 이유** | 멀티 호스트 아키텍처 반영 — 인증 화면 전면 재설계 |

---

## Style Guide v2 기준

| 항목 | 값 |
|------|----|
| **Primary** | `#6366F1` (Indigo-500) |
| **Font** | Pretendard (KO/EN) |
| **Header** | 64px fixed |
| **Sidebar** | 240px / 64px collapsed |
| **Content Padding** | 24px |
| **Auth Layout** | 중앙 카드 (max-w-md, bg-white, rounded-xl, shadow-lg, p-8) |
| **Success/Warning/Error** | `#10B981` / `#F59E0B` / `#EF4444` |

---

## 호스트별 화면 구성 총괄

### apps.amoeba.site 공통 (포털 레벨)

| 화면 ID | 화면명 | URL | 접근 조건 |
|---------|--------|-----|----------|
| SCR-PORTAL-01 | 앱 포털 홈 | `apps.amoeba.site/` | AMA 로그인 상태 |
| SCR-PORTAL-02 | 앱 사용 신청 | `apps.amoeba.site/app-stock-management/apply` | AMA 로그인 상태 |
| SCR-PORTAL-03 | 통합 로그인 | `apps.amoeba.site/login?app=app-stock-management` | 누구나 |
| SCR-PORTAL-04 | Entity 안내 | `apps.amoeba.site/entity-info` | 누구나 |

### ambStockManagement 앱 레벨

| 화면 ID | 화면명 | URL | 접근 조건 |
|---------|--------|-----|----------|
| SCR-AUTH-02 | 최초 비밀번호 변경 | `apps.amoeba.site/app-stock-management/{crp_code}/auth/change-password` | 임시PW 로그인 |
| SCR-DASH-00 | 메인 대시보드 | `apps.amoeba.site/app-stock-management/{crp_code}/dashboard` | 로그인 + 유효 Entity |
| SCR-M1-01~03 | 상품 관리 | `…/{crp_code}/products`, `/skus` | OPERATOR+ |
| SCR-M2-01~06 | 입출고 관리 | `…/{crp_code}/transactions`, `/receiving-schedules` | OPERATOR+ |
| SCR-M6-01~03 | 발주 관리 | `…/{crp_code}/order-proposals`, `/order-history` | OPERATOR+ |
| SCR-M5-01~02 | 안전재고 | `…/{crp_code}/safety-stock` | OPERATOR+ |
| SCR-M7-01 | 매개변수 | `…/{crp_code}/settings/parameters` | ADMIN+ |
| SCR-M8-01 | 계절지수 | `…/{crp_code}/settings/seasonality` | ADMIN+ |
| SCR-M11-01~03 | 판매주문 | `…/{crp_code}/sales-orders` | OPERATOR+ |
| SCR-ADM-01~02 | 사용자 관리 | `…/admin/users` | SYSTEM_ADMIN |

---

# 전체 접근 흐름 다이어그램

```
[사용자 접근]
      │
      ▼
apps.amoeba.site/app-stock-management 접속
      │
      ▼
AMA JWT 쿠키(Domain=.amoeba.site) 감지?
      │
      ├─ YES ──→ POST /auth/ama-sso 검증
      │               │
      │          ┌────┴──────────────────────────────┐
      │          │ 유효 + 앱 사용 승인됨              │ 유효 + 미승인
      │          ▼                                   ▼
      │    /{crp_code}/dashboard          /apply (사용 신청)
      │    (자동 로그인 완료)
      │          │                       유효하지 않음/만료
      │          │                                   ▼
      │          │                         /login?app=app-stock-management
      │          │
      └─ NO ───→ /login?app=app-stock-management (직접 로그인)
                        │
                        ▼
               Entity Code + email + pw 입력
                        │
              ┌─────────┴─────────┐
              │ 성공               │ 실패
              ▼                   ▼
    temp_password?        에러 메시지 인라인
    ├─ YES → /change-password
    └─ NO  → /{crp_code}/dashboard
```

---

# SCR-PORTAL-01. 앱 포털 홈

**URL:** `https://apps.amoeba.site/`  
**조건:** AMA JWT 쿠키 감지 → 자동 AMA 사용자 식별  
**레이아웃:** PartnerLayout (Header 64px + Side Menu 220px)

```
┌─────────────────────────────────────────────────────────────────┐
│ [apps 포털]                            [홍길동(AMA)] [KO▼]      │ ← Header 64px
├────────────┬────────────────────────────────────────────────────┤
│ 내 앱      │                                                     │
│ 마켓플레이스│  내가 사용 중인 앱                                    │
│           │  ┌──────────────┐  ┌──────────────┐               │
│           │  │  📦           │  │  🚗           │               │
│           │  │ ambStock      │  │ CarManager   │               │
│           │  │ Management    │  │              │               │
│           │  │ AMA-001       │  │ AMA-001      │               │
│           │  │ [앱 열기]     │  │ [앱 열기]    │               │
│           │  └──────────────┘  └──────────────┘               │
│           │                                                     │
│           │  사용 가능한 앱                                       │
│           │  ┌──────────────┐                                   │
│           │  │  📊           │                                   │
│           │  │ ambStock      │                                   │
│           │  │ Management    │                                   │
│           │  │ [사용 신청]   │                                   │
│           │  └──────────────┘                                   │
└────────────┴────────────────────────────────────────────────────┘
```

**`[앱 열기]` 클릭 동작:**
```
GET /api/v1/auth/ama-sso-check?app=app-stock-management&ent_id={crp_id}
  ├─ 유효 → apps.amoeba.site/app-stock-management/{crp_code}/dashboard (자동 로그인)
  └─ 만료 → AMA JWT 갱신 후 재시도 → 실패 시 /login
```

---

# SCR-PORTAL-02. 앱 사용 신청

**URL:** `https://apps.amoeba.site/app-stock-management/apply`  
**조건:** AMA JWT 인증 상태에서만 접근 가능  
**레이아웃:** AuthLayout (중앙 카드)

```
┌─────────────────────────────────────────────────────────────────┐
│                    [apps.amoeba.site 로고]                       │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │  📦 ambStockManagement 사용 신청                         │  │
│   │  amoeba 인벤토리 재고관리 발주예측 시스템                  │  │
│   │  ─────────────────────────────────────────────────────  │  │
│   │                                                         │  │
│   │  신청인 정보 (AMA 계정에서 자동 로드)                     │  │
│   │  이름:   홍 길 동                       (변경 불가)       │  │
│   │  이메일: hong@amoeba.site              (변경 불가)       │  │
│   │                                                         │  │
│   │  법인(Entity) 정보                                       │  │
│   │  Entity 이름 *   [Amoeba Company Limited___________]    │  │
│   │  Entity Code *   [AMA-001_________________________]     │  │
│   │                  영문·숫자·하이픈, 최대 20자. 변경 불가.   │  │
│   │                                                         │  │
│   │  담당자 정보                                             │  │
│   │  담당자명 *      [Kim Igyong_______________________]    │  │
│   │  연락처 이메일 * [ceo@amoeba.site___________________]   │  │
│   │                                                         │  │
│   │  사용 목적                                               │  │
│   │  [____________________________________________]         │  │
│   │  [____________________________________________]         │  │
│   │                                                         │  │
│   │  [취소]                              [신청 제출]         │  │
│   └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**제출 후 처리:**
- `asm_user_applications (uap_status=PENDING)` INSERT
- SYSTEM_ADMIN 알림 발송
- 성공 화면: `"신청이 완료되었습니다. 승인 후 이메일로 안내드립니다."`

---

# SCR-PORTAL-03. 통합 로그인 (직접 로그인)

**URL:** `https://apps.amoeba.site/login?app=app-stock-management&entity={crp_code}`  
**레이아웃:** AuthLayout (Style Guide v2 §3.3)

```
┌─────────────────────────────────────────────────────────────────┐
│                    [apps.amoeba.site 로고]                       │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │  [AMA로 자동 로그인 시도 중... ⟳]                        │  │  ← AMA SSO 진행 시 표시
│   │  ─────────────────────────────────────────────────────  │  │     (3초 타임아웃 후 폼 표시)
│   │                                                         │  │
│   │  📦 ambStockManagement                                  │  │
│   │  amoeba 인벤토리 재고관리 발주예측 시스템                  │  │
│   │                                                         │  │
│   │  ┌─────────────────────────────────────────────────┐   │  │
│   │  │  🏢 Amoeba Company Limited          [변경]       │   │  │  ← Entity 배너
│   │  │     AMA-001                                      │   │  │    (URL ?entity= 자동 로드)
│   │  └─────────────────────────────────────────────────┘   │  │
│   │                                                         │  │
│   │  이메일 *                                                │  │
│   │  [hong@amoeba.site_________________________________]   │  │
│   │                                                         │  │
│   │  비밀번호 *                                              │  │
│   │  [•••••••••••••••••••••••••••] [👁]                   │  │
│   │                                                         │  │
│   │  [🔴 인라인 에러: 이메일 또는 비밀번호가 올바르지 않습니다.│  │  ← 조건부 표시
│   │   (2/5회 실패)]                                         │  │
│   │                                                         │  │
│   │  ┌─────────────────────────────────────────────────┐   │  │
│   │  │                    로그인                        │   │  │
│   │  └─────────────────────────────────────────────────┘   │  │
│   │                                                         │  │
│   │  또는                                                    │  │
│   │  [AMA 계정으로 로그인] → ama.amoeba.site/login 이동      │  │  ← AMA 로그인 링크
│   │                                                         │  │
│   │  계정이 없으신가요? → 사용 신청                            │  │
│   └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**컴포넌트 명세:**

| 요소 | 동작 |
|------|------|
| AMA SSO 배너 | 페이지 로드 시 AMA JWT 쿠키 감지 → `POST /auth/ama-sso` 시도 → 성공 시 대시보드 이동 |
| Entity 배너 | URL `?entity=AMA-001` → `GET /entities/AMA-001/validate` → crp_name 자동 표시 |
| `[변경]` 링크 | → `apps.amoeba.site/entity-info` (Entity Code 재입력) |
| 이메일 Input | 이메일 형식 실시간 검증 |
| 비밀번호 Input | `[👁]` 표시/숨김 토글 |
| `[로그인]` 버튼 | `POST /api/v1/auth/login` |
| `[AMA 계정으로 로그인]` | `ama.amoeba.site/login?redirect=apps.amoeba.site/app-stock-management` |
| 사용 신청 링크 | `apps.amoeba.site/app-stock-management/apply` |

**Entity Code 없이 접근 시:**
- `?entity=` 파라미터 없음 → Entity 배너 없이 Entity Code 입력 필드 표시
- 입력 후 유효성 검증 → 유효하면 Entity 배너로 전환

**로그인 성공 후 라우팅:**
```
temp_password = true  → apps.amoeba.site/app-stock-management/{crp_code}/auth/change-password
temp_password = false → apps.amoeba.site/app-stock-management/{crp_code}/dashboard
```

---

# SCR-PORTAL-04. Entity 안내 페이지

**URL:** `https://apps.amoeba.site/entity-info`  
**레이아웃:** AuthLayout

```
┌─────────────────────────────────────────────────────────────────┐
│                    [apps.amoeba.site 로고]                       │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  📦 ambStockManagement                                  │  │
│   │  법인(Entity) 코드가 필요합니다.                          │  │
│   │  앱 사용이 승인된 법인 계정으로만 접속할 수 있습니다.       │  │
│   │                                                         │  │
│   │  [🔴/🟡/ℹ️ 상태 메시지 — reason 파라미터 기준]           │  │  ← 조건부
│   │                                                         │  │
│   │  법인 코드를 알고 계신가요?                               │  │
│   │  [Entity Code______________]  [접속]                    │  │
│   │                                                         │  │
│   │  ────────────────────────────────────────────────────   │  │
│   │                                                         │  │
│   │  AMA 계정이 있으신가요?                                   │  │
│   │  [AMA로 로그인] → ama.amoeba.site/login                 │  │
│   │  (로그인 후 앱 포털에서 사용 신청 가능)                   │  │
│   │                                                         │  │
│   │  📧 support@amoeba.site                                 │  │
│   └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**상태 메시지 배리언트:**

| reason | 메시지 | 색상 |
|--------|--------|------|
| `not_found` | 입력하신 법인 코드를 찾을 수 없습니다. | 🔴 Error |
| `suspended` | 해당 법인 계정이 일시 정지되었습니다. | 🟡 Warning |
| `inactive` | 해당 법인 계정이 비활성 상태입니다. | ⚫ Gray |
| `expired` | 세션이 만료되었습니다. 다시 로그인해 주세요. | ℹ️ Info |
| `unauthorized` | 앱 사용이 승인되지 않은 계정입니다. [사용 신청하기] | 🟡 Warning |

---

# SCR-AUTH-02. 최초 비밀번호 변경 (강제)

**URL:** `https://apps.amoeba.site/app-stock-management/{crp_code}/auth/change-password`  
**트리거:** `usr_temp_password=true` 로그인 직후 강제 이동. 완료 전 다른 페이지 차단.  
**레이아웃:** AuthLayout

```
┌─────────────────────────────────────────────────────────────────┐
│                    [ambStockManagement 로고]                     │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  🏢 Amoeba Company Limited (AMA-001)                   │  │
│   │  ─────────────────────────────────────────────────────  │  │
│   │  🔑 비밀번호 변경 필요                                   │  │
│   │  임시 비밀번호로 로그인되었습니다.                        │  │
│   │  보안을 위해 새 비밀번호를 설정해 주세요.                 │  │
│   │                                                         │  │
│   │  현재(임시) 비밀번호 *  [____________________] [👁]     │  │
│   │  새 비밀번호 *          [____________________] [👁]     │  │
│   │  ✅8자+ ✅영문 ✅숫자 ✅특수문자 (실시간 검증)            │  │
│   │  새 비밀번호 확인 *     [____________________] [👁]     │  │
│   │                                                         │  │
│   │  [변경하기]                                              │  │
│   └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

# SCR-DASH-00. 메인 대시보드

**URL:** `https://apps.amoeba.site/app-stock-management/{crp_code}/dashboard`  
**레이아웃:** Basic-A-1 (Style Guide v2 §2.1)

```
GNB (64px):
┌─────────────────────────────────────────────────────────────────┐
│ [ambSM]  🏢 AMA-001 · Amoeba Company Limited  [🔔][홍길동▾][KO▼]│
└─────────────────────────────────────────────────────────────────┘

Body:
┌─────────────┬───────────────────────────────────────────────────┐
│  LNB 240px  │  Content (24px padding)                           │
│             │                                                   │
│  [대시보드]  │  ┌─────────────────────────────────────────────┐  │
│  재고 관리  │  │  🟣 안녕하세요, 홍길동 님!                    │  │
│   · 상품   │  │  AMA-001 · Amoeba Company Limited            │  │
│   · 입출고 │  └─────────────────────────────────────────────┘  │
│   · 입고예정│                                                   │
│  발주 관리  │  [🔴품절위험 12] [🟡발주필요 8] [🟢활성SKU 325] [🟠대기주문 23]│
│   · 발주   │                                                   │
│  수요·예측  │  재고 상태 분포          품절위험 Top 5            │
│  판매주문   │  [Donut 🟢🟡🔴🔵]      [Table ATS/SS/예상품절일] │
│  설정      │                                                   │
│  ─────────  │  최근 7일 입출고 추이                              │
│  [로그아웃] │  [Line Chart — 입고(파랑) / 출고(주황)]            │
└─────────────┴───────────────────────────────────────────────────┘
```

**GNB Entity 뱃지 — 접속 법인 항상 표시:**
```
┌──────────────────────────────────────────┐
│ 🏢  AMA-001 · Amoeba Company Limited     │  bg-primary-50, border-primary-200
└──────────────────────────────────────────┘
```
다른 Entity 접근 시도 → URL `crp_code` ↔ JWT `crp_code` 불일치 → 현재 Entity로 강제 복귀

---

# SCR-M6-01. 발주 제안 목록

**URL:** `…/{crp_code}/order-proposals`

```
페이지 헤더: 발주 제안 관리

┌──────────────────────────────────────────────────────────────────┐
│ 배치: 2026-03-25 (월) · 상태: 🟡 PENDING              [승인 요청] │
├──────────────────────────────────────────────────────────────────┤
│ SKU코드   │ 상품명  │  ATS │  SS │목표재고│제안수량│조정수량│우선순위│
│ ASM-S-001│ 이유식큐│  15  │  22 │  180  │  200  │[200↕] │🔴긴급  │
│ ASM-S-002│ 스푼세트│  45  │   8 │   90  │   60  │[ 60↕] │🟡일반  │
├──────────────────────────────────────────────────────────────────┤
│ 총 예상금액: ₩1,560,000 VND                    [수량 조정 저장]   │
└──────────────────────────────────────────────────────────────────┘
```

---

# SCR-M2-04. 입고예정 현황

**URL:** `…/{crp_code}/receiving-schedules`

```
페이지 헤더: 입고예정 현황

┌──────────────────────────────────────────────────────────────────┐
│ [PO번호___________] [검색]  상태:[전체▼]  예정일:[____~____]     │
├──────────────────────────────────────────────────────────────────┤
│ PO번호       │SKU코드  │상품명   │예정수량│실입고│예정일│상태       │
│ PO-2026-001 │ASM-S-001│이유식큐브│  500  │  — │3.30 │🟡발주확정  │
│ PO-2026-002 │ASM-S-002│스푼세트  │  200  │  — │4.05 │🔵선적중    │
│ PO-2026-001 │ASM-S-003│찜기세트  │  100  │ 98 │3.28 │🟢입고완료  │
├──────────────────────────────────────────────────────────────────┤
│ 행 클릭 → 검품·검수 사이드 패널 슬라이드 오픈                     │
└──────────────────────────────────────────────────────────────────┘
```

---

# SCR-M7-01. 매개변수 관리

**URL:** `…/{crp_code}/settings/parameters`

```
페이지 헤더: 매개변수 관리    [저장]

서비스 수준:  ○ 90% (Z=1.28)  ● 95% (Z=1.65)  ○ 99% (Z=2.33)

리드타임 (5단계 → 총 LT 자동 합산)
┌──────────────────────────────────────────────────────────────────┐
│ LT1 제품준비  │ [7 ] 일  발주 후 제조·포장 완료               │
│ LT2 수출선적  │ [2 ] 일  공장 출고 ~ 선박 적재               │
│ LT3 항해·운송 │ [14] 일  해상 운송 (한국→베트남)              │
│ LT4 통관      │ [3 ] 일  베트남 수입 통관                     │
│ LT5 창고입고  │ [2 ] 일  항구→AMB 창고                       │
│ ────────────  │ ─────────────────────────────────────────────  │
│ 총 LT         │ 28일 = 4.0주  (자동 계산)                    │
└──────────────────────────────────────────────────────────────────┘

리뷰 주기: [1] 주    정기 발주 주기: [4] 주
[변경 이력 보기]
```

---

# 공통 컴포넌트 / Common Components

## StatusBadge (Style Guide v2 §7.6)

| 상태 | 스타일 |
|------|--------|
| ACTIVE / 정상 / APPROVED | `bg-green-100 text-green-800` |
| SUSPENDED / 주의 / PENDING | `bg-yellow-100 text-yellow-800` |
| LOCKED / 위험 / REJECTED | `bg-red-100 text-red-800` |
| INACTIVE / 취소 | `bg-gray-100 text-gray-600` |
| URGENT | `bg-red-100 text-red-800 font-semibold` |
| NORMAL | `bg-yellow-100 text-yellow-800` |

## Button (Style Guide v2 §7.1)

```
primary   : bg-primary-500 text-white hover:bg-primary-600  h-10 rounded-lg px-4
secondary : bg-gray-100 text-gray-700 hover:bg-gray-200
outline   : border border-gray-300 text-gray-700 hover:bg-gray-50
danger    : bg-red-500 text-white hover:bg-red-600
```

## Alert (인라인 메시지)

```
error   : bg-red-50 border border-red-200 text-red-800 rounded-lg p-3
warning : bg-yellow-50 border border-yellow-200 text-yellow-800
info    : bg-blue-50 border border-blue-200 text-blue-800
```

## EntityBadge (앱 전역 고정)

```
GNB 내 법인 뱃지:
bg-primary-50 border border-primary-200 rounded-lg px-3 py-1.5
🏢 {crp_code} · {crp_name}
```

---

## 문서 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|---------|
| v1.0 | 2026-03-29 | Amoeba Company | 최초 작성 |
| **v1.1** | **2026-03-29** | **Amoeba Company** | **멀티 호스트 아키텍처 반영. 화면 URL 전체를 `apps.amoeba.site/*` 기준으로 재정의. SCR-PORTAL-01(앱 포털 홈), SCR-PORTAL-02(사용 신청), SCR-PORTAL-03(통합 로그인), SCR-PORTAL-04(Entity 안내) 신규 설계. 통합 로그인 화면에 AMA SSO 자동 시도 + 직접 로그인 + AMA 로그인 링크 3가지 경로 명시. Entity 배너(URL ?entity= 자동 로드) 컴포넌트 명세 추가.** |

*— 문서 끝 — ASM-SCR-2026-001 v1.1*

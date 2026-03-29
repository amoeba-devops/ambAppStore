# ambStockManagement
## amoeba 인벤토리 재고관리 발주예측 시스템
### 기능명세서 / Functional Specification Document

| 항목 | 내용 |
|------|------|
| **문서 번호** | ASM-FDS-2026-001 |
| **버전** | v1.1 |
| **작성일** | 2026-03-29 |
| **작성자** | Amoeba Company |
| **운영 URL** | `https://apps.amoeba.site/app-stock-management` |
| **DB** | `db_app_stock` / Prefix: `asm_` |
| **변경 이유** | 멀티 호스트 아키텍처 반영 — M0 인증 모듈 전면 재작성 |

---

## 프로젝트 컨벤션

| 항목 | 값 |
|------|----|
| 프로젝트 코드 | `ASM` |
| DB | `db_app_stock` |
| 테이블 Prefix | `asm_` |
| API Base Path | `/api/v1` |
| 에러 코드 | `ASM-E{4digit}` |
| 멀티테넌시 키 | `ent_id` (= crp_id) |
| Request DTO | snake_case |
| Response DTO | camelCase |

---

# M0. 인증 모듈 / Auth Module

## M0-1. 호스트 구조 개요

```
ama.amoeba.site              apps.amoeba.site
─────────────────            ─────────────────────────────────────────
AMA 본체 (인증 서버)           파트너 앱 포털 (별도 호스트)
· AMA JWT 발급               · /                     앱 포털 홈
· AMA 사용자 DB              · /login                통합 로그인
                             · /entity-info          Entity 안내
                             · /app-stock-management  ambSM 앱
                             · /app-stock-management/{crp_code}/* 앱 내부
```

**Cookie 도메인 전략:**
- AMA JWT: `Domain=.amoeba.site` → `ama.*`와 `apps.*` 모두 접근 가능
- apps 내부 JWT: `Domain=apps.amoeba.site` → apps 전용

## M0-2. 인증 방식 2가지 / Two Auth Tracks

### Track 1 — AMA SSO 자동 로그인

**진입 경로:**
- AMA(`ama.amoeba.site`)에 로그인된 상태에서 `apps.amoeba.site/app-stock-management` 접속
- AMA 앱 포털에서 ambStockManagement 클릭

**상세 흐름:**
```
[브라우저] apps.amoeba.site/app-stock-management 요청
     │ AMA_TOKEN 쿠키 자동 포함 (Domain=.amoeba.site)
     ▼
[apps FE] AMA_TOKEN 쿠키 존재 확인
     │
     ├─ 있음 → POST /api/v1/auth/ama-sso
     │          body: { ama_token }
     │                  │
     │          [apps BE] AMA Public Key로 JWT 검증
     │                  ├─ 유효 + ent_id 있음 + 앱 사용 승인됨
     │                  │     → apps 내부 JWT 발급
     │                  │     → /{crp_code}/dashboard 이동
     │                  │
     │                  ├─ 유효 + 사용 신청 안 됨
     │                  │     → /app-stock-management/apply 이동
     │                  │       (앱 사용 신청 화면)
     │                  │
     │                  └─ 유효하지 않음 / 만료
     │                        → /login?app=app-stock-management
     │
     └─ 없음 → /login?app=app-stock-management
```

### Track 2 — 직접 로그인 (Entity Code + Email + Password)

**진입 경로:**
- `https://apps.amoeba.site/login?app=app-stock-management&entity={crp_code}` 직접 접속
- apps 포털 통합 로그인 페이지에서 앱 선택 후 진입

**상세 흐름:**
```
[사용자] Entity Code + 이메일 + 비밀번호 입력
     │
     ▼
POST /api/v1/auth/login
{
  "entity_code": "AMA-001",
  "email": "hong@amoeba.site",
  "password": "••••••••"
}
     │
     ▼ 검증 단계 (순서 보장)

Step 1. Entity Code 검증
  crp_code 존재?         NO  → ASM-E1001 ENTITY_NOT_FOUND
  crp_status = ACTIVE?   NO  → ASM-E1002 ENTITY_SUSPENDED
  crp_deleted_at IS NULL?NO  → ASM-E1001

Step 2. 사용자 검증
  usr_email 존재?               NO  → ASM-E1003 (보안 마스킹)
  usr.ent_id = corp.crp_id?     NO  → ASM-E1004 (보안 마스킹)
  usr_status = ACTIVE?          NO  → ASM-E1005
  ※ E1003, E1004 → 동일 메시지 노출 (계정 존재 여부 노출 방지)

Step 3. 비밀번호 검증
  bcrypt.compare()              NO  → ASM-E1006 + fail_count++
                                       5회 → usr_status=LOCKED

Step 4. apps 내부 JWT 발급
  payload: {
    sub: usr_id,
    ent_id: crp_id,
    crp_code: "AMA-001",
    role: "OPERATOR",
    name: "홍길동",
    temp_password: false,
    source: "DIRECT"  ← Track 구분용
  }
     │
     ▼
temp_password = true  → /{crp_code}/auth/change-password (강제)
temp_password = false → /{crp_code}/dashboard
```

## M0-3. JWT Payload 구조

```typescript
interface AsmJwtPayload {
  sub: string;           // usr_id (UUID)
  ent_id: string | null; // crp_id — 데이터 격리 기준 (SYSTEM_ADMIN: null)
  crp_code: string | null; // Corporation Code — URL 매칭용
  role: 'OPERATOR' | 'MANAGER' | 'ADMIN' | 'VIEWER' | 'SYSTEM_ADMIN';
  name: string;          // usr_name
  temp_password: boolean;
  source: 'AMA_SSO' | 'DIRECT'; // 인증 경로 구분
  iat: number;
  exp: number;           // Access: 15min / Refresh: 7days
}
```

## M0-4. EntityScopeGuard 구현

```typescript
@Injectable()
export class EntityScopeGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user: AsmJwtPayload = req.user;

    // SYSTEM_ADMIN — 전체 데이터 접근
    if (user.role === 'SYSTEM_ADMIN') return true;

    // ent_id 없는 비-ADMIN → 차단
    if (!user.ent_id)
      throw new ForbiddenException({ code: 'ASM-E1009' });

    // URL crp_code ↔ JWT crp_code 일치 확인
    const urlCrpCode = req.params.crp_code;
    if (urlCrpCode && urlCrpCode !== user.crp_code)
      throw new ForbiddenException({ code: 'ASM-E1010' });

    // 법인 상태 실시간 확인 (Redis 캐시 TTL: 60s)
    const isActive = await this.corpCacheService.isActive(user.ent_id);
    if (!isActive)
      throw new UnauthorizedException({ code: 'ASM-E1002' });

    // req에 ent_id 주입 → 하위 Repository 자동 사용
    req.entId = user.ent_id;
    return true;
  }
}
```

## M0-5. 앱 사용 신청 / App Usage Application

**테이블:** `asm_user_applications` (uap_), `asm_corporations` (crp_)

```
[apps 포털] /app-stock-management/apply
     │ AMA JWT 인증 상태에서만 접근 가능
     │
     ▼
사용자 입력:
  · Entity 이름 (법인명): "Amoeba Company Limited"
  · Entity Code (희망): "AMA-001"
  · 사용 목적/담당자 정보
     │
     ▼
POST /api/v1/corp/apply
  → asm_user_applications (uap_status=PENDING) INSERT
  → SYSTEM_ADMIN에게 알림
     │
     ▼
SYSTEM_ADMIN 승인
  → asm_corporations INSERT (crp_status=ACTIVE)
  → asm_users INSERT (신청자 계정, usr_temp_password=true)
  → 승인 이메일 발송 (임시 비밀번호 포함)
  → AMA SSO 재시도 시 자동 로그인 가능
```

## M0-6. 기능 목록

| FR ID | 기능명 | 설명 | 역할 |
|-------|--------|------|------|
| FR-M0-001 | AMA SSO 자동 로그인 | AMA JWT 쿠키 → apps 내부 JWT 발급 | 전체 |
| FR-M0-002 | 직접 로그인 | Entity Code + email + pw → JWT 발급 | 전체 |
| FR-M0-003 | 앱 사용 신청 | AMA 사용자의 앱 사용 신청 제출 | AMA 사용자 |
| FR-M0-004 | 신청 승인 → 법인·계정 자동 생성 | 승인 시 crp + usr 자동 INSERT | SYSTEM_ADMIN |
| FR-M0-005 | Access/Refresh Token 관리 | 발급, 갱신, 무효화 | 전체 |
| FR-M0-006 | 임시 비밀번호 변경 강제 | `temp_password=true` 시 강제 이동 | 시스템 자동 |
| FR-M0-007 | 로그인 실패 추적 + 잠금 | 5회 실패 → LOCKED | 시스템 자동 |
| FR-M0-008 | Entity Code 유효성 사전 검증 | Public API, 캐시 60s | Public |
| FR-M0-009 | 로그아웃 | Refresh Token 무효화 | 전체 |

## M0-7. API 엔드포인트 (인증)

| Method | Endpoint | 기능 | 인증 |
|--------|----------|------|------|
| POST | `/api/v1/auth/ama-sso` | AMA JWT → apps 내부 JWT | Public |
| POST | `/api/v1/auth/login` | 직접 로그인 | Public |
| POST | `/api/v1/auth/refresh` | Access Token 갱신 | Refresh Token |
| POST | `/api/v1/auth/logout` | 로그아웃 | JWT |
| POST | `/api/v1/auth/change-password` | 비밀번호 변경 | JWT |
| GET | `/api/v1/entities/:crp_code/validate` | Entity Code 검증 | Public |
| GET | `/api/v1/entities/me` | 현재 세션 Entity 정보 | JWT |
| POST | `/api/v1/corp/apply` | 앱 사용 신청 | AMA JWT |
| GET | `/api/v1/corp/applications` | 신청 목록 | SYSTEM_ADMIN |
| PATCH | `/api/v1/corp/applications/:id/approve` | 신청 승인 | SYSTEM_ADMIN |
| PATCH | `/api/v1/corp/applications/:id/reject` | 신청 반려 | SYSTEM_ADMIN |

---

# M1. 상품 마스터 / Product Master

*(v1.0 내용 유지 — 변경 없음)*

**테이블:** `asm_products` (prd_), `asm_skus` (sku_), `asm_sku_id_codes` (sic_)

SPU/SKU 계층 + 6종 식별코드 + 상태 관리 (PENDING_IN → ACTIVE → INACTIVE → DISCONTINUED)

| FR ID | 기능명 | 역할 |
|-------|--------|------|
| FR-M1-001 | SPU/SKU 등록·수정 | OPERATOR+ |
| FR-M1-002 | 6종 식별코드 관리 | OPERATOR+ |
| FR-M1-003 | 통합 코드 검색 | OPERATOR+ |
| FR-M1-004 | SKU 상태 관리 | OPERATOR+ |
| FR-M1-005 | 최초 입고 시 ACTIVE 자동 전환 | 시스템 자동 |
| FR-M1-006 | 채널별 판매가격 관리 | OPERATOR+ |
| FR-M1-007 | Excel 일괄 등록 | OPERATOR+ |

---

# M2. 입출고 트랜잭션 / Warehouse Transactions

*(v1.0 내용 유지 — ATS 이벤트 규칙 핵심)*

**ATS 이벤트 규칙:**

| 이벤트 | WS | PS | ATS |
|--------|----|----|-----|
| M11 주문 확정 | — | +qty | 감소 |
| M2 출고완료 (단일 DB txn) | −qty | −qty | 순변화 0 |
| M11 주문 취소 | — | −qty | 증가 |
| M2 창고 입고 | +qty | — | 증가 |

| FR ID | 기능명 | 역할 |
|-------|--------|------|
| FR-M2-001 | 입출고 내역 조회·등록 | OPERATOR+ |
| FR-M2-002 | Excel 일괄 업로드 | OPERATOR+ |
| FR-M2-003 | 입고예정(RS) 관리 | OPERATOR+ |
| FR-M2-004 | 검품·검수 등록 | OPERATOR+ |
| FR-M2-005 | 이상 데이터 탐지·관리 | OPERATOR+ |

---

# M3~M8. 수요·발주·설정 모듈

*(v1.0 내용 유지 — 핵심 공식 요약)*

```
[배치 파이프라인 — 매주 월요일 01:00]
01:02 → 주간 집계 (asm_weekly_aggregations)
01:03 → 월간 집계 (asm_monthly_aggregations)
01:03 → 수요 예측 = SMA × SI (asm_forecasts)
01:04 → SS = Z × σ × √(LT+RP) (asm_safety_stocks)
01:04 → 발주 제안 = CEIL(MAX(0,TS-ATS)/MOQ)×MOQ (asm_order_batches)
01:05 → URGENT 알림 발송
```

---

# M9. 대시보드·리포트 / Dashboard & Reports

*(v1.0 내용 유지)*

---

# M10. 데이터 연동 / Integration

*(v1.0 내용 유지)*

---

# M11. 판매주문 / Sales Orders

*(v1.0 내용 유지 — 핵심: 단일 DB 트랜잭션)*

```typescript
// 출고완료 확정 — 반드시 단일 DB 트랜잭션
async completeOutbound(orderId: string, entId: string) {
  return this.dataSource.transaction(async (manager) => {
    // 1. M11 상태 업데이트
    await manager.update(SalesOrderEntity, orderId, { status: 'DELIVERED' });
    // 2. M11 pending_shipment_qty 차감
    await manager.decrement(InventoryEntity, { entId, skuId }, 'invPendingShipmentQty', qty);
    // 3. M2 OUT 트랜잭션 자동 생성
    await manager.insert(TransactionEntity, { entId, txnType: 'OUT', ... });
    // 4. M2 현재고 차감
    await manager.decrement(InventoryEntity, { entId, skuId }, 'invCurrentQty', qty);
  });
}
```

---

## 문서 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|---------|
| v1.0 | 2026-03-29 | Amoeba Company | 최초 작성 |
| **v1.1** | **2026-03-29** | **Amoeba Company** | **멀티 호스트 아키텍처 반영. M0 인증 모듈 전면 재작성: apps.amoeba.site 별도 호스트 구조, AMA SSO Cross-domain Cookie 흐름, 직접 로그인 Track 2, 앱 사용 신청 흐름(FR-M0-003/004), EntityScopeGuard 구현, API 엔드포인트 `/auth/ama-sso` + `/corp/apply` 추가.** |

*— 문서 끝 — ASM-FDS-2026-001 v1.1*

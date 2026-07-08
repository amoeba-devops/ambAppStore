# 요구사항분석서 — HS Code Manager 전역 참조 매핑 테넌트 격리

- **문서 ID**: REQ-20260709-HSCode-전역참조매핑-테넌트격리
- **작성일**: 2026-07-09
- **대상 앱**: HS Code Manager (`/app-hscode`)
- **유형**: 보안 / 멀티테넌시 격리
- **관련 요청**: "hscode manager도 테넌트별로 구분사용되어야 한다 — 반영 여부 확인"
- **비고**: [`REQ-20260709-HSCode-설정화면401인증오류`](REQ-20260709-HSCode-설정화면401인증오류.md)(인증)와 **별개 항목**.

---

## 1. 요구사항 요약

| # | 요구사항 | 유형 |
|---|----------|------|
| R1 | 테넌트(ent_id) 고유 데이터는 컬럼·가드·쿼리 전 계층에서 격리된다 | 필수 |
| R2 | ent_id가 없는 **전역 참조 테이블**(GPC→HS6, HS6→국가확장)의 **쓰기**는 테넌트 관리자가 수행할 수 없어야 한다(크로스테넌트 오염 방지) | 버그/보안 |
| R3 | 전역 참조 **읽기**는 표준 참조 공유 목적상 테넌트 관리자에게 허용한다 | 기능 |

> **핵심**: 감사 결과 테넌트 고유 데이터 격리는 **양호**하나, 전역 참조 매핑 2종의 **쓰기 엔드포인트가 테넌트 관리자에게 노출**되어 한 테넌트가 전 테넌트 공용 데이터를 변경할 수 있었다.

---

## 2. AS-IS 현황 분석

### 2.1 테넌트 격리 (양호 — 검증됨)

| 계층 | 확인 | 근거 |
|------|------|------|
| 전역 인증 가드 | 모든 컨트롤러(9)·전 엔드포인트 `@Auth()`/`@AdminOnly()`, `@Public` 0건. `EntityScopeGuard`가 ent_id 없는 요청 차단 | `auth/decorators/auth.decorator.ts`, `auth/guards/entity-scope.guard.ts` |
| 엔티티 컬럼 | 테넌트 데이터 8개 테이블 모두 `ent_id` 보유 | app-setting, gtin-map, hs-reference, import-batch, query-log, resolution-audit, review-queue, product-master |
| 읽기 쿼리 | RAG 벡터/키워드/인용(RAW SQL 포함), 분류 룩업, 리뷰, 설정, import 목록 — 전부 `ent_id` 필터 | `search-core/semantic-retrieval.service.ts:63,80`, `result.service.ts:60`, `gtin/layer1-direct-map.service.ts:22` |
| 쓰기 create() | 전 create()가 `entId` 설정 | query-log, audit, review→gtin-map, app-setting, hs-reference, import-batch |

### 2.2 격리 공백 (문제점)

| 테이블(ent_id 없음, 전역) | 쓰기 엔드포인트 | 문제 |
|---------------------------|----------------|------|
| `hsm_gpc_hs_maps` | `POST /reference/maps/gpc` | `@AdminOnly()`뿐 → 아무 테넌트 관리자가 전 테넌트 공용 GPC→HS6 매핑 upsert. `entId` 인자 없음 |
| `hsm_hs_country_extensions` | `POST /reference/maps/country-ext` | 동일. 전역 관세율/설명을 테넌트 관리자가 변경 |

- 파일: `domain/mapping/service/mapping.service.ts:43,56`(upsert), `domain/mapping/controller/mapping.controller.ts`(구 `@AdminOnly()`).
- `RoleGuard.ADMIN_ROLES=['ADMIN','MASTER','SUPER_ADMIN']`는 **테넌트 관리자(MASTER/ADMIN)와 플랫폼 슈퍼관리자(SUPER_ADMIN)를 구분하지 않음**.
- 영향: 전역 데이터가 분류 로직(country-expander, gpc)에 쓰이므로 **테넌트 A 편집이 테넌트 B 결과에 영향**, **변경 주체 감사 부재**.

> GPC 브릭/국가 HS 확장은 국제·국가 표준 참조 → **읽기 전역 공유는 타당**. 문제는 **테넌트 관리자 쓰기 노출**뿐.

---

## 3. TO-BE 요구사항

| AS-IS | TO-BE |
|-------|-------|
| 전역 매핑 쓰기 = `@AdminOnly()` (테넌트 관리자 가능) | 전역 매핑 쓰기 = `@SuperAdminOnly()` (플랫폼 `SUPER_ADMIN`만) |
| 슈퍼관리자/테넌트관리자 미구분 | `RoleGuard`에 슈퍼관리자 분기 추가(fail-closed) |
| 전역 읽기 | 변경 없음(테넌트 관리자 허용 유지) |

- **역할 모델**(AMA): 엔티티 레벨 `MASTER`/`ADMIN`/`MEMBER`, 플랫폼 레벨 `SUPER_ADMIN`(`ambManagement auth.decorator.ts`).
- **정책**: 전역 참조 쓰기는 플랫폼 중앙 관리. 테넌트별 커스터마이징이 필요해지면 별도 요구사항으로 `ent_id` 도입 검토.

---

## 4. 갭 분석

| 영역 | 현재 | 변경 | 영향도 |
|------|------|------|--------|
| Backend 인증 | `@AdminOnly()` 전역쓰기 | `@SuperAdminOnly()` + RoleGuard 분기 | 중(권한 축소) |
| DB | — | 변경 없음(전역 테이블 스키마 유지) | 없음 |
| Frontend | 전역 매핑 편집 UI(있다면) | 슈퍼관리자만 노출/동작 — 후속 | 낮음 |

- 변경 파일: `auth/decorators/super-admin-only.decorator.ts`(신규), `auth/guards/role.guard.ts`(수정), `domain/mapping/controller/mapping.controller.ts`(수정).
- **DB 마이그레이션 불필요**.

---

## 5. 사용자 플로우

```
[테넌트 관리자(MASTER/ADMIN)]
   GET  /reference/maps/gpc, /country-ext        → 200 (읽기 허용)
   POST /reference/maps/gpc, /country-ext        → 403 FORBIDDEN_ROLE (차단) ✅

[플랫폼 슈퍼관리자(SUPER_ADMIN)]
   POST /reference/maps/gpc, /country-ext        → 200 (전역 참조 관리) ✅
```

---

## 6. 기술 제약사항

- **Fail-closed 의존성**: AMA app_store SSO 토큰이 플랫폼 운영자에게 `role:'SUPER_ADMIN'`을 **실제 발급**해야 전역 매핑 편집이 가능. 미발급 시 두 쓰기 엔드포인트는 API로 접근 불가(안전하게 닫힘) → 전역 참조는 seed/DB 중앙 관리.
- `RoleGuard`는 전역 `JwtAuthGuard` 통과(=유효 토큰) 이후 실행 → 본 변경은 401(인증)과 독립.
- 멀티테넌시 원칙(CLAUDE.md): 전역 참조 테이블은 ent_id 예외이나, 쓰기 권한은 플랫폼으로 상향.

# 작업계획서 — HS Code Manager 전역 참조 매핑 테넌트 격리

- **문서 ID**: PLAN-20260709-HSCode-전역참조매핑-테넌트격리
- **작성일**: 2026-07-09
- **선행 문서**: [`REQ-20260709-HSCode-전역참조매핑-테넌트격리`](../analysis/REQ-20260709-HSCode-전역참조매핑-테넌트격리.md)
- **브랜치**: `feature/hscode-manager`
- **상태**: 백엔드 구현 완료(본 계획은 구현 반영 기록 + 후속 검증/배포 절차)

---

## 1. 시스템 개발 현황 분석

- **인증 체계**: 전역 `JwtAuthGuard`(passport-jwt) → `@Auth()`(EntityScopeGuard+RoleGuard) → `@AdminOnly()`(IS_ADMIN) 계층.
- **역할 모델**(AMA): 엔티티 `MASTER`/`ADMIN`/`MEMBER`, 플랫폼 `SUPER_ADMIN`. app_store SSO 토큰은 단일 `role` → `jwt.strategy`가 `roles[]`에 반영.
- **전역 테이블**: `hsm_gpc_hs_maps`, `hsm_hs_country_extensions` (ent_id 없음, 설계상 전역 — `mapping.service.ts:14` 주석).
- **제약**: 스키마 변경 없음. 로컬 빌드는 `backend/node_modules` 필요(복구 시 제외 → `npm install` 후 `tsc`). 배포 시 이미지 재빌드.

---

## 2. 단계별 구현 계획

### Phase 1 — 슈퍼관리자 전용 가드 (구현 완료)

- **Step 1-1**: `@SuperAdminOnly()` 데코레이터 신규 — `SetMetadata(IS_SUPER_ADMIN_KEY,true)` + `Auth()`.
  - └─ 사이드 임팩트: 신규 데코레이터, 기존 `@Auth()`/`@AdminOnly()` 무영향.
- **Step 1-2**: `RoleGuard`에 `isSuperAdmin` 분기 — `SUPER_ADMIN` role만 통과, 아니면 403(fail-closed). early-return 조건에 `isSuperAdmin` 포함.
  - └─ 사이드 임팩트: 가드 공통 로직 변경 → `@AdminOnly()`/`@Roles()` 경로 회귀 필요(로직상 기존 분기 보존).
- **Step 1-3**: `mapping.controller.ts`의 `POST /reference/maps/gpc`·`POST /reference/maps/country-ext`를 `@AdminOnly()`→`@SuperAdminOnly()`. 읽기(GET gpc/country-ext/preview)·GTIN(테넌트별) 무변경.
  - └─ 사이드 임팩트: 테넌트 관리자의 전역 매핑 쓰기 차단(403). **정상적 권한 축소**.

### Phase 2 — 빌드/타입 검증

- **Step 2-1**: `npm install` → `npx tsc --noEmit`로 타입 검증.
  - └─ 사이드 임팩트: 없음(로컬).

### Phase 3 — 운영 정합 확인 & 배포 (후속)

- **Step 3-1**: AMA app_store 토큰이 플랫폼 운영자에게 `role:'SUPER_ADMIN'` 발급하는지 확인(디버그 패널 `role`). 미발급이면 전역 참조 seed/DB 관리 정책 확정.
  - └─ 사이드 임팩트: 미발급 시 전역 매핑 편집 UI 비활성(안전).
- **Step 3-2**: `main` 병합 → 스테이징 배포(이미지 재빌드) → 검증.
  - └─ 사이드 임팩트: 백엔드 재빌드. 스테이징 우선 원칙.

---

## 3. 변경 파일 목록

| 구분 | 파일 | 변경유형 |
|------|------|---------|
| Backend | `backend/src/auth/decorators/super-admin-only.decorator.ts` | 신규 |
| Backend | `backend/src/auth/guards/role.guard.ts` | 수정 |
| Backend | `backend/src/domain/mapping/controller/mapping.controller.ts` | 수정 |
| Docs | `docs/analysis/REQ-...`, `docs/plan/PLAN-...` | 신규 |

---

## 4. 사이드 임팩트 분석

| 범위 | 위험도 | 설명 |
|------|--------|------|
| 전역 매핑 쓰기 권한 | 중 | 테넌트 관리자 403화. 의도된 축소이나, 슈퍼관리자 토큰 경로 부재 시 편집 UI 무력화 → 운영 확인 필요(Step 3-1) |
| RoleGuard 공통 로직 | 중 | `@AdminOnly()`/`@Roles()` 기존 동작 보존 확인(회귀). early-return에 isSuperAdmin 추가로 기존 true 경로 불변 |
| 전역 매핑 읽기 | 낮음 | 무변경(테넌트 관리자 허용 유지) |
| 프론트 | 낮음 | 편집 UI가 있다면 슈퍼관리자만 노출하도록 후속 정렬 |

---

## 5. DB 마이그레이션

- **불필요**. 전역 테이블(`hsm_gpc_hs_maps`, `hsm_hs_country_extensions`) 스키마 유지. 본 변경은 애플리케이션 인증 계층 한정.
- (후속) 테넌트별 오버라이드가 요구되면 별도 REQ로 `ent_id` 컬럼 도입 + 데이터 마이그레이션 검토.

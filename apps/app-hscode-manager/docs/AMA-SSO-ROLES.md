# HS Code Manager — AMA SSO 역할 발급 가이드

> 본 문서는 hscode-manager 앱이 AMA SSO JWT에서 *어떤 역할 클레임을 기대하는지* 와 *AMA에서 어떻게 발급해야 하는지* 를 정의한다.
> Phase 1~4 공통 리스크 — 미설정 시 모든 mutation API가 403으로 막힌다.

---

## 1. 역할 종류

코드 정의: [`auth/decorators/roles.decorator.ts`](../backend/src/auth/decorators/roles.decorator.ts)

| 역할 | 의미 | 권한 | 사용처 |
|------|------|------|--------|
| `ADMIN` | 시스템 관리자 | 글로벌 마스터(수입국·수출국·FTA·외부소스) CUD + 사용자 역할 변경 | S17 마스터 관리 |
| `MANAGER` | 카고러시 담당자 | 본인 ent_id 범위의 Inquiry/Item/Classification CUD | S02~S11 전체 흐름 |
| `EXPERT_LOCAL` | 베트남 현지 통관사 | 본인에게 할당된 ExpertReview 조회·회신 | S14, S15 (Phase 6) |
| `EXPERT_INTERNAL` | 사내 분류 전문가 | 동일 | S14, S15 (Phase 6) |
| `VIEWER` | 읽기 전용 | 모든 GET 가능, mutation 불가 | (옵션) |

---

## 2. JWT 클레임 요구사항

[`auth/jwt.strategy.ts`](../backend/src/auth/jwt.strategy.ts) 가 다음 클레임을 추출한다:

```jsonc
{
  "sub": "user-uuid",              // 또는 "userId"
  "ent_id": "entity-uuid",         // 또는 "entityId" — 필수, 없으면 HSC-E0105
  "ent_code": "ENT_ABC",           // 또는 "entityCode"
  "email": "user@example.com",
  "name": "홍길동",                 // 선택 — 없으면 email prefix 사용
  "roles": ["MANAGER"],            // 또는 ["ADMIN", "MANAGER"] 다중 허용
  "iat": 1700000000,
  "exp": 1700086400
}
```

**필수 필드**: `sub`, `ent_id`, `email`, `roles` (배열).
**누락 시 동작**:
- `ent_id` 없음 → `HSC-E0105 (Entity scope required)`
- `roles` 비어있거나 누락 → 모든 `@Roles(...)` 가드 통과 실패 → 403 `HSC-E0104`
- JWT 자체 누락/만료 → 401 `HSC-E0101/0102`

---

## 3. AMA SSO 측 발급 절차

### 3.1 사용자별 역할 매핑 테이블 (AMA 측 운영)

AMA가 hscode-manager 앱을 *구독*하는 Entity의 사용자 목록에 다음 매핑을 적용해야 한다.

| Entity 사용자 유형 | hscode-manager 역할 |
|--------------------|---------------------|
| Entity 관리자 (`isAdmin=true`) | `ADMIN` + `MANAGER` |
| Entity 일반 사용자 | `MANAGER` |
| AMA 시스템 운영자 (카고러시 내부) | `ADMIN` + `MANAGER` |
| Mr. Nguyen / 베트남 현지 통관사 | `EXPERT_LOCAL` |
| Ms. Hau / 내부 분류 전문가 | `EXPERT_INTERNAL` |

**JWT 발급 시점**:
- 사용자가 AMA에서 hscode-manager 앱으로 진입 (iframe 또는 SSO redirect)
- AMA가 `roles` 배열을 *앱별로 다르게* 생성해야 한다
  - 예: `{"app_code": "app-hscode", "roles": ["MANAGER"]}` 매핑 테이블

### 3.2 검증 방법 (앱측)

```bash
# JWT 디코딩 후 roles 클레임 확인
echo $AMA_JWT | cut -d. -f2 | base64 -d 2>/dev/null | jq '.roles'
# 예상: ["MANAGER"] 또는 ["ADMIN", "MANAGER"]
```

또는 앱 안에서:
```bash
curl http://localhost:3102/api/v1/me \
  -H "Authorization: Bearer ${AMA_JWT}" | jq '.data.roles'
```

### 3.3 임시 대안: Entity 헤더 인증 (스테이징 디버깅 전용)

JWT 발급 흐름이 미완성인 동안 `ALLOW_ENTITY_HEADER_AUTH=true` 환경변수로 헤더 기반 우회 가능:

```bash
curl http://localhost:3102/api/v1/me \
  -H "X-Entity-Id: ent-test-001" \
  -H "X-Entity-Code: TEST" \
  -H "X-Entity-Name: Test User" \
  -H "X-Entity-Email: test@local"
```

이 경우 `roles` 는 `[]` 빈 배열로 처리되어 **mutation API는 여전히 403**.
즉, *읽기 시연*은 가능하지만 *컨펌·마스터 등록*은 불가.

운영 진입 전 반드시 AMA SSO 측에서 `roles` 클레임 발급을 완료해야 한다.

---

## 4. 운영 체크리스트

- [ ] AMA SSO 발급자 (issuer) 가 `JWT_SECRET` 환경변수와 일치하는 비밀키로 서명
- [ ] AMA가 hscode-manager 사용자의 role 매핑 테이블 확정 (5종)
- [ ] JWT `roles` 클레임 발급 검증 (`/api/v1/me` 응답에 정확히 표시)
- [ ] 첫 ADMIN 사용자 1명 이상 발급 — 그렇지 않으면 S17 마스터 관리 진입 불가
- [ ] 스테이징 환경에서 5종 역할별 시나리오 검증

---

## 5. 예외 시나리오

| 시나리오 | 동작 | 대응 |
|----------|------|------|
| JWT 만료 | 401 `HSC-E0102` | FE가 부모창에 `TOKEN_EXPIRED` postMessage 발송 |
| JWT 변조 | 401 `HSC-E0103` | 자동 로그아웃 + AMA 재로그인 |
| `roles` 누락 | 마스터 조회는 OK, mutation 403 | AMA 측 사용자 매핑 점검 요청 |
| ADMIN 미발급 | 마스터 관리 화면(S17) 진입은 가능하나 모든 버튼 403 | 운영 1명 이상 ADMIN 발급 |
| 잘못된 ent_id | 다른 Entity 데이터 조회 시도는 EntityScopeGuard가 차단 (NFR-SE-01) | 정상 동작 — 격리 검증 PASS |

---

## 6. 참조

- [auth.module.ts](../backend/src/auth/auth.module.ts)
- [jwt.strategy.ts](../backend/src/auth/jwt.strategy.ts)
- [roles.decorator.ts](../backend/src/auth/decorators/roles.decorator.ts)
- [role.guard.ts](../backend/src/auth/guards/role.guard.ts)
- [entity-scope.guard.ts](../backend/src/auth/guards/entity-scope.guard.ts)
- [me.controller.ts](../backend/src/domain/user/controller/me.controller.ts)

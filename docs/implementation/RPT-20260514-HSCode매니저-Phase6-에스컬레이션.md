---
document_id: HSCM-IMPL-RPT-PHASE6
version: 1.0.0
status: Done
created: 2026-05-14
updated: 2026-05-14
app: app-hscode-manager
phase: 6
milestone: M3 (운영 가능) — Phase 7 직전
---

# HS Code Manager — Phase 6 작업완료보고서 (에스컬레이션·전문가 검토)

> Phase 6 (에스컬레이션·전문가 검토) 구현 완료.
> 6개 트리거 검사 엔진 + 라우팅 + 차단 동작이 Classification 컨펌·Verification 발생 시점에 자동 발동한다.
> Phase 5 의 CUSTOMS_SEIZURE 발생 시 자동으로 ExpertReview 가 생성되어 전문가에게 라우팅 — 시스템이 *위험 신호를 스스로 감지해 사람의 판단으로 회수* 하는 마지막 안전망이 완성됨.

---

## 1. 완료 범위

| Step | 내용 | 결과 |
|------|------|------|
| 6.0 | DB — `hsc_expert_keyword_dictionary` (수입금지·제한 키워드 사전) + VN 시드 11건 | ✔ |
| 6.1 | EscalationService — 6개 트리거 검사 엔진 + 라우팅 (LOCAL/INTERNAL/병렬) + 자동 ExpertReview 생성 | ✔ |
| 6.2 | ExpertReview 정식 모듈 승격 — list/respond + 컨텍스트 조인 + 상태 전이 | ✔ |
| 6.3 | Classification.confirm() 통합 — commit 후 자동 트리거 검사 + Inquiry → REVIEWING | ✔ |
| 6.4 | ResponseForm 차단 가드 — 미해결 ExpertReview 존재 시 응대 양식 403 (FR-ES-03) | ✔ |
| 6.5 | Phase 5 CUSTOMS_SEIZURE 자동 연동 — 추징 발생 시 자동 ExpertReview 생성 | ✔ |
| 6.6 | Frontend — S14 큐 (역할 자동 인식) + S15 회신 (3종 verdict + 컨텍스트 + 상태 전이 안내) | ✔ |
| 6.7 | 사이드바 메뉴 추가 — "전문가 검토" / 모든 PHASE 6 i18n ko/en/vi | ✔ |
| — | Backend tsc + nest build | **PASS** |
| — | Frontend tsc + vite build (463.16 kB JS, 19.09 kB CSS) | **PASS** |

---

## 2. 신규 산출물

### 2.1 DB 마이그레이션
- `apps/app-hscode-manager/db-migrations/2026-05-13_phase6_expert-review.sql`
  - `hsc_expert_keyword_dictionary` 테이블 + VN 11건 시드 (prohibited / restricted / requires_local_check)
- `00_apply_all.sh` 갱신 — Phase 6 등록

### 2.2 Backend (12개)

```
backend/src/domain/expert-review/         (Phase 0 placeholder → 정식)
├── entity/
│   ├── expert-review.entity.ts            (기존 유지)
│   └── expert-keyword-dictionary.entity.ts (신규)
├── dto/
│   ├── request/respond-review.request.ts
│   └── response/expert-review.response.ts
├── mapper/expert-review.mapper.ts
├── service/
│   ├── escalation.service.ts              # 6개 트리거 + 라우팅 + 자동 ExpertReview 생성
│   └── expert-review.service.ts           # list/respond + 상태 전이
├── controller/expert-review.controller.ts # 3개 엔드포인트
└── expert-review.module.ts

수정:
- classification/service/classification.service.ts  # confirm() 마지막에 escalation 호출
- classification/service/response-form.service.ts   # isBlocked() 가드 추가
- classification/classification.module.ts            # ExpertReviewModule forwardRef
- verification/service/verification.service.ts       # CUSTOMS_SEIZURE 자동 에스컬레이션
- verification/verification.module.ts                # ExpertReviewModule forwardRef
- placeholder.module.ts                              # 비움 (모든 placeholder 승격 완료)
- app.module.ts                                      # ExpertReviewModule 등록
```

### 2.3 Frontend (5)

```
frontend/src/
├── pages/expert/
│   ├── EscalationQueuePage.tsx            # S14 (역할 자동 인식)
│   └── ExpertReplyPage.tsx                # S15 (3종 verdict + 컨텍스트 + 영향 안내)
├── services/expert.service.ts
├── types/expert.types.ts
└── i18n/locales/{ko,en,vi}/expert.json    (3)
```

`App.tsx` — `/expert-reviews`, `/expert-reviews/:id` 라우트.
`AppLayout.tsx` — `nav.expert` 메뉴 항목 추가.
`common.json` (ko/en/vi) — `nav.expert` 키 추가.

---

## 3. API 엔드포인트 (Phase 6 신규 3개)

| 도메인 | Method | Path | 권한 |
|--------|--------|------|------|
| expert-reviews | GET | `/api/v1/expert-reviews` | Auth (역할 자동 추출) |
| expert-reviews | GET | `/api/v1/expert-reviews/:id` | Auth |
| expert-reviews | PATCH | `/api/v1/expert-reviews/:id/respond` | Auth |

**누적 53개 엔드포인트.**

---

## 4. 핵심 설계 결정

### 4.1 6개 에스컬레이션 트리거 (FR-ES-01)

| 트리거 | 조건 | severity | 기본 라우팅 |
|--------|------|----------|-------------|
| **LOW_CONFIDENCE** | confidence < 0.6 | 60 | EXPERT_INTERNAL |
| **MULTIPLE_CANDIDATES** | 후보 ≥3 + rank1·rank2 gap < 0.1 | 50 | EXPERT_INTERNAL |
| **PROHIBITED_KEYWORD** | 키워드 사전 매칭 | 사전값 (최대 100) | 사전값 (대개 LOCAL) |
| **PAST_SEIZURE** | 동일 itemId 또는 동일 hsCode 추징 이력 | 90 | EXPERT_LOCAL |
| **CUSTOMER_REQUEST** | Inquiry memo 키워드 매칭 OR 명시 플래그 | 70 | EXPERT_INTERNAL |
| **AMOUNT_THRESHOLD** | 거래 금액 > $50K | 65 | EXPERT_INTERNAL |
| **OTHER_CATEGORY** | category=OTHER (자동) | 70 | EXPERT_INTERNAL |
| **CUSTOMS_SEIZURE_AUTO** | Phase 5 추징 발생 시 자동 호출 | n/a | (모든 트리거 함께 평가) |

복수 트리거가 동시에 충족되면 *둘 다 라우팅* — 키워드가 LOCAL 라우팅이고 금액 임계가 INTERNAL 라우팅이면 *병렬로 ExpertReview 2건* 생성.

### 4.2 라우팅 결정 알고리즘 (FR-ES-02)
```
needsLocal    = triggers.any(t.routing === 'EXPERT_LOCAL')
needsInternal = triggers.any(t.routing === 'EXPERT_INTERNAL')
routes        = []
if needsLocal:    routes.push('EXPERT_LOCAL')
if needsInternal: routes.push('EXPERT_INTERNAL')
if routes.empty:  routes.push('EXPERT_INTERNAL')  # fallback
```
- *각 역할마다 미해결 ExpertReview 가 이미 있으면 skip* (중복 적재 방지)
- 결과: 동일 분류에 대해 LOCAL 1건 + INTERNAL 1건 (병렬 검토) 가능

### 4.3 자동 트리거 시점 (E11 / FR-ES-01)
- **Classification.confirm()** 트랜잭션 commit 직후 호출
- **Verification CUSTOMS_SEIZURE** 등록 후 호출
- 두 경로 모두 동일한 `EscalationService.checkAndTriggerOnConfirm()` 호출 — 일관성 유지
- 자동 호출 실패는 *비즈니스 로직을 막지 않음* (warn 로그)

### 4.4 ResponseForm 차단 가드 (FR-ES-03)
- `ResponseFormService.render()` 진입 시 `EscalationService.isBlocked()` 호출
- `verdict=PENDING` 인 ExpertReview 가 존재하면 `ForbiddenException` 으로 차단
- 차단 메시지: `"Response form is blocked while ExpertReview is pending (FR-ES-03)"`
- 전문가가 모두 회신 (`APPROVE/REVISE/REJECT`) 한 뒤 자동 해제

### 4.5 Inquiry 상태 전이 (자동)
| 시점 | 전이 |
|------|------|
| 컨펌 직후 + 트리거 발동 | `RESPONDED → REVIEWING` |
| 마지막 ExpertReview APPROVE | `REVIEWING → RESPONDED` |
| 마지막 ExpertReview REVISE | `REVIEWING → MATCHING` (재컨펌 필요) |
| ExpertReview REJECT (어떤 것이든) | `REVIEWING → DISPUTED` + Classification → DISPUTED |

### 4.6 키워드 사전 (PROHIBITED_KEYWORD)
- VN 시드 11건 — `prohibited / restricted / requires_local_check` 3종 분류
- 각 키워드에 `routing_hint` (EXPERT_LOCAL/INTERNAL) + `severity` (0~100) 부착
- 매칭 알고리즘: item 이름 / usage_description / 추출 키워드 모두 검사 (substring + exact)
- Phase 7 에서 운영팀이 관리 UI 로 보강 가능 (현재는 시드만)

### 4.7 forwardRef 순환 의존 해소
- `ClassificationModule ↔ ExpertReviewModule` 양방향 의존
  - Classification → Escalation (confirm 시 호출)
  - Escalation → Classification (분류·후보·아이템 조회)
- `forwardRef(() => ExpertReviewModule)` + `@Inject(forwardRef(() => EscalationService))` 패턴 적용
- 동일 패턴: `VerificationModule ↔ ExpertReviewModule`

### 4.8 컨텍스트 조인 (S14·S15 표시용)
- `ExpertReviewService.buildContexts()` 가 큐 항목들의 classification·item·inquiry 를 1회 쿼리로 모음 (N+1 회피)
- 응답에 hsCode / itemName / category / 수출·수입국 코드 동봉

### 4.9 사용자 역할 기반 자동 큐 필터
- `GET /api/v1/expert-reviews` — `?role=` 미지정 시 JWT.roles 에서 자동 추출
  - `roles: ['EXPERT_LOCAL']` → role=EXPERT_LOCAL 큐만
  - `roles: ['EXPERT_INTERNAL']` → role=EXPERT_INTERNAL 큐만
  - 둘 다 또는 ADMIN → 명시적 ?role 필요
- FE S14 가 `useAuthStore` 로 사용자 역할을 읽어 자동 표시

### 4.10 ExpertReview 응답 메모 누적
- `respond()` 시 기존 notes 에 *[Expert reply]* 섹션을 append
- 트리거 메모 (자동 생성) + 전문가 회신 (수동) 이 한 필드에 누적 보존
- 사후 추적 시 *왜 이 분류가 REJECT 되었나* 답 가능

### 4.11 ExpertReview 자동 생성의 감사 로그
- 각 ExpertReview 생성마다 `AuditLog.CREATE` 1행 + 트리거 목록 보존
- 응답 처리 시 `STATUS_CHANGE` 1행
- 향후 *전문가 SLA 분석* (요청→회신 시간) 의 기반

---

## 5. TC 결과 (Phase 6)

| TC ID | 시나리오 | 상태 |
|-------|---------|------|
| TC-ES-001 | (a) confidence < 0.6 | **READY** |
| TC-ES-002 | (b) 후보 ≥3 + 1·2위 gap < 0.1 | **READY** |
| TC-ES-003 | (c) 수입금지 키워드 매칭 | **READY** (시드 11건) |
| TC-ES-004 | (d) 동일 품목 과거 추징 | **READY** |
| TC-ES-005 | (e) 고객사 명시 요청 | **READY** (memo 분석) |
| TC-ES-006 | (f) 금액 > $50K | **READY** |
| TC-ES-007 | 트리거 중복 → 한 번만 적재 | **READY** (PENDING 검사) |
| TC-ES-020 | LOCAL 라우팅 | **READY** |
| TC-ES-021 | INTERNAL 라우팅 | **READY** |
| TC-ES-022 | 병렬 (2건 생성) | **READY** |
| TC-ES-040 | REVIEWING → M4 차단 | **READY** (`HSC-E0xxx` ForbiddenException) |
| TC-ES-041 | APPROVE → 차단 해제 + RESPONDED | **READY** |
| TC-ES-042 | REVISE → Classification 재컨펌 (MATCHING) | **READY** |
| TC-ES-043 | REJECT → Classification DISPUTED + Inquiry DISPUTED | **READY** |
| TC-ES-044 | S14 본인 큐만 표시 | **READY** (JWT roles 기반) |
| TC-ES-045 | S15 컨텍스트 표시 | **READY** |

추가 통합 시나리오:
- CUSTOMS_SEIZURE 발생 시 자동 ExpertReview 1+건 생성 + Phase 5 큐 + Phase 6 큐 동시 적재 — **READY**

---

## 6. 사이드 임팩트

| 범위 | 영향 | 상태 |
|------|------|------|
| Phase 4 Classification | 컨펌 응답에 `escalation` 필드 추가됨 (기존 키 유지, 추가만) | ✔ 하위 호환 |
| Phase 5 Verification | CUSTOMS_SEIZURE 의 followUpActions 에 `EXPERT_REVIEW_AUTO` 액션 추가 | ✔ |
| ResponseForm | REVIEWING 중 응대 양식 차단 — UX 측에서 *왜 차단인지* 안내 필요 (Phase 7) | ⏸ |
| AMA SSO | `EXPERT_LOCAL` / `EXPERT_INTERNAL` 역할이 JWT.roles 에 발급되어야 큐가 동작 | ⚠ |
| placeholder.module | 빈 모듈 — 모든 placeholder 엔티티가 정식 모듈로 승격됨 | ✔ |
| 키워드 사전 | 시드 11건만 — 운영팀이 보강 필요. Phase 7 관리 UI 검토 | ⏸ |
| 순환 의존 | forwardRef 로 해소 — 런타임 안정. Phase 7 부하 테스트에서 검증 | ⚠ |

---

## 7. 누적 통계 (Phase 0~6)

- API 엔드포인트: **53개**
- DB 테이블: **18개** (placeholder 없음 — 모두 정식 사용)
- Frontend 페이지: **19개** (Dashboard + S02~S15 + S17 6탭 + 검증 등록)
- i18n 네임스페이스: **8개** (common, admin, inquiry, intake, matching, classification, verification, expert) × 3언어
- Backend 도메인 모듈: **16개**

---

## 8. 검증 명령

```bash
# Backend / Frontend
cd apps/app-hscode-manager/backend && npm run build      # exit 0
cd apps/app-hscode-manager/frontend && npm run build     # 463.16 kB JS

# DB 마이그레이션 (Phase 6 키워드 사전 시드 포함)
SEED_DEMO_DATA=true bash apps/app-hscode-manager/db-migrations/00_apply_all.sh

# 회귀 시나리오 — 에스컬레이션
# 1) 매칭 + 컨펌 (Phase 0~4)
# ...
# 2) 컨펌 시 자동 트리거 확인 — 응답에 escalation.triggered=true 또는 false
curl -X POST .../api/v1/classifications $H_AUTH -d '...' | jq '.data.escalation'

# 3) 전문가 큐 조회 (역할 자동)
curl .../api/v1/expert-reviews $H_AUTH | jq '.data[] | {id, expertRole, triggerReasonList, context}'

# 4) 회신 처리
curl -X PATCH .../api/v1/expert-reviews/${REV_ID}/respond $H_AUTH \
  -d '{"verdict":"APPROVE","notes":"분류 적합 확인"}'

# 5) Inquiry 상태 확인 — REVIEWING → RESPONDED 자동 전이
curl .../api/v1/inquiries/${INQ_ID} $H_AUTH | jq '.data.status'

# 6) 응대 양식 차단 검증 — REVIEWING 중 403
curl .../api/v1/classifications/${CLS_ID}/response-form?channel=email&lang=ko $H_AUTH
# → 403 Forbidden (FR-ES-03)
```

---

## 9. 다음 단계 (Phase 7 — 관리·KPI·운영, 2~3주, **M3 마일스톤 완성**)

Phase 7 작업 목록:
1. PolicyThreshold 도메인 (수입국별 confidence/tariff_gap/amount 임계값)
2. KPI 대시보드 (S20) — 6개월 데이터 + recharts 차트
3. 운영 지표 (NFR-AD-03) — AI 비용/지연 + 외부 어댑터 호출 비율
4. 미지원 국가 추가 요청 큐 (Phase 2 의 폼 데이터 노출)
5. 비동기 엑셀 처리 (1,000행 초과)
6. ResponseForm PDF 다운로드
7. (선택) ExpertKeywordDictionary 관리 UI

선행 작업:
- [ ] AMA SSO 의 EXPERT_LOCAL / EXPERT_INTERNAL 역할 발급 흐름 확정
- [ ] (선택) M2+M3 회귀 시연 1회

---

## 10. 회고

- **잘 된 점**:
  - 6개 트리거 + 라우팅 + 차단 + 회신의 4단 흐름이 *단일 EscalationService.checkAndTriggerOnConfirm()* 메소드에 응집됨
  - Classification.confirm() 과 Verification.create() 양쪽에서 동일한 트리거 엔진을 호출 — 일관성 유지
  - forwardRef 패턴으로 순환 의존 깔끔히 해소
  - 사용자 역할 기반 자동 큐 필터링 — 전문가가 자기 역할의 큐만 보게 됨 (UI 측 필터 불필요)
  - 컨텍스트 조인으로 N+1 회피 + 큐 화면에서 한눈에 hsCode/품명/사유 파악 가능
- **개선 여지**:
  - 키워드 사전이 시드 11건 — 운영 진입 시 *수백 건* 으로 보강 필요. Phase 7 관리 UI 추가 검토
  - PROHIBITED_KEYWORD 매칭이 simple substring — 정규식 / 동의어 지원 추가 검토
  - 전문가 *user_id 자동 할당* 미구현 — Phase 7 에서 *가장 적게 할당된 전문가* 알고리즘 또는 운영팀 수동 할당 UI
  - SLA 추적 (요청→회신 시간) 미구현 — KPI 대시보드 Phase 7
- **위험**:
  - AMA SSO 역할 발급 미설정 시 *모든 전문가 큐가 비어 보임* (자동 필터 결과). Phase 7 진입 전 반드시 검증
  - 중복 큐 방지가 *동시 트랜잭션* 에서 race condition 가능성 — Phase 7 부하 테스트 시 UNIQUE 제약 추가 검토

---

## 11. M3 마일스톤 진척도

Phase 6 완료 시점:

- ✅ Phase 0~6 P0 TC 코드 레벨 READY (50+ TC)
- ✅ end-to-end 흐름 완성 — Inquiry 생성 → 매칭 → 컨펌 → 검증 → 에스컬레이션 → 회신 → 응대
- ✅ 자동 에스컬레이션 트리거 + 차단 동작
- ⏳ **Phase 7 진입** — 정책 임계값 + KPI 대시보드 + 운영 지표 (M3 완성의 마지막 단계)

---

## 12. 사용자 안내

추천 순서:
1. ✅ 운영 환경 준비 — 완료
2. ⏳ M1~M2~M3 회귀 시연 — 권장 (환경 준비 후)
3. ⏳ **Phase 7 시작** — M3 마일스톤 완성 (2~3주)

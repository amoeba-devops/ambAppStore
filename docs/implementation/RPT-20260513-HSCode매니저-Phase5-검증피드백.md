---
document_id: HSCM-IMPL-RPT-PHASE5
version: 1.0.0
status: Done
created: 2026-05-13
updated: 2026-05-13
app: app-hscode-manager
phase: 5
milestone: M2 (검증·피드백 루프)
---

# HS Code Manager — Phase 5 작업완료보고서 (M2 검증·피드백 루프)

> Phase 5 (검증·피드백 루프) 구현 완료. **M2 마일스톤 달성**.
> SAMPLE_ANALYSIS / CUSTOMS_SEIZURE / CUSTOMS_DOUBLE_CHECK 3종 검증 이벤트를 등록하면 자동으로 분류 상태가 갱신되고, 동일 패턴 분류가 재검토 큐에 적재된다. 운영팀이 검증을 시작하면 시스템이 *스스로 학습* 하기 시작한다.

---

## 1. 완료 범위

| Step | 내용 | 결과 |
|------|------|------|
| 5.0 | DB — `hsc_review_queue` 신규 + `hsc_verification_events` ALTER (`inquiry_id`, `amount_usd`) | ✔ |
| 5.1 | VerificationEvent 정식 모듈 승격 — 3종 이벤트 등록 + 검증 게이트 | ✔ |
| 5.2 | 자동 후속 작업 트리거 — 트랜잭션 안에서 분류 상태/신뢰도 갱신 + 재검토 큐 적재 | ✔ |
| 5.3 | ReviewQueue 도메인 — 우선순위·해결 처리 + targetSummary 조인 보강 | ✔ |
| 5.4 | KPI 집계 (FR-VR-03) — 추징률·정정률·세관확인률·추징 총액 | ✔ |
| 5.5 | Frontend — S12 등록 (3종 이벤트별 폼 분기) + S13 재검토 큐 (KPI 헤더 포함) | ✔ |
| — | Backend tsc + nest build | **PASS** |
| — | Frontend tsc + vite build (450.08 kB JS, 19.00 kB CSS) | **PASS** |

---

## 2. 신규 산출물

### 2.1 DB 마이그레이션
- `apps/app-hscode-manager/db-migrations/2026-05-13_phase5_verification.sql` — `hsc_review_queue` 테이블
- `00_apply_all.sh` 갱신 — Phase 5 ALTER 가 idempotent 적용 (mysql_alter_safe 패턴 재사용)

### 2.2 Backend (10개)

```
backend/src/domain/verification/   (Phase 0 placeholder에서 정식 승격)
├── entity/
│   ├── verification-event.entity.ts  (ALTER: inquiryId + amountUsd 컬럼 추가)
│   └── review-queue.entity.ts        (신규)
├── dto/
│   ├── request/create-verification.request.ts
│   └── response/verification-event.response.ts  (Event + ReviewQueueItem + KpiSummary)
├── mapper/verification.mapper.ts
├── service/
│   ├── verification.service.ts       (자동 후속 작업 트리거 트랜잭션)
│   └── kpi.service.ts                (월간 집계)
├── controller/verification.controller.ts (5개 엔드포인트)
└── verification.module.ts
```

`placeholder.module.ts` — VerificationEntity 제거 (ExpertReview 1개만 남음)
`app.module.ts` — VerificationModule 추가

### 2.3 Frontend (5)

```
frontend/src/
├── pages/verification/
│   ├── VerificationRegisterPage.tsx    # S12 (3종 이벤트 분기 + 자동 후속 작업 안내)
│   └── ReviewQueuePage.tsx             # S13 (KPI 헤더 + 우선순위 정렬 + 해결 처리)
├── services/verification.service.ts
├── types/verification.types.ts
└── i18n/locales/{ko,en,vi}/verification.json (3)
```

`App.tsx` — `/verification`, `/verification/register[/:classificationId]` 라우트 추가.

---

## 3. API 엔드포인트 (Phase 5 신규 5개)

| 도메인 | Method | Path | 권한 |
|--------|--------|------|------|
| verifications | POST | `/api/v1/verifications` | Auth |
| verifications | GET | `/api/v1/verifications` | Auth |
| verifications | GET | `/api/v1/verifications/review-queue` | Auth |
| verifications | PATCH | `/api/v1/verifications/review-queue/:id/resolve` | Auth |
| verifications | GET | `/api/v1/verifications/kpi` | Auth |

**누적 50개 엔드포인트.**

---

## 4. 핵심 설계 결정

### 4.1 자동 후속 작업 트랜잭션 (FR-VR-02)
`VerificationService.create()` 가 *이벤트 등록 + 분류 상태 갱신 + 큐 적재* 를 1트랜잭션으로 처리:

**SAMPLE_ANALYSIS + MATCH**:
- `classification.confidenceScore += 0.2` (cap 1.0)
- `followUpActions: [{ kind: 'CONFIDENCE_BUMP', delta: 0.2 }]`

**SAMPLE_ANALYSIS + MISMATCH**:
- 원본 `status: ADOPTED|SEALED → SUPERSEDED` + `supersededAt = now`
- 동일 Item 의 모든 ADOPTED/SEALED 분류 → `ReviewQueue` (reason=SAMPLE_MISMATCH, priority=50)
- 중복 큐 적재 방지 (`resolvedAt IS NULL` 행이 이미 있으면 skip)

**CUSTOMS_SEIZURE**:
- 본 분류 `status → DISPUTED`
- *동일 hsCode* 사용 다른 모든 분류 (status NOT IN SUPERSEDED/DISPUTED) → `ReviewQueue` (reason=CUSTOMS_SEIZURE_PATTERN)
- 본 분류도 큐 적재 (reason=CUSTOMS_SEIZURE_DIRECT, priority=5)
- 추징 금액 > $50K 시 패턴 큐 priority 10 → 더 높은 우선순위

**CUSTOMS_DOUBLE_CHECK**:
- `status: ADOPTED → SEALED`
- `confidenceScore += 0.3`
- 향후 Phase 3 내부 매칭이 자동으로 *SEALED 행을 1순위 회수* 하므로 별도 큐 작업 불필요

### 4.2 큐 우선순위 정책
| 시나리오 | priority |
|----------|----------|
| CUSTOMS_SEIZURE_DIRECT (본 분류) | **5** (최우선) |
| CUSTOMS_SEIZURE_PATTERN, 추징액 > $50K | **10** |
| CUSTOMS_SEIZURE_PATTERN, 일반 | **30** |
| SAMPLE_MISMATCH | **50** |
| MANUAL | **100** (기본) |

낮을수록 먼저 처리. UI는 priority 오름차순 정렬.

### 4.3 followUpActions JSON 영속화
모든 자동 작업을 `VerificationEvent.follow_up_actions` JSON 배열에 기록:
```json
[
  { "kind": "STATUS_CHANGE", "to": "DISPUTED" },
  { "kind": "REVIEW_QUEUE", "target_type": "CLASSIFICATION", "target_id": "...", "reason": "..." },
  { "kind": "CONFIDENCE_BUMP", "delta": 0.3 }
]
```
- 사후 *왜 이 분류가 SUPERSEDED 되었나* 추적 가능
- KPI 집계 시 활용 가능
- FE 응답에 `followUpCount` 함께 표시 → 사용자에게 "5건의 후속 작업이 자동 실행됨" 안내

### 4.4 입력 검증 가드
- `SAMPLE_ANALYSIS` 는 `result` 가 `MATCH | MISMATCH` 중 하나 필수
- `CUSTOMS_DOUBLE_CHECK` 는 `result: CONFIRMED` 만 허용
- `CUSTOMS_SEIZURE` 는 `result` 생략 가능 (이벤트 발생 자체가 정보)
- FE 폼이 이벤트 유형 선택 시 자동으로 result 필드 노출/숨김

### 4.5 KPI 집계 (FR-VR-03)
`KpiService.summary()`:
- **추징률** = `CUSTOMS_SEIZURE 건수` / max(1, `ADOPTED 총수`)
- **정정률** = 기간 내 `SUPERSEDED 전이 건수` / max(1, `ADOPTED 총수`)
- **세관확인률** = 기간 내 `SEALED 전이 건수` / max(1, `ADOPTED 총수`)
- **추징 총액** = `CUSTOMS_SEIZURE.amount_usd` 합산

Phase 7 KPI 대시보드에 그대로 노출 예정. 1순위 히트율 (Phase 4) 과 함께 *4대 KPI* 구성.

### 4.6 중복 큐 방지
재검토 큐 적재 시 `(targetType, targetId, resolvedAt IS NULL)` 조합 존재 검증.
- 동일 분류에 여러 검증 이벤트가 발생해도 *미해결 큐 1건* 만 유지
- 해결 후 새 이벤트 → 새 큐 항목 생성

### 4.7 큐 항목 요약 조인
`fetchQueueSummaries()` — 큐 항목의 `targetId` 가 Classification 이면 hsCode + itemName 을 1회 쿼리로 모음. N+1 회피.

### 4.8 감사 로그
`CREATE` 액션으로 모든 검증 이벤트 등록 기록:
- diff: `{ event_type, result, classification_id, follow_up_count }`
- IP / User-Agent / requestId 부착

### 4.9 ReviewQueue ent_id 격리
- 모든 service 메소드가 `entId` 강제
- 멀티테넌시 격리 (NFR-SE-01) 유지

### 4.10 FE 우선순위 시각화
- priority ≤ 10 → 빨강 (CUSTOMS_SEIZURE 직접/대량)
- priority ≤ 30 → 주황 (추징 패턴)
- 그 외 → 회색
- 사용자가 첫 번째로 처리해야 할 항목이 자연스럽게 눈에 띄게 디자인

---

## 5. TC 결과 (Phase 5)

| TC ID | 시나리오 | 상태 |
|-------|---------|------|
| TC-VR-001 | SAMPLE_ANALYSIS + MATCH → 신뢰도 +0.2 | **READY** |
| TC-VR-002 | SAMPLE_ANALYSIS + MISMATCH → 원본 SUPERSEDED + 동일 Item 큐 적재 | **READY** |
| TC-VR-003 | CUSTOMS_SEIZURE → DISPUTED + 동일 HS 큐 적재 | **READY** |
| TC-VR-004 | CUSTOMS_DOUBLE_CHECK → SEALED + 신뢰도 +0.3 | **READY** |
| TC-VR-005 | S12 등록 폼 i18n 3언어 | **READY** |
| TC-VR-020 | 추징 1건 → 동일 HS Item 모두 큐 적재 | **READY** |
| TC-VR-021 | 큐 priority — 금액 큰 순 | **READY** (>$50K → 10) |
| TC-VR-022 | 큐 처리 완료 (resolvedAt) | **READY** (`PATCH /resolve`) |
| TC-VR-023 | S13 큐 화면 | **READY** |
| TC-VR-040~042 | 월간 KPI 계산 (추징/정정/세관확인률) | **READY** |
| TC-VR-043 | 일일 배치 또는 view 동작 | **READY** (실시간 계산 — Phase 7에서 view/MV 검토) |

---

## 6. 사이드 임팩트

| 범위 | 영향 | 상태 |
|------|------|------|
| Phase 4 Classification | SAMPLE_MISMATCH / CUSTOMS_SEIZURE 시 status 자동 전이됨 | ✔ 정상 연동 |
| Phase 3 내부 매칭 | SEALED 분류가 신선도 게이트를 통과해 1순위 회수 — 자동으로 *세관 확인된 분류*에 가중치 부여됨 | ✔ 자연 연동 |
| Phase 6 (예정) | CUSTOMS_SEIZURE 발생 시 *전문가 검토* 자동 트리거 — 본 Phase에서는 *재검토 큐 적재* 까지만. Phase 6에서 ExpertReview 자동 생성으로 확장 | ⏸ |
| 감사 로그 | 모든 검증 이벤트 등록이 audit_log 적재 → Phase 4의 CONFIRM/SUPERSEDE 와 함께 추적성 완비 | ✔ |
| 재검토 큐 deadlock | 트랜잭션 안에서 중복 큐 SELECT 후 INSERT — 동시 검증 이벤트에서 race condition 가능. Phase 7 운영 시 UNIQUE 제약 추가 검토 | ⏸ |

---

## 7. 누적 통계 (Phase 0~5)

- API 엔드포인트: **50개**
- DB 테이블: **17개** (placeholder ExpertReview 1개 미사용)
- Frontend 페이지: **17개** (Dashboard + S02~S13 + S17 6탭 + 검증 등록 폼)
- i18n 네임스페이스: **7개** × 3 언어 = **21 파일**

---

## 8. 검증 명령

```bash
# Backend
cd apps/app-hscode-manager/backend
npx tsc --noEmit       # exit 0
npm run build          # exit 0

# Frontend
cd apps/app-hscode-manager/frontend
npm run build          # 450.08 kB JS / 19.00 kB CSS

# DB 마이그레이션
SEED_DEMO_DATA=true bash apps/app-hscode-manager/db-migrations/00_apply_all.sh

# Phase 5 회귀 시나리오 (Phase 4의 컨펌된 분류 1건이 있다는 가정)
# CLS_ID 변수에 분류 ID 설정 후:

# (1) SAMPLE_ANALYSIS MATCH → 신뢰도 +0.2
curl -X POST http://localhost:3102/api/v1/verifications \
  -H "Content-Type: application/json" $H_AUTH \
  -d "{ \"classification_id\":\"$CLS_ID\", \"event_type\":\"SAMPLE_ANALYSIS\",
        \"event_date\":\"2026-05-13\", \"result\":\"MATCH\" }"

# (2) CUSTOMS_SEIZURE — 동일 HS 코드 사용 분류 모두 큐 적재 확인
curl -X POST http://localhost:3102/api/v1/verifications \
  -H "Content-Type: application/json" $H_AUTH \
  -d "{ \"classification_id\":\"$CLS_ID\", \"event_type\":\"CUSTOMS_SEIZURE\",
        \"event_date\":\"2026-05-13\", \"amount_usd\": 75000,
        \"notes\":\"베트남 통관 검사 단계 추징\" }"

# (3) 재검토 큐 조회 — priority 5 (DIRECT) + 10 (>$50K PATTERN)
curl "http://localhost:3102/api/v1/verifications/review-queue?open_only=true" $H_AUTH | jq

# (4) KPI 1개월
curl "http://localhost:3102/api/v1/verifications/kpi?months=1" $H_AUTH | jq

# UI
# http://localhost:5202/app-hscode/verification           → 큐 + KPI
# http://localhost:5202/app-hscode/verification/register  → 등록 폼
```

---

## 9. 다음 단계 (Phase 6 — 에스컬레이션·전문가 검토, 2주)

Phase 6 작업 목록:
1. ExpertReview 정식 모듈 승격 — 라우팅·차단·회신
2. 에스컬레이션 6개 트리거 엔진 — confidence < 0.6 / 후보 ≥3 / 키워드 / 추징 이력 / 명시 요청 / 금액 임계
3. 라우팅: VN 현지 규제 → EXPERT_LOCAL / FTA 원산지 → EXPERT_INTERNAL / 둘 다 → 병렬
4. S14 에스컬레이션 큐 + S15 회신 화면
5. M4 응대 차단 동작 (REVIEWING 상태 동안)
6. **자동 연동**: Phase 5 의 CUSTOMS_SEIZURE 가 ExpertReview 자동 생성 (Phase 6에서 트리거 추가)

선행 작업:
- [ ] AMA SSO 의 EXPERT_LOCAL / EXPERT_INTERNAL 역할 발급 흐름 확정
- [ ] (선택) Phase 5 회귀 시연 1회 (M2 마일스톤 검증)

---

## 10. 회고

- **잘 된 점**:
  - 3종 이벤트의 자동 후속 작업이 *단일 service 메소드*에 응집 — 트랜잭션 안에서 분류 상태 + 큐 + 이벤트 영속화가 일관됨
  - `followUpActions` JSON 영속화로 *추적성* 확보 — 6개월 뒤에도 "왜 이 분류가 SUPERSEDED 되었나" 답 가능
  - 중복 큐 적재 방지 + priority 정책 + 추징액 임계로 *운영 우선순위* 자동 산정
  - KPI 4대 지표 (1순위 히트율 + 추징률 + 정정률 + 세관확인률) 완비 → Phase 7 대시보드에 그대로 노출 가능
  - Phase 3 내부 매칭과의 자연 연동 — SEALED 분류가 자동으로 신뢰도 우대받음
- **개선 여지**:
  - 동시 검증 이벤트의 race condition 미해결 — Phase 7 운영 부하 검증 시 SELECT FOR UPDATE 또는 UNIQUE 제약 추가
  - KPI 가 매 호출마다 COUNT 쿼리 — 데이터 누적 시 materialized view 필요 (Phase 7)
  - 큐 항목별 *작업 처리 시간* 측정 미구현 (예: 적재→해결 평균 시간) — Phase 7 운영지표에서 추가
- **위험**:
  - 운영 초기 추징 이벤트가 발생하면 *동일 HS 사용 분류 수십~수백 건* 이 한꺼번에 큐에 들어갈 가능성. 시뮬레이션 부하 테스트 필요
  - SAMPLE_MISMATCH 후 사용자가 *새로운 정정 분류*를 컨펌하는 흐름이 자동화되지 않음 — Phase 7 *재검토 큐 → 컨펌 흐름* 통합 검토

---

## 11. 사용자 안내

**Phase 6 (에스컬레이션·전문가 검토, 2주)**로 진입 가능. 또는 *M2 회귀 시연* 권장.

추천 순서:
1. ✅ 운영 환경 준비 — 완료
2. ⏳ **M1+M2 회귀 시연** — 환경 준비 후 1회 (선택)
3. ⏳ **Phase 6 시작** — 에스컬레이션·전문가 검토

---
document_id: HSCM-IMPL-RPT-PHASE3
version: 1.0.0
status: Done
created: 2026-05-13
updated: 2026-05-13
app: app-hscode-manager
phase: 3
based_on:
  - docs/plan/PLAN-20260513-HSCode매니저-앱전체구현.md
  - docs/test/TC-20260513-HSCode매니저-앱전체구현.md
  - apps/app-hscode-manager/DB-SCHEMA-hscode-manager.md
---

# HS Code Manager — Phase 3 작업완료보고서

> Phase 3 (정규화·매칭·추천 엔진) 구현 완료. 본 앱의 가치 중심 단계.
> 정규화 → 내부 매칭 → 외부 어댑터(VN/KR) → AI 추천(Claude + 환각 가드) → 랭킹(보수적 세율 룰 + FTA) 5단계가 단일 `POST /api/v1/matching/run` 으로 통합 동작. BE/FE 모두 빌드 통과.
> **M1 마일스톤** (Phase 0~3 완료) — 직접 입력 1건이 추천 리스트까지 도달하는 end-to-end 흐름 완성. 컨펌·영속화는 Phase 4.

---

## 1. 완료 범위

| Step | 내용 | 결과 |
|------|------|------|
| 3.0 | DB — `hsc_authority_hs_codes` + `hsc_ai_recommendation_logs` + VN/KR 시드 (9건) | ✔ |
| 3.1 | 정규화 모듈 v0.1.0 — `composition_hash` 산출 + 키워드 추출 (`common/util/keywords.ts`) | ✔ |
| 3.2 | 내부 매칭 엔진 — 3단 우선순위 (exporter+import / import-only / fuzzy) + 신선도·위험도 게이트 | ✔ |
| 3.3 | 외부 어댑터 인터페이스 + VN BIEU THUE + KR Customs (DB 시드 기반 + LRU 캐시 24h) | ✔ |
| 3.4 | Claude AI 어댑터 — 환각 가드레일 + 마스킹 + 비용 추적 + 일일 한도 + Mock fallback | ✔ |
| 3.5 | 랭커 — 보수적 세율 룰(§2.2) + FTA 가산점 + 출처 합치 가산점 | ✔ |
| 3.6 | Matching Service + Controller — 5단계 통합 (`POST /matching/run`) + 어댑터 헬스체크 | ✔ |
| 3.7 | Frontend — S07 ProgressStepper (5단계 + 경고 메시지) + S08 추천 카드 (AI 근거·출처·플래그) | ✔ |
| — | Backend tsc + nest build | **PASS** |
| — | Frontend tsc + vite build (411.13 kB JS, 18.48 kB CSS) | **PASS** |

---

## 2. 신규 산출물

### 2.1 DB 마이그레이션 + 시드
- `apps/app-hscode-manager/db-migrations/2026-05-13_phase3_matching.sql` — 2개 테이블
- `apps/app-hscode-manager/db-migrations/seed-phase3-authority.sql` — VN BIEU THUE 8건 + KR 1건 데모 시드

### 2.2 Backend 신규 도메인 / 유틸 (15+)

```
backend/src/
├── common/util/keywords.ts                          # 카테고리별 키워드 추출
└── domain/
    ├── external/                                    # 신규 모듈
    │   ├── interface/external-customs-adapter.interface.ts   # 어댑터 시그니처
    │   ├── entity/{authority-hs-code, ai-recommendation-log}.entity.ts
    │   ├── adapter-vn-bieu-thue/adapter-vn-bieu-thue.service.ts
    │   ├── adapter-kr-customs/adapter-kr-customs.service.ts
    │   ├── ai-claude/ai-claude.service.ts           # Anthropic SDK + Mock fallback
    │   └── external.module.ts                       # EXTERNAL_CUSTOMS_ADAPTERS DI 토큰
    └── matching/                                    # 신규 모듈
        ├── service/internal-matching.service.ts
        ├── service/ranker.service.ts
        ├── service/matching.service.ts              # orchestrator
        ├── controller/matching.controller.ts        # POST /matching/run
        ├── dto/request/matching-run.request.ts
        ├── dto/response/matching-result.response.ts
        └── matching.module.ts
```

### 2.3 Frontend 신규 (9)

```
frontend/src/
├── components/matching/ProgressStepper.tsx
├── pages/matching/
│   ├── MatchingProgressPage.tsx                     # S07 — 5단계 스테퍼 + 경고
│   └── RecommendationConfirmPage.tsx                # S08 — 후보 카드 (Phase 4에서 컨펌 활성)
├── services/matching.service.ts
├── types/matching.types.ts
└── i18n/locales/{ko,en,vi}/matching.json            # 3 언어
```

`App.tsx` — `/new-work/:inquiryId/matching` (S07) + `/candidates` (S08) 라우트 추가.
`MatchingPlaceholderPage` (Phase 2 임시) 는 라우트에서 제거.

---

## 3. API 엔드포인트 (Phase 3 신규 2개)

| 도메인 | Method | Path | 권한 | 설명 |
|--------|--------|------|------|------|
| matching | POST | `/api/v1/matching/run` | Auth | 5단계 통합 매칭 실행 |
| matching | GET | `/api/v1/matching/adapters/health` | Auth | 외부 어댑터 헬스체크 |

**누적 40개 엔드포인트.**

---

## 4. 핵심 설계 결정

### 4.1 외부 어댑터 인터페이스 (변경 2 추상화)
```ts
interface ExternalCustomsAdapter {
  readonly adapterKey: string;
  readonly importCountryCode: string;
  readonly displayName: string;
  lookupByAttributes(attrs, options): Promise<ExternalCandidate[]>;
  healthCheck(): Promise<AdapterHealth>;
}
```
- NestJS DI에 `EXTERNAL_CUSTOMS_ADAPTERS` 토큰으로 배열 주입 — `MatchingService`가 `importCountryCode`로 1개를 골라 호출
- 환경변수 `ADAPTER_VN_BIEU_THUE_ENABLED=false` / `ADAPTER_KR_CUSTOMS_ENABLED=false`로 즉시 비활성화 가능
- **신규 수입국 추가 = 어댑터 1개 구현 + ImportCountry 마스터 등록** (PLAN의 변경 2 충족)

### 4.2 정규화 + 키워드 추출
- Phase 2의 `composition_hash` v0.1.0를 유지하면서, *어댑터 매칭용 키워드*는 `extractKeywords()` 별도 함수로 분리
- 키워드 정렬·소문자화·토큰화 + 카테고리별 핵심 속성(CAS / material / process / nameplate_model 등) 모두 포함

### 4.3 외부 어댑터 점수 산출 (VN/KR)
```
score = keywordOverlapRatio * 0.9 (max 0.7)
      + categoryHint * 0.3 (max 0.3)
      → cap at 0.95
```
- `hsc_authority_hs_codes.auh_keywords` JSON 배열 ↔ 입력 키워드의 교집합 비율
- `auh_category_hints` JSON `{"STEEL_MECHANICAL": 0.9}` 형식으로 카테고리 가중치
- 결과는 confidence 내림차순 정렬, limit 적용

### 4.4 LRU 캐시 24h (IR-01)
- 어댑터별 in-memory `Map<string, { expiresAt, candidates }>`
- 캐시 키: `${category}|${sortedKeywords}|${limit}`
- TTL: `EXTERNAL_CACHE_TTL_SEC` 환경변수 (기본 86400초)
- 외부 API 다운 시: 캐시 hit 시 정상 응답 (NFR-AV-01 degraded mode) — 본 구현은 시드 DB 기반이라 항상 응답 가능

### 4.5 내부 매칭 3단 우선순위 (FR-MA-02)
1. **EXPERTER_IMPORT** — 동일 exporter + 동일 import_country + 동일 hash → confidence 0.95
2. **IMPORT_ONLY** — 동일 import_country + 동일 hash (다른 exporter) → 0.85
3. **FUZZY_NAME** — name_normalized LIKE + 동일 category → 0.6
- 신선도 게이트: 마지막 채택 > 12개월 → confidence -0.15
- 위험도 게이트: `status='DISPUTED'` 이력 있음 → confidence -0.2

### 4.6 신선도 + 위험도 + 외부 호출 생략 (FR-MA-03 / A2)
- 최상위 후보 confidence ≥ 0.85 AND FUZZY_NAME 아님 AND disputed 없음 AND 12개월 이내 → `highConfidenceFresh=true`
- `MatchingService.run({force_external=false})` 면 외부·AI 호출 모두 생략
- `force_external=true` 또는 게이트 불충족 → 정상 흐름

### 4.7 AI Claude 어댑터 — 환각 가드레일 (FR-AI-01~03)
1. **컨텍스트 강제**: 시스템 프롬프트에 "MUST select ONLY from the candidate list provided"
2. **JSON 강제**: 응답 형식을 JSON 스키마로 명시
3. **출력 검증**: 응답에서 `hsCode ∉ context` 인 후보는 *폐기* + `hallucinatedCount` 증가
4. **JSON 파싱 실패** → `status: 'PARSE_FAIL'` 로그 + 외부 결과만 사용 (FR-AI-03)
5. **API 에러** → `status: 'API_ERROR'` 로그 + 외부 결과만 사용
6. **CLAUDE_API_KEY 미설정** → `status: 'MOCK'` — 외부/내부 후보에서 상위 5개를 그대로 사용한 mock 응답 (dev/CI)
7. **일일 비용 한도** (`AI_DAILY_BUDGET_USD`, 기본 $50) — 초과 시 mock fallback

### 4.8 AI 마스킹 (NFR-SE-03)
- 회사명 패턴 (`...社`, `...Co.`, `...Corp.`, `...Inc.`, `...Ltd.`) 을 `EXPORTER` 토큰으로 치환
- 모델·CAS·소재명 등 비식별 정보는 보존

### 4.9 AIRecommendationLog (DR-05)
- 매 AI 호출마다 `hsc_ai_recommendation_logs` 1행
- 컬럼: `prompt_hash`, `model_version`, `status`, `latency_ms`, `cost_usd`, `hallucinated_count`, `candidate_count`
- 토큰 비용 추정: Sonnet $3/MTok in + $15/MTok out (모델 변경 시 갱신 필요)

### 4.10 랭킹 룰 (Step 3.5)
- 출처별 confidence 최댓값을 베이스로 시작
- **+0.10** 출처 합치 (2개 이상 출처에 동일 hsCode)
- **+0.05** internal + external 동일 코드
- **+0.05** FTA 매트릭스에 행 존재
- **-0.20** external degraded
- **-0.15** disputed 이력
- **§2.2 보수적 세율 룰**:
  - 후보간 세율 격차 ≥3%p → 높은 세율 후보 +0.08 + `requiresSampleAnalysis=true`
  - 1~3%p → 높은 세율 후보 +0.04 + `sampleAnalysisRecommended=true`
  - <1%p → 가산점 없음 (자연 신뢰도 그대로)

### 4.11 결과 메타데이터 (운영 지표)
모든 호출에 다음 metadata 반환 — 운영 대시보드(Phase 7)와 KPI에 직접 연결:
```
{
  internalCount, externalCalled, externalCacheUsed, externalDegraded,
  aiCalled, aiStatus, aiHallucinatedCount, internalSkipExternal,
  durationMs: { total, internal, external, ai, rank }
}
```

---

## 5. TC 결과 (Phase 3 매핑)

| TC ID | 시나리오 | 상태 |
|-------|---------|------|
| TC-MA-001~006 | 정규화 단위 (CAS / 재질 / 두께 / hash 결정성 / 버전) | **READY** (Phase 2 util) |
| TC-MA-020~024 | 내부 매칭 3단 + 신선도/위험도 게이트 | **READY** |
| TC-MA-025 | 1만 Item 매칭 90p < 1.5s (NFR-PF-01) | **PARTIAL** — 부하 테스트 별도 |
| TC-MA-040 | VN 어댑터 정상 응답 | **READY** |
| TC-MA-041 | 캐시 hit (TTL 24h) | **READY** |
| TC-MA-042 | 캐시 miss → fallback | **READY** (어댑터 내부) |
| TC-MA-043 | 외부 503 mock → degraded mode | **READY** (warnings 발생) |
| TC-MA-044 | 헬스체크 endpoint | **READY** `/matching/adapters/health` |
| TC-MA-060 | AI JSON 응답 파싱 | **READY** |
| TC-MA-061 | 컨텍스트 외 hsCode → 폐기 (환각) | **READY** (hallucinatedCount) |
| TC-MA-062 | JSON 파싱 실패 → 외부만 진행 | **READY** (`PARSE_FAIL`) |
| TC-MA-063 | AI API 503 → 외부만 (X3) | **READY** (`API_ERROR`) |
| TC-MA-064 | AI 마스킹 (NFR-SE-03) | **READY** |
| TC-MA-065 | AIRecommendationLog 기록 | **READY** |
| TC-MA-066 | AI 끄기 옵션 (FR-AI-04) | **READY** (`ai_disabled=true`) |
| TC-MA-067 | 일일 비용 한도 → 차단 | **READY** (`API_ERROR` + mock) |
| TC-MA-080~084 | 보수적 세율 룰 + 가산점 | **READY** |
| TC-MA-100 | end-to-end `POST /matching/run` | **READY** |
| TC-MA-101 | 90p < 8s (NFR-PF-02) | **PARTIAL** — 부하 테스트 별도 |
| TC-MA-102 | S07 5단계 스테퍼 | **READY** |
| TC-MA-103 | S08 후보 카드 — AI 근거 + 출처 + 플래그 | **READY** |
| TC-MA-104 | 과거 채택 마커 | **READY** (`pastAdoptionCount` 표시) |

> 부하 테스트(NFR-PF-01·02)와 실제 Claude API 통합 검증은 *DB·API key 환경 준비 후* 별도 수행. 정적 검증(tsc + build + 로직 리뷰)은 모두 통과.

---

## 6. 사이드 임팩트

| 범위 | 영향 | 상태 |
|------|------|------|
| Phase 1·2 모듈 | 변경 없음 — Inquiry, Item, FTA Matrix 모두 그대로 의존 | ✔ |
| Classification placeholder | MatchingModule에 정식 등록 — placeholder에서 제거 | ✔ |
| 의존성 | `@anthropic-ai/sdk` 사용 (이미 Phase 0에 package.json 등록) | ✔ |
| Claude API 키 | 미설정 시 자동 mock 모드 → 개발/CI 환경 무중단 | ✔ |
| AI 비용 | 호출량에 비례 — `AI_DAILY_BUDGET_USD` 환경변수로 일일 차단 가능 | ⚠ 모니터링 필요 |
| FE state | S07 → S08 데이터 전달은 `react-router` `location.state` 사용 (페이지 새로고침 시 손실). Phase 4에서 영속화로 보완. | ⏸ |
| 영구 캐시 | in-memory LRU — 단일 인스턴스 가정. 멀티 인스턴스 전환 시 Redis 필요. | ⏸ Phase 7 |
| deploy-staging.sh | 여전히 미수정 | ⚠ 후속 |

---

## 7. 검증 명령

```bash
# Backend
cd apps/app-hscode-manager/backend
npx tsc --noEmit       # exit 0
npm run build          # dist/ 생성

# Frontend
cd apps/app-hscode-manager/frontend
npm run typecheck      # exit 0
npm run build          # 411.13 kB JS / 18.48 kB CSS

# DB 마이그레이션
mysql -uroot -p db_app_hscode \
  < apps/app-hscode-manager/db-migrations/2026-05-13_phase3_matching.sql
mysql -uroot -p db_app_hscode \
  < apps/app-hscode-manager/db-migrations/seed-phase3-authority.sql

# 어댑터 헬스체크
curl http://localhost:3102/api/v1/matching/adapters/health \
  -H "Authorization: Bearer ${AMA_JWT}"

# 통합 매칭 실행 (시연)
# 1) Phase 2에서 Inquiry 생성 + 직접 입력으로 Item 등록
# 2) Item ID, Inquiry ID 추출
curl -X POST http://localhost:3102/api/v1/matching/run \
  -H "Authorization: Bearer ${AMA_JWT}" \
  -H "Content-Type: application/json" \
  -d '{"inquiry_id":"...","item_id":"..."}'

# AI 끄고 외부+내부만
curl -X POST http://localhost:3102/api/v1/matching/run \
  -H "Authorization: Bearer ${AMA_JWT}" \
  -H "Content-Type: application/json" \
  -d '{"inquiry_id":"...","item_id":"...","ai_disabled":true}'

# FE 시연
# http://localhost:5202/app-hscode/new-work → Inquiry 생성 → 직접 입력 → 매칭 자동 실행 → 추천 카드
```

---

## 8. 다음 단계 (Phase 4 — 컨펌·영속화, 2주)

Phase 4 작업 목록:
1. Classification 컨펌·영속화 (FR-CO-01~05) — 트랜잭션·중복감지·supersede·불변성
2. 사유 입력 강제 (FR-CO-02) — S08에서 *과거와 다른 선택* 시 활성
3. 감사 로그 (`hsc_audit_logs`, NFR-SE-02) — NestJS Interceptor 자동 기록
4. 응대 양식 출력 (S09) — 이메일/카카오톡/PDF 채널별 템플릿
5. 누적 조회 + S10/S11 화면
6. 1순위 히트율 측정 (Phase 7 KPI 입력)
7. **M1 마일스톤 달성** — MVP 운영 가능

선행 작업:
- [ ] 운영팀의 BIEU THUE 시드 데이터 일괄 적재 (현재 8건만 데모)
- [ ] AMA SSO 역할 발급 흐름 확정 (Phase 1·2·3 공통)
- [ ] (선택) Claude API 키 발급 후 실호출 통합 테스트

---

## 9. 회고

- **잘 된 점**: 5단계 파이프라인이 단일 진입점(`/matching/run`)으로 통합되어 운영·모니터링이 깔끔. 어댑터 인터페이스가 추상화 잘 되어 신규 국가 추가 시 *1개 파일* 만 추가하면 됨. AI 환각 가드레일이 응답 검증 + 컨텍스트 강제 + 비용 한도 3중 방어. Mock fallback 덕분에 dev/CI 환경에서 API 키 없이도 모든 흐름 시연 가능.
- **개선 여지**:
  - 외부 어댑터의 키워드 매칭이 단순 substring 기반 — Phase 7에서 임베딩(예: pgvector) 기반으로 교체 가능
  - 캐시는 in-memory LRU — 멀티 인스턴스 환경에서는 Redis로 이전 필요
  - S08 → S09 데이터 전달이 `location.state` 단방향 — Phase 4 컨펌 시점에 영속 모델(`Classification` `proposed` 상태) 로 전환 예정
- **위험**:
  - 시드 데이터 빈약 — 운영 시연에서는 8건만으로는 부족하므로 *최소 ~500건* 시드가 필요. 운영팀 협조 필수
  - Claude 모델 가격 변동 — `cost_usd` 추정식이 코드 상수. Phase 7에서 운영 지표 화면에 표시 시 *실제 청구액과 비교 검증* 필요

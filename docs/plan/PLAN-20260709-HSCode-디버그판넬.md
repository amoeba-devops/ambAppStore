# 작업계획서 — HS Code Manager AMA 컨텍스트 디버그 판넬

- **문서 ID**: PLAN-20260709-HSCode-디버그판넬
- **작성일**: 2026-07-09
- **선행 문서**: [REQ-20260709-HSCode-디버그판넬](../analysis/REQ-20260709-HSCode-디버그판넬.md)
- **결정사항**: 디버그 판넬 **전 환경 상시 노출**(프로덕션 포함) — 환경 게이팅 없음

---

## 1. 시스템 개발 현황 분석

### 1.1 디렉토리 구조 (frontend/src)
```
components/common/  ConfidenceBadge / LegalNotice / Placeholder / ScreenHeader / SubTabs  ← 여기 신규 추가
stores/auth.store.ts  token / user(AuthUser) / isAdmin()
lib/ama-token.ts      decodeAmaToken(token) → AmaTokenPayload  (재사용)
App.tsx               헤더 + <Outlet/> 공통 레이아웃  ← 판넬 마운트
i18n/                 keySeparator:false, defaultNS 'hscode' (flat 점표기 키)
```

### 1.2 기술 스택 / 자산
- React18+TS, Zustand(`useAuthStore`), i18next(flat key), `lucide-react ^0.468.0`.
- 데이터 원천 이미 존재: `useAuthStore().user`, `localStorage.hsc_token`, `decodeAmaToken()`.

### 1.3 제약사항
- i18n **flat 점표기 키** 필수(`"debug.title"`), ko/en/vi 3언어.
- 토큰/유저 **null 안전** 필수(미인증에서도 크래시 없이).
- 정적 SPA 재빌드 필수(스테이징 우선).

---

## 2. 단계별 구현 계획

### Phase 1 — 디버그 판넬 컴포넌트

**Step 1.1** `src/components/common/DebugContextPanel.tsx` 신규
- car-manager 패턴 이식하되 hscode 데이터원천으로 재작성:
  - `useAuthStore()`에서 `user`, `token`, `isAdmin()` 취득.
  - `token = localStorage.getItem('hsc_token')`, `payload = token ? decodeAmaToken(token) : null` (lib/ama-token 재사용).
  - **섹션 A(요약)**: 이름/이메일/역할(+admin)/EntityId/EntityCode/appCode/scope/만료(exp 로컬시각+유효여부)/인증상태.
  - **섹션 B(원시)**: referrer / `window.location.search` / 원본 JWT / payload(JSON pretty) → readOnly textarea.
  - 토글(접힘 기본) + Copy(clipboard, 2초 복원). `fixed bottom-0 right-4 z-50`, 노란 점선 테마.
  - lucide 아이콘: `Bug, Copy, Check, ChevronUp, ChevronDown`.
  - 모든 라벨 `useTranslation('hscode')` `t('debug.*')`.
- └─ 사이드 임팩트: 신규 격리 컴포넌트. 전역 상태 **읽기만**(스토어 변경 없음). 다른 페이지 로직 무영향.

### Phase 2 — 레이아웃 마운트

**Step 2.1** `src/App.tsx` 수정
- import 후 레이아웃 최상위 `<div className="min-h-full">` 내부 끝(또는 `</main>` 뒤)에 `<DebugContextPanel />` 추가.
- └─ 사이드 임팩트: 전 페이지에 판넬 노출(요구사항). `fixed` 요소라 문서 흐름/레이아웃에 영향 없음. z-50이 헤더(z-40)보다 위 → 의도적.

### Phase 3 — i18n

**Step 3.1** `locales/{ko,en,vi}/hscode.json`에 `debug.*` flat 키 추가
- 키: `debug.title, debug.copy, debug.copied, debug.section.user, debug.section.raw, debug.name, debug.email, debug.roles, debug.admin, debug.entityId, debug.entityCode, debug.appCode, debug.scope, debug.expiry, debug.valid, debug.expired, debug.authStatus, debug.authed, debug.noToken, debug.referrer, debug.params, debug.jwt, debug.payload`.
- └─ 사이드 임팩트: 신규 키만 추가 → 기존 번역 무영향. 3언어 동시(누락 방지).

### Phase 4 — 검증/빌드

**Step 4.1** `npm run build`(tsc+vite) 그린.
**Step 4.2** 로컬 동작(목업 토큰 `?ama_token=…` 진입 → 판넬 요약/원시/복사 확인, 무토큰 안전).
- └─ 사이드 임팩트: 없음(로컬).

---

## 3. 변경 파일 목록

| 구분 | 파일 | 변경유형 |
|------|------|----------|
| Frontend | `src/components/common/DebugContextPanel.tsx` | 신규 |
| Frontend | `src/App.tsx` | 수정 |
| i18n | `src/i18n/locales/ko/hscode.json` | 수정 |
| i18n | `src/i18n/locales/en/hscode.json` | 수정 |
| i18n | `src/i18n/locales/vi/hscode.json` | 수정 |
| Backend / DB | — | 변경 없음 |

---

## 4. 사이드 임팩트 분석

| 범위 | 위험도 | 설명 |
|------|--------|------|
| 전 페이지 판넬 노출 | 낮음 | `fixed` 오버레이 — 레이아웃 흐름 무영향. 접힘 기본이라 UI 방해 최소 |
| z-index | 낮음 | z-50 > 헤더 z-40. 모달 등과 충돌 시 조정 여지(현재 앱 모달 z 확인 불요 — 판넬은 우하단 소형) |
| 전역 스토어 | 없음 | 읽기 전용 사용 |
| JWT 원문 노출 | 중(수용) | 전 환경 노출 결정에 따름. 프로덕션에서도 표시됨(정책 승인 완료) |
| 번들 크기 | 낮음 | 소형 컴포넌트 + 기존 lucide 재사용 |

---

## 5. DB 마이그레이션
- **불필요** (프론트 전용).

---

## 6. 배포 계획
1. 프론트 빌드 그린(로컬).
2. 스테이징 배포: 변경 소스 rsync 오버레이 → `web-app-hscode` 재빌드(`docker compose -f docker-compose.app-hscode.yml build web-app-hscode` → `up -d --no-deps web-app-hscode`). (기존 hscode 배포 패턴)
3. `stg-apps.amoeba.site/app-hscode/` 진입 → 우측 하단 판넬 확인.
4. main 정합 PR(선택, PR #93/#94 방식).

---

## 다음 단계
→ 테스트케이스(TC-20260709) → 구현 → 테스트 → TR → RPT.

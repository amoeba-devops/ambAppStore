# 요구사항분석서 — HS Code Manager AMA 컨텍스트 디버그 판넬

- **문서 ID**: REQ-20260709-HSCode-디버그판넬
- **작성일**: 2026-07-09
- **대상 앱**: HS Code Manager (`/app-hscode`)
- **유형**: 신규 기능 (개발/운영 디버그 도구)
- **요청**: `stg-apps.amoeba.site/app-hscode/` 우측 하단에 디버그 판넬 구현 — AMA를 통해 접속한 사용자 정보 표현

---

## 1. 요구사항 요약

| # | 요구사항 | 유형 |
|---|----------|------|
| R1 | 앱 우측 하단 고정(fixed) 위치에 디버그 판넬 표시 | 기능 |
| R2 | AMA SSO로 접속한 사용자 정보 표현(이름/이메일/역할/Entity/앱 컨텍스트) | 기능 |
| R3 | 원본 `ama_token`(JWT) 및 디코드된 payload 표시 | 기능 |
| R4 | 접기/펼치기 토글 + 내용 복사(clipboard) 버튼 | 기능 |
| R5 | 모든 라벨 i18n 처리(ko/en/vi) | 비기능(컨벤션) |
| R6 | car-manager `DebugContextPanel` 패턴과 일관 | 비기능 |

---

## 2. AS-IS 현황 분석

### 2.1 프론트엔드 인증 컨텍스트 (데이터 원천은 이미 존재)

| 항목 | 파일 | 내용 |
|------|------|------|
| Auth 스토어 | `frontend/src/stores/auth.store.ts` | `token`, `user: AuthUser`, `isAdmin()`. `AuthUser = { userId, entityId, entityCode, name, email, roles[] }` |
| 토큰 저장소 | `auth.store.ts:21` | `localStorage.getItem('hsc_token')` |
| 토큰 캡처 | `frontend/src/lib/ama-token.ts` | `bootstrapAmaAuth()`가 부팅 시 `ama_token` 디코드→`setAuth(user)`. `decodeAmaToken()` 재사용 가능 |
| 토큰 payload | `ama-token.ts:18` | `AmaTokenPayload { sub, userId, email, name, entityId/ent_id, entityCode/ent_code, level, role, roles[], scope, exp, iat }` |
| 레이아웃 | `frontend/src/App.tsx` | 헤더 + `<Outlet/>`. 모든 라우트를 감싸는 공통 레이아웃 → **판넬 마운트 지점** |
| 라우터 | `frontend/src/router.tsx` | `App`이 root element, children이 페이지 |

### 2.2 디버그 판넬 (현재 부재)

| 항목 | 상태 | 문제점 |
|------|------|--------|
| DebugPanel 컴포넌트 | **없음** | hscode에 디버그 UI 없음 |
| `components/common/` | ConfidenceBadge, LegalNotice, Placeholder, ScreenHeader, SubTabs | 디버그 판넬 신규 추가 필요 |
| i18n `debug.*` 키 | **없음**(grep=0) | ko/en/vi에 신규 추가 필요 |
| 아이콘 | `lucide-react ^0.468.0` 설치됨 | 재사용 가능(Bug, Copy, Check, ChevronUp/Down) |

### 2.3 참조 — car-manager `DebugContextPanel`

`apps/app-car-manager/frontend/src/components/common/DebugContextPanel.tsx`
- `fixed bottom-0 right-4 z-50`, 노란색 점선 테마, 토글 버튼 + 펼침 시 textarea(readOnly) + 복사 버튼.
- 표시 항목: referrer / initialParams / currentParams / JWT token / JWT payload / entity context.
- props로 `initialReferrer`, `initialQueryParams`(React 하이드레이션 전 캡처값) 수신.
- **차이점**: car는 localStorage `ama_token`, hscode는 `hsc_token`. car는 `entity_context` sessionStorage 사용(hscode엔 없음).

---

## 3. TO-BE 요구사항

### 3.1 AS-IS → TO-BE 매핑

| # | 항목 | AS-IS | TO-BE |
|---|------|-------|-------|
| 1 | 디버그 판넬 | 없음 | `DebugContextPanel.tsx` 신규(우측 하단 fixed) |
| 2 | 사용자 정보 원천 | auth.store `user` 존재 | 판넬이 `useAuthStore().user` + `hsc_token` 디코드로 표현 |
| 3 | 마운트 | — | `App.tsx` 레이아웃 하단에 `<DebugContextPanel/>` 추가 |
| 4 | i18n | debug 키 없음 | `debug.*` 키 ko/en/vi 추가(flat key — `keySeparator:false`) |

### 3.2 표시 정보 (AMA 사용자 컨텍스트)

**섹션 A — 사용자 요약(가독형):**
| 라벨 | 값 원천 |
|------|---------|
| 이름 | `user.name` (없으면 email local-part) |
| 이메일 | `user.email` |
| 역할 | `user.roles.join(', ')` + `isAdmin()` 표기 |
| Entity ID | `user.entityId` |
| Entity Code | `user.entityCode` |
| 앱 코드 | payload `appCode` |
| Scope | payload `scope` |
| 토큰 만료 | payload `exp` → 로컬시각 + 만료여부 |
| 인증 상태 | 토큰 유무 / 만료 |

**섹션 B — 원시 데이터(복사용 textarea):**
- referrer, current params, 원본 JWT, 디코드 payload(JSON pretty).

### 3.3 UI 설계

```
                                   ┌───────────────┐
                                   │ 🐛 Debug  ▲/▼ │  ← 토글(우측 하단 고정)
        (펼침 시)                   ├───────────────┤
        ┌──────────────────────────┴───────────────┐
        │ AMA Context           [📋 Copy]           │
        │ ── 사용자 ──                               │
        │ 이름: Gray Kim / 이메일: gray.kim@...      │
        │ 역할: MASTER (admin) / Entity: acce6566…  │
        │ 앱: hscode-manager / scope: custom_app:…  │
        │ 만료: 2026-07-09 05:18 (유효)             │
        │ ── 원시 ── (textarea readOnly)            │
        │ referrer / params / JWT / payload(JSON)   │
        └───────────────────────────────────────────┘
```
- 테마: car-manager와 동일 노란 점선(디버그 관례). `fixed bottom-0 right-4 z-50`.

### 3.4 신규/변경 파일

- `frontend/src/components/common/DebugContextPanel.tsx` (신규)
- `frontend/src/App.tsx` (수정 — 판넬 마운트)
- `frontend/src/i18n/locales/{ko,en,vi}/hscode.json` (수정 — `debug.*`)

---

## 4. 갭 분석

### 4.1 변경 범위 요약

| 영역 | 현재 | 변경 | 영향도 |
|------|------|------|--------|
| FE 컴포넌트 | 디버그 UI 없음 | DebugContextPanel 신규 | 낮음(신규, 격리) |
| FE 레이아웃 | App.tsx | 판넬 1줄 마운트 | 낮음 |
| i18n | debug 키 없음 | debug.* 3언어 | 낮음 |
| BE / DB | — | 변경 없음 | 없음 |

### 4.2 파일 변경 목록

| 구분 | 파일 | 변경유형 |
|------|------|----------|
| Frontend | `src/components/common/DebugContextPanel.tsx` | 신규 |
| Frontend | `src/App.tsx` | 수정 |
| i18n | `locales/{ko,en,vi}/hscode.json` | 수정 |

### 4.3 DB 마이그레이션
- **없음** (프론트 전용).

### 4.4 재빌드
- 정적 SPA(`web-app-hscode`) 재빌드 필요.

### 4.5 노출/보안 고려 (검토 필요 사항)
- 판넬은 JWT 원문을 표시 → **개발/스테이징 편의 도구**. 프로덕션 상시 노출 여부는 정책 결정 필요(§6).

---

## 5. 사용자 플로우

```
AMA 호스트에서 HS Code 진입 (?ama_token=…)
  └─ bootstrapAmaAuth() → setAuth(user), localStorage hsc_token 저장
       └─ App 렌더 → 우측 하단 🐛 토글 표시(접힘 기본)
            └─ 사용자가 토글 클릭 → 판넬 펼침
                 ├─ 섹션 A: user 스토어 + 토큰 payload 요약
                 ├─ 섹션 B: referrer/params/JWT/payload 원문
                 └─ [Copy] → 클립보드 복사 (2초 후 표시 원복)

토큰 없음(직접접근/만료) → 판넬은 "인증 없음/만료" 상태 표시(빈 값 안전 처리)
```

---

## 6. 기술 제약사항

| 구분 | 내용 |
|------|------|
| i18n | `keySeparator:false, nsSeparator:false` → **flat 점표기 키**(`"debug.title"`) 사용, 네임스페이스 `hscode` |
| 아이콘 | `lucide-react` 재사용 |
| 안전성 | 토큰/유저 null 안전 처리(미인증 상태에서도 크래시 없이 표시) |
| 보안(정책) | JWT 원문 노출 → 프로덕션 표시 정책 결정 필요. 기본안: 전 환경 표시(디버그 목적) / 대안: `import.meta.env.DEV`나 hostname 조건부 노출 → **작업계획서에서 확정** |
| 성능 | 순수 클라이언트, 최초 마운트 1회. 서버 호출 없음 |
| 배포 | VITE 정적 SPA 재빌드 필수. 스테이징 우선 |

---

## 다음 단계
본 분석서 승인 후 → **작업계획서(PLAN-20260709)** → TC → 구현 → 테스트 → TR → RPT.
> **확인 필요(§6 보안)**: 디버그 판넬을 **전 환경 상시 노출**로 할지, **개발/스테이징 한정**으로 할지 계획서 착수 전 결정 요청.

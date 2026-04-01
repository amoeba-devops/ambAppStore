# DebugContextPanel iframe Auto-Show — Requirements Analysis (요구사항 분석서)

---
- **document_id**: PLT-REQ-20260331-DEBUG-PANEL-IFRAME-AUTO
- **version**: 1.0.0
- **status**: Draft
- **created**: 2026-03-31
- **author**: AI Assistant
- **app**: platform + app-car-manager + app-stock-management (cross-app)
---

## 1. Requirements Summary (요구사항 요약)

| # | Requirement (요구사항) | Type (유형) |
|---|----------------------|-------------|
| FR-001 | iframe으로 접속 시 DebugContextPanel을 자동으로 표시 (admin 토글 불필요) | Functional |
| FR-002 | iframe 감지: `window.self !== window.top` 기반 자동 판별 | Functional |
| FR-003 | 기존 admin 수동 토글(`debug_panel_enabled`)도 병행 유지 | Functional |
| FR-004 | 3개 앱(platform, car-manager, stock-management) 모두 동일 적용 | Functional |
| FR-005 | iframe에서 접속 시 패널 기본 펼침(expanded) 상태로 표시 | Functional |

---

## 2. AS-IS Status Analysis (현황 분석)

### 2.1 Current DebugContextPanel Implementation

3개 앱 모두 동일한 구조:

**활성화 조건** (현재):
```typescript
const LS_KEY = 'debug_panel_enabled';
// ...
setEnabled(localStorage.getItem(LS_KEY) === 'true');
// ...
if (!enabled) return null;
```

- `localStorage('debug_panel_enabled') === 'true'` 일 때만 렌더링
- Platform Admin 사이드바에서 토글 스위치로 ON/OFF
- 기본값: `'false'` (비활성)

**문제점**:
1. AMA USER_LEVEL 사용자가 iframe으로 접속 시 패널이 보이지 않음
2. 어드민 로그인 → 토글 ON → 다시 앱 접속 필요 → 테스트 워크플로우 비효율
3. iframe 접속 감지 로직 없음

### 2.2 Affected Files (영향 파일)

| App | File | Token Key |
|-----|------|-----------|
| Platform | `apps/platform/frontend/src/components/common/DebugContextPanel.tsx` | `ama_token` |
| Car-Manager | `apps/app-car-manager/frontend/src/components/common/DebugContextPanel.tsx` | `ama_token` |
| Stock-Management | `apps/app-stock-management/frontend/src/components/common/DebugContextPanel.tsx` | `asm_token` |

### 2.3 AMA → AppStore iframe Flow

```
stg-ama.amoeba.site (Entity Settings > Custom Apps)
  └─ iframe src="https://stg-apps.amoeba.site/app-stock-management?ent_id=xxx&ent_code=VN01&..."
     └─ window.self !== window.top → true (iframe 내부)
     └─ 현재: debug_panel_enabled 미설정 → 패널 미표시
     └─ 기대: iframe 감지 → 패널 자동 표시 + 기본 펼침
```

---

## 3. TO-BE Requirements (TO-BE 요구사항)

### 3.1 AS-IS → TO-BE Mapping

| Area | AS-IS | TO-BE |
|------|-------|-------|
| 활성화 조건 | `localStorage === 'true'` only | `isInIframe \|\| localStorage === 'true'` |
| 기본 상태 | 접힌 상태 (collapsed) | iframe: 펼침 / 수동 토글: 접힘 |
| 적용 범위 | 어드민 토글 후에만 | iframe 접속 시 자동 + 수동 토글 병행 |

### 3.2 Activation Logic (활성화 로직)

```typescript
const isInIframe = window.self !== window.top;
const isManuallyEnabled = localStorage.getItem('debug_panel_enabled') === 'true';
const enabled = isInIframe || isManuallyEnabled;

// iframe 접속 시 기본 펼침
const [expanded, setExpanded] = useState(isInIframe);
```

---

## 4. Gap Analysis (갭 분석)

### 4.1 Change Scope Summary

| Area | Current | Change | Impact |
|------|---------|--------|--------|
| DebugContextPanel (3개 앱) | localStorage 체크만 | iframe 감지 추가 | Low |
| 기본 expanded 상태 | `false` 고정 | iframe 시 `true` | Low |

### 4.2 File Change List

| # | File | Change |
|---|------|--------|
| 1 | `apps/platform/frontend/src/components/common/DebugContextPanel.tsx` | Modify |
| 2 | `apps/app-car-manager/frontend/src/components/common/DebugContextPanel.tsx` | Modify |
| 3 | `apps/app-stock-management/frontend/src/components/common/DebugContextPanel.tsx` | Modify |

**Total**: 3 files modified

---

## 5. User Flow (사용자 플로우)

```
Step 1: AMA Entity 사용자 (USER_LEVEL) → entity-settings/custom-apps 접속
Step 2: 앱 목록에서 "재고관리" 클릭 → iframe으로 stg-apps.amoeba.site/app-stock-management 로드
Step 3: DebugContextPanel 자동 감지: window.self !== window.top → true
Step 4: 패널 표시 + 기본 펼침 상태
Step 5: Referer, Query Params, JWT Token, Entity Context 정보 확인 가능
Step 6: Copy 버튼으로 전체 내용 클립보드 복사
```

---

## 6. Technical Constraints (기술 제약사항)

| # | Constraint | Description |
|---|-----------|-------------|
| 1 | Cross-origin iframe | `window.self !== window.top`은 same-origin/cross-origin 모두 동작 |
| 2 | Security | iframe 감지는 브라우저 표준 API, 보안 이슈 없음 |
| 3 | Backwards compatible | 기존 admin 토글 기능 유지 |

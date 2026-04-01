# DebugContextPanel iframe Auto-Show — Task Plan (작업계획서)

---
- **document_id**: PLT-PLAN-20260331-DEBUG-PANEL-IFRAME-AUTO
- **version**: 1.0.0
- **status**: Draft
- **created**: 2026-03-31
- **author**: AI Assistant
- **based_on**: PLT-REQ-20260331-DEBUG-PANEL-IFRAME-AUTO
- **app**: platform + app-car-manager + app-stock-management
---

## 1. System Development Status Analysis (시스템 개발 현황 분석)

### 1.1 Current DebugContextPanel Structure (3개 앱 동일)

```typescript
// 현재 활성화 로직
const checkEnabled = useCallback(() => {
  setEnabled(localStorage.getItem(LS_KEY) === 'true');
}, []);

// 현재 expanded 초기값
const [expanded, setExpanded] = useState(false);
```

- 3개 앱 모두 `localStorage('debug_panel_enabled')` 체크만 수행
- iframe 감지 로직 없음
- 기본 접힌 상태

### 1.2 Required Change

```typescript
// 변경 후 활성화 로직
const isInIframe = window.self !== window.top;

const checkEnabled = useCallback(() => {
  setEnabled(isInIframe || localStorage.getItem(LS_KEY) === 'true');
}, []);

// iframe 시 기본 펼침
const [expanded, setExpanded] = useState(isInIframe);
```

---

## 2. Step-by-Step Implementation Plan (단계별 구현 계획)

### Phase 1: DebugContextPanel iframe Auto-Detect (3개 앱 동시)

#### Step 1.1: Platform DebugContextPanel.tsx
- `window.self !== window.top` 감지 추가
- `checkEnabled`에 `isInIframe` OR 조건 추가
- `expanded` 초기값을 `isInIframe`으로 변경
- └─ 사이드 임팩트: 비iframe 접속 시 기존 동작 유지 (admin 토글 필요)

#### Step 1.2: Car-Manager DebugContextPanel.tsx
- 동일 변경
- └─ 사이드 임팩트: 없음

#### Step 1.3: Stock-Management DebugContextPanel.tsx
- 동일 변경
- └─ 사이드 임팩트: 없음

---

## 3. File Change List (변경 파일 목록)

| # | Classification | File Path | Change Type |
|---|---------------|-----------|-------------|
| 1 | Platform FE | `apps/platform/frontend/src/components/common/DebugContextPanel.tsx` | Modify |
| 2 | Car-Manager FE | `apps/app-car-manager/frontend/src/components/common/DebugContextPanel.tsx` | Modify |
| 3 | Stock-Mgmt FE | `apps/app-stock-management/frontend/src/components/common/DebugContextPanel.tsx` | Modify |

**Total**: 3 files modified

---

## 4. Side Impact Analysis (사이드 임팩트 분석)

| Scope | Risk | Description |
|-------|------|-------------|
| iframe 감지 | **None** | `window.self !== window.top` 표준 API, 브라우저 호환성 100% |
| 기존 admin 토글 | **None** | OR 조건이므로 기존 토글 기능 유지 |
| 비iframe 직접 접속 | **None** | iframe이 아니면 기존과 동일 (admin 토글 필요) |
| 성능 | **None** | 동기 비교 1회 (`window.self !== window.top`) |

---

## 5. DB Migration (DB 마이그레이션)

**해당 없음** — 순수 프론트엔드 변경.

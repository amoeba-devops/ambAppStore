# REQ-20260402 — App Name Display & Admin Form Enhancement (앱 이름 표시 및 관리자 폼 개선)

---
document_id: PLT-REQ-20260402-AppNameEnhancement
version: 1.0.0
status: Draft
created: 2026-04-02
author: AI Assistant
app: platform
---

## 1. Requirements Summary (요구사항 요약)

| # | Requirement | Type |
|---|-------------|------|
| R-01 | Landing page app card: Display English name as primary, Korean name in parentheses `()` if exists | UI Change |
| R-02 | Admin form: Reorder — App Name (English) required first, App Name (Korean) optional second | UI Change + Validation |
| R-03 | Admin form: App Slug auto-generated from English name with `app-` prefix, hyphen-separated | UI Logic |
| R-04 | Admin form: Short Description / Description / Category — English only input enforcement | Validation |

---

## 2. AS-IS Analysis (현황 분석)

### 2.1 Landing Page — App Card Display

**File**: `apps/platform/frontend/src/components/AppCard.tsx`

| Field | Current | Note |
|-------|---------|------|
| Primary name | `app.name` (Korean name) | e.g. "법인차량관리", "재고관리" |
| English name | Not displayed | `app.nameEn` available in API response but unused |
| Short description | `app.shortDesc` | Korean text displayed |

**Current rendering** (Line 44):
```tsx
<h3 className="mb-1 text-lg font-bold text-gray-900">{app.name}</h3>
```

### 2.2 Admin Form — AppFormModal

**File**: `apps/platform/frontend/src/components/admin/AppFormModal.tsx`

**Current field order:**

| Order | Field | Required | Width |
|-------|-------|----------|-------|
| 1 | App Slug | Yes (create only) | Full |
| 2 | App Name (Korean) | Yes | 1/2 (grid) |
| 3 | App Name (English) | No | 1/2 (grid) |
| 4 | Short Description | No | Full |
| 5 | Description | No | Full (textarea) |
| 6 | Category | No | 1/2 |
| 7 | Status | Yes | 1/2 |
| 8 | Sort Order | No | 1/3 |
| 9 | FE Port | No | 1/3 |
| 10 | BE Port | No | 1/3 |

- **Slug**: Manually entered by user, no auto-generation logic
- **Name fields**: Korean first (required), English second (optional)
- **No input language restriction** on shortDesc / description / category

### 2.3 Backend — Entity & DTO

**File**: `apps/platform/backend/src/platform-app/entities/app.entity.ts`

| Column | Type | Nullable | Note |
|--------|------|----------|------|
| `app_name` | VARCHAR(100) | NOT NULL | Korean name (현재 필수) |
| `app_name_en` | VARCHAR(100) | NULL | English name (현재 선택) |
| `app_slug` | VARCHAR(50) | NOT NULL, UNIQUE | Manual input |

**File**: `apps/platform/backend/src/admin/dto/request/admin-app.request.ts`

- `CreateAppDto.app_name` — `@IsNotEmpty()` (required)
- `CreateAppDto.app_name_en` — `@IsOptional()` (optional)
- `CreateAppDto.app_slug` — `@IsNotEmpty()` (required, manual)

### 2.4 Seed Data

**File**: `apps/platform/backend/scripts/seed-apps.sql`

| Slug | app_name (KO) | app_name_en (EN) |
|------|---------------|------------------|
| app-car-manager | 법인차량관리 | Corporate Vehicle Manager |
| app-hscode | HS Code Tool | HS Code Tool |
| app-sales-report | 매출리포트 | Sales Report |
| app-stock-management | 재고관리 | Stock Forecast |

### 2.5 i18n

**File**: `apps/platform/frontend/src/i18n/locales/{lang}/admin.json`

| Key | en | ko |
|-----|----|----|
| `app.name` | App Name (Korean) | 앱 이름 (한국어) |
| `app.nameEn` | App Name (English) | 앱 이름 (영어) |
| `app.slug` | Slug | Slug |
| `app.slugPlaceholder` | app-my-app | app-my-app |

---

## 3. TO-BE Requirements (요구사항 상세)

### 3.1 R-01: Landing Page — English Name Primary Display

**AS-IS → TO-BE Mapping:**

| Aspect | AS-IS | TO-BE |
|--------|-------|-------|
| App card title | `{app.name}` (Korean) | `{app.nameEn}` (English primary) |
| Korean name display | Not shown | `({app.name})` in parentheses if exists and differs from EN |

**Display logic:**
```
IF nameEn exists:
  Primary: nameEn
  IF name exists AND name ≠ nameEn:
    Secondary: (name) — shown below or next to primary
ELSE:
  Primary: name (fallback)
```

**Example renders:**
- "Corporate Vehicle Manager (법인차량관리)"
- "HS Code Tool" (Korean name identical, no parentheses)
- "Sales Report (매출리포트)"

### 3.2 R-02: Admin Form — Name Field Reorder

**TO-BE field order:**

| Order | Field | Required | Width | Change |
|-------|-------|----------|-------|--------|
| 1 | **App Name (English)** | **Yes** ✱ | 1/2 | **Moved up, now required** |
| 2 | **App Name (Korean)** | **No** ✱ | 1/2 | **Moved down, now optional** |
| 3 | **App Slug** (auto-generated) | Yes (create only) | Full | **Auto-generated, read-only** |
| 4 | Short Description | No | Full | English only |
| 5 | Description | No | Full (textarea) | English only |
| 6 | Category | No | 1/2 | English only |
| 7 | Status | Yes | 1/2 | No change |
| 8 | Sort Order | No | 1/3 | No change |
| 9 | FE Port | No | 1/3 | No change |
| 10 | BE Port | No | 1/3 | No change |

### 3.3 R-03: Slug Auto-Generation

**Rule:**
```
slug = "app-" + englishName.toLowerCase()
                           .trim()
                           .replace(/[^a-z0-9\s-]/g, '')  // remove special chars
                           .replace(/\s+/g, '-')           // spaces → hyphens
                           .replace(/-+/g, '-')            // collapse hyphens
```

**Examples:**
| English Name Input | Generated Slug |
|-------------------|---------------|
| "Corporate Vehicle Manager" | `app-corporate-vehicle-manager` |
| "HS Code Tool" | `app-hs-code-tool` |
| "Stock Forecast" | `app-stock-forecast` |

- Slug field: **Read-only** (auto-filled from English name)
- User can **NOT** manually edit slug
- On edit mode: Slug is not shown / not editable (no change from current behavior)

### 3.4 R-04: English-Only Input Enforcement

**Affected fields:**
- Short Description
- Description
- Category

**Validation rule:** Only allow ASCII characters (English letters, numbers, common punctuation). Reject Korean/Vietnamese/CJK characters.

**Regex pattern:** `/^[a-zA-Z0-9\s.,;:!?()'\-–—/&+@#$%*=\[\]{}|<>"]+$/`

**UX behavior:**
- Show helper text: "English only" under each field
- On submit: Validate and show error if non-English characters detected

### 3.5 Backend DTO Changes

| Field | AS-IS | TO-BE |
|-------|-------|-------|
| `app_name` (Korean) | `@IsNotEmpty()` required | `@IsOptional()` optional |
| `app_name_en` (English) | `@IsOptional()` optional | `@IsNotEmpty()` **required** |
| `app_slug` | Manual input `@IsNotEmpty()` | Auto-generated (still required in DTO) |

**Entity column change:**
- `app_name`: `NOT NULL` → `NULL` (or keep NOT NULL with empty string default — **recommend keep NOT NULL, allow empty**)
- `app_name_en`: `NULL` → `NOT NULL`

---

## 4. Gap Analysis (갭 분석)

### 4.1 Change Summary

| Area | Current | Change | Impact |
|------|---------|--------|--------|
| AppCard.tsx | Korean name only | EN primary + KO in parentheses | Low |
| AppFormModal.tsx | KO required + EN optional + manual slug | EN required + KO optional + auto-slug | Medium |
| admin-app.request.ts | `app_name` required, `app_name_en` optional | Swap required/optional | Low |
| app.entity.ts | `app_name` NOT NULL, `app_name_en` nullable | `app_name_en` NOT NULL, `app_name` nullable | Medium (DB migration) |
| init-db.sql | Column nullability | Sync with entity | Low |
| seed-apps.sql | Both names present | No data change needed | None |
| i18n (3 langs × 2 ns) | Current labels | Update labels + add validation messages | Low |

### 4.2 File Change List

| # | Area | File | Change Type |
|---|------|------|-------------|
| 1 | Frontend | `components/AppCard.tsx` | Modify |
| 2 | Frontend | `components/admin/AppFormModal.tsx` | Modify |
| 3 | Frontend | `i18n/locales/en/admin.json` | Modify |
| 4 | Frontend | `i18n/locales/ko/admin.json` | Modify |
| 5 | Frontend | `i18n/locales/vi/admin.json` | Modify |
| 6 | Frontend | `i18n/locales/en/platform.json` | Modify (if needed) |
| 7 | Frontend | `i18n/locales/ko/platform.json` | Modify (if needed) |
| 8 | Frontend | `i18n/locales/vi/platform.json` | Modify (if needed) |
| 9 | Backend | `admin/dto/request/admin-app.request.ts` | Modify |
| 10 | Backend | `platform-app/entities/app.entity.ts` | Modify |
| 11 | DB | `scripts/init-db.sql` | Modify |

### 4.3 DB Migration Strategy

Staging DB (`synchronize: true` 비활성 시):
```sql
ALTER TABLE plt_apps
  MODIFY COLUMN app_name VARCHAR(100) NULL,
  MODIFY COLUMN app_name_en VARCHAR(100) NOT NULL;
```

> **Note**: Existing seed data already has both `app_name` and `app_name_en` populated for all 4 apps, so no data loss risk.

---

## 5. User Flow (사용자 플로우)

### 5.1 Landing Page — App Browsing

```
User visits stg-apps.amoeba.site
  │
  ├── App cards displayed in 3-column grid
  │   ├── Title: "Corporate Vehicle Manager (법인차량관리)"
  │   ├── Title: "HS Code Tool"       ← KO name identical, no parentheses
  │   ├── Title: "Sales Report (매출리포트)"
  │   └── Title: "Stock Forecast (재고관리)"
  │
  └── Click card → App detail page (no change in this task)
```

### 5.2 Admin — Register New App

```
Admin navigates to /admin/apps
  │
  ├── Clicks "Add New App" button
  │
  ├── Form opens:
  │   ├── [1] App Name (English) ← required, focused
  │   │       User types "Expense Tracker"
  │   │
  │   ├── [2] App Name (Korean) ← optional
  │   │       User types "경비관리" (or leaves empty)
  │   │
  │   ├── [3] App Slug ← auto-generated, read-only
  │   │       Shows: "app-expense-tracker"
  │   │
  │   ├── [4] Short Description ← English only
  │   │       Helper: "English only"
  │   │       User types "Track and manage corporate expenses"
  │   │
  │   ├── [5] Description ← English only
  │   │       User types full description in English
  │   │
  │   ├── [6] Category ← English only
  │   │       User types "Finance"
  │   │
  │   ├── [7~10] Status, Sort Order, Ports (no change)
  │   │
  │   └── Submit
  │       ├── Frontend validates: EN name not empty, slug auto-filled, English-only fields
  │       ├── Backend validates: slug uniqueness, DTO validation
  │       └── Success → Modal closes, list refreshes
```

---

## 6. Technical Constraints (기술 제약사항)

| # | Constraint | Detail |
|---|-----------|--------|
| 1 | DB backward compatibility | Existing 4 apps already have both name fields populated — no data migration needed |
| 2 | Slug uniqueness | Auto-generated slug still validated server-side for uniqueness (PLT-E3003) |
| 3 | Slug immutability | Slug is NOT editable after creation (existing behavior preserved) |
| 4 | English-only validation | Frontend-only enforcement (UX hint + regex check). Backend DTO does not restrict language |
| 5 | i18n | All label changes must update 3 language files (ko, en, vi) |
| 6 | API response format | `name` and `nameEn` fields remain in camelCase response — no API contract change |

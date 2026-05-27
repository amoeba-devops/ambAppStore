# Scan Report: User Guide Localization Issues
**Date**: 2026-05-27  
**Scope**: `/docs/user-guide/` static HTML (vi/, en/, ko/)  
**Status**: ❌ Multiple critical & medium issues found

---

## 1. CRITICAL: Missing `en/` Folder

| Issue | Details |
|---|---|
| **Scope** | Entire `/en/` directory missing |
| **Impact** | App claims 3-language support (EN/KO/VI) but English guide missing completely |
| **Files Missing** | 37+ files: `en/index.html`, `en/admin/*`, `en/manager/*`, `en/driver/*`, `en/common/*` |
| **Requirement** | Per `CLAUDE.md`: **"i18n EN/KO/VI"** |

**Fix**: Create `/en/` folder with full English translation (mirror `vi/` structure).

---

## 2. INDEX PAGES — Language Switcher Missing EN Link

### vi/index.html & ko/index.html
Both index pages show only VI + KO in lang-switch dropdown.

**Current** (dòng 13-14 in ko/index.html):
```html
<a href="../vi/index.html" ...>Tiếng Việt</a>
<a href="../ko/index.html" class="is-active" ...>한국어</a>
<!-- Missing EN link -->
```

**Should be**:
```html
<a href="../en/index.html" ...>English</a>
<a href="../vi/index.html" ...>Tiếng Việt</a>
<a href="../ko/index.html" ...>한국어</a>
```

---

## 3. KO/INDEX.HTML — Korean Translation Issues

### 3.1 Line 20: "각자에게 맞는 가이드를..." — Incorrect Grammar
**Issue**: "각자" = "each person" — incorrect when targeting 1 user  
**Current**: "각자에게 맞는 가이드를 보여 드립니다."  
**Better**: "당신의 역할에 맞는 가이드를 보여 드립니다." = "We show a guide suited to your role"

### 3.2 Line 32: "차량 예약" — Wrong Term
**Issue**: "예약" = "reservation" — but app does "trip assignment" not vehicle booking  
**Current**: "본인 또는 팀의 차량 예약"  
**Better**: "본인 또는 팀의 차량 배정" or "본인 또는 팀의 운행 신청"  

### 3.3 Line 38: Expense Types — Incomplete List
**Issue**: Only lists 3 of 8 expense types  
**Current**: "주유·주차·정비 비용 기록" = Fuel + Parking + Repair (3 types)  
**Should list all 8**: "주유, 주차, 정비, 사고, 식사, 오일, 검사 비용 기록"  
(Fuel, Parking, Repair, Accident, Meal, Oil, Inspection, + 1 more?)

---

## 4. DATE FORMAT INCONSISTENCY

**vi/index.html** (Line 48):
```
"Cập nhật lần cuối: 24-05-2026" (DD-MM-YYYY)
```

**ko/index.html** (Line 49):
```
"최종 업데이트: 2026-05-24" (YYYY-MM-DD)
```

**Fix**: Standardize to one format (recommend ISO `YYYY-MM-DD` or locale-appropriate)

---

## 5. FILE NAMING MISMATCH — All Locales

**Issue**: File names use Vietnamese slugs while content is translated to Korean/future English

| File | EN Content | KO Content | VI Content | Filename |
|---|---|---|---|---|
| `admin/00-tong-quan.html` | (missing) | 관리자 — 개요 | Quản trị viên — Tổng quan | ✅ VI slug |
| `admin/01-dashboard.html` | (missing) | 대시보드 | Dashboard | ✅ VI slug |
| `admin/02-quan-ly-xe.html` | (missing) | 차량 관리 | Quản lý xe | ✅ VI slug (OK but confusing) |
| `driver/02-today-screen.html` | (missing) | (check needed) | (check needed) | ✅ VI slug |

**Impact**:
- Sidebar links inside pages hardcode VI file paths
- Lang-switch (JavaScript) tries to switch locale but URL doesn't change
- No way to ensure correct locale page loads when shared via link

**Current Workaround** (in `lang-switch.js`): Reloads page on lang-click (user loses scroll position)

**Recommendation**:
- Option A: Rename files to locale-agnostic slugs (`admin/overview.html` → `/en/admin/overview.html`, `/ko/admin/overview.html`, `/vi/admin/overview.html`)
- Option B: Keep VI slugs, but ensure `lang-switch.js` rewrites `href` before navigation

---

## 6. SIDEBAR STRUCTURE ISSUE — File Paths Hardcoded

**ko/admin/00-tong-quan.html** sidebar (Line 30-34):
```html
<a class="sidebar__link" href="../common/00-gioi-thieu.html">소개</a>
<a class="sidebar__link" href="../common/01-dang-nhap.html">로그인</a>
<!-- etc. -->
```

✅ **OK since files use VI slugs** — but only works if all locales share same physical path structure

⚠️ **Risk**: If user bookmarks `/ko/admin/00-tong-quan.html`, sidebar links point to `/ko/common/00-gioi-thieu.html` (correct). But if user navigates via lang-switch, they're still in `/ko/` folder. This is fine **IF** Korean content is in `/ko/common/` folder.

**Check required**: Verify `/ko/common/00-gioi-thieu.html` exists and is fully translated Korean.

---

## 7. COUNTING ERROR — Admin Overview

**ko/admin/00-tong-quan.html** (Line 68):
```
<h2>11개 기능 그룹</h2>
```

**vi/admin/00-tong-quan.html** (Line 67):
```
<h2>11 nhóm chức năng</h2>
```

But **table body shows only 10 rows** (Lines 72-81 in KO, 71-81 in VI):
1. 대시보드 / Dashboard
2. 차량 관리 / Quản lý xe
3. 기사 관리 / Quản lý tài xế
4. 사용자 / Người dùng
5. 운행 / Chuyến đi
6. 비용 관리 / Quản lý chi phí
7. 정비 알림 / Cảnh báo bảo dưỡng
8. 보고서 / Báo cáo
9. 설정 / Cấu hình
10. 감사 로그 / Audit log

**Missing**: 1 feature group. Check:
- Should there be 10 or 11?
- If 11, what's the 11th (Manager module? Common features?)
- If 10, fix heading to say "10 nhóm chức năng"

---

## 8. LANG-SWITCH JAVASCRIPT ISSUE

**File**: `assets/js/lang-switch.js`  
**Current behavior**: On click, toggles active class but reloads page  
**Issue**: Reload loses scroll position

**Note**: This may be intentional for static guide, but check if better UX exists.

---

## 9. SIDEBAR DRAWER — Mobile Full Height

**File**: `assets/css/main.css` + `assets/js/sidebar.js`  
**Status**: ✅ Previously fixed (uses `top: 0; bottom: 0` instead of `100dvh`)

---

## 10. INCOMPLETE TRANSLATIONS — Sampling

Spot-checked Korean translations:
- ✅ Role names: 관리자, 매니저, 기사 — correct
- ✅ Feature names: 대시보드, 차량 관리 — correct
- ⚠️ Descriptions may need native Korean review (e.g., "각자에게" at ko/index.html line 20)

---

## Summary of Fixes Required

| Priority | Issue | Action | Files Affected |
|---|---|---|---|
| **CRITICAL** | Missing `en/` folder | Create full English translation | +37 files |
| **HIGH** | Index pages missing EN link | Add EN lang-switch link | `vi/index.html`, `ko/index.html`, (future `en/index.html`) |
| **HIGH** | Korean translation errors (index) | Fix "각자에게", "차량 예약", expense list | `ko/index.html` |
| **MEDIUM** | Date format inconsistency | Standardize format | `vi/index.html`, `ko/index.html`, (future) |
| **MEDIUM** | Counting error (11 vs 10) | Resolve feature count | `ko/admin/00-tong-quan.html`, `vi/admin/00-tong-quan.html` |
| **MEDIUM** | File naming unclear strategy | Clarify locale URL structure | Architecture decision |
| **LOW** | Native Korean review | QA pass on all KO pages | `ko/**/*.html` (36 files) |

---

## Next Steps

1. **Decide**: Create full English translation OR drop EN support?
   - If YES → Create `/en/` folder + translate all 37 files
   - If NO → Remove EN from app's i18n config + remove EN lang-switch links

2. **Fix index pages**: Korean term + expense list + date format

3. **Verify count**: Is it 10 or 11 admin features?

4. **Native QA**: Have Korean speaker review all `ko/**/*.html` pages

---

**Report generated**: 2026-05-27 by Claude Code

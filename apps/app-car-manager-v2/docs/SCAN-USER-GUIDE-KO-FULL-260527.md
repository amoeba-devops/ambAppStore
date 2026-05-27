# Scan Report: Korean Translation Audit — User Guide (Full)

**Date**: 2026-05-27
**Scope**: `apps/web/public/docs/user-guide/ko/` — 33 HTML files (admin × 11, manager × 7, driver × 8, common × 6, index × 1)
**Method**: Section-by-section comparison of each `ko/` file against its `vi/` source-of-truth counterpart, executed by 4 parallel research agents (admin / manager / driver / common).
**Total issues found**: ~225 across 33 files
**Status**: ❌ Critical — 10 of 33 files are effectively untranslated; systematic terminology error propagates everywhere.

---

## 0. Executive Summary

### 0.1 Severity buckets

| Bucket | Count | Files |
|---|---:|---|
| ✅ Clean (no issues) | 8 | admin/00, 02, 06, 08, 09; driver/00, 01; (none in manager/common) |
| 🟡 Low–medium issues only | 15 | admin/01, 03, 04, 07, 10; manager/00, 01, 02, 03; common/00, 01, 02, 03, 04, 99; index.html |
| 🔴 **CRITICAL — body mostly Vietnamese** | 10 | admin/05; manager/04, 05, 06; driver/02, 03, 04, 05, 06, 07 |

### 0.2 The 3 systemic problems

**P0 — Terminology error: `예약 (reservation)` everywhere it should be `신청/배정 (request/assignment)`**

The Korean translation systematically renders Vietnamese `Đặt xe` (request a corporate vehicle) as `차량 예약` (book/reserve a vehicle). This is wrong in domain: the system is **internal corporate dispatch**, not consumer ride-hailing or rental booking. The Korean word `예약` carries strong "consumer booking / make a reservation" connotations (hotels, restaurants, KTX), which mis-frames the entire product.

Correct Korean depending on context:
- Manager view (= "I am requesting a vehicle for a trip") → **`차량 신청`** or **`운행 신청`**
- Admin view (= "I am assigning a vehicle/driver to a trip") → **`차량 배정`** or **`운행 배정`**

Affected: sidebar of every page (`02-dat-xe.html` link label), page titles, breadcrumbs, body text, glossary. Single highest-value fix.

**P1 — Frankenstein translations: Vietnamese sentences with Korean nouns pasted in**

10 files (admin/05, manager/04-06, driver/02-07) all carry a `한국어 번역 진행 중` banner and have bodies that are **structurally still Vietnamese**. The translator did a token-level replacement of select Korean nouns (운행, 기사, 메모, 알림, 정비, 정기검사, 오일 교환, 주행거리, 번호판, 출발지, 도착지) onto Vietnamese sentence frames, leaving Vietnamese verbs ("Bấm", "Mở", "Chọn"), connectors ("và", "có", "khi"), particles, and headings untouched. Sample line from `driver/03-xac-nhan-chuyen.html:82`:

> `Mở app từ thông báo đẩy, hoặc vào tab 운행 của tôi → 운행 có nhãn "Chờ 기사 xác nhận".`

This is unusable for Korean readers — it is not "partial translation", it is "find-and-replace on top of Vietnamese". The 10 files need a full body rewrite, not patch edits.

**P2 — Self-pronoun and register inconsistencies**

Korean user-guide convention is informal `내 / 사용자 / 본인 계정` for second-person address. Many manager pages use the formal-legal `본인 (the undersigned)`, which reads stiff. Several callouts have bare-noun sentence endings (`초대/역할 변경은 관리자 권한`) that lack the required verb ending (`…권한입니다`) — grammatically truncated.

### 0.3 Recommended fix order

1. **Decide canonical KR terms** (1-page glossary): `차량 신청 / 차량 배정 / 운행 / 기사 / 정비 알림 / 엔진오일 / 자동차 검사 / 알림함 / …`. Lock these before any rewriting.
2. **Global find-replace pass**: `차량 예약 → 차량 신청` (with manual review for admin-side text where `차량 배정` is the right word), `오일 교환 (standalone) → 엔진오일 교환`, footer `Phản hồi → 피드백`, breadcrumb tail Vietnamese segments → Korean.
3. **Full rewrite of 10 critical files** using files `driver/00-tong-quan.html` + `driver/01-cai-pwa.html` as quality reference (those two are clean, full-Korean translations).
4. **Line-specific copy-edits** in the 15 medium files (per the per-section tables below).
5. **Add missing glossary entries** in `common/99-thuat-ngu.html`: `차량 신청 (Đặt xe)`, `회사 코드 (ent_code)`.

---

## 1. CRITICAL — Files that are essentially untranslated

These 10 files carry a `한국어 번역 진행 중` banner and have bodies that are Vietnamese with Korean nouns sprinkled on top. **Full retranslation required.** Patching individual lines is not viable.

| File | Lines | Notes |
|---|---:|---|
| `admin/05-quan-ly-chuyen-di.html` | 147 | Breadcrumb mixed (`홈 · 관리자 · Quản lý 운행`). Every step instruction, callout, h2 still Vietnamese. ~14 distinct sections need rewriting. |
| `manager/04-ghi-chi-phi.html` | 155 | ~70% body Vietnamese. Form steps 1-9 all Vietnamese (`Nhập Số tiền…`, `Chọn Ngày…`, `Bấm "Ghi nhận"…`). |
| `manager/05-so-chi-phi.html` | 130 | Body, filter list, columns description all Vietnamese. Mixed phrases like `승인 phân cấp` literally splice 2 languages mid-noun-phrase. |
| `manager/06-bao-cao-ca-nhan.html` | 144 | Two how-to methods + advanced reports section all in Vietnamese. |
| `driver/02-today-screen.html` | 159 | All h2/h3 headings, body paragraphs, bottom-nav tab descriptions Vietnamese. Compound order issue: `목적 운행` should be `운행 목적`. |
| `driver/03-xac-nhan-chuyen.html` | 160 | All step instructions Vietnamese. Status label `Chờ 기사 xác nhận` is half-half nonsense. Reject-reasons table fully Vietnamese. |
| `driver/04-bat-dau-ket-thuc-chuyen.html` | 184 | All step instructions for start/end trip Vietnamese. Edge-case troubleshooting table Vietnamese. Redundant `주행거리 (주행거리계)` at line 135 needs disambiguation. |
| `driver/05-ghi-chi-phi.html` | 215 | All 8 expense-type table rows Vietnamese. All 9 form-step instructions Vietnamese. Status labels (`Chờ duyệt`, `Đã duyệt`, `Tự duyệt`, `Bị từ chối`) Vietnamese. |
| `driver/06-canh-bao-bao-duong.html` | 166 | Maintenance alert types table fully Vietnamese. `오일 교환 / 정기검사` mixed inconsistently with `엔진오일 교환` from other pages. |
| `driver/07-ngoai-tuyen.html` | 141 | Current-behavior table + offline-roadmap list all Vietnamese. |

**Reference for what done looks like**: `driver/00-tong-quan.html` and `driver/01-cai-pwa.html` are fully and naturally translated Korean. Use these as style/voice reference.

---

## 2. HIGH — `차량 예약` wrong-term occurrences (cross-file)

Verified instances of `예약` used where `신청` or `배정` is correct. **Single global string fix in the sidebar template** removes ~10 of these in one pass; the rest are body-text occurrences needing individual edits.

| File | Line | Current | Correct |
|---|---:|---|---|
| `index.html` | 32 | `본인 또는 팀의 차량 예약` | `본인 또는 팀의 차량 신청` |
| `common/00-gioi-thieu.html` | 98 | `본인 또는 팀의 차량 예약, 이력 추적, 본인 운행 취소` | `본인 또는 팀의 차량 신청, 이력 추적, 본인 운행 취소, 계층적 비용 승인` |
| `common/00-gioi-thieu.html` | 110 | `운행 — 예약, 배정, 추적, 취소` | `운행 — 신청, 배정, 추적, 취소` |
| `common/00-gioi-thieu.html` | 120 | `매니저 운행 예약 →` (ASCII flow) | `매니저 운행 신청 →` |
| `common/{00..04,99}.html` + `index.html` | 55 (each) | sidebar: `차량 예약` (7 files) | sidebar: `차량 신청` |
| `manager/00-tong-quan.html` | 57, 62, 70 | `데스크톱에서 예약…`, `회의/출장 차량 예약`, `새 차량 예약` | replace `예약` with `신청` |
| `manager/00-tong-quan.html` | 90 (table row) | `차량 예약` | `차량 신청` |
| `manager/01-dashboard.html` | 88 | `차량 예약 폼` | `차량 신청 폼` |
| `manager/02-dat-xe.html` | 6 | `<title>차량 예약 — …</title>` | `<title>차량 신청 — …</title>` |
| `manager/02-dat-xe.html` | 50 | breadcrumb `· 매니저 · 차량 예약` | `· 매니저 · 차량 신청` |
| `manager/02-dat-xe.html` | 51 | `<h1>차량 예약 — 새 운행 만들기</h1>` | `<h1>차량 신청 — 새 운행 만들기</h1>` |
| `manager/02-dat-xe.html` | 101 | `대신 예약하는 경우…` | `대신 신청하는 경우…` |
| `manager/02-dat-xe.html` | 149 | `팁: 미리 예약하세요` | `팁: 미리 신청하세요` |
| `manager/02-dat-xe.html` | 155 (pager) | `차량 예약` | `차량 신청` |
| `manager/03-theo-doi-chuyen-di.html` | 110 | `…운행을 예약한 경우` | `…운행을 신청한 경우` |
| `manager/03-theo-doi-chuyen-di.html` | 125 (pager) | `차량 예약` | `차량 신청` |
| `admin/04-quan-ly-nguoi-dung.html` | 148 | `차량 예약 + 개인 보고서 조회` (MANAGER role) | `차량 신청 + 개인 보고서 조회` |
| `admin/07-canh-bao-bao-duong.html` | 121 | `다시 운행을 예약할 수 있게 합니다` | `다시 운행을 신청할 수 있게 합니다` |
| Manager sidebar (every file) | line 40-41 | sidebar entry `02-dat-xe.html → 차량 예약` | `차량 신청` |

**Action**: Pick canonical term (recommend `차량 신청` for user-facing, `차량 배정` for admin-side), then find/replace.

---

## 3. MEDIUM — Per-file findings for the 15 partially-translated files

### 3.1 admin/01-dashboard.html (2 issues)

| Line | Issue | Current | Fix |
|---:|---|---|---|
| 75 | Awkward word order | `이번 달 운행 X건` | `이번 달 운행 X건` is OK; consider `이번 달에 X건 운행` |
| 76 | Inaccurate column header (loses "Quyết định" semantics) | `<td>권한 범위</td>` | `<td>의사결정 범위</td>` or `<td>시야</td>` |

### 3.2 admin/03-quan-ly-tai-xe.html (3 issues)

| Line | Issue | Current | Fix |
|---:|---|---|---|
| 67 | Count phrasing ambiguous | `"X명 만료 임박" 카운트` | `"면허 만료 임박 X명" 카운터` |
| 75 | Status enum mistranslated (overlaps PENDING semantics) | `(대기 중 / 운행 중 / 휴무 / 불가)` | `(사용 가능 / 운행 중 / 휴무 / 사용 불가)` |
| 88 | Stale wording — no longer "초대" since onboarding refactor | `MEMBER (DRIVER) 역할로 초대하세요` | `MEMBER (DRIVER) 역할로 추가하세요` |

### 3.3 admin/04-quan-ly-nguoi-dung.html (5 issues)

| Line | Issue | Current | Fix |
|---:|---|---|---|
| 91 | "조작" carries negative undertone | `시스템 조작이 필요 없어 간단합니다` | `시스템 작업이 필요 없어 간단합니다` |
| 92 vs 96 | Mixes `기업 코드` and `조직` for same concept | (two terms) | Standardize: `기업 코드` |
| 130 | "로그인 정보" implies credentials, but content is onboarding info | `로그인 정보를 전송하세요` | `로그인 안내를 전송하세요` |
| 148 | **HIGH** `차량 예약` wrong term | (see §2) | `차량 신청` |
| 102–114 | Vietnamese sample message block (intentional — sent to VN members). OK as-is, but consider wrapper note in Korean explaining why. | — | (optional) |

### 3.4 admin/07-canh-bao-bao-duong.html (2 issues)

| Line | Issue | Current | Fix |
|---:|---|---|---|
| 121 | **HIGH** `예약` wrong term | `다시 운행을 예약할 수 있게 합니다` | `다시 운행을 신청할 수 있게` |
| 141 | Minor — drops dev-context label "Idempotency window" | `중복 방지: 24시간…` | `중복 방지 (Idempotency window): 24시간…` |

### 3.5 admin/10-audit-log.html (3 issues)

| Line | Issue | Current | Fix |
|---:|---|---|---|
| 79 | "대상" too vague vs VI "Thực thể" | `<strong>대상</strong>` | `<strong>엔티티</strong>` |
| 80 | "참조" duplicates cell content | `<strong>참조</strong>` | `<strong>식별자</strong>` or `<strong>ID/코드</strong>` |
| 106 | Self-contradicting wording (also present in VI) | `감사 로그는 삭제할 수 없습니다 — raw SQL 권한을 가진 DB 관리자만 가능` | `감사 로그는 앱에서 삭제할 수 없습니다 — raw SQL 권한을 가진 DB 관리자만 (예외적으로) 가능` |

### 3.6 manager/00-tong-quan.html (16 issues)

Major patterns:
- `예약` misuse (already in §2, 3 occurrences: lines 57, 62, 70, 90)
- Formal self-pronoun `본인` for second-person address — should be `내` or omitted (lines 62, 69, 70)
- Bare-noun sentence endings without verb (lines 80, 81, 82, 83) — e.g., `초대/역할 변경은 관리자 권한` → `…관리자 권한입니다`
- Line 78 — grammar broken: `무엇은 하지 않나요?` → particle `은` after `무엇` is incorrect → `무엇을 하지 않나요?` (or rephrase heading)
- Line 82 — literal dash-port `감사 로그 접근 불가 — 보안` → `— 보안 사유`

### 3.7 manager/01-dashboard.html (12 issues)

Major patterns:
- `예약` misuse line 88 (in §2)
- Inconsistent `차량 팀` (with space) vs `차량팀` (without space) — pick one
- Formal self-pronoun `본인` (line 56) vs `내` — inconsistent; pick one
- Status enum: `대기 중` should be `사용 가능`; `폐차` should be `퇴역` or `처분됨` (line 82)
- Broken word order line 94: `이번 달 X건 운행` → `이번 달 운행 X건`
- Line 77: "By vehicle" (`차량별`) listed under "4 시간 모드" but is a grouping mode, not a time mode → rename heading `4가지 보기 모드`

### 3.8 manager/02-dat-xe.html (11 issues)

All major issues are `예약 → 신청` (already in §2, 7 occurrences). Body otherwise translated. Minor:
- Line 80: `1구` literal port of Vietnamese `Quận 1` → `호치민시 1군` for Korean readers
- Line 87: `출발지와 동일하게 입력` reads as "fill identically" → `출발지와 같은 방식으로 입력`

### 3.9 manager/03-theo-doi-chuyen-di.html (12 issues)

Major patterns:
- `예약` misuse line 110, 125 (in §2)
- **Mistranslation line 95**: `출발 / 도착` should be `시작 / 종료` — describes state-machine `start/end`, not geographic `depart/arrive`. The state IN_PROGRESS → COMPLETED transition is "ended" not "arrived" (trip might end anywhere).
- Inconsistent status form mix `확정됨 / 운행 중 / 완료 / 취소됨` — pick consistent style (line 72)
- "특이 케이스" reads as "edge case" — VI says "Special" → use `특별 케이스` or `참고` (line 109)

### 3.10 common/00-gioi-thieu.html (7 issues)

Major patterns:
- `예약` misuse line 98, 110, 120 (in §2)
- Missing content line 98: VI has `duyệt chi phí phân cấp` (cascading expense approval), KO drops it entirely
- Line 113: `다차원` (mathematical "multi-dimensional") for VI's `theo nhiều chiều` → use `다양한 기준` or `여러 차원의`

### 3.11 common/01-dang-nhap.html (9 issues)

Major patterns:
- Sidebar `예약` (already in §2)
- Line 149: KO says "phone not remembered", VI says "phone doesn't match" — semantic drift; fix to `전화번호가 일치하지 않으면`
- Line 155: VI lists `SMS / Zalo / Telegram / Email`; KO substitutes Korean-popular `카카오톡`. Smart localization, but consider keeping Zalo for accuracy with deployment region (Vietnam). Either keep current or inclusive: `SMS / Zalo / 카카오톡 / 텔레그램 / 이메일`.
- Line 194: register inconsistency — `할 일 없음` (informal-curt) vs other bullets using `-습니다/-합니다` polite form → `본인이 할 일은 없습니다`
- Lines 211-214: compressed symptom descriptions drop VI context ("Click vào icon Amoeba", "Vào app thấy") — add back

### 3.12 common/02-dieu-huong.html (4 issues)

Major patterns:
- Sidebar `예약`
- Line 129: `차량 예약` (in §2) + `차량팀` (non-idiomatic) → `차량 신청 및 차량 운영 추적`
- Line 149: KO adds `/` keyboard-shortcut row not in VI source (probably intentional enhancement — sync to VI too if so)

### 3.13 common/03-ngon-ngu.html (4 issues)

Sidebar `예약` + minor wording.

| Line | Issue | Fix |
|---:|---|---|
| 99 | `언어 카드` vs VI `khối Ngôn ngữ hiển thị` | `언어 표시 카드` |
| 109 | `(VI, EN, KO)` drops VI's "hoặc" (or) | `(Tiếng Việt, English, 또는 한국어)` |

### 3.14 common/04-thong-bao.html (6 issues)

| Line | Issue | Current | Fix |
|---:|---|---|---|
| 55 | Sidebar `예약` | — | (see §2) |
| 117 | Logical subject confusion | `기사가 본인 운행을 확인` | `기사가 귀하의 운행을 확인` |
| 121-122 | Inconsistent `오일` vs `엔진오일` | `오일 교환 임박/만료` | `엔진오일 교환 임박` / `엔진오일 교환 기한 초과` |

### 3.15 common/99-thuat-ngu.html (7 issues + 2 missing entries)

| Line | Issue | Current | Fix |
|---:|---|---|---|
| 87 | Headword "정비" too generic; body says `오일 교환` not `엔진오일 교환` | `정비 · 정기 점검 — 오일 교환…` | Body: `엔진오일 교환…` |
| 98 | Misplaced alphabet section — `7일 잠금` starts with number, not in I-Q range | (under I-Q) | Rename `잠금 (Lock 7일)` and place in ㅈ section |
| 99 | `오일` inconsistent | `오일/정기검사 만료 임박` | `엔진오일/정기검사 만료 임박` |
| 113 | Role inconsistency with rest of guide (`매니저/디렉터` elsewhere vs `매니저` here) | — | Standardize across all files |
| — | **MISSING ENTRY**: `차량 신청 (Đặt xe)` — core business action, no glossary entry | — | Add: `차량 신청 (Đặt xe) · 매니저가 본인 또는 팀의 운행을 신청하는 행위. 관리자가 차량·기사를 배정함.` |
| — | **MISSING ENTRY**: `회사 코드 (ent_code)` — referenced in login flow | — | Add: `회사 코드 (ent_code) · 회사를 식별하는 고유 코드. 직접 로그인 시 사용.` |

### 3.16 index.html (5 issues)

| Line | Issue | Current | Fix |
|---:|---|---|---|
| 20 | Awkward phrasing — loses imperative | `각자에게 맞는 가이드를 보여 드립니다` | `역할을 선택하시면 맞춤 가이드를 보여 드립니다` |
| 26 | Loses VI specificity (`duyệt chi phí`) | `시스템 설정, 비용 관리, 운행 배정…` | `시스템 설정, 비용 승인, 운행 배정…` |
| 32 | `예약` (in §2) + missing `duyệt phân cấp` | `차량 예약 … 비용 기록. 웹과 모바일…` | `차량 신청, 운행 이력 추적, 비용 기록, 비용 결재. 웹과 모바일…` |
| 38 | Incomplete expense list (3 of 8, omits "오일") | `주유·주차·정비 비용 기록` | `주유·오일·주차·정비 비용 기록` (4 representative items, matches VI) |

---

## 4. Cross-cutting terminology drift checklist

Standardize these terms across **all** KO files before finalizing:

| VI source | Canonical KO | Wrong variants seen |
|---|---|---|
| Đặt xe (manager view) | **차량 신청** | 차량 예약 |
| Đặt xe (admin view) | **차량 배정** | 차량 예약 |
| Chuyến đi | **운행** | (consistent) |
| Tài xế | **기사** | (consistent) |
| Cảnh báo bảo dưỡng | **정비 알림** | (consistent in titles, but body uses "알림" / "경고" inconsistently) |
| Thay dầu | **엔진오일 교환** | 오일 교환 (standalone — ambiguous) |
| Đăng kiểm | **자동차 검사** or **정기검사** | (pick one; both seen) |
| Bắt đầu / kết thúc chuyến (state-machine) | **운행 시작 / 운행 종료** | 출발 / 도착 (geographic, wrong semantics) |
| Sẵn sàng (vehicle status AVAILABLE) | **사용 가능** | 대기 중 (overlaps PENDING) |
| Đã thanh lý (vehicle status RETIRED) | **퇴역 / 처분됨** | 폐차 (means "scrapped", different) |
| Ghi chú | **메모** | (consistent) |
| Hộp thư | **알림함** | (consistent) |
| Phản hồi (footer) | **피드백** | "Phản hồi" left untranslated in 10+ files |
| `bạn` (second-person) | **내 / 사용자 / (omit)** | 본인 (formal-legal) used inconsistently |

---

## 5. Recommended fix plan (5 phases)

### Phase 1 — Decisions (engineer + Korean speaker, ~1 hour)
1. Lock canonical terms from §4 above (1-page mini-glossary).
2. Decide: `차량 신청` vs `차량 배정` per role context (recommend: 신청 for user-facing, 배정 for admin actions).
3. Decide: keep KO addition of `/` shortcut row in common/02 + add to VI? Or remove?
4. Decide: keep Korean-localized `카카오톡` in login flow, or restore `Zalo` for region accuracy?

### Phase 2 — Mechanical sweeps (~30 min)
1. Sidebar template fix: `차량 예약 → 차량 신청` in all 33 files.
2. Footer fix: `Phản hồi → 피드백` in 10 driver/manager files.
3. Breadcrumb tail fix: replace last Vietnamese segment in each of the 10 critical files.
4. `오일 교환 → 엔진오일 교환` (verify each instance — some "오일" alone may be correct in glossary header).

### Phase 3 — Full rewrites for 10 critical files (~2-3 days)
Re-translate body of: `admin/05`, `manager/04-06`, `driver/02-07`. Use `driver/00-tong-quan.html` + `driver/01-cai-pwa.html` as voice/style reference. Remove `한국어 번역 진행 중` banner after each file is complete.

### Phase 4 — Line-specific copy-edits (~half day)
Apply the per-line fixes in §3 above for the 15 medium-issue files.

### Phase 5 — Glossary additions (~30 min)
Add `차량 신청 (Đặt xe)` and `회사 코드 (ent_code)` entries to `common/99-thuat-ngu.html` (and mirror to VI).

### Phase 6 — Native QA pass (~half day)
Korean speaker reads all 33 KO files end-to-end, flags remaining issues. Particular attention to:
- Honorific consistency (-습니다 vs -해요)
- Particle correctness (은/는/이/가/을/를)
- Self-pronoun choice (내 vs 본인 vs 사용자)

---

## 6. Coverage attestation

All 33 files were read in full and section-by-section compared to their VI counterparts:

- ✅ `index.html` + 6 `common/*.html` (1 agent, ~120K tokens)
- ✅ 11 `admin/*.html` (1 agent, ~145K tokens)
- ✅ 7 `manager/*.html` (1 agent, ~100K tokens)
- ✅ 8 `driver/*.html` (1 agent, ~118K tokens)

Total audit cost: ~483K tokens across 4 parallel research agents.

---

**Report generated**: 2026-05-27
**Next action**: Phase 1 — decide canonical terms before any code edits.

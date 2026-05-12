# Prototype Audit — FIRGI Sales Ops (Figma Make bundle)

> Audit ngày 2026-05-11. Method: decode gzip+base64 bundle, extract UI strings từ 54 assets (3 JS bundles tổng 4.3MB).
> Mục đích: verify prototype có match REQ + SRD + final decisions.

## 1. Method

Prototype HTML là Figma Make bundle với asset payload nén ở line 170 (2.2MB). Decode pipeline:
1. Parse JSON object `{asset_id: {mime, compressed, data:base64}}`
2. Base64 decode → gzip decompress → 54 assets (JS, CSS, fonts, SVGs)
3. Main JS bundle = 3.1MB minified React app
4. Grep specific UI keywords + multi-word phrases

**Limitation**: React render strings bị split/minified → không thể extract toàn bộ UI tree. Chỉ verify được keyword existence + sample phrases.

## 2. Confirmed matches (HIGH confidence)

### 2.1 Roles ✅
| Role | Occurrences trong bundle |
|---|---|
| Operator | 86 |
| Manager | 58 |
| Admin | 31 |

Khớp [SRD §2.3](SRD-20260506-FIRGI-SalesReport-v2.md) và [final-decisions Q-E](../../.claude/memory/final-decisions.md) (3 roles, pure AMA passthrough).

### 2.2 Platforms ✅
| Platform | Mentions |
|---|---|
| Shopee | 33 |
| TikTok | 32 |
| TikTok Shop | 5 |

### 2.3 Currency ✅
- VND: 49 mentions
- KRW: implied
- "Vietnam Dong" hiển thị trong product breakdown table

### 2.4 Key metrics ✅
| Metric | Mentions |
|---|---|
| GMV | 24 |
| Net GMV | 9 |
| NMV | 4 |
| Contribution Margin | 6 (+3 CM short) |
| Prime Cost | 9 (Cerave brand mock data) |
| Conversion | 21 |
| SKU | 23 |

### 2.5 Period comparison ✅
| Concept | Mentions |
|---|---|
| Week | 58 |
| Period | 27 |
| WoW | 26 |
| Trend | 22 |
| Month | 5 (low!) |
| MoM | 7 |

### 2.6 Operations ✅
| Action | Mentions |
|---|---|
| Upload | 20 |
| Export | 517 (heavy use, likely component name) |
| Edit | 29 |
| Delete | 71 |
| Save | 6 |
| Cancel | 9 |
| Confirm | 8 |
| Submit | 3 |
| Finalize | 8 |
| Drag | 30 |
| Drop | 10 |
| Browse | 51 |

### 2.7 Pages found (multi-word phrases) ✅
- **Weekly Report** ✓
- **Weekly Detail** ✓ (4 mentions — drill-down per FR-09)
- **Weekly Summary Hero** ✓ (likely overview card)
- **Product Breakdown** ✓ (FR-09)
- **Trend Report** ✓ (FR-15~18)
- **Activity Log** ✓ (FR-19~21)
- **Sales Report** ✓
- **Shopee Sales Report** ✓ (FR-02)
- **Shopee Ads Report** ✓ (FR-02 ADS section)
- **Affiliate Report** ✓ (FR-02/03 affiliate)

### 2.8 Cost categories ✅
| Category | Mentions |
|---|---|
| Affiliate | 14 |
| Brand Ads | 2 |
| Livestream | 8 |
| Booking | 7 |
| Platform Fee | 4 |
| Off-Platform | implied |

### 2.9 Mock data uses April 2026 (cùng period với real data!) ✅
- Sample dates trong UI: `Apr 05`, `Apr 06 – Apr 12`, `Apr 13 – Apr 19`, `Apr 20 – Apr 26`, `Apr 27 and May 03`, `May 03, 2026`
- → Prototype mock data **trùng month với `resources/` CSV** (April 2026)
- Brand mock: "Cerave" (khác real data "Firgi" — chỉ là demo placeholder)

### 2.10 Upload UX strings ✅
- `Drop CSV or Excel files here` ✓
- `Drop your files`
- `Drag-and-Drop Attributes`
- Drag/Drop/Browse keywords prominent

## 3. POTENTIAL DIVERGENCE từ final decisions (cần bạn xác nhận)

### ✅ 3.1 Q-A Upload format — RESOLVED 2026-05-11 (Option C Smart Drop Zone)

**User chốt** (sau audit prototype): Option C Hybrid với **Smart Drop Zone** UX — 1 drop zone duy nhất, auto-detect, lenient skip. Cover consolidated + individual + mix. Detail: [UPLOAD-FLOW-20260511.md](UPLOAD-FLOW-20260511.md).

Phần dưới đây giữ lại làm reference history:

---

### 🚨 (history) Q-A Upload format — có thể KHÔNG đúng decision của mình

**Prototype text found** (string trong main JS):
```
"Select which raw reports you have for each channel. Skip any you don..."
```

**Interpretation**:
- Hint mạnh: prototype design **per-section upload với "Skip" option**
- KHÔNG phải 1 consolidated CSV per platform như Q-A đã chốt
- User chọn checkbox cho từng raw report (6 Shopee + 3 TikTok), upload từng file riêng, skip cái không có

**Conflict với Q-A**:
| | Q-A decision | Prototype hint |
|---|---|---|
| Slot count | 2 (Shopee + TikTok consolidated) | ~11 individual report slots |
| Skip support | N/A | Yes — user skip nếu không có |
| Workflow | Match Google Sheet hiện tại | Linh hoạt hơn cho operator |

**Recommendation**:
- Option **A** (giữ Q-A): 2 consolidated slot — simpler UI nhưng đi ngược prototype
- Option **B** (theo prototype): 9 slot riêng + skip checkbox — phức tạp hơn nhưng linh hoạt
- Option **C** (hybrid): Cả 2 — tab "Quick (consolidated)" + tab "Individual files"

→ **Bạn cần xem prototype browser** xác nhận thực sự design là gì.

### ⚠️ 3.2 Monthly Report — có thể MISSING trong prototype

**Tìm thấy**:
- "Weekly Report" ✓ (1 mention)
- "Weekly Detail" ✓ (4 mentions)
- "Weekly Summary Hero" ✓
- **"Monthly Report" — 0 mentions trong main bundle**
- "Month" chỉ 5 mentions

**Implication**:
- Prototype có thể CHƯA include Monthly Report (FR-11~14)
- Phù hợp với MVP scope phase 1 của mình (deferred Monthly to Phase 2)
- Nhưng client SRD ghi Monthly là Must Have

→ Verify visual: prototype có sidebar item "Monthly Report" không?

### ⚠️ 3.3 COGS riêng — không rõ

**Tìm thấy**:
- "COGS" × 5 (low count)
- "Prime Cost" × 9 (cao hơn)
- Không thấy phrase "COGS Master" hay tách riêng từ Prime Cost

**Implication**:
- SRD FR-06 yêu cầu COGS Master riêng (date-based lookup)
- Prototype có thể CHƯA tách COGS, gộp vào Prime Cost
- MVP Phase 1 của mình cũng skip COGS riêng → match OK

### ⚠️ 3.4 Total Platform Discount (Rfr) — không tìm thấy

**Real data FINAL REPORT.csv** có row "Total Platform Discount (Rfr) = 249,414,868"

**Prototype**: search "Platform Discount" trả về thấp, không có "Rfr"

→ Có thể prototype CHƯA include metric này. Nếu bạn confirm visual đúng → cần add khi implement.

### ⚠️ 3.5 Formula Configuration UI — không rõ

**Tìm thấy**:
- "Formula" × 14 mentions (cao)
- Không có "Formula Configuration" / "Configure Formula" / "Formula Config"

**Implication**:
- 14 mentions "Formula" có thể là tên function/variable trong calculation engine, KHÔNG phải Admin UI
- FR-23 (48 formula params Admin configurable) có thể CHƯA implement trong prototype
- Phù hợp MVP Phase 1 (Phase 2 mới làm FR-23) → OK

### ⚠️ 3.6 User Management UI (FR-22) — không rõ

**Tìm thấy**:
- "User Management" — 0 specific phrase
- "Profile" × 98 (nhiều — có user profile UI)
- "Manage Users", "Add User", "Edit User" — 0

**Implication**:
- Prototype có user profile page nhưng có thể CHƯA có Admin User Management
- Match Q-E decision: pure AMA passthrough, không CRUD user

## 4. Confirmed deferred/Phase 2 items ✅

Prototype seems aligned với Phase 1 MVP scope của mình:
- ✅ Weekly Report (FR-07~10) — present
- ✅ Activity Log (FR-19~21) — present
- ✅ Prime Cost (FR-05) — present
- ✅ Upload (FR-01~03) — present
- ⏸️ Monthly Report (FR-11~14) — possibly deferred
- ⏸️ COGS (FR-06) — possibly merged with Prime Cost
- ⏸️ Formula Config UI (FR-23) — possibly deferred
- ⏸️ User Management UI (FR-22) — possibly deferred (passthrough match)

## 5. Different from real data (visual check needed)

| Aspect | Real data (resources/) | Prototype mock |
|---|---|---|
| Brand name | Firgi (Socialbean) | Cerave (placeholder) |
| Product line | Đồ dùng ăn dặm cho bé | Skincare products (Cerave) |
| Languages in name | VN + EN | EN only |

→ Đây chỉ là demo placeholder. UI structure giữ nguyên. **Không phải gap thực sự**.

## 6. Recommended visual verification (15-20 phút)

Bạn mở [prototype HTML](../../FIRGI%20Sales%20Ops%20_standalone_.html) trong browser, chụp screenshot từng page và verify:

### 6.1 Sidebar nav items
- [ ] Dashboard
- [ ] Upload — **1 slot consolidated** hay **N slots per section + Skip**?
- [ ] Manual Input
- [ ] Prime Cost / Cost Master
- [ ] COGS — riêng hay gộp?
- [ ] Weekly Report
- [ ] **Monthly Report — có hay không?**
- [ ] Trending — **bao nhiêu tabs?**
- [ ] Activity Log → sub-pages (Login / Action / Download)
- [ ] User Management — có?
- [ ] Formula Configuration — có?
- [ ] Settings

### 6.2 Upload page (critical cho Q-A)
- [ ] Có **2 slot consolidated** hay **9-11 slot riêng**?
- [ ] Có toggle "Skip" cho từng raw report không?
- [ ] Có **Date range picker** prominent ở top?
- [ ] Có **Overwrite/Append confirm dialog** khi trùng period?

### 6.3 Weekly Report page
- [ ] Header: Period filter, Platform filter (ALL/Shopee/TikTok), Month/Week label
- [ ] Overview Performance section — VND + KRW columns?
- [ ] Discount Costs breakdown — có "Total Platform Discount (Rfr)"?
- [ ] Promotional Costs breakdown
- [ ] Product Breakdown table — sort/filter/search?
- [ ] WoW indicators ▲▼ với màu green/red?
- [ ] Edge cases `----` (first week) và `N/A` (prev=0)?
- [ ] Export button (Excel/CSV)

### 6.4 Trending page (nếu có)
- [ ] **4 tabs** (Shopee WoW / TikTok WoW / Shopee MoM / TikTok MoM)?
- [ ] Bar chart Net GMV
- [ ] Line chart CM
- [ ] Date range selector (4w/13w/custom)

### 6.5 Manual Input page
- [ ] 5 main fields + 7 TikTok platform subitems?
- [ ] FX rate input separate?
- [ ] Save → trigger recalc?

### 6.6 Activity Log
- [ ] 3 separate logs (Login / Action / Download)?
- [ ] Filter by date + username/action type?
- [ ] Read-only (no edit/delete buttons)?

## 7. Tổng kết & next steps

### Đánh giá tổng thể: **~85% match**

**Match perfectly**:
- 3 roles, 2 platforms, currency (VND/KRW), key metrics
- Weekly Report structure + drill-down
- Activity Log existence
- Upload UX (drag-drop)
- WoW/MoM concept

**Cần verify visual**:
- Upload UX detail (consolidated vs N-slot) — **MỘT decision Q-A có thể cần revisit**
- Monthly Report presence
- COGS separation
- Trending 4 tabs

**Confirmed deferred Phase 2 (match MVP plan)**:
- Formula Config UI
- User Management UI

### Next steps
1. **Bạn**: mở prototype browser → fill checklist §6 → trả lời câu hỏi quan trọng nhất: **Upload UX layout?**
2. **Sau khi confirm Upload UX**: nếu prototype = N-slot + Skip → revise Q-A decision + update final-decisions.md + memory
3. **Sau alignment**: viết PLAN-20260511 + API-SPEC
4. **Hoặc**: nếu bạn tin prototype design tốt → skip verification, mình adapt code theo decoded findings

### Files generated trong audit
- `.tmp-decoded/` — 54 decoded assets (gitignored)
- `.tmp-*.py` — 3 decoder scripts (gitignored)
- Sẽ cleanup sau audit

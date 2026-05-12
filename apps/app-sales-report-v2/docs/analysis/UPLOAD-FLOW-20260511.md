# Upload Flow Spec — Smart Drop Zone

> Quyết định 2026-05-11. Solve Q-A Option **C (Hybrid)** với 1 single UX — KHÔNG có tab mode toggle.
> Match prototype hint "Select which raw reports you have for each channel. Skip any you don't" + flexibility for power users + simple cho operator.

## 1. Nguyên tắc thiết kế

| Principle | Tại sao |
|---|---|
| **1 drop zone duy nhất** | Tránh user phải chọn mode (consolidated vs individual) upfront → không có decision fatigue |
| **Auto-detect** thay vì hỏi | Backend parse row 1 markers nhận diện section, KHÔNG bắt user labelling từng file |
| **Lenient skip** (default) | Missing report = auto-skip + warning banner. KHÔNG bắt user click Skip từng row |
| **Incremental upload** | Có thể drop thêm file bất cứ lúc nào → flexible cho user lượm file dần |
| **Last-write-wins** | Cùng section upload 2 lần → bản mới nhất thay bản cũ (archive bản cũ — OI-001) |

**Mục tiêu**: cover được **3 use cases** với 1 UX duy nhất:
- UC1: Operator có file consolidated từ Google Sheet → drop 1 file = xong
- UC2: Operator có 6 file Shopee + 3 file TikTok riêng từ dashboard → drop 9 file một lần = xong
- UC3: Operator có 1 nửa hôm nay, 1 nửa hôm sau → drop dần, hệ thống nhớ state

## 2. User flow (mockup)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Upload Reports                                                     │
│  ───────────────                                                    │
│                                                                     │
│  Period: [Apr 06 – Apr 12, 2026  ▼]   Granularity: ●Weekly ○Monthly │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                                                             │    │
│  │            📥  Drop CSV or Excel files here                 │    │
│  │                or click to browse                           │    │
│  │                                                             │    │
│  │  Accepts: consolidated Shopee/TikTok export OR individual   │    │
│  │  raw report files. We'll auto-detect what's in each file.   │    │
│  │                                                             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ────────────────────────────────────────────────────────────       │
│  Detection status:  7 of 9 expected reports detected                │
│                                                                     │
│  📦 Shopee                                                          │
│  ✅ Sales              shopee-consolidated.csv (parsed: 234 rows)   │
│  ✅ Ads                shopee-consolidated.csv (parsed: 45 rows)    │
│  ✅ Brand Ads          shopee-consolidated.csv (parsed: 1 row)      │
│  ⚪ Off-Platform Ads   Not detected — [Skip] [Add file...]          │
│  ✅ Traffic            shopee-consolidated.csv (parsed: 89 rows)    │
│  ✅ Affiliate          shopee-affiliate-only.csv (parsed: 56 rows)  │
│                                                                     │
│  📦 TikTok                                                          │
│  ✅ Sales              tiktok-consolidated.csv (parsed: 178 rows)   │
│  ✅ Traffic            tiktok-consolidated.csv (parsed: 67 rows)    │
│  ⚪ Affiliate          Not detected — [Skip] [Add file...]          │
│                                                                     │
│  ────────────────────────────────────────────────────────────       │
│                                                                     │
│  Uploaded files (3):                                                │
│  📄 shopee-consolidated.csv  • 5.6 MB  • 2 min ago  [Remove]        │
│  📄 shopee-affiliate-only.csv• 198 KB  • 1 min ago  [Remove]        │
│  📄 tiktok-consolidated.csv  • 2.7 MB  • 30 sec ago [Remove]        │
│                                                                     │
│  ────────────────────────────────────────────────────────────       │
│                                                                     │
│              [Save draft]              [Continue →]                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Continue confirm dialog (chỉ hiện khi <100% detected)

```
┌──────────────────────────────────────────────────────────────┐
│  Continue with 7 of 9 reports?                               │
│  ─────────────────────────────                               │
│                                                              │
│  Missing reports will be treated as 0:                       │
│  • Shopee Off-Platform Ads → Total = 0 VND                   │
│  • TikTok Affiliate → Total Commission = 0 VND               │
│                                                              │
│  This will affect Contribution Margin accuracy for           │
│  the affected channels.                                      │
│                                                              │
│  [Cancel]                  [Continue anyway]                 │
└──────────────────────────────────────────────────────────────┘
```

## 3. Behavior count = 4 (minimal)

| # | Behavior | Trigger |
|---|---|---|
| 1 | **Pick period** | Period dropdown |
| 2 | **Add file(s)** | Drop / browse / [Add file...] button |
| 3 | **Remove file** | [Remove] button per file |
| 4 | **Continue** | [Continue →] → confirm dialog if partial → trigger calc |

NO behavior cho:
- ❌ Mode toggle (consolidated vs individual)
- ❌ Pre-upload section selector
- ❌ Re-order files
- ❌ Per-row Skip click (default = lenient)

## 4. Detection logic (backend)

### 4.1 Step 1: row 1 marker detection (consolidated files)

Parse row 1 of uploaded CSV, look for known markers:
```ts
const SHOPEE_MARKERS = ['SALE REPORT', 'ADS REPORT', 'BRAND ADS', 'OFF PLATFORM ADS', 'TRAFFIC REPORT', 'AFFILIATE REPORT'];
const TIKTOK_MARKERS = ['SALE REPORT', 'TRAFFIC REPORT', 'AFFILIATE REPORT', 'ADS REPORT', 'PLATFORM FEE'];

// Match markers found → identify platform + sections
function detectByMarkers(row1: string[]): { platform: 'SHOPEE' | 'TIKTOK' | null; sections: SectionRange[] } {
  // Detect platform by combination of markers
  // Compute column ranges per section
}
```

### 4.2 Step 2: column heuristic (individual files, no markers)

Nếu row 1 không có markers (single-section file), fallback heuristic:
```ts
function inferTypeByColumns(headers: string[]): ReportType | null {
  // Shopee Sales: contains "Mã đơn hàng" + "SKU phân loại hàng" + "Tổng số tiền Người mua thanh toán"
  // Shopee Ads: contains "Doanh số (Đơn đã đặt) (VND)" + "Chi phí (VND)"
  // Shopee Brand Ads: contains "Expense" + "Shop Name"
  // Shopee Off-Platform: contains "Chi phí" + "GMV" (without "Doanh số")
  // Shopee Traffic: contains "Lượt xem trang sản phẩm" only
  // Shopee Affiliate: contains "Mã hoa hồng" + "Chi phí(₫)"
  // TikTok Sales: contains "Order ID" + "Seller SKU"
  // TikTok Traffic: contains "Lượt xem trang từ tab Cửa hàng"
  // TikTok Affiliate: contains "Tên người dùng của nhà sáng tạo" + "Hoa hồng ước tính"
  // ...
}
```

### 4.3 Step 3: ambiguous → no-op (don't ask user)

Nếu detect không ra → mark file là **ambiguous**, hiển thị warning:
```
⚠️ "extra-data.csv" — Could not auto-detect. [Remove]
```

User can:
- Remove → ignore
- Re-upload renamed/cleaned version

→ Cố tình **không có dropdown "What type is this?"** để giữ behavior count thấp. Power user có thể rename file hoặc clean header để parser detect được.

## 5. State machine

```
┌───────┐  drop file   ┌──────────┐  parse OK    ┌───────────┐
│ EMPTY ├─────────────►│ UPLOADED ├─────────────►│ DETECTED  │
└───────┘              └──────────┘              └─────┬─────┘
                                                       │
                                       parse fail      │ all detected
                                ┌──────────────────────┤
                                │                      │
                                ▼                      ▼
                          ┌──────────┐          ┌────────────┐
                          │  FAILED  │          │   READY    │
                          └────┬─────┘          └─────┬──────┘
                               │                      │ click Continue
                               │ remove               │
                               └──────────────►┌─────────────┐
                                               │  PROCESSING │ (Worker job)
                                               └──────┬──────┘
                                                      │
                                                      ▼
                                               ┌─────────────┐
                                               │   FINISHED  │
                                               └─────────────┘
```

## 6. Acceptance criteria (cho FR-01/02/03 update)

| AC | Mô tả |
|---|---|
| AC-01 | Drop zone chấp nhận multi-file drop (drag và click browse) |
| AC-02 | File CSV / Excel chỉ accept (.csv, .xls, .xlsx) — others → `Invalid file type` |
| AC-03 | Sau drop, mỗi file upload S3 + parse row 1 trong < 2s |
| AC-04 | Detection list hiển thị 9 reports (6 Shopee + 3 TikTok) với status: ✅ Detected / ⚪ Not detected / ❌ Failed / ⚠️ Ambiguous |
| AC-05 | Ambiguous file → KHÔNG hỏi user, chỉ show warning + Remove button |
| AC-06 | "Continue" button enabled mọi lúc (kể cả 0/9 detected — chỉ confirm dialog) |
| AC-07 | Confirm dialog hiện khi < 9/9 detected, liệt kê missing sections + impact |
| AC-08 | Continue → Worker job start → status page poll |
| AC-09 | Same section upload 2 file → bản mới win, bản cũ archive vào S3 + audit log (OI-001 overwrite) |
| AC-10 | Period dropdown gắn với upload session (FR-01) — bắt buộc trước drop |
| AC-11 | "Save draft" → preserve uploaded files + detection state, user quay lại sau (resume) |
| AC-12 | Period đã FINALIZED → drop file mới → confirm "Re-open and overwrite?" (OI-002 unfinalize) |

## 7. Edge cases

| Case | Handling |
|---|---|
| Drop file rỗng | Reject với `File is empty` |
| Drop file > 50MB | Reject với `File too large (max 50MB)` |
| Drop cùng filename 2 lần | Skip dedupe by file hash; cùng content → reject; khác content → keep both |
| 2 file cùng có Shopee Sales section | Last upload wins, log warning |
| File chứa section của cả 2 platforms (Shopee + TikTok) | Accept, split như bình thường (rất hiếm) |
| TikTok ADS / Platform Fee sections detected | Per Q-B: SKIP (manual input giữ) — show in list: "⚪ (Skipped per spec — use Manual Input)" |
| User upload xong rời page chưa click Continue | Session lưu state, hiển thị banner "Resume upload" lần sau |
| Worker parse partial fail (1 section bad) | Mark section ❌ + retry button, sections khác vẫn proceed |

## 8. Implementation modules

### Frontend (`apps/web/`)
```
app/(dashboard)/upload/
├── page.tsx                          ← Smart Drop Zone shell
├── components/
│   ├── DropZone.tsx                  ← react-dropzone wrapper
│   ├── DetectionList.tsx             ← 9-row status list
│   ├── UploadedFilesList.tsx         ← file cards w/ Remove
│   ├── ContinueConfirmDialog.tsx
│   └── PeriodPicker.tsx
└── actions/
    ├── upload-file.action.ts         ← Server Action: presign S3 → save file record
    ├── detect-sections.action.ts     ← After S3 upload, parse row 1
    ├── remove-file.action.ts
    └── continue-upload.action.ts     ← Trigger Worker job
```

### Backend (`server/services/upload/`)
```
server/services/upload/
├── upload-session.service.ts         ← CRUD session + state
├── section-detector.service.ts       ← row 1 markers + column heuristic
├── file-archiver.service.ts          ← S3 archive on overwrite
└── inngest/
    └── parse-upload.function.ts      ← async parse handler
```

### DB tables (xem [DATA-MODEL.md](../architecture/DATA-MODEL.md))
- `sal_upload_sessions` — period + status
- `sal_uploaded_files` — file metadata + S3 key + hash
- `sal_uploaded_files.upf_detected_sections` JSONB — extracted section map per file
- 9 raw tables (Shopee 6 + TikTok 3)

## 9. Out of scope (giữ MVP gọn)

- ❌ Dropdown "What type is this?" cho ambiguous file → Phase 2 nếu user complain
- ❌ Bulk drop folder (recursive) → Phase 2
- ❌ Re-order uploaded files (no order matters)
- ❌ Per-section Skip toggle (lenient default đủ)
- ❌ Preview parsed data trước Continue → Phase 2

## 10. Why this design > alternatives

| Alternative | Reject reason |
|---|---|
| 2-tab UI (Consolidated / Individual) | User phải chọn mode trước → +1 decision cost, không cần thiết |
| 9 fixed slots với file input riêng | UX cũ, rigid, không support 1 file consolidated chứa 6 sections |
| Wizard 9 steps | Slow, frustrating cho user có sẵn 1 file consolidated |
| Smart Drop Zone (chọn này) | 1 zone, auto-detect, behavior count = 4, cover 3 use cases |

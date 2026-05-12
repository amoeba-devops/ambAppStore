---
name: excel-parser
description: Parse Shopee (6 sections trong 1 file) + TikTok (5 sections trong 1 file) consolidated CSV. Section splitter + 11 sub-parsers. Vietnamese + Korean column headers.
---

# Skill: excel-parser

> Tài liệu nguồn:
> - [SRD FR-02, FR-03 + Group 1-4 formula](../../../docs/analysis/SRD-20260506-FIRGI-SalesReport-v2.md)
> - **[REAL-DATA-FINDINGS-20260511.md](../../../docs/analysis/REAL-DATA-FINDINGS-20260511.md)** ⚠️ MUST READ — file thật khác SRD: consolidated CSV không phải 9 file riêng

## ⚠️ Critical updates

**1. Real file structure**: Shopee = 1 CSV với 6 sections horizontal; TikTok = 1 CSV với 5 sections.
**2. Q-A decision** (Smart Drop Zone): User có thể drop **consolidated** HOẶC **individual** HOẶC **mix** → parser cần handle cả 2 cases.

→ Parser pipeline (xem [UPLOAD-FLOW-20260511 §4](../../../docs/analysis/UPLOAD-FLOW-20260511.md)):
1. **Section marker detection** (consolidated): scan row 1 for `SALE REPORT`, `ADS REPORT`, etc.
2. **Column heuristic fallback** (individual file, no markers): match unique header patterns
3. **Ambiguous → warn**: nếu cả 2 step fail, mark file `AMBIGUOUS`, user Remove (no dropdown)

## Khi nào dùng
- Implement `server/services/upload/shopee/*` (6 parsers) + `tiktok/*` (3 parsers)
- Inngest worker handle `upload.created` event
- Debug edge case: NaN, merged cells, Vietnamese encoding

## 1. Tổng quan 9 report types

| # | Platform | Type code | Source data | Key columns (VN) |
|---|---|---|---|---|
| 1 | SHOPEE | `SALES` | Shopee Seller dashboard | Mã đơn hàng, Trạng thái, SKU phân loại hàng, Giá gốc, Số lượng, Số lượng sản phẩm được hoàn trả, Tổng số tiền Người mua thanh toán, Mã giảm giá của Shop, Giảm giá từ Combo của Shop, Phí cố định, Phí Dịch Vụ, Phí thanh toán |
| 2 | SHOPEE | `ADS` | Shopee Ads dashboard | Mã SP, Chi phí, Doanh số |
| 3 | SHOPEE | `BRAND_ADS` | Shopee Brand Ads | Expense |
| 4 | SHOPEE | `OFF_PLATFORM_ADS` | Off-platform Ads tool | Chi phí |
| 5 | SHOPEE | `TRAFFIC` | Shopee Traffic report | Mã SP, Lượt xem trang sản phẩm |
| 6 | SHOPEE | `AFFILIATE` | Shopee Affiliate | Chi phí (đ) |
| 7 | TIKTOK | `SALES` | TikTok Seller dashboard | Order ID, Order Status, Order Substatus, Seller SKU, Normal or Pre-order, Product Name, SKU Unit Original Price, Quantity, SKU Quantity of return, SKU Seller Discount, Net GMV, GMV |
| 8 | TIKTOK | `TRAFFIC` | TikTok Traffic | Lượt xem trang từ tab Cửa hàng, từ Live, từ video, từ thẻ sản phẩm |
| 9 | TIKTOK | `AFFILIATE` | TikTok Affiliate | Chi phí (đ), Hoa hồng ước tính |

## 2. Lib stack

```
exceljs       — .xlsx streaming reader cho file lớn (>10MB)
xlsx          — fallback cho .xls legacy
csv-parse     — Shopee đôi khi export CSV
iconv-lite    — encoding (UTF-8 BOM, Windows-1258 cho VN cũ)
```

**Tốc độ**: NFR-04 yêu cầu < 5s cho 10MB. Dùng streaming pattern:

```ts
import ExcelJS from 'exceljs';

const wb = new ExcelJS.stream.xlsx.WorkbookReader(s3ReadStream);
for await (const ws of wb) {
  for await (const row of ws) {
    // process row, skip header rows
  }
}
```

## 3. Parser architecture

### 3.1 Section detection (per file, after S3 upload)

```ts
// server/services/upload/section-detector.service.ts
type DetectionResult = {
  fileType: 'CONSOLIDATED' | 'INDIVIDUAL' | 'AMBIGUOUS';
  sections: Array<{
    reportType: ReportType;  // 9 active types (Shopee 6 + TikTok 3)
    columnRange: [number, number];  // start, end column indices
    headerRowIndex: number;
  }>;
};

async function detectSections(s3Key: string): Promise<DetectionResult> {
  const rows = await readFirstNRows(s3Key, 10);  // first 10 rows enough
  
  // Step 1: row 1 markers (consolidated)
  const markers = scanRow1Markers(rows[0]);
  if (markers.length > 0) {
    return { fileType: 'CONSOLIDATED', sections: computeRangesFromMarkers(markers, rows) };
  }
  
  // Step 2: column heuristic (individual)
  const inferredType = inferTypeByHeaders(rows[1] ?? rows[0]);
  if (inferredType) {
    return { fileType: 'INDIVIDUAL', sections: [{ reportType: inferredType, columnRange: [0, rows[0].length - 1], headerRowIndex: 0 }] };
  }
  
  return { fileType: 'AMBIGUOUS', sections: [] };
}
```

### 3.2 Marker constants

```ts
// Row 1 section markers — verified từ resources/1. SHOPEE DOWNLOAD.csv + 10. TIKTOK DOWNLOAD.csv
const SHOPEE_SECTION_MARKERS = {
  'SALE REPORT':      'SHOPEE_SALES',
  'ADS REPORT':       'SHOPEE_ADS',
  'BRAND ADS':        'SHOPEE_BRAND_ADS',
  'OFF PLATFORM ADS': 'SHOPEE_OFF_PLATFORM_ADS',
  'TRAFFIC REPORT':   'SHOPEE_TRAFFIC',
  'AFFILIATE REPORT': 'SHOPEE_AFFILIATE',
} as const;

const TIKTOK_SECTION_MARKERS = {
  'SALE REPORT':      'TIKTOK_SALES',
  'TRAFFIC REPORT':   'TIKTOK_TRAFFIC',
  'AFFILIATE REPORT': 'TIKTOK_AFFILIATE',
  // 'ADS REPORT':    skipped per Q-B (manual input)
  // 'PLATFORM FEE':  skipped per Q-B (manual input)
} as const;
```

**Disambiguation Shopee vs TikTok**: marker `SALE REPORT` xuất hiện cả 2 platform → dùng column heuristic của Sales section:
- Shopee Sales: column 1 = `Mã đơn hàng` (VN)
- TikTok Sales: column 1 = `Order ID` (EN)

### 3.3 Column heuristic — fingerprint per type

```ts
// Mỗi report type có 1 "fingerprint" — set of unique headers
const FINGERPRINTS: Record<ReportType, string[]> = {
  SHOPEE_SALES: ['Mã đơn hàng', 'SKU phân loại hàng', 'Tổng số tiền Người mua thanh toán'],
  SHOPEE_ADS: ['Mã sản phẩm', 'Doanh số (Đơn đã đặt) (VND)', 'Chi phí(VND)'],
  SHOPEE_BRAND_ADS: ['Shop Name', 'Expense'],
  SHOPEE_OFF_PLATFORM_ADS: ['SHOP ID', 'OP COST'],
  SHOPEE_TRAFFIC: ['Lượt xem trang sản phẩm', 'Mã sản phẩm'],
  SHOPEE_AFFILIATE: ['Mã hoa hồng', 'Chi phí(₫)'],
  TIKTOK_SALES: ['Order ID', 'Seller SKU', 'SKU Unit Original Price'],
  TIKTOK_TRAFFIC: ['Lượt xem trang từ tab Cửa hàng', 'Lượt xem trang từ LIVE'],
  TIKTOK_AFFILIATE: ['Tên người dùng của nhà sáng tạo', 'Hoa hồng ước tính'],
};

function inferTypeByHeaders(headers: string[]): ReportType | null {
  const normalized = headers.map(h => h?.trim() ?? '');
  let best: { type: ReportType; matchCount: number } | null = null;
  for (const [type, fingerprint] of Object.entries(FINGERPRINTS)) {
    const matchCount = fingerprint.filter(fp => normalized.some(h => h.includes(fp))).length;
    if (matchCount >= 2 && (!best || matchCount > best.matchCount)) {
      best = { type: type as ReportType, matchCount };
    }
  }
  return best?.type ?? null;
}
```

### 3.4 Sub-parser interface

```ts
interface ReportParser<Row> {
  reportType: ReportType;
  
  // Parse 1 data row, given column map
  parseRow(row: string[], columns: ColumnMap, ctx: ParseCtx): Row | null;
}

type ColumnMap = Record<string, number>;  // canonical field name → column index

interface ParseCtx {
  uploadFileId: string;
  entId: string;
  sectionRange: [number, number];  // slice row to this range
  formulaConfig: Map<string, string>;  // FR-23 field map override
}
```

**Field Map từ Formula Config** (FR-23): user có thể đổi column nào map vào canonical field qua Admin UI. Parser PHẢI đọc config thay vì hard-code:

```ts
// Thay vì:
const skuCol = columns['SKU phân loại hàng'];

// Phải dùng:
const skuFieldMap = ctx.formulaConfig.get('SHOPEE_SALES_SKU_COLUMN') ?? 'SKU phân loại hàng';
const skuCol = columns[skuFieldMap];
```

## 4. Header normalization (Vietnamese)

```ts
function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFC')          // VN dấu
    .replace(/\s+/g, ' ');     // multiple spaces
}
```

Sometime Shopee/TikTok đổi label nhẹ (vd: "SKU phân loại hàng" vs "SKU phân loại"). Mapping file `parsers/shopee/sales.column-aliases.ts`:

```ts
export const SHOPEE_SALES_ALIASES = {
  sku: ['sku phân loại hàng', 'sku phân loại', 'seller sku'],
  original_price: ['giá gốc', 'original price'],
  quantity: ['số lượng', 'quantity'],
  // ...
};
```

## 5. Edge cases (mỗi platform)

### 5.1 Shopee Sales
- **Order Status = "Đã hủy"** → giữ row, đánh dấu `excluded=CANCELLED` (calculation engine lo)
- **NMV = 0** → giữ row, mark `is_free_gift=true` (TheChi tiết §5.6 SRD)
- **Quantity hoàn trả > 0** → trừ trong `item_sold` formula
- **Merged title rows** (Row 1-3 thường là metadata "Báo cáo doanh thu...") → skip đến row có "Mã đơn hàng"
- **Empty rows** ở giữa → skip nhưng không stop

### 5.2 Shopee Ads
- File có thể CSV format khác Excel
- Cột "Chi phí" có thể có format `"1,234,567 ₫"` → strip non-numeric

### 5.3 Shopee Brand Ads
- File rất nhỏ, có thể chỉ 1-2 row tổng
- Cột "Expense" (English)

### 5.4 Shopee Off-Platform Ads
- Tương tự Brand Ads, cột "Chi phí"

### 5.5 Shopee Traffic
- 1 row per product (không per order)
- Cột "Lượt xem trang sản phẩm" có thể có comma thousands

### 5.6 Shopee Affiliate
- "Chi phí (đ)" — đơn vị VND tường minh

### 5.7 TikTok Sales
- **Order Status + Substatus** combo cho cancellation rule
- **Quantity vs SKU Quantity of return** — formula: `IF(Q = return, 0, ...)`
- **Product Name starts with `[GIFT]`** → free gift detection
- **Normal or Pre-order** column = "Normal" → required cho free gift rule
- TikTok export đôi khi có header English đôi khi VN — alias list cần đủ

### 5.8 TikTok Traffic
- 4 cột Page View riêng: tab Cửa hàng / Live / video / thẻ sản phẩm
- Parser PHẢI sum 4 cột → 1 field `page_view`

### 5.9 TikTok Affiliate
- 2 cột: "Chi phí (đ)" (commission cost) + "Hoa hồng ước tính" (estimated commission booking)
- Parser tách 2 field riêng

## 6. Common edge cases (mọi file)

| Vấn đề | Xử lý |
|---|---|
| Merged header cells | Skip rows đến header thực, detect bằng keyword |
| NaN / empty cells | Coerce về `0` cho số, `null` cho text |
| Number format `"1.234.567,89"` (VN) | Detect locale per file, normalize trước parse |
| Date format đa dạng | Dùng `exceljs cellDates: true` + fallback regex |
| Excel serial date (45397) | `(serial - 25569) * 86400 * 1000` → Unix ms |
| Encoding cũ (Win-1258) | `iconv-lite` detect BOM, fallback UTF-8 |
| File rỗng | Throw `INVALID_FILE_EMPTY` |
| Wrong report type | Detect signature fail → `INVALID_REPORT_TYPE` |

## 7. Output → DB

Mỗi parser ghi vào table tương ứng (xem [DATA-MODEL.md §4](../../../docs/architecture/DATA-MODEL.md)):

| Parser | Table | Bulk insert chunk |
|---|---|---|
| Shopee Sales | `sal_raw_shopee_sales` | 500 |
| Shopee Ads | `sal_raw_shopee_ads` | 500 |
| Shopee Brand Ads | `sal_raw_shopee_brand_ads` | 100 |
| Shopee Off-Platform Ads | `sal_raw_shopee_off_platform_ads` | 100 |
| Shopee Traffic | `sal_raw_shopee_traffic` | 500 |
| Shopee Affiliate | `sal_raw_shopee_affiliate` | 500 |
| TikTok Sales | `sal_raw_tiktok_sales` | 500 |
| TikTok Traffic | `sal_raw_tiktok_traffic` | 500 |
| TikTok Affiliate | `sal_raw_tiktok_affiliate` | 500 |

**Mỗi row** lưu `raw_data JSONB` toàn bộ row gốc + extract core columns indexed.

## 8. Inngest flow

```ts
inngest.createFunction(
  { id: 'parse-upload' },
  { event: 'upload.created' },
  async ({ event, step }) => {
    const { upfId, entId } = event.data;
    
    await step.run('fetch-from-s3', async () => { /* ... */ });
    await step.run('detect-parser', async () => { /* match report_type → parser */ });
    
    await step.run('parse-rows', async () => {
      // streaming parse + bulk insert
      // update upf_row_count, upf_status='PARSING'
    });
    
    await step.run('validate', async () => {
      // if errorRows / total > 10% → mark FAILED
    });
    
    await step.run('mark-parsed', async () => {
      // upf_status='PARSED'
      // emit 'upload.parsed' event → trigger calculation
    });
  }
);
```

## 9. Error handling

- Per-row parse error → push vào `errors[]`, KHÔNG fail toàn file
- Cuối parse: nếu `errors.length / total > 0.1` (10%) → `upf_status='FAILED'`
- Lưu first 10 errors vào `upf_error_log` JSON để user debug
- File-level error (encoding, không tìm thấy header) → fail toàn file ngay

## 10. Performance budget (NFR-04)

10MB CSV/Excel < 5s. Strategy:
- Streaming (không load full vào RAM)
- Batch insert chunk 500
- Skip rows sớm khi exclusion rule match
- Parser worker chạy parallel cho 9 file (Inngest concurrent)

## 11. Test fixtures

`apps/web/__fixtures__/excel/` — cần Truc Hoang cung cấp:
- `shopee-sales-sample-100rows.xlsx`
- `shopee-ads-sample.csv`
- `shopee-brand-ads-sample.xlsx`
- `shopee-off-platform-ads-sample.xlsx`
- `shopee-traffic-sample.xlsx`
- `shopee-affiliate-sample.xlsx`
- `tiktok-sales-sample-100rows.xlsx`
- `tiktok-traffic-sample.xlsx`
- `tiktok-affiliate-sample.xlsx`
- `edge-cases/{merged-cells,empty-rows,wrong-encoding,return-orders,free-gifts}.xlsx`

Vitest snapshot test per parser.

## 12. Anti-patterns ❌

- ❌ `xlsx.readFile()` load full RAM với file >10MB
- ❌ Parse sync trong Server Action → block 30s timeout
- ❌ Trust column order — luôn map qua header alias
- ❌ Hard-code field name "SKU phân loại hàng" → phải qua formula config (FR-23)
- ❌ Áp dụng exclusion rule TRONG parser — parser ghi raw + flag, calc engine lo exclusion
- ❌ Skip "Đã hủy" rows trong parser → mất audit trail (raw file unmodified, raw row mất theo bug parser sau)
- ❌ Overwrite S3 raw file khi re-upload — phải lưu version mới hoặc move cũ vào `archive/`

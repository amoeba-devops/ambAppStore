/**
 * Formula Config catalog — read-only mock data for /settings/formula-config.
 * Mirrors what sal_formula_configs will eventually store (FR-23).
 *
 * Naming convention:
 *   Every calculated metric has a globally-unique canonical name ending in
 *   `— Shopee` or `— TikTok`. This lets the engine resolve `{token}` without
 *   needing section-context. UI may dim the suffix to reduce visual noise.
 *
 * `dataSources` rule:
 *   List ONLY sources whose raw columns the formula directly references.
 *   Transitive sources (through calculated metrics) are NOT propagated.
 */

export interface FormulaItem {
  metric: string;
  description?: string;
  dataSources: string[];
  formula: string;
  unit?: string;
  versions: number;
}

export interface FormulaSection {
  id: string;
  title: string;
  items: FormulaItem[];
}

export const FORMULA_SECTIONS: FormulaSection[] = [
  // ============================================================================
  // 1. Platform-Level Formulas — Shopee (21)
  // ============================================================================
  {
    id: 'shopee-platform',
    title: 'Platform-Level Formulas — Shopee',
    items: [
      {
        metric: 'Total Page View — Shopee',
        dataSources: ['Calculated'],
        formula: 'Sum of {Page View — Shopee}',
        versions: 2,
      },
      {
        metric: 'Conversion Rate — Shopee',
        dataSources: ['Calculated'],
        formula: '{Total Item Sold — Shopee} / {Total Page View — Shopee}',
        unit: '%',
        versions: 1,
      },
      {
        metric: 'Total Item Sold — Shopee',
        dataSources: ['Calculated'],
        formula: 'Sum of {Item Sold — Shopee}',
        versions: 2,
      },
      {
        metric: 'Total Orders — Shopee',
        description:
          'Distinct order IDs that have at least one non-cancelled row (Shopee charges fees on delivered+returned orders)',
        dataSources: ['Shopee Sales CSV'],
        formula:
          'COUNT_DISTINCT({Mã đơn hàng}) WHERE NOT all rows have {Trạng Thái Đơn Hàng} = "Đã hủy"',
        versions: 1,
      },
      {
        metric: 'AOV — Shopee',
        description: 'Average Order Value — total GMV per non-cancelled order',
        dataSources: ['Calculated'],
        formula: '{Total GMV — Shopee} / {Total Orders — Shopee}',
        versions: 1,
      },
      {
        metric: 'Total GMV — Shopee',
        dataSources: ['Calculated'],
        formula: 'Sum of {GMV — Shopee}',
        versions: 2,
      },
      {
        metric: 'Total Net GMV — Shopee',
        dataSources: ['Calculated'],
        formula: 'Sum of {Net GMV — Shopee}',
        versions: 2,
      },
      {
        metric: 'Total NMV — Shopee',
        dataSources: ['Calculated'],
        formula: 'Sum of {NMV — Shopee}',
        versions: 2,
      },
      {
        metric: 'Total Seller Vouchers — Shopee',
        description:
          'Per-order: values duplicate across SKU lines — MAX per order, sum across non-cancelled orders',
        dataSources: ['Shopee Sales CSV'],
        formula:
          'SUM_PER_ORDER( MAX({Mã giảm giá của Shop} + {Giảm giá từ Combo của Shop}) ) WHERE {Trạng Thái Đơn Hàng} != "Đã hủy"',
        versions: 1,
      },
      {
        metric: 'Total Seller Discount — Shopee',
        dataSources: ['Calculated'],
        formula: 'Sum of {Seller Discount — Shopee}',
        versions: 2,
      },
      {
        metric: 'Total Platform Discount (Ref) — Shopee',
        description:
          'Reference-only — Shopee-funded discount, not deducted from CM',
        dataSources: ['Shopee Sales CSV'],
        formula:
          'SUM_PER_ORDER( MAX({Mã giảm giá của Shopee}) ) WHERE {Trạng Thái Đơn Hàng} != "Đã hủy"',
        versions: 1,
      },
      {
        metric: 'Total Free Gift — Shopee',
        dataSources: ['Calculated'],
        formula: 'Sum of {Prime Cost — Shopee} of [Free Gift]',
        versions: 2,
      },
      {
        metric: 'Total Ad Spending — Shopee',
        dataSources: ['Calculated'],
        formula: 'Sum of {Ad Spending — Shopee}',
        versions: 2,
      },
      {
        metric: 'Total Brand Ads Fee — Shopee',
        description: 'Field Map — sum of {Expense} across all brand ads campaigns',
        dataSources: ['Shopee Brand Ads CSV'],
        formula: 'Sum of {Expense}',
        versions: 1,
      },
      {
        metric: 'Total Off-Platform Ads Fee — Shopee',
        description: 'Field Map — sum of {Chi phí(VND)}',
        dataSources: ['Shopee Off-Platform Ads CSV'],
        formula: 'Sum of {Chi phí(VND)}',
        versions: 1,
      },
      {
        metric: 'Total Affiliate Commission — Shopee',
        description:
          'Platform total đọc trực tiếp từ Shopee Affiliate file = SUM của {Chi phí(₫)} tất cả rows. Không nhân với NMV. Lưu ý: một product có nhiều SKU variations (combo + regular) → mỗi variation row trong Product Breakdown table hiển thị cùng product-level chiPhi; tổng các row trong table có thể > Total (vì duplicate per variation), nhưng Total platform-level luôn = file total.',
        dataSources: ['Shopee Affiliate CSV'],
        formula: 'SUM of {Chi phí(₫)} over all rows in Shopee Affiliate file',
        versions: 3,
      },
      {
        metric: 'Total Affiliate Booking Fee — Shopee',
        dataSources: ['Calculated'],
        formula:
          '{Total Affiliate Booking Fee} × {Total GMV — Shopee} / ({Total GMV — Shopee} + {Total GMV — TikTok})',
        versions: 1,
      },
      {
        metric: 'Total Livestream Fee — Shopee',
        description: 'Manual Input',
        dataSources: ['Manual Input'],
        formula: '{Total Livestream Fee — Shopee}',
        versions: 1,
      },
      {
        metric: 'Total Platform Fee — Shopee',
        description:
          'Per-order: three fee columns duplicate across SKU lines — MAX per order, sum across non-cancelled orders',
        dataSources: ['Shopee Sales CSV'],
        formula:
          'SUM_PER_ORDER( MAX({Phí cố định} + {Phí Dịch Vụ} + {Phí thanh toán}) ) WHERE {Trạng Thái Đơn Hàng} != "Đã hủy"',
        versions: 1,
      },
      {
        metric: 'Total Prime Cost — Shopee',
        dataSources: ['Calculated'],
        formula: 'Sum of {Prime Cost — Shopee}',
        versions: 2,
      },
      {
        metric: 'Total Contribution Margin — Shopee',
        dataSources: ['Calculated'],
        formula:
          '{Total Net GMV — Shopee} − {Total Seller Discount — Shopee} − {Total Prime Cost — Shopee} − {Total Ad Spending — Shopee} − {Total Brand Ads Fee — Shopee} − {Total Platform Fee — Shopee} − {Total Seller Vouchers — Shopee} − {Total Livestream Fee — Shopee} − {Total Off-Platform Ads Fee — Shopee} − {Total Free Gift — Shopee} − {Total Affiliate Booking Fee — Shopee} − {Total Affiliate Commission — Shopee}',
        versions: 1,
      },
      {
        metric: 'Total Contribution Margin % — Shopee',
        dataSources: ['Calculated'],
        formula: '{Total Contribution Margin — Shopee} / {Total Net GMV — Shopee}',
        unit: '%',
        versions: 1,
      },
      {
        metric: 'AD GMV — Shopee',
        description: 'Field Map — {Doanh số} column',
        dataSources: ['Shopee Ads CSV'],
        formula: 'Sum of {Doanh số}',
        versions: 1,
      },
      {
        metric: 'AD ROAS — Shopee',
        dataSources: ['Calculated'],
        formula: '{AD GMV — Shopee} / {Total Ad Spending — Shopee}',
        versions: 1,
      },
    ],
  },

  // ============================================================================
  // 2. Product-Level Formulas — Shopee (21)
  // ============================================================================
  {
    id: 'shopee-product',
    title: 'Product-Level Formulas — Shopee',
    items: [
      {
        metric: 'Original Price — Shopee',
        description: 'Select column from Shopee Sales CSV',
        dataSources: ['Shopee Sales CSV'],
        formula: '{Giá gốc}',
        versions: 1,
      },
      {
        metric: 'Selling / Listing Price — Shopee',
        description: 'XLOOKUP by {SKU phân loại hàng}',
        dataSources: ['Shopee Sales CSV', 'Prime Cost Table'],
        formula: 'XLOOKUP({SKU phân loại hàng}, {SKU}, {Selling Price}, 0)',
        versions: 1,
      },
      {
        metric: 'Page View — Shopee',
        description: 'Look up from Shopee Traffic CSV',
        dataSources: ['Shopee Traffic CSV'],
        formula: '{Lượt xem trang sản phẩm}',
        versions: 1,
      },
      {
        metric: 'Conversion Rate per Product — Shopee',
        dataSources: ['Calculated'],
        formula: '{Item Sold — Shopee} / {Page View — Shopee}',
        unit: '%',
        versions: 1,
      },
      {
        metric: 'Item Sold — Shopee',
        description: 'Two columns selected; result = col A − col B',
        dataSources: ['Shopee Sales CSV'],
        formula: '{Số lượng} − {Số lượng sản phẩm được hoàn trả}',
        versions: 1,
      },
      {
        metric: 'GMV — Shopee',
        dataSources: ['Calculated'],
        formula: '{Original Price — Shopee} × {Item Sold — Shopee}',
        versions: 1,
      },
      {
        metric: 'Net GMV — Shopee',
        dataSources: ['Calculated'],
        formula: '{Selling / Listing Price — Shopee} × {Item Sold — Shopee}',
        versions: 1,
      },
      {
        metric: 'NMV — Shopee',
        description: 'Select column from Shopee Sales CSV',
        dataSources: ['Shopee Sales CSV'],
        formula: '{Tổng số tiền Người mua thanh toán}',
        versions: 1,
      },
      {
        metric: 'Seller Vouchers — Shopee',
        dataSources: ['Calculated'],
        formula: '{Total Seller Vouchers — Shopee} × {NMV — Shopee} / {Total NMV — Shopee}',
        versions: 1,
      },
      {
        metric: 'Seller Discount — Shopee',
        description: 'Edge case: if result < 0 → use 0',
        dataSources: ['Calculated'],
        formula:
          'IF({Net GMV — Shopee} − {NMV — Shopee} < 0, 0, {Net GMV — Shopee} − {NMV — Shopee})',
        versions: 1,
      },
      {
        metric: 'Free Gift — Shopee',
        description: 'Allocated',
        dataSources: ['Calculated'],
        formula: '{Total Free Gift — Shopee} × {NMV — Shopee} / {Total NMV — Shopee}',
        versions: 1,
      },
      {
        metric: 'Ad Spending — Shopee',
        description: 'Field Map',
        dataSources: ['Shopee Ads CSV'],
        formula: '{Chi phí}',
        versions: 1,
      },
      {
        metric: 'Brand Ads — Shopee',
        description: 'Allocated',
        dataSources: ['Calculated'],
        formula: '{Total Brand Ads Fee — Shopee} × {NMV — Shopee} / {Total NMV — Shopee}',
        versions: 1,
      },
      {
        metric: 'Off-Platform Ads Fee — Shopee',
        description: 'Allocated',
        dataSources: ['Calculated'],
        formula: '{Total Off-Platform Ads Fee — Shopee} × {NMV — Shopee} / {Total NMV — Shopee}',
        versions: 1,
      },
      {
        metric: 'Affiliate Commission — Shopee',
        description:
          'Per-SKU value = product-level chiPhi (SUM của {Chi phí(₫)} từ file mà {Tên sản phẩm} = P). Lấy thẳng từ file, không nhân NMV. Multi-variation cùng product → mỗi row nhận giá trị giống nhau. Tên không match Sales breakdown → rớt vào row "Others".',
        dataSources: ['Shopee Affiliate CSV'],
        formula: 'SUM of {Chi phí(₫)} WHERE {Tên sản phẩm} = P',
        versions: 3,
      },
      {
        metric: 'Affiliate Booking Fee — Shopee',
        description: 'Allocated',
        dataSources: ['Calculated'],
        formula: '{Total Affiliate Booking Fee — Shopee} × {NMV — Shopee} / {Total NMV — Shopee}',
        versions: 1,
      },
      {
        metric: 'Livestream Fee — Shopee',
        description: 'Allocated',
        dataSources: ['Calculated'],
        formula: '{Total Livestream Fee — Shopee} × {NMV — Shopee} / {Total NMV — Shopee}',
        versions: 1,
      },
      {
        metric: 'Platform Fee — Shopee',
        description: 'Allocated',
        dataSources: ['Calculated'],
        formula: '{Total Platform Fee — Shopee} × {NMV — Shopee} / {Total NMV — Shopee}',
        versions: 1,
      },
      {
        metric: 'Prime Cost — Shopee',
        description: 'Lookup from Prime Cost table × units sold',
        dataSources: ['Shopee Sales CSV', 'Prime Cost Table'],
        formula:
          'XLOOKUP({SKU phân loại hàng}, {SKU}, {Prime Cost}, 0) × {Item Sold — Shopee}',
        versions: 1,
      },
      {
        metric: 'Contribution Margin — Shopee',
        dataSources: ['Calculated'],
        formula:
          '{Net GMV — Shopee} − {Seller Discount — Shopee} − {Prime Cost — Shopee} − {Ad Spending — Shopee} − {Brand Ads — Shopee} − {Platform Fee — Shopee} − {Seller Vouchers — Shopee} − {Livestream Fee — Shopee} − {Off-Platform Ads Fee — Shopee} − {Free Gift — Shopee} − {Affiliate Booking Fee — Shopee} − {Affiliate Commission — Shopee}',
        versions: 1,
      },
      {
        metric: 'Contribution Margin % — Shopee',
        dataSources: ['Calculated'],
        formula: '{Contribution Margin — Shopee} / {Net GMV — Shopee}',
        unit: '%',
        versions: 1,
      },
    ],
  },

  // ============================================================================
  // 3. Platform-Level Formulas — TikTok (17)
  // ============================================================================
  {
    id: 'tiktok-platform',
    title: 'Platform-Level Formulas — TikTok',
    items: [
      {
        metric: 'Total Page View — TikTok',
        dataSources: ['Calculated'],
        formula: 'Sum of {Page View — TikTok}',
        versions: 2,
      },
      {
        metric: 'Conversion Rate — TikTok',
        dataSources: ['Calculated'],
        formula: '{Total Item Sold — TikTok} / {Total Page View — TikTok}',
        unit: '%',
        versions: 1,
      },
      {
        metric: 'Total Item Sold — TikTok',
        dataSources: ['Calculated'],
        formula: 'Sum of {Item Sold — TikTok}',
        versions: 2,
      },
      {
        metric: 'Total Orders — TikTok',
        description:
          'Distinct order IDs where order-level SUM(Net GMV) > 0 — excludes cancelled, fully returned, free-gift-only, and orders whose rows sum to 0 Net GMV',
        dataSources: ['TikTok Sales CSV'],
        formula:
          'COUNT_DISTINCT({Order ID}) WHERE NOT excluded (cancelled, full return, free gift, per-row Net GMV = 0) AND SUM({Net GMV — TikTok}) per order > 0',
        versions: 1,
      },
      {
        metric: 'AOV — TikTok',
        description: 'Average Order Value — total GMV per valid order',
        dataSources: ['Calculated'],
        formula: '{Total GMV — TikTok} / {Total Orders — TikTok}',
        versions: 1,
      },
      {
        metric: 'Total GMV — TikTok',
        dataSources: ['Calculated'],
        formula: 'Sum of {GMV — TikTok}',
        versions: 2,
      },
      {
        metric: 'Total Net GMV — TikTok',
        dataSources: ['Calculated'],
        formula: 'Sum of {Net GMV — TikTok}',
        versions: 2,
      },
      {
        metric: 'Total NMV — TikTok',
        dataSources: ['Calculated'],
        formula: 'Sum of {NMV — TikTok}',
        versions: 2,
      },
      {
        metric: 'Total Seller Discount — TikTok',
        dataSources: ['Calculated'],
        formula: 'Sum of {Seller Discount — TikTok}',
        versions: 2,
      },
      {
        metric: 'Total Platform Discount (Ref) — TikTok',
        description: 'Reference-only — TikTok platform-funded discount, not deducted from CM',
        dataSources: ['TikTok Sales CSV'],
        formula: 'Sum of {SKU Platform Discount} WHERE NOT excluded (gift, cancelled, returned)',
        versions: 1,
      },
      {
        metric: 'Total Free Gift — TikTok',
        dataSources: ['Calculated'],
        formula: 'Sum of {Prime Cost — TikTok} of [Free Gift]',
        versions: 2,
      },
      {
        metric: 'Total Ad Spending — TikTok',
        description: 'Manual Input — not available in TikTok export',
        dataSources: ['Manual Input'],
        formula: '{Total Ad Spending — TikTok}',
        versions: 1,
      },
      {
        metric: 'Total Affiliate Commission — TikTok',
        description:
          'Platform total = SUM of per-SKU {Affiliate Commission — TikTok} over all TikTok SKUs (including row "Others" for product names not in Sales breakdown).',
        dataSources: ['Calculated'],
        formula: 'SUM of {Affiliate Commission — TikTok} over all SKUs',
        versions: 2,
      },
      {
        metric: 'Total Affiliate Booking Fee — TikTok',
        dataSources: ['Calculated'],
        formula:
          '{Total Affiliate Booking Fee} × {Total GMV — TikTok} / ({Total GMV — Shopee} + {Total GMV — TikTok})',
        versions: 2,
      },
      {
        metric: 'Total Livestream Fee — TikTok',
        description: 'Manual Input',
        dataSources: ['Manual Input'],
        formula: '{Total Livestream Fee — TikTok}',
        versions: 1,
      },
      {
        metric: 'Platform Fee Rate — TikTok',
        description:
          'Constant set by TikTok Shop policy. 24% until 2026-05-08, then 26% from 2026-05-09 onwards (current rate). Operator can override per ingest if TikTok issues a new rate.',
        dataSources: ['Constant'],
        formula: '26',
        unit: '%',
        versions: 2,
      },
      {
        metric: 'Total Platform Fee — TikTok',
        dataSources: ['Calculated'],
        formula: 'Sum of {Platform Fee — TikTok}',
        versions: 1,
      },
      {
        metric: 'Total Prime Cost — TikTok',
        dataSources: ['Calculated'],
        formula: 'Sum of {Prime Cost — TikTok}',
        versions: 2,
      },
      {
        metric: 'Total Contribution Margin — TikTok',
        dataSources: ['Calculated'],
        formula:
          '{Total Net GMV — TikTok} − {Total Ad Spending — TikTok} − {Total Platform Fee — TikTok} − {Total Prime Cost — TikTok} − {Total Free Gift — TikTok} − {Total Livestream Fee — TikTok} − {Total Affiliate Commission — TikTok} − {Total Affiliate Booking Fee — TikTok}',
        versions: 1,
      },
      {
        metric: 'Total Contribution Margin % — TikTok',
        dataSources: ['Calculated'],
        formula: '{Total Contribution Margin — TikTok} / {Total Net GMV — TikTok}',
        unit: '%',
        versions: 1,
      },
    ],
  },

  // ============================================================================
  // 4. Product-Level Formulas — TikTok (18)
  // ============================================================================
  {
    id: 'tiktok-product',
    title: 'Product-Level Formulas — TikTok',
    items: [
      {
        metric: 'Original Price — TikTok',
        description: 'Returns 0 for return orders',
        dataSources: ['TikTok Sales CSV'],
        formula: 'IF({Quantity} = {Sku Quantity of return}, 0, {SKU Unit Original Price})',
        versions: 1,
      },
      {
        metric: 'Selling / Listing Price — TikTok',
        description: 'Lookup from Prime Cost table',
        dataSources: ['TikTok Sales CSV', 'Prime Cost Table'],
        formula: 'XLOOKUP({Seller SKU}, {SKU}, {Listing Price}, 0)',
        versions: 1,
      },
      {
        metric: 'Page View — TikTok',
        description: 'Look up from TikTok Traffic CSV',
        dataSources: ['TikTok Traffic CSV'],
        formula:
          '{Lượt xem trang từ tab Cửa hàng} + {Lượt xem trang từ LIVE} + {Lượt xem trang từ video} + {Lượt xem trang từ thẻ sản phẩm}',
        versions: 1,
      },
      {
        metric: 'Conversion Rate per Product — TikTok',
        dataSources: ['Calculated'],
        formula: '{Item Sold — TikTok} / {Page View — TikTok}',
        unit: '%',
        versions: 1,
      },
      {
        metric: 'Item Sold — TikTok',
        description: 'Two columns selected; result = col A − col B',
        dataSources: ['TikTok Sales CSV'],
        formula: 'IF({Quantity} = {Sku Quantity of return}, 0, {Quantity})',
        versions: 1,
      },
      {
        metric: 'GMV — TikTok',
        dataSources: ['Calculated'],
        formula: '{Selling / Listing Price — TikTok} × {Item Sold — TikTok}',
        versions: 1,
      },
      {
        metric: 'Net GMV — TikTok',
        description: 'Raw subtotal before discount minus the seller-funded discount.',
        dataSources: ['TikTok Sales CSV'],
        formula: '{SKU Subtotal Before Discount} − {SKU Seller Discount}',
        versions: 1,
      },
      {
        metric: 'NMV — TikTok',
        description: 'Derived from Net GMV − Seller Discount',
        dataSources: ['Calculated'],
        formula: '{Net GMV — TikTok} − {Seller Discount — TikTok}',
        versions: 1,
      },
      {
        metric: 'Seller Discount — TikTok',
        description: 'Direct from TikTok Sales CSV column (no clamping)',
        dataSources: ['TikTok Sales CSV'],
        formula: '{SKU Seller Discount}',
        versions: 1,
      },
      {
        metric: 'Free Gift — TikTok',
        description: 'Allocated',
        dataSources: ['Calculated'],
        formula: '{Total Free Gift — TikTok} × {NMV — TikTok} / {Total NMV — TikTok}',
        versions: 1,
      },
      {
        metric: 'Ad Spending — TikTok',
        description: 'Allocated',
        dataSources: ['Calculated'],
        formula: '{Total Ad Spending — TikTok} × {NMV — TikTok} / {Total NMV — TikTok}',
        versions: 1,
      },
      {
        metric: 'Affiliate Commission — TikTok',
        description:
          'Per-SKU value. Product-level cost = SUM over (Creator ∪ Partner ∪ Non-collab) WHERE {Trạng thái đơn hàng} = "Đã quyết toán" AND {Tên sản phẩm} = P, of (({Thanh toán hoa hồng tiêu chuẩn ước tính} | {Thanh toán hoa hồng ước tính}) + {Thanh toán hoa hồng Quảng cáo cửa hàng ước tính}). Per-SKU = product-level × ({NMV — TikTok of SKU} / {Sum NMV — TikTok of same name P}). Tên không match Sales breakdown → rớt vào row "Others".',
        dataSources: [
          'TikTok Affiliate Creator XLSX',
          'TikTok Affiliate Partner XLSX',
          'TikTok Affiliate Non-collab XLSX',
          'Calculated',
        ],
        formula:
          '(SUM over 3 affiliate files WHERE {Trạng thái đơn hàng} = "Đã quyết toán" AND {Tên sản phẩm} = P OF (({Thanh toán hoa hồng tiêu chuẩn ước tính} | {Thanh toán hoa hồng ước tính}) + {Thanh toán hoa hồng Quảng cáo cửa hàng ước tính})) × ({NMV — TikTok} / {Sum NMV — TikTok of same name})',
        versions: 2,
      },
      {
        metric: 'Affiliate Booking Fee — TikTok',
        description: 'Allocated',
        dataSources: ['Calculated'],
        formula: '{Total Affiliate Booking Fee — TikTok} × {NMV — TikTok} / {Total NMV — TikTok}',
        versions: 1,
      },
      {
        metric: 'Livestream Fee — TikTok',
        description: 'Allocated',
        dataSources: ['Calculated'],
        formula: '{Total Livestream Fee — TikTok} × {NMV — TikTok} / {Total NMV — TikTok}',
        versions: 1,
      },
      {
        metric: 'Platform Fee — TikTok',
        description: 'Per-row platform fee — direct from row data, not allocated',
        dataSources: ['Calculated'],
        formula: '({GMV — TikTok} − {Seller Discount — TikTok}) × {Platform Fee Rate — TikTok}',
        versions: 1,
      },
      {
        metric: 'Prime Cost — TikTok',
        description: 'Lookup from Prime Cost table × units sold',
        dataSources: ['TikTok Sales CSV', 'Prime Cost Table'],
        formula: 'XLOOKUP({Seller SKU}, {SKU}, {Prime Cost}, 0) × {Item Sold — TikTok}',
        versions: 1,
      },
      {
        metric: 'Contribution Margin — TikTok',
        dataSources: ['Calculated'],
        formula:
          '{Net GMV — TikTok} − {Ad Spending — TikTok} − {Platform Fee — TikTok} − {Prime Cost — TikTok} − {Free Gift — TikTok} − {Livestream Fee — TikTok} − {Affiliate Commission — TikTok} − {Affiliate Booking Fee — TikTok}',
        versions: 1,
      },
      {
        metric: 'Contribution Margin % — TikTok',
        dataSources: ['Calculated'],
        formula: '{Contribution Margin — TikTok} / {Net GMV — TikTok}',
        unit: '%',
        versions: 1,
      },
    ],
  },

  // ============================================================================
  // 5. Aggregated Metrics — Both Platforms (1)
  // ============================================================================
  {
    id: 'aggregated',
    title: 'Aggregated Metrics — Both Platforms',
    items: [
      {
        metric: 'Total Affiliate Booking Fee',
        description: 'Manual Input — total for both platforms combined',
        dataSources: ['Manual Input'],
        formula: '{Total Affiliate Booking Fee}',
        versions: 1,
      },
    ],
  },

  // ============================================================================
  // 6. Currency & Period Comparison (6)
  // ============================================================================
  {
    id: 'currency-period',
    title: 'Currency & Period Comparison',
    items: [
      {
        metric: 'KRW Conversion',
        description: 'Exchange rate updates trigger immediate recalculation of all KRW display values.',
        dataSources: ['Calculated'],
        formula: 'KRW Value = VND Value ÷ Exchange Rate (VND per 1 KRW)',
        versions: 1,
      },
      {
        metric: 'Default Exchange Rate',
        description: 'Overridable per session from the exchange rate input field.',
        dataSources: ['Calculated'],
        formula: '17543',
        unit: 'VND/KRW',
        versions: 2,
      },
      {
        metric: 'WoW %',
        description: "If previous = 0 → display 'N/A'. If previous = null (first week) → display '----'.",
        dataSources: ['Calculated'],
        formula: '(Current Week − Previous Week) / |Previous Week| × 100',
        unit: '%',
        versions: 1,
      },
      {
        metric: 'MoM %',
        description: 'Same edge case handling as WoW.',
        dataSources: ['Calculated'],
        formula: '(Current Month − Previous Month) / |Previous Month| × 100',
        unit: '%',
        versions: 1,
      },
      {
        metric: 'WoW / MoM zero display',
        description: 'Displayed when previous period value = 0.',
        dataSources: ['Calculated'],
        formula: 'N/A',
        versions: 1,
      },
      {
        metric: 'WoW / MoM null display',
        description: 'Displayed when previous period has no data (first period).',
        dataSources: ['Calculated'],
        formula: '----',
        versions: 1,
      },
    ],
  },

  // ============================================================================
  // 7. Order Exclusion Rules (6)
  // ============================================================================
  {
    id: 'order-exclusion',
    title: 'Order Exclusion Rules',
    items: [
      {
        metric: 'Cancelled orders — Shopee',
        description: 'Excluded from all metric calculations.',
        dataSources: ['Shopee Sales CSV'],
        formula: '{Trạng Thái Đơn Hàng} = [Đã hủy]',
        versions: 1,
      },
      {
        metric: 'Cancelled orders — TikTok',
        description: 'Excluded from all metric calculations.',
        dataSources: ['TikTok Sales CSV'],
        formula: '{Order Status} = [Đã hủy] AND {Order Substatus} = [Đã hủy]',
        versions: 1,
      },
      {
        metric: 'Return orders — Shopee',
        description: 'Excluded from all metric calculations.',
        dataSources: ['Calculated'],
        formula: '{GMV — Shopee} = [0]',
        versions: 1,
      },
      {
        metric: 'Return orders — TikTok',
        description: 'Excluded from all metric calculations.',
        dataSources: ['Calculated'],
        formula: '{Net GMV — TikTok} = [0]',
        versions: 1,
      },
      {
        metric: 'Free Gift identification — Shopee',
        description:
          'SKUs with GMV ≠ 0 and NMV = 0 (excluding cancelled) are treated as free gifts. Revenue excluded from Net GMV; Prime Cost of Free Gifts added to Total Prime Cost.',
        dataSources: ['Calculated'],
        formula:
          '{GMV — Shopee} ≠ [0] AND {NMV — Shopee} = [0] AND {Trạng Thái Đơn Hàng} ≠ [Đã hủy]',
        versions: 1,
      },
      {
        metric: 'Free Gift identification — TikTok',
        description:
          'SKUs with Net GMV = 0 and product name starts with [GIFT] are treated as free gifts. Revenue and platform discount excluded from Net GMV. Add Prime Cost of Free Gifts to Total Prime Cost.',
        dataSources: ['TikTok Sales CSV', 'Calculated'],
        formula:
          '{Normal or Pre-order} = [Normal] AND {Net GMV — TikTok} = [0] AND {Product Name} starts with [GIFT]',
        versions: 1,
      },
    ],
  },

  // ============================================================================
  // 8. Cost Master (3)
  // ============================================================================
  {
    id: 'cost-master',
    title: 'Cost Master',
    items: [
      {
        metric: 'HQ Margin %',
        description: 'Added on top of ex-VAT production cost.',
        dataSources: ['Calculated'],
        formula: '5',
        unit: '%',
        versions: 1,
      },
      {
        metric: 'VAT Rate',
        description: 'Applied to strip VAT from HQ cost.',
        dataSources: ['Calculated'],
        formula: '10',
        unit: '%',
        versions: 1,
      },
      {
        metric: 'Fulfillment Fee / unit',
        description: 'Fixed per dispatched unit (Amoeba). Configurable without code changes.',
        dataSources: ['Calculated'],
        formula: '14000',
        unit: 'VND',
        versions: 2,
      },
    ],
  },
];

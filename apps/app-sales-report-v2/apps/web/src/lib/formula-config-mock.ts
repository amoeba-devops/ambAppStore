/**
 * Mock Formula Config catalog — FR-23 stub displayed read-only in Step 4 Review.
 * Real impl reads from sal_formula_configs (48 parameters across 7 groups per SRD).
 */

export type ParamType = 'field-map' | 'calculated' | 'select' | 'number';

export interface FormulaParam {
  name: string;
  value: string;
  description?: string;
  type: ParamType;
}

export interface FormulaGroup {
  id: string;
  title: string;
  description: string;
  params: FormulaParam[];
}

export const FORMULA_GROUPS: FormulaGroup[] = [
  {
    id: 'shopee-mapping',
    title: 'Shopee — Column Mapping',
    description: 'How raw Shopee export columns map to app fields',
    params: [
      { name: 'order_id', value: 'Mã đơn hàng', type: 'field-map' },
      { name: 'sku_code', value: 'SKU phân loại hàng', type: 'field-map' },
      { name: 'product_name', value: 'Tên Sản phẩm', type: 'field-map' },
      { name: 'order_status', value: 'Trạng Thái Đơn Hàng', type: 'field-map' },
      { name: 'quantity', value: 'Số lượng', type: 'field-map' },
      { name: 'quantity_returned', value: 'Số lượng trả lại', type: 'field-map' },
      { name: 'gmv', value: 'Tổng giá trị đơn hàng', type: 'field-map' },
      { name: 'net_gmv', value: 'Net GMV', type: 'field-map' },
      { name: 'seller_voucher', value: 'Seller Voucher', type: 'field-map' },
      { name: 'seller_discount', value: 'Seller Discount', type: 'field-map' },
      { name: 'platform_fee', value: 'Platform Fee', type: 'field-map' },
    ],
  },
  {
    id: 'tiktok-mapping',
    title: 'TikTok Shop — Column Mapping',
    description: 'How raw TikTok export columns map to app fields',
    params: [
      { name: 'order_id', value: 'Order ID', type: 'field-map' },
      { name: 'sku_code', value: 'Seller SKU', type: 'field-map' },
      { name: 'product_name', value: 'Product Name', type: 'field-map' },
      { name: 'order_status', value: 'Order Status', type: 'field-map' },
      { name: 'quantity', value: 'Quantity', type: 'field-map' },
      { name: 'gmv', value: 'GMV', type: 'field-map' },
      { name: 'net_gmv', value: 'Net GMV', type: 'field-map' },
      { name: 'seller_discount', value: 'Seller Discount', type: 'field-map' },
      { name: 'tiktok_commission', value: 'TikTok Commission', type: 'field-map' },
      { name: 'order_processing_fee', value: 'Order Processing Fee', type: 'field-map' },
    ],
  },
  {
    id: 'exclusion-rules',
    title: 'Order Exclusion Rules',
    description: 'How invalid orders are excluded from metrics',
    params: [
      { name: 'Excluded order statuses', value: 'CANCELLED, RETURNED, REFUNDED', type: 'select' },
      { name: 'Free Gift detection', value: 'product_name starts with "[GIFT]"', type: 'calculated' },
      { name: 'Item Sold (Shopee)', value: 'quantity − quantity_returned', type: 'calculated' },
      { name: 'Item Sold (TikTok)', value: 'IF(order_status="returned", 0, quantity)', type: 'calculated' },
      { name: 'Free Gift treatment', value: 'Prime Cost counted, revenue excluded', type: 'select' },
    ],
  },
  {
    id: 'discount-costs',
    title: 'Discount Costs Definition',
    description: 'How discount costs are summed',
    params: [
      {
        name: 'Total Discount Costs',
        value: 'Seller Voucher + Seller Discount + Free Gift',
        type: 'calculated',
      },
      {
        name: 'Platform Discount (Rfr)',
        value: 'SUM(SKU Platform Discount) — reference only, NOT in total',
        type: 'calculated',
      },
      { name: 'Free Gift cost basis', value: 'Allocated per NMV contribution to non-gift SKUs', type: 'select' },
    ],
  },
  {
    id: 'promo-allocation',
    title: 'Promotional Cost Allocation',
    description: '2-tier allocation: cross-platform + intra-platform',
    params: [
      {
        name: 'Affiliate Booking Fee split',
        value: 'Cross-platform by GMV contribution (Shopee vs TikTok)',
        type: 'select',
      },
      { name: 'Brand Ads allocation', value: 'Per SKU by NMV contribution (Shopee only)', type: 'calculated' },
      {
        name: 'Off-Platform Ads allocation',
        value: 'Per SKU by NMV contribution (Shopee only)',
        type: 'calculated',
      },
      {
        name: 'Affiliate Commission allocation',
        value: 'Per SKU by NMV contribution',
        type: 'calculated',
      },
      {
        name: 'TikTok Platform Fee (weekly)',
        value: 'avg(last 4 weeks rate) × current week Net GMV',
        type: 'calculated',
      },
      {
        name: 'TikTok Platform Fee fallback',
        value: '16% if <4 weeks history',
        type: 'number',
      },
      {
        name: 'TikTok Platform Fee (monthly)',
        value: 'SUM of 7 manual components',
        type: 'calculated',
      },
    ],
  },
  {
    id: 'cm-formula',
    title: 'Contribution Margin Formula',
    description: 'CM formulas differ per channel (TikTok has fewer cost lines)',
    params: [
      {
        name: 'Shopee CM',
        value:
          'Net GMV − Seller Discount − Prime Cost − Ad Spending − Brand Ads − Platform Fee − Seller Vouchers − Livestream Fee − Off-Platform Ads − Free Gift − Affiliate Booking − Affiliate Commission',
        type: 'calculated',
      },
      {
        name: 'TikTok CM',
        value:
          'Net GMV − Seller Discount − Prime Cost − Ad Spending − Platform Fee − Livestream Fee − Free Gift − Affiliate Booking − Affiliate Commission',
        type: 'calculated',
        description: 'TikTok has no Brand Ads, Off-Platform Ads, or Seller Vouchers per FR-03',
      },
      { name: 'Total CM', value: 'Shopee CM + TikTok CM', type: 'calculated' },
      { name: 'CM %', value: 'Total CM / Net GMV × 100', type: 'calculated' },
    ],
  },
  {
    id: 'currency',
    title: 'Currency & FX',
    description: 'Currency conversion and storage rules',
    params: [
      {
        name: 'Storage currency',
        value: 'VND (all *_vnd columns)',
        type: 'select',
      },
      {
        name: 'FX rate (default)',
        value: '1 KRW = 17,543 VND',
        type: 'number',
        description: 'Editable in Weekly/Monthly Report header; default per FX rate snapshot',
      },
      { name: 'KRW display formula', value: 'KRW = VND / FX rate', type: 'calculated' },
      { name: 'Rounding', value: 'Integer VND (no decimals)', type: 'select' },
    ],
  },
  {
    id: 'wow-mom',
    title: 'WoW / MoM Deltas',
    description: 'Comparison logic for trending reports',
    params: [
      {
        name: 'WoW formula',
        value: '(current − prev) / abs(prev) × 100',
        type: 'calculated',
      },
      { name: 'WoW when prev = 0', value: '"N/A" (no delta)', type: 'select' },
      { name: 'WoW when no prev data', value: '"----" (first period)', type: 'select' },
      {
        name: 'MoM formula',
        value: 'Same as WoW, comparing consecutive calendar months',
        type: 'calculated',
      },
      { name: 'Week definition', value: 'Friday → Thursday (client convention)', type: 'select' },
    ],
  },
];

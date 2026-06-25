import 'server-only';
import {
  cellText,
  cellNumber,
  findHeaderRowByLabels,
  isXlsx,
  readXlsxGrid,
  XlsxParseError,
} from './xlsx-grid.util';

/**
 * Parser for TikTok Shop "affiliate order" exports — 3 file variants:
 *
 *   1. Creator Order            (affiliate_orders_*.xlsx, header @ row 1, 33 cols)
 *   2. Affiliate Partner Order  (affiliate_orders_*.xlsx, header @ row 2 below
 *                                a Note row, 30 cols)
 *   3. Non-collaboration Order  (creator_order_all_*.xlsx, header @ row 1, 39 cols)
 *
 * Per spec (REQ-20260528):
 *   - Match key:   "Tên sản phẩm"
 *   - amount cols: varies per variant — see CREATOR_CONFIG / PARTNER_CONFIG /
 *                  NONCOLLAB_CONFIG below
 *   - Filter out:  row where "Trạng thái đơn hàng" == "Đã hủy" OR refunded
 *                  column reads "Có"/"Yes" (column name varies per variant)
 *
 * Output of each parser: `{ costByProductName, totalCost, rowsKept, rowsExcluded }`.
 * `costByProductName` keys are normalized so downstream lookup matches the
 * Sales breakdown's product names regardless of NFC / whitespace drift.
 */

export interface TikTokAffOrderResult {
  /** Map of normalized product name → SUM(amount cols for that product, kept rows only). */
  costByProductName: Record<string, number>;
  /** SUM of all per-row amounts that were kept — equal to SUM(values of map). */
  totalCost: number;
  rowsKept: number;
  rowsExcluded: number;
}

export class TikTokAffiliateOrderParseError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NO_HEADER'
      | 'MISSING_COLUMN'
      | 'EMPTY_FILE'
      | 'READ_FAILED'
      | 'NOT_XLSX',
  ) {
    super(message);
    this.name = 'TikTokAffiliateOrderParseError';
  }
}

interface VariantConfig {
  variant: 'creator' | 'partner' | 'noncollab';
  /** Vietnamese label of the product-name column. */
  productNameLabel: string;
  /** Vietnamese label of the order-/commission-status column used for the settled filter. */
  statusLabel: string;
  /**
   * Per row, the row's affiliate cost is `SUM` of one value from each amount
   * field. Each amount field is an alias list — the first alias resolved in
   * the header wins. ALL fields must resolve to at least one alias; otherwise
   * `MISSING_COLUMN` is thrown.
   *
   * Aliases let us tolerate TikTok's inconsistent naming across the 3 exports
   * (e.g., "Thanh toán hoa hồng ước tính" in Partner file vs. "Thanh toán hoa
   * hồng tiêu chuẩn ước tính" in Creator + NonCollab — same metric, different
   * Vietnamese phrasing).
   */
  amountFields: ReadonlyArray<readonly string[]>;
}

// Standard-commission column aliases (semantically equivalent across files).
const STANDARD_COMMISSION_ALIASES = [
  'Thanh toán hoa hồng tiêu chuẩn ước tính', // Creator + NonCollab
  'Thanh toán hoa hồng ước tính',            // Partner (dropped the "tiêu chuẩn" qualifier)
] as const;

const SHOP_ADS_COMMISSION_ALIASES = [
  'Thanh toán hoa hồng Quảng cáo cửa hàng ước tính',
] as const;

const CREATOR_CONFIG: VariantConfig = {
  variant: 'creator',
  productNameLabel: 'Tên sản phẩm',
  statusLabel: 'Trạng thái đơn hàng',
  amountFields: [STANDARD_COMMISSION_ALIASES, SHOP_ADS_COMMISSION_ALIASES],
};

const PARTNER_CONFIG: VariantConfig = {
  variant: 'partner',
  productNameLabel: 'Tên sản phẩm',
  statusLabel: 'Trạng thái đơn hàng',
  amountFields: [SHOP_ADS_COMMISSION_ALIASES, STANDARD_COMMISSION_ALIASES],
};

const NONCOLLAB_CONFIG: VariantConfig = {
  variant: 'noncollab',
  productNameLabel: 'Tên sản phẩm',
  statusLabel: 'Trạng thái đơn hàng',
  amountFields: [SHOP_ADS_COMMISSION_ALIASES, STANDARD_COMMISSION_ALIASES],
};

/**
 * Whitelist filter — only rows whose status column equals "Đã quyết toán"
 * (commission settled / finalized payout) count toward the total. Everything
 * else is excluded:
 *   - "Không đủ điều kiện" (not eligible)
 *   - "Chờ xử lý" (pending)
 *   - "Khách hàng chưa thanh toán" (customer not yet paid)
 *   - "Đã hủy" / "Đã hoàn thành" / "Đang xử lý" (order-status values, present
 *     in the Non-collab file which lacks a commission-settlement status column)
 * Net effect on the sample fixtures: Creator 3035 rows, Partner 60 rows,
 * NonCollab 0 rows.
 */
const SETTLED_STATUS_VALUES = new Set([
  'đã quyết toán'.normalize('NFC'),
]);

/** Normalize a product name for cross-file matching (NFC + collapse whitespace + trim). */
function normalizeProductName(s: string): string {
  return s.normalize('NFC').replace(/\s+/g, ' ').trim();
}

function isSettled(statusCell: string): boolean {
  return SETTLED_STATUS_VALUES.has(statusCell.trim().toLowerCase().normalize('NFC'));
}

function parseGeneric(buffer: ArrayBuffer, config: VariantConfig): TikTokAffOrderResult {
  const bytes = new Uint8Array(buffer);
  if (!isXlsx(bytes)) {
    throw new TikTokAffiliateOrderParseError(
      'File is not xlsx (expected PK ZIP magic)',
      'NOT_XLSX',
    );
  }
  let grid: Map<number, Map<number, string | number>>;
  try {
    grid = readXlsxGrid(bytes);
  } catch (err) {
    if (err instanceof XlsxParseError) {
      throw new TikTokAffiliateOrderParseError(err.message, 'READ_FAILED');
    }
    throw err;
  }
  if (grid.size === 0) {
    throw new TikTokAffiliateOrderParseError('No cells found in worksheet', 'EMPTY_FILE');
  }

  // Auto-detect header row (Partner file has a Note in row 1). Use anchors that
  // are stable across all 3 file variants: productName + status + at least one
  // amount alias.
  const headerAnchors = [
    config.productNameLabel,
    config.statusLabel,
    ...config.amountFields.flatMap((aliases) => [...aliases]),
  ];
  const headerRowNum = findHeaderRowByLabels(grid, headerAnchors, 3);
  if (headerRowNum < 0) {
    throw new TikTokAffiliateOrderParseError(
      `Header row not found — need columns: ${headerAnchors.join(', ')}`,
      'NO_HEADER',
    );
  }

  const headerCells = grid.get(headerRowNum)!;
  // Build a label → column index map from the header row (NFC-normalized so
  // hidden width / encoding drift doesn't break matching).
  const colByLabel = new Map<string, number>();
  for (const [c, v] of headerCells) {
    if (typeof v === 'string') colByLabel.set(v.trim().normalize('NFC'), c);
  }

  function resolveAliases(aliases: readonly string[]): number | undefined {
    for (const alias of aliases) {
      const col = colByLabel.get(alias.normalize('NFC'));
      if (col != null) return col;
    }
    return undefined;
  }

  const productNameCol = colByLabel.get(config.productNameLabel.normalize('NFC'));
  const statusCol = colByLabel.get(config.statusLabel.normalize('NFC'));
  const amountCols = config.amountFields.map((aliases) => ({ aliases, col: resolveAliases(aliases) }));

  // Required columns must resolve. Amount fields each need at least one alias
  // match — if a file truly lacks one of the metrics we expect, parser fails
  // loudly rather than silently treating it as zero.
  const missing: string[] = [];
  if (productNameCol == null) missing.push(config.productNameLabel);
  if (statusCol == null) missing.push(config.statusLabel);
  for (const { aliases, col } of amountCols) {
    if (col == null) missing.push(aliases.join(' / '));
  }
  if (missing.length > 0) {
    throw new TikTokAffiliateOrderParseError(
      `Missing required columns: ${missing.join('; ')}`,
      'MISSING_COLUMN',
    );
  }

  const costByProductName: Record<string, number> = {};
  let totalCost = 0;
  let rowsKept = 0;
  let rowsExcluded = 0;

  // Non-null assertions safe — missing check above guarantees resolution.
  const productNameColFinal = productNameCol!;
  const statusColFinal = statusCol!;
  const resolvedAmountCols = amountCols.map(({ col }) => col!);

  const sortedRowNums = [...grid.keys()].sort((a, b) => a - b);
  for (const r of sortedRowNums) {
    if (r <= headerRowNum) continue;
    const row = grid.get(r)!;
    const productName = cellText(row.get(productNameColFinal));
    if (!productName) continue; // skip blank rows

    const statusText = cellText(row.get(statusColFinal));
    if (!isSettled(statusText)) {
      rowsExcluded++;
      continue;
    }

    let rowAmount = 0;
    for (const col of resolvedAmountCols) {
      rowAmount += cellNumber(row.get(col));
    }

    const key = normalizeProductName(productName);
    if (!key) continue;
    costByProductName[key] = (costByProductName[key] ?? 0) + rowAmount;
    totalCost += rowAmount;
    rowsKept++;
  }

  // Filter out zero-cost entries — they add no value to lookup and just
  // clutter the snapshot JSON.
  for (const k of Object.keys(costByProductName)) {
    if (costByProductName[k] === 0) delete costByProductName[k];
  }

  return { costByProductName, totalCost, rowsKept, rowsExcluded };
}

export async function parseTikTokAffiliateCreator(
  buffer: ArrayBuffer,
): Promise<TikTokAffOrderResult> {
  return parseGeneric(buffer, CREATOR_CONFIG);
}

export async function parseTikTokAffiliatePartner(
  buffer: ArrayBuffer,
): Promise<TikTokAffOrderResult> {
  return parseGeneric(buffer, PARTNER_CONFIG);
}

export async function parseTikTokAffiliateNonCollab(
  buffer: ArrayBuffer,
): Promise<TikTokAffOrderResult> {
  return parseGeneric(buffer, NONCOLLAB_CONFIG);
}

/** Merge per-product cost maps from any combination of the 3 affiliate files. */
export function mergeTikTokAffiliateCosts(
  ...maps: ReadonlyArray<Record<string, number> | undefined | null>
): { costByProductName: Record<string, number>; totalCost: number } {
  const merged: Record<string, number> = {};
  for (const m of maps) {
    if (!m) continue;
    for (const [k, v] of Object.entries(m)) {
      merged[k] = (merged[k] ?? 0) + v;
    }
  }
  let totalCost = 0;
  for (const v of Object.values(merged)) totalCost += v;
  return { costByProductName: merged, totalCost };
}

export { normalizeProductName as normalizeTikTokAffiliateProductName };

import 'server-only';
import {
  cellText,
  cellNumber,
  findHeaderRowByLabels,
  isXlsx,
  readXlsxGrid,
  resolveHeaderColumns,
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
  /** Vietnamese label of the order-status column (used for cancellation filter). */
  statusLabel: string;
  /** Aliases for the "refunded" column (NonCollab uses different wording). */
  refundedLabels: readonly string[];
  /** Amount columns whose values are summed per row to produce row affiliate cost. */
  amountLabels: readonly string[];
}

const CREATOR_CONFIG: VariantConfig = {
  variant: 'creator',
  productNameLabel: 'Tên sản phẩm',
  statusLabel: 'Trạng thái đơn hàng',
  refundedLabels: ['Đã trả hàng hoặc hoàn tiền đầy đủ'],
  amountLabels: [
    'Thanh toán hoa hồng tiêu chuẩn ước tính',
    'Thanh toán hoa hồng Quảng cáo cửa hàng ước tính',
  ],
};

const PARTNER_CONFIG: VariantConfig = {
  variant: 'partner',
  productNameLabel: 'Tên sản phẩm',
  statusLabel: 'Trạng thái đơn hàng',
  refundedLabels: ['Đã trả hàng hoặc hoàn tiền đầy đủ'],
  amountLabels: ['Thanh toán hoa hồng Quảng cáo cửa hàng ước tính'],
};

const NONCOLLAB_CONFIG: VariantConfig = {
  variant: 'noncollab',
  productNameLabel: 'Tên sản phẩm',
  statusLabel: 'Trạng thái đơn hàng',
  // NonCollab file uses different refund column names — accept any alias.
  refundedLabels: ['Trả hàng & hoàn tiền', 'Đã trả hàng hoặc hoàn tiền đầy đủ', 'Hoàn tiền'],
  amountLabels: ['Thanh toán hoa hồng Quảng cáo cửa hàng ước tính'],
};

const CANCELLED_STATUS_VALUES = new Set(['đã hủy', 'da huy', 'cancelled']);
const REFUNDED_TRUE_VALUES = new Set(['có', 'co', 'yes', 'true', '1']);

/** Normalize a product name for cross-file matching (NFC + collapse whitespace + trim). */
function normalizeProductName(s: string): string {
  return s.normalize('NFC').replace(/\s+/g, ' ').trim();
}

function isCancelled(statusCell: string): boolean {
  return CANCELLED_STATUS_VALUES.has(statusCell.trim().toLowerCase().normalize('NFC'));
}

function isRefunded(refundedCell: string): boolean {
  if (!refundedCell) return false;
  return REFUNDED_TRUE_VALUES.has(refundedCell.trim().toLowerCase().normalize('NFC'));
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

  // Auto-detect header row (Partner file has a Note in row 1).
  const requiredLabels = [config.productNameLabel, config.statusLabel, ...config.amountLabels];
  const headerRowNum = findHeaderRowByLabels(grid, requiredLabels, 3);
  if (headerRowNum < 0) {
    throw new TikTokAffiliateOrderParseError(
      `Header row not found — need columns: ${requiredLabels.join(', ')}`,
      'NO_HEADER',
    );
  }

  const headerCells = grid.get(headerRowNum)!;
  // Resolve column indices. Each amount label is a separate field; we'll sum
  // them per row. Refunded uses alias list.
  const headerMap: Record<string, string | readonly string[]> = {
    productName: config.productNameLabel,
    status: config.statusLabel,
    refunded: config.refundedLabels,
  };
  config.amountLabels.forEach((label, i) => {
    headerMap[`amount_${i}`] = label;
  });
  const { colByField, missing } = resolveHeaderColumns(headerCells, headerMap);

  // Refunded column is optional (NonCollab has it under different names; if
  // none match we just skip the refund check rather than failing the parse).
  const requiredMissing = missing.filter((label) =>
    [config.productNameLabel, config.statusLabel, ...config.amountLabels].includes(label),
  );
  if (requiredMissing.length > 0) {
    throw new TikTokAffiliateOrderParseError(
      `Missing required columns: ${requiredMissing.join(', ')}`,
      'MISSING_COLUMN',
    );
  }

  // Safe: requiredMissing check above guarantees productName/status/amount cols resolved.
  const productNameCol = colByField.productName!;
  const statusCol = colByField.status!;
  const refundedCol: number | undefined = colByField.refunded; // optional
  const amountCols = config.amountLabels.map((_, i) => colByField[`amount_${i}`]!);

  const costByProductName: Record<string, number> = {};
  let totalCost = 0;
  let rowsKept = 0;
  let rowsExcluded = 0;

  const sortedRowNums = [...grid.keys()].sort((a, b) => a - b);
  for (const r of sortedRowNums) {
    if (r <= headerRowNum) continue;
    const row = grid.get(r)!;
    const productName = cellText(row.get(productNameCol));
    if (!productName) continue; // skip blank rows

    const statusText = cellText(row.get(statusCol));
    if (isCancelled(statusText)) {
      rowsExcluded++;
      continue;
    }
    if (refundedCol != null && isRefunded(cellText(row.get(refundedCol)))) {
      rowsExcluded++;
      continue;
    }

    let rowAmount = 0;
    for (const col of amountCols) {
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

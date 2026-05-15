import 'server-only';
import ExcelJS from 'exceljs';

/**
 * One creator row from a TikTok Affiliate (Creator_List) xlsx export.
 * 1 row per creator/affiliate per period — Total Affiliate Commission = SUM(commission).
 */
export interface TikTokAffiliateRow {
  username: string;
  gmv: number;
  itemsSold: number;
  /** Estimated commission seller paid to this creator. Primary metric. */
  commission: number;
  /** Estimated fixed fee (often "--" / 0 in practice). */
  fixedFee: number;
  gmvRefunded: number;
}

const HEADER_MAP = {
  username: 'Tên người dùng của nhà sáng tạo',
  gmv: 'GMV liên kết',
  itemsSold: 'Số món bán ra',
  commission: 'Hoa hồng ước tính',
  fixedFee: 'Phí cố định ước tính',
  gmvRefunded: 'GMV đã hoàn tiền từ liên kết',
} as const;

type FieldName = keyof typeof HEADER_MAP;

export class TikTokAffiliateParseError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_SHEET' | 'MISSING_COLUMN' | 'EMPTY_FILE' | 'READ_FAILED',
  ) {
    super(message);
    this.name = 'TikTokAffiliateParseError';
  }
}

const num = (v: ExcelJS.CellValue): number => {
  if (v == null || v === '' || v === '-' || v === '--') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && 'result' in v && typeof v.result === 'number') return v.result;
  const s = String(v).replace(/[, ]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const text = (v: ExcelJS.CellValue): string => {
  if (v == null) return '';
  if (typeof v === 'object' && 'text' in v && typeof v.text === 'string') return v.text.trim();
  return String(v).trim();
};

export async function parseTikTokAffiliate(buffer: ArrayBuffer): Promise<TikTokAffiliateRow[]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch (err) {
    throw new TikTokAffiliateParseError(
      `Failed to read xlsx: ${err instanceof Error ? err.message : String(err)}`,
      'READ_FAILED',
    );
  }
  const sheet = wb.worksheets[0];
  if (!sheet) throw new TikTokAffiliateParseError('No worksheets found', 'NO_SHEET');
  if (sheet.rowCount < 2) throw new TikTokAffiliateParseError('No data rows', 'EMPTY_FILE');

  const headerRow = sheet.getRow(1);
  const colByField = {} as Record<FieldName, number>;
  const missing: string[] = [];
  for (const [field, label] of Object.entries(HEADER_MAP) as Array<[FieldName, string]>) {
    const labelNfc = label.normalize('NFC');
    let col = -1;
    headerRow.eachCell({ includeEmpty: false }, (cell, c) => {
      if (text(cell.value).normalize('NFC') === labelNfc) col = c;
    });
    if (col === -1) missing.push(label);
    else colByField[field] = col;
  }
  if (missing.length > 0) {
    throw new TikTokAffiliateParseError(
      `Missing required columns: ${missing.join(', ')}`,
      'MISSING_COLUMN',
    );
  }

  const rows: TikTokAffiliateRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const username = text(row.getCell(colByField.username).value);
    if (!username) continue;
    rows.push({
      username,
      gmv: num(row.getCell(colByField.gmv).value),
      itemsSold: num(row.getCell(colByField.itemsSold).value),
      commission: num(row.getCell(colByField.commission).value),
      fixedFee: num(row.getCell(colByField.fixedFee).value),
      gmvRefunded: num(row.getCell(colByField.gmvRefunded).value),
    });
  }
  return rows;
}

export function aggregateTikTokAffiliate(rows: TikTokAffiliateRow[]) {
  let totalCommission = 0;
  let totalFixedFee = 0;
  let totalGmv = 0;
  let totalItemsSold = 0;
  let activeCreatorCount = 0;
  for (const r of rows) {
    totalCommission += r.commission;
    totalFixedFee += r.fixedFee;
    totalGmv += r.gmv;
    totalItemsSold += r.itemsSold;
    if (r.commission > 0 || r.fixedFee > 0) activeCreatorCount++;
  }
  return {
    totalCommission,
    totalFixedFee,
    totalGmv,
    totalItemsSold,
    creatorCount: rows.length,
    activeCreatorCount,
  };
}

import ExcelJS from 'exceljs';
import type { TruckSheetCellType } from '@car-v2/shared/zod';

/** One cell as the caller has it: dates 'YYYY-MM-DD', times 'HH:MM',
 * numbers as numbers; '' / null = empty cell. */
export type TruckSheetValue = string | number | null;

/* Number format per data type — applied to the whole COLUMN, so the template's
 * empty rows already carry it (whatever the user types lands as that type) and
 * the export's cells get the very same one. */
const NUM_FMT: Record<TruckSheetCellType, string> = {
  text: '@',
  date: 'dd/mm/yyyy',
  time: 'hh:mm',
  int: '#,##0',
  money: '#,##0',
  decimal: '#,##0.00',
};
const MIN_WIDTH: Record<TruckSheetCellType, number> = {
  text: 16,
  date: 12,
  time: 9,
  int: 11,
  money: 14,
  decimal: 12,
};

/* Excel serial (days since 1899-12-30). Built from UTC parts so the value is
 * exactly what the string says on any server timezone. */
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

function toCell(type: TruckSheetCellType, v: TruckSheetValue): ExcelJS.CellValue {
  if (v == null || v === '') return null;
  switch (type) {
    case 'text':
      return String(v);
    case 'date': {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
      return m ? (Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - EXCEL_EPOCH) / 86400000 : String(v);
    }
    case 'time': {
      const m = /^(\d{1,2}):(\d{2})/.exec(String(v));
      return m ? (Number(m[1]) * 60 + Number(m[2])) / 1440 : String(v);
    }
    default:
      return typeof v === 'number' ? v : Number.isFinite(Number(v)) ? Number(v) : String(v);
  }
}

/**
 * The truck trip-log .xlsx — used by BOTH the import template (no rows) and the
 * trip-log export, so the two files share header, column order AND data types:
 * every column is formatted by its `type` (TRUCK_TRIP_SHEET_COLUMNS), and
 * export cells are written as real numbers / dates / times, never as text that
 * only looks like one. The importer reads dates / times as Excel serials
 * (parseImportDate / parseImportTime), so an exported file re-imports as is.
 */
export async function buildTruckTripWorkbook(opts: {
  sheetName: string;
  header: readonly string[];
  types: readonly TruckSheetCellType[];
  rows?: readonly (readonly TruckSheetValue[])[];
}): Promise<Uint8Array<ArrayBuffer>> {
  const { sheetName, header, types, rows = [] } = opts;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = types.map((type, i) => ({
    width: Math.min(40, Math.max(MIN_WIDTH[type], (header[i]?.length ?? 0) + 2)),
    style: { numFmt: NUM_FMT[type] },
  }));

  const head = ws.getRow(1);
  header.forEach((h, i) => {
    const cell = head.getCell(i + 1);
    cell.value = h;
    cell.numFmt = '@';
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });

  for (const row of rows) {
    ws.addRow(types.map((type, i) => toCell(type, row[i] ?? null)));
  }

  const buf = await wb.xlsx.writeBuffer();
  /* Plain Uint8Array — Node Buffer isn't a valid BodyInit under the web lib
   * types used by route handlers. */
  return new Uint8Array(buf as ArrayBuffer);
}

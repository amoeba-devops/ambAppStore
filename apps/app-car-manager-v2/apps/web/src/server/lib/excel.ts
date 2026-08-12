import 'server-only';
import * as XLSX from 'xlsx';
import { attachment } from './content-disposition';

/* Excel (.xlsx) export utilities.
 *
 * Uses SheetJS (xlsx) library for cross-platform .xlsx generation.
 * All exports use UTF-8 encoding with proper Vietnamese/Korean support.
 */

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number; // character width
}

export interface ExcelSheetData {
  name: string;
  columns: ExcelColumn[];
  rows: Record<string, unknown>[];
}

/**
 * Build a single-sheet Excel workbook from header + rows.
 * Returns a Buffer suitable for streaming to NextResponse.
 */
export function buildExcel(
  sheetName: string,
  columns: ExcelColumn[],
  rows: Record<string, unknown>[],
): Buffer {
  const wb = XLSX.utils.book_new();

  // Build AOA (array of arrays) with header row first
  const header = columns.map((c) => c.header);
  const data: unknown[][] = [header];

  for (const row of rows) {
    const rowArr = columns.map((c) => {
      const val = row[c.key];
      // Handle dates
      if (val instanceof Date) {
        return val.toISOString();
      }
      return val ?? '';
    });
    data.push(rowArr);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = columns.map((c) => ({ wch: c.width ?? 15 }));

  // Style header row (bold) - requires cellStyles option but SheetJS community
  // edition has limited styling. We use a workaround via cell formatting.
  // For basic xlsx, the header row is distinguishable by being the first row.

  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Write to buffer
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buf);
}

/**
 * Build a multi-sheet Excel workbook.
 * Each sheet has its own name, columns, and rows.
 */
export function buildMultiSheetExcel(sheets: ExcelSheetData[]): Buffer {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const header = sheet.columns.map((c) => c.header);
    const data: unknown[][] = [header];

    for (const row of sheet.rows) {
      const rowArr = sheet.columns.map((c) => {
        const val = row[c.key];
        if (val instanceof Date) {
          return val.toISOString();
        }
        return val ?? '';
      });
      data.push(rowArr);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = sheet.columns.map((c) => ({ wch: c.width ?? 15 }));

    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buf);
}

/**
 * Create an Excel response for NextResponse.
 */
export function excelResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      /* Localized filenames reach here (Korean truck exports), so the ASCII
       * `filename=` fallback must be sanitised — see content-disposition.ts. */
      'Content-Disposition': attachment(filename),
      'Cache-Control': 'no-store',
    },
  });
}

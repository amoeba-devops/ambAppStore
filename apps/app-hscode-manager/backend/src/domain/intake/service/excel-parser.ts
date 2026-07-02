import * as ExcelJS from 'exceljs';

export interface ParsedSheet {
  sheetName: string;
  headers: string[];
  rows: Array<Record<string, unknown>>;
  totalRows: number;
}

const MAX_SYNC_ROWS = 1000;

export async function parseWorkbook(
  buffer: Buffer,
  options: { sheet?: string; headerRow?: number } = {},
): Promise<{
  sheets: string[];
  parsed: ParsedSheet;
}> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheets = wb.worksheets.map((w) => w.name);
  const targetName = options.sheet ?? sheets[0];
  const ws = wb.getWorksheet(targetName);
  if (!ws) {
    throw new Error(`Sheet not found: ${targetName}`);
  }

  const headerRowIdx = options.headerRow ?? 1;
  const headerRow = ws.getRow(headerRowIdx);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? '').trim();
  });

  const rows: Array<Record<string, unknown>> = [];
  const lastRow = ws.actualRowCount;
  for (let r = headerRowIdx + 1; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const obj: Record<string, unknown> = {};
    let hasAny = false;
    headers.forEach((h, i) => {
      if (!h) return;
      const cell = row.getCell(i + 1);
      const raw = cell.value;
      let v: unknown = raw;
      if (raw && typeof raw === 'object' && 'text' in (raw as object)) {
        v = (raw as { text: string }).text;
      } else if (raw instanceof Date) {
        v = raw.toISOString();
      }
      obj[h] = v;
      if (v !== null && v !== undefined && String(v).trim() !== '') hasAny = true;
    });
    if (hasAny) rows.push(obj);
  }

  if (rows.length > MAX_SYNC_ROWS) {
    throw new Error(
      `Row limit exceeded: ${rows.length} > ${MAX_SYNC_ROWS} (use async batch in Phase 7)`,
    );
  }

  return {
    sheets,
    parsed: {
      sheetName: targetName,
      headers: headers.filter(Boolean),
      rows,
      totalRows: rows.length,
    },
  };
}

export function suggestMapping(headers: string[]): Record<string, string | null> {
  const lc = headers.map((h) => h.toLowerCase());
  const suggest = (candidates: string[]): string | null => {
    for (const c of candidates) {
      const idx = lc.findIndex((h) => h.includes(c));
      if (idx >= 0) return headers[idx];
    }
    return null;
  };
  return {
    name: suggest(['item name', 'product', '품명', '제품명', 'description']),
    category: suggest(['category', 'type', '분류', '카테고리']),
    material: suggest(['material', '재질', '소재']),
    usage_description: suggest(['usage', 'use', '용도']),
    composition: suggest(['composition', 'cas', '성분', 'msds']),
    thickness_mm: suggest(['thickness', '두께']),
    gtin: suggest(['gtin', 'barcode', '바코드']),
  };
}

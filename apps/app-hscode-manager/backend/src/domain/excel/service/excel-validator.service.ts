import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { ALLOWED_UNITS, REQUIRED_COLUMNS, TEMPLATE_COLUMNS } from '../excel.constants';
import { ExcelRow, ExcelValidationResult, RowValidationError } from '../excel.types';

/** FN-031 — 엑셀 템플릿 검증 + 행별 오류 리포트 (FR-031/032). */
@Injectable()
export class ExcelValidatorService {
  async validate(buffer: Buffer): Promise<ExcelValidationResult> {
    const wb = new Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    const validRows: ExcelRow[] = [];
    const errors: RowValidationError[] = [];

    if (!ws) return { validRows, errors };

    // 1행 = 헤더 (우리 고정 템플릿)
    const header = ws.getRow(1);
    const colIndex = new Map<string, number>();
    for (let c = 1; c <= header.cellCount; c += 1) {
      const key = String(header.getCell(c).text ?? '').trim().toLowerCase();
      if (key) colIndex.set(key, c);
    }

    const allowedUnits = new Set<string>(ALLOWED_UNITS);

    for (let r = 2; r <= ws.rowCount; r += 1) {
      const row = ws.getRow(r);
      const get = (col: string): string => {
        const idx = colIndex.get(col);
        return idx ? String(row.getCell(idx).text ?? '').trim() : '';
      };

      const values: Record<string, string> = {};
      for (const col of TEMPLATE_COLUMNS) values[col] = get(col);

      if (Object.values(values).every((v) => v === '')) continue; // 빈 행 스킵

      let rowHasError = false;
      for (const col of REQUIRED_COLUMNS) {
        if (!values[col]) {
          errors.push({ row: r, col, reason: `required column '${col}' is empty` });
          rowHasError = true;
        }
      }
      if (values.unit && !allowedUnits.has(values.unit.toUpperCase())) {
        errors.push({
          row: r,
          col: 'unit',
          reason: `unit '${values.unit}' undefined → choose ${ALLOWED_UNITS.join('/')}`,
        });
        rowHasError = true;
      }

      if (!rowHasError) {
        validRows.push({
          rowNo: r,
          name: values.name,
          material: values.material || undefined,
          usage: values.usage || undefined,
          processing: values.processing || undefined,
          origin: values.origin || undefined,
          unit: values.unit || undefined,
        });
      }
    }

    return { validRows, errors };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export interface ExcelRow {
  rowNum: number;
  cells: Record<string, unknown>;
}

@Injectable()
export class ExcelParserService {
  private readonly logger = new Logger(ExcelParserService.name);

  /**
   * 엑셀 버퍼 → 행 배열 반환
   * headerRow: 헤더가 있는 행 번호 (기본 11 — CR Truck 프로파일)
   * dataStartRow: 데이터 시작 행 (기본 12)
   */
  async parse(
    buffer: Buffer,
    headerRow = 11,
    dataStartRow = 12,
  ): Promise<{ headers: string[]; rows: ExcelRow[] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('No worksheet found');

    // 헤더 추출
    const headerCells = sheet.getRow(headerRow);
    const headers: string[] = [];
    headerCells.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value || '').trim().toUpperCase();
    });

    // 데이터 행 추출
    const rows: ExcelRow[] = [];
    for (let r = dataStartRow; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const cells: Record<string, unknown> = {};
      let hasData = false;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const key = headers[colNumber - 1] || `COL_${colNumber}`;
        let val = cell.value;

        // ExcelJS rich text 처리
        if (val && typeof val === 'object' && 'richText' in (val as unknown as Record<string, unknown>)) {
          val = ((val as unknown as { richText: Array<{ text: string }> }).richText)
            .map((t) => t.text)
            .join('');
        }
        cells[key] = val;
        if (val != null && val !== '') hasData = true;
      });

      // 합계행/빈행 스킵
      if (!hasData) continue;
      const noVal = cells['NO'];
      if (noVal && String(noVal).toLowerCase().includes('total')) continue;

      rows.push({ rowNum: r, cells });
    }

    this.logger.log(`Parsed ${rows.length} data rows from sheet "${sheet.name}"`);
    return { headers, rows };
  }
}

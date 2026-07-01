import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { RowResult } from '../excel.types';

/** FR-034 — 분류 결과 워크북 생성 (입력 + HS/신뢰도/상태 컬럼 추가). */
@Injectable()
export class ExcelExportService {
  async buildResults(results: RowResult[]): Promise<Buffer> {
    const wb = new Workbook();
    const ws = wb.addWorksheet('results');
    ws.addRow(['row', 'name', 'hs_code', 'hs6', 'confidence', 'status']);
    for (const r of results) {
      ws.addRow([r.rowNo, r.name, r.hsCode, r.hs6, r.confidence, r.status]);
    }
    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out);
  }
}

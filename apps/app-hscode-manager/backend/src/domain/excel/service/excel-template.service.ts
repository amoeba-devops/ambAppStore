import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { TEMPLATE_COLUMNS } from '../excel.constants';

/** FR-035 — 빈 입력 템플릿 생성 + FR-034 결과 워크북 생성. */
@Injectable()
export class ExcelTemplateService {
  async buildTemplate(): Promise<Buffer> {
    const wb = new Workbook();
    const ws = wb.addWorksheet('template');
    ws.addRow([...TEMPLATE_COLUMNS]);
    ws.addRow(['NBR oil seal', 'NBR rubber', 'engine', 'finished', 'R.KOREA', 'PIECES']);
    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out);
  }
}

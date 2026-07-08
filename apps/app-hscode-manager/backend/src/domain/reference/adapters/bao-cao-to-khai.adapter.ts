import { Injectable } from '@nestjs/common';
import {
  AdapterParseResult,
  cell,
  ImportAdapter,
  NormalizedReferenceRow,
  toHs6,
} from './import-adapter.interface';

/**
 * 선언(declaration)-레벨 변형. 표준과 컬럼 명칭/구성이 일부 다름 (예: OKIA).
 * 정확한 컬럼 매핑은 실제 파일 확보 후 보강 [TBD] (분석서 Open Q #6).
 */
@Injectable()
export class BaoCaoToKhaiAdapter implements ImportAdapter {
  readonly formatType = 'BaoCaoToKhai';

  detect(headers: string[]): boolean {
    const set = new Set(headers.map((h) => h.trim().toLowerCase()));
    // 선언 레벨: 'Số tờ khai'(declaration no.) 존재 + HS 컬럼 보유
    return set.has('số tờ khai') && (set.has('mã hs') || set.has('mã số hàng hóa'));
  }

  parse(rows: Record<string, unknown>[], sourceCompany: string | null): AdapterParseResult {
    const out: NormalizedReferenceRow[] = [];
    let failed = 0;

    for (const row of rows) {
      const hsCode = cell(row, 'Mã HS', 'Mã số hàng hóa', 'Ma HS');
      const description = cell(row, 'Mô tả hàng hóa', 'Tên hàng', 'Tên hàng hóa');
      if (!hsCode || !description) {
        failed += 1;
        continue;
      }
      out.push({
        hsCode,
        hs6: toHs6(hsCode),
        description,
        origin: cell(row, 'Xuất xứ', 'Nước xuất xứ'),
        unit: cell(row, 'Đơn vị tính', 'Đơn vị'),
        unitPrice: cell(row, 'Đơn giá', 'Trị giá'),
        tradeType: cell(row, 'Mã loại hình', 'Loại hình'),
        sourceCompany,
      });
    }
    return { rows: out, failed };
  }
}

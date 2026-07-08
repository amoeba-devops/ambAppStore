import { Injectable } from '@nestjs/common';
import {
  AdapterParseResult,
  cell,
  ImportAdapter,
  NormalizedReferenceRow,
  toHs6,
} from './import-adapter.interface';

/**
 * 표준 면장리스트 형식 (goods-detail). 헤더에 `Mã HS` + `Tên hàng` 보유.
 * 코퍼스 27개 중 26개가 이 레이아웃. (FN-040 / FR-040)
 */
@Injectable()
export class BaoCaoHangChiTietAdapter implements ImportAdapter {
  readonly formatType = 'BaoCaoHangChiTiet';

  detect(headers: string[]): boolean {
    const set = new Set(headers.map((h) => h.trim().toLowerCase()));
    return set.has('mã hs') && (set.has('tên hàng') || set.has('tên hàng hóa'));
  }

  parse(rows: Record<string, unknown>[], sourceCompany: string | null): AdapterParseResult {
    const out: NormalizedReferenceRow[] = [];
    let failed = 0;

    for (const row of rows) {
      const hsCode = cell(row, 'Mã HS', 'Ma HS', 'mã hs');
      const description = cell(row, 'Tên hàng', 'Tên hàng hóa', 'Ten hang');
      if (!hsCode || !description) {
        failed += 1;
        continue;
      }
      out.push({
        hsCode,
        hs6: toHs6(hsCode),
        description,
        origin: cell(row, 'Xuất xứ', 'Xuat xu'),
        unit: cell(row, 'Đơn vị tính', 'Đơn vị', 'Don vi tinh'),
        unitPrice: cell(row, 'Đơn giá', 'Don gia'),
        tradeType: cell(row, 'Mã loại hình', 'Ma loai hinh'),
        sourceCompany,
      });
    }
    return { rows: out, failed };
  }
}

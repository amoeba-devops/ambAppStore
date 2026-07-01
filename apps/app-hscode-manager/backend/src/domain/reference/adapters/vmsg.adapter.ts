import { Injectable } from '@nestjs/common';
import {
  AdapterParseResult,
  cell,
  ImportAdapter,
  NormalizedReferenceRow,
  toHs6,
} from './import-adapter.interface';

/**
 * VMSG 커스텀 리스트 — 비표준 레이아웃. 헤더가 영문/혼합일 수 있음.
 * 정확한 컬럼 매핑은 실제 파일 확보 후 보강 [TBD]. 미감지 시 dispatcher가 'OTHER'로 처리.
 */
@Injectable()
export class VmsgAdapter implements ImportAdapter {
  readonly formatType = 'VMSG';

  detect(headers: string[]): boolean {
    const set = new Set(headers.map((h) => h.trim().toLowerCase()));
    return set.has('hs code') || (set.has('hscode') && set.has('description'));
  }

  parse(rows: Record<string, unknown>[], sourceCompany: string | null): AdapterParseResult {
    const out: NormalizedReferenceRow[] = [];
    let failed = 0;

    for (const row of rows) {
      const hsCode = cell(row, 'HS Code', 'HSCode', 'Mã HS');
      const description = cell(row, 'Description', 'Product Name', 'Tên hàng');
      if (!hsCode || !description) {
        failed += 1;
        continue;
      }
      out.push({
        hsCode,
        hs6: toHs6(hsCode),
        description,
        origin: cell(row, 'Origin', 'Country', 'Xuất xứ'),
        unit: cell(row, 'Unit', 'UOM', 'Đơn vị tính'),
        unitPrice: cell(row, 'Unit Price', 'Price'),
        tradeType: cell(row, 'Trade Type', 'Type'),
        sourceCompany,
      });
    }
    return { rows: out, failed };
  }
}

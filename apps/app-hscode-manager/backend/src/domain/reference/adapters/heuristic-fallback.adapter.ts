import { Injectable } from '@nestjs/common';
import {
  AdapterParseResult,
  ImportAdapter,
  NormalizedReferenceRow,
  toHs6,
} from './import-adapter.interface';

/** HS 코드 컬럼 후보 헤더 토큰 (ko/en/vi). */
const HS_TOKENS = [
  'mã hs',
  'ma hs',
  'hs code',
  'hscode',
  'hs',
  'mã số hàng hóa',
  'mã số',
  '세번',
  '세번부호',
  'hs코드',
  'hs 코드',
  'hs번호',
  'tariff',
];

/** 품명(설명) 컬럼 후보 헤더 토큰 (ko/en/vi). */
const DESC_TOKENS = [
  'tên hàng',
  'tên hàng hóa',
  'ten hang',
  'mô tả',
  '품명',
  '품목',
  '상품',
  '품목명',
  '내용',
  '규격',
  'description',
  'desc',
  'name',
  'product',
  'goods',
];

const ORIGIN_TOKENS = ['xuất xứ', 'xuat xu', '원산지', 'origin', 'country'];
const UNIT_TOKENS = ['đơn vị', 'don vi', '단위', 'unit'];

/**
 * 휴리스틱 폴백 어댑터 (BUG-260710 #3) — 특정 형식 어댑터가 모두 실패했을 때,
 * 임의 양식 면장에서 **HS 코드 컬럼 + 품명 컬럼을 추론**해 정규화 적재한다.
 * 어댑터 목록의 **마지막**에 배치(특정 형식 우선). ko/en/vi 헤더 지원.
 */
@Injectable()
export class HeuristicFallbackAdapter implements ImportAdapter {
  readonly formatType = 'Heuristic';

  /** HS 유사 컬럼 + 품명 유사 컬럼이 모두 있으면 처리 가능. */
  detect(headers: string[]): boolean {
    const lower = headers.map((h) => h.trim().toLowerCase());
    return this.findKey(lower, HS_TOKENS) >= 0 && this.findKey(lower, DESC_TOKENS) >= 0;
  }

  parse(rows: Record<string, unknown>[], sourceCompany: string | null): AdapterParseResult {
    if (rows.length === 0) return { rows: [], failed: 0 };
    const keys = Object.keys(rows[0]);
    const lowerKeys = keys.map((k) => k.trim().toLowerCase());

    const hsIdx = this.findKey(lowerKeys, HS_TOKENS);
    const descIdx = this.findKey(lowerKeys, DESC_TOKENS);
    const originIdx = this.findKey(lowerKeys, ORIGIN_TOKENS);
    const unitIdx = this.findKey(lowerKeys, UNIT_TOKENS);
    if (hsIdx < 0 || descIdx < 0) return { rows: [], failed: rows.length };

    const hsKey = keys[hsIdx];
    const descKey = keys[descIdx];
    const originKey = originIdx >= 0 ? keys[originIdx] : null;
    const unitKey = unitIdx >= 0 ? keys[unitIdx] : null;

    const out: NormalizedReferenceRow[] = [];
    let failed = 0;
    for (const row of rows) {
      const rawHs = String(row[hsKey] ?? '').trim();
      const hsCode = rawHs.replace(/\D/g, ''); // 숫자만
      const description = String(row[descKey] ?? '').trim();
      // HS는 최소 6자리 숫자, 품명은 비어있지 않아야 유효.
      if (hsCode.length < 6 || !description) {
        failed += 1;
        continue;
      }
      out.push({
        hsCode,
        hs6: toHs6(hsCode),
        description,
        origin: originKey ? String(row[originKey] ?? '').trim() || null : null,
        unit: unitKey ? String(row[unitKey] ?? '').trim() || null : null,
        unitPrice: null,
        tradeType: null,
        sourceCompany,
      });
    }
    return { rows: out, failed };
  }

  /** 토큰 우선순위 매칭(정확 → 포함). 인덱스 반환, 없으면 -1. */
  private findKey(lowerKeys: string[], tokens: string[]): number {
    for (const tok of tokens) {
      const idx = lowerKeys.findIndex((k) => k === tok);
      if (idx >= 0) return idx;
    }
    for (const tok of tokens) {
      const idx = lowerKeys.findIndex((k) => k.includes(tok));
      if (idx >= 0) return idx;
    }
    return -1;
  }
}

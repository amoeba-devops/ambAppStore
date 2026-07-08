/** 어댑터가 공통 스키마로 정규화한 참조 행 (→ hsm_hs_references) */
export interface NormalizedReferenceRow {
  hsCode: string; // 8~10 digit as declared
  hs6: string; // first 6 digits
  description: string; // Tên hàng
  origin: string | null; // Xuất xứ
  unit: string | null; // Đơn vị tính
  unitPrice: string | null; // Đơn giá
  tradeType: string | null; // Mã loại hình
  sourceCompany: string | null;
}

export interface AdapterParseResult {
  rows: NormalizedReferenceRow[];
  failed: number; // 파싱 실패(필수값 누락 등) 행 수
}

/** 면장리스트 다형식 import 어댑터 (FN-040) */
export interface ImportAdapter {
  readonly formatType: string;
  /** 헤더 집합으로 형식 자동 감지 */
  detect(headers: string[]): boolean;
  /** 헤더 키 기반 행 배열을 공통 스키마로 정규화 */
  parse(rows: Record<string, unknown>[], sourceCompany: string | null): AdapterParseResult;
}

/** HS코드 문자열에서 숫자 6자리(HS6) 추출 */
export function toHs6(hsCode: string): string {
  const digits = (hsCode ?? '').replace(/\D/g, '');
  return digits.slice(0, 6);
}

/** 셀 값을 trim된 문자열로 (빈값은 null) */
export function cell(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  return null;
}

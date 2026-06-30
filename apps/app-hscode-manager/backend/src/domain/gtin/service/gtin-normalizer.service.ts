import { Injectable } from '@nestjs/common';

export interface GtinNormalizeResult {
  gtin14: string;
  valid: boolean;
}

/**
 * FN-010/011 — GTIN-8/12/13/14 → 14자리 정규화 + modulo-10 체크디지트 검증.
 * 가중치 우측부터 3,1,3,1… · calc = (10 - (sum % 10)) % 10.
 */
@Injectable()
export class GtinNormalizerService {
  normalize(raw: string): GtinNormalizeResult {
    const digits = (raw ?? '').replace(/\D/g, '');
    if (![8, 12, 13, 14].includes(digits.length)) {
      return { gtin14: digits.padStart(14, '0'), valid: false };
    }
    const gtin14 = digits.padStart(14, '0');
    return { gtin14, valid: this.isCheckDigitValid(gtin14) };
  }

  private isCheckDigitValid(gtin14: string): boolean {
    if (gtin14.length !== 14 || !/^\d{14}$/.test(gtin14)) return false;
    const payload = gtin14.slice(0, 13);
    const checkDigit = Number(gtin14[13]);
    let sum = 0;
    for (let j = 0; j < 13; j += 1) {
      const digit = Number(payload[12 - j]);
      const weight = j % 2 === 0 ? 3 : 1; // 우측 첫 자리 가중치 3
      sum += digit * weight;
    }
    const calc = (10 - (sum % 10)) % 10;
    return calc === checkDigit;
  }
}

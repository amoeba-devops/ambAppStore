import { describe, expect, it } from 'vitest';
import { formatSkuMultiline } from './sku-format';

describe('formatSkuMultiline', () => {
  it('returns single-component SKU unchanged', () => {
    expect(formatSkuMultiline('SAFG20U0019')).toBe('SAFG20U0019');
  });

  it('returns 2-component combo SKU unchanged (fits on one line)', () => {
    expect(formatSkuMultiline('SAFG20U0019_SAFG20U0007')).toBe(
      'SAFG20U0019_SAFG20U0007',
    );
  });

  it('groups 2 components per line for 3+ component combos', () => {
    // The exact format the user requested in the session — pairs per line
    // with leading underscore preserved on wrap rows.
    expect(formatSkuMultiline('A_B_C')).toBe('A_B\n_C');
  });

  it('handles 5-component combo (real-world Socialbean example)', () => {
    const input = 'SAFG20U0020_SAFG20U0007_SAFG20U0008_SAFG20U0006_SAFG20U0005';
    const expected =
      'SAFG20U0020_SAFG20U0007\n_SAFG20U0008_SAFG20U0006\n_SAFG20U0005';
    expect(formatSkuMultiline(input)).toBe(expected);
  });
});

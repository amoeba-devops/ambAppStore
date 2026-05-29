import { describe, expect, it } from 'vitest';
import {
  buildColumnIndex,
  cell,
  detectHeader,
  looksLikeScientificNotation,
  parseBool,
  parseFlexibleDate,
  parseNumericLoose,
  stripExcelTextWrapper,
} from './csv-import';

describe('stripExcelTextWrapper', () => {
  it('unwraps `="..."` to the inner string', () => {
    expect(stripExcelTextWrapper('="243646783891"')).toBe('243646783891');
  });

  it('handles surrounding whitespace before unwrapping', () => {
    expect(stripExcelTextWrapper('   ="X"   ')).toBe('X');
  });

  it('leaves un-wrapped strings alone (only trims)', () => {
    expect(stripExcelTextWrapper('  hello  ')).toBe('hello');
  });

  it('does not strip when only one side has the wrapper', () => {
    expect(stripExcelTextWrapper('="incomplete')).toBe('="incomplete');
  });
});

describe('looksLikeScientificNotation', () => {
  it('matches Excel-mangled long numeric IDs', () => {
    expect(looksLikeScientificNotation('2.27886E+11')).toBe(true);
    expect(looksLikeScientificNotation('1.5e10')).toBe(true);
  });

  it('rejects plain integers', () => {
    expect(looksLikeScientificNotation('243646783891')).toBe(false);
  });

  it('rejects decimals without exponent', () => {
    expect(looksLikeScientificNotation('123.45')).toBe(false);
  });

  it('rejects free text', () => {
    expect(looksLikeScientificNotation('SAFG20U0001')).toBe(false);
  });
});

describe('parseNumericLoose', () => {
  it('parses Vietnamese-formatted thousands with dot separator', () => {
    // "137.000" must NOT be interpreted as 137 (JS Number quirk that
    // caused the prior production bug — root cause documented in
    // session memory).
    expect(parseNumericLoose('137.000')).toBe(137000);
  });

  it('parses US-formatted thousands with comma separator', () => {
    expect(parseNumericLoose('1,234,567')).toBe(1234567);
  });

  it('handles mixed comma + dot', () => {
    expect(parseNumericLoose('1.234,567')).toBe(1234567);
  });

  it('unwraps Excel text wrapper before parsing', () => {
    expect(parseNumericLoose('="500000"')).toBe(500000);
  });

  it('returns null for blank input', () => {
    expect(parseNumericLoose('')).toBeNull();
    expect(parseNumericLoose(undefined)).toBeNull();
  });

  it('returns null for non-numeric text', () => {
    expect(parseNumericLoose('abc')).toBeNull();
  });
});

describe('parseFlexibleDate', () => {
  it('passes canonical YYYY-MM-DD through unchanged', () => {
    expect(parseFlexibleDate('2026-05-08')).toBe('2026-05-08');
  });

  it('pads single-digit month/day in YYYY-MM-DD', () => {
    expect(parseFlexibleDate('2026-5-8')).toBe('2026-05-08');
  });

  it('parses ambiguous M/D/YYYY as US (Excel default on Windows)', () => {
    // 5/8/2026 — both ≤ 12, ambiguous. Excel on Windows interprets as
    // May 8 (US), not Aug 5 (VN). Match that.
    expect(parseFlexibleDate('5/8/2026')).toBe('2026-05-08');
  });

  it('detects D/M/YYYY when day > 12', () => {
    // 23/5/2026 — only valid as 23 May.
    expect(parseFlexibleDate('23/5/2026')).toBe('2026-05-23');
  });

  it('detects M/D/YYYY when day > 12', () => {
    expect(parseFlexibleDate('5/23/2026')).toBe('2026-05-23');
  });

  it('rejects out-of-range slash dates', () => {
    expect(parseFlexibleDate('15/13/2026')).toBeNull(); // both > 12
  });

  it('returns null for unparseable input', () => {
    expect(parseFlexibleDate('not a date')).toBeNull();
    expect(parseFlexibleDate('')).toBeNull();
  });
});

describe('parseBool', () => {
  it('truthy values', () => {
    expect(parseBool('1')).toBe(true);
    expect(parseBool('yes')).toBe(true);
    expect(parseBool('Y')).toBe(true);
    expect(parseBool('TRUE')).toBe(true);
    expect(parseBool('combo')).toBe(true);
  });

  it('falsy values', () => {
    expect(parseBool('0')).toBe(false);
    expect(parseBool('no')).toBe(false);
    expect(parseBool('N')).toBe(false);
    expect(parseBool('FALSE')).toBe(false);
  });

  it('returns null for blank / unknown (preserve DB value)', () => {
    expect(parseBool('')).toBeNull();
    expect(parseBool('  ')).toBeNull();
    expect(parseBool(undefined)).toBeNull();
    expect(parseBool('maybe')).toBeNull();
  });
});

describe('detectHeader', () => {
  it('detects canonical full-master header', () => {
    const row = ['Product ID', 'Variation ID', 'SKU', 'Prime Cost (VND)'];
    expect(detectHeader(row)).toBe(true);
  });

  it('detects prime-only field-specific header', () => {
    const row = ['SKU', 'Prime Cost (VND)', 'Effective From — Prime'];
    expect(detectHeader(row)).toBe(true);
  });

  it('detects selling-only field-specific header', () => {
    const row = ['SKU', 'Selling Price (VND)', 'Effective From — Selling'];
    expect(detectHeader(row)).toBe(true);
  });

  it('rejects data row that happens to contain digits', () => {
    expect(detectHeader(['SAFG20U0001', '500000', '2026-05-01'])).toBe(false);
  });

  it('detects when SKU appears in any case', () => {
    expect(detectHeader(['sku', 'price'])).toBe(true);
    expect(detectHeader(['SKU', 'PRICE'])).toBe(true);
  });
});

describe('buildColumnIndex', () => {
  it('maps every column name to its position when header is present', () => {
    const header = [
      'Product ID',
      'Variation ID',
      'Variation Name',
      'Product (VI)',
      'Product (EN)',
      'SKU',
      'GTIN',
      'HS Code',
      'Prime Cost (VND)',
    ];
    const idx = buildColumnIndex(header, true);
    expect(idx.productId).toBe(0);
    expect(idx.variationId).toBe(1);
    expect(idx.sku).toBe(5);
    expect(idx.gtin).toBe(6);
    expect(idx.hsCode).toBe(7);
    expect(idx.primeCost).toBe(8);
  });

  it('returns -1 for columns missing from a field-specific export', () => {
    // Selling-only CSV — no Prime Cost / Listing Price / GTIN / HS Code.
    const header = [
      'Product ID',
      'Variation ID',
      'Variation Name',
      'Product (VI)',
      'Product (EN)',
      'SKU',
      'Selling Price (VND)',
      'Effective From — Selling',
      'Is Combo',
      'Combo Component SKUs',
    ];
    const idx = buildColumnIndex(header, true);
    expect(idx.sellingPrice).toBe(6);
    expect(idx.primeCost).toBe(-1);
    expect(idx.listingPrice).toBe(-1);
    expect(idx.gtin).toBe(-1);
    expect(idx.hsCode).toBe(-1);
  });

  it('falls back to positional layout for legacy header-less CSV', () => {
    const idx = buildColumnIndex(['ignored'], false);
    expect(idx.productId).toBe(0);
    expect(idx.sku).toBe(5);
    expect(idx.primeCost).toBe(6);
    expect(idx.effPrime).toBe(9);
    expect(idx.gtin).toBe(-1); // GTIN added later, no positional slot
    expect(idx.hsCode).toBe(-1);
  });
});

describe('cell', () => {
  it('returns the cell at index when in range', () => {
    expect(cell(['a', 'b', 'c'], 1)).toBe('b');
  });

  it('returns undefined for -1 (column absent)', () => {
    expect(cell(['a', 'b'], -1)).toBeUndefined();
  });

  it('returns undefined for out-of-range index', () => {
    expect(cell(['a', 'b'], 5)).toBeUndefined();
  });
});

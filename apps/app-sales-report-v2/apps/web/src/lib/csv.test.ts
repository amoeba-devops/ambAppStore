import { describe, expect, it } from 'vitest';
import { buildCsv, escapeCsvField, parseCsv, toCsvRow } from './csv';

describe('escapeCsvField', () => {
  it('returns empty string for null / undefined', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('passes simple strings through unchanged', () => {
    expect(escapeCsvField('SAFG20U0001')).toBe('SAFG20U0001');
  });

  it('quotes fields containing comma', () => {
    expect(escapeCsvField('hello, world')).toBe('"hello, world"');
  });

  it('escapes embedded double quotes by doubling', () => {
    // Per RFC 4180 — "He said ""hi""" stays as one field.
    expect(escapeCsvField('He said "hi"')).toBe('"He said ""hi"""');
  });

  it('quotes fields with newline', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('quotes fields with carriage return', () => {
    expect(escapeCsvField('a\rb')).toBe('"a\rb"');
  });

  it('stringifies numbers without quoting', () => {
    expect(escapeCsvField(1234)).toBe('1234');
  });
});

describe('toCsvRow', () => {
  it('joins fields with commas', () => {
    expect(toCsvRow(['a', 'b', 'c'])).toBe('a,b,c');
  });

  it('quotes only the field that needs it', () => {
    expect(toCsvRow(['a', 'b, c', 'd'])).toBe('a,"b, c",d');
  });
});

describe('parseCsv', () => {
  it('parses a simple comma-separated single row', () => {
    expect(parseCsv('a,b,c')).toEqual([['a', 'b', 'c']]);
  });

  it('parses multiple rows separated by LF', () => {
    expect(parseCsv('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('parses CRLF line endings', () => {
    expect(parseCsv('a,b\r\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('handles quoted fields with commas', () => {
    expect(parseCsv('a,"b, c",d')).toEqual([['a', 'b, c', 'd']]);
  });

  it('handles escaped double-quote inside quoted field', () => {
    expect(parseCsv('a,"He said ""hi""",b')).toEqual([['a', 'He said "hi"', 'b']]);
  });

  it('handles quoted field with newline', () => {
    expect(parseCsv('a,"line1\nline2",c')).toEqual([['a', 'line1\nline2', 'c']]);
  });

  it('strips leading UTF-8 BOM', () => {
    expect(parseCsv('﻿a,b')).toEqual([['a', 'b']]);
  });

  it('parses empty fields as empty strings (not undefined)', () => {
    expect(parseCsv('a,,c')).toEqual([['a', '', 'c']]);
  });

  it('round-trips with buildCsv for a typical product list row', () => {
    const header = ['SKU', 'Product (VI)', 'Price'];
    const rows = [
      ['SAFG20U0001', 'Khay silicone, hồng san hô', 1500000],
      ['MBSD17U0019', 'Sản phẩm "đặc biệt"', 250000],
    ];
    const csv = buildCsv(header, rows);
    const parsed = parseCsv(csv);
    // Header + 2 rows, with numbers stringified.
    expect(parsed).toEqual([
      header,
      ['SAFG20U0001', 'Khay silicone, hồng san hô', '1500000'],
      ['MBSD17U0019', 'Sản phẩm "đặc biệt"', '250000'],
    ]);
  });
});

describe('buildCsv', () => {
  it('prepends UTF-8 BOM so Excel reads UTF-8 correctly', () => {
    const out = buildCsv(['x'], [['y']]);
    expect(out.charCodeAt(0)).toBe(0xfeff);
  });

  it('uses CRLF line separator for Excel compatibility', () => {
    const out = buildCsv(['a'], [['b']]);
    expect(out).toContain('\r\n');
  });
});

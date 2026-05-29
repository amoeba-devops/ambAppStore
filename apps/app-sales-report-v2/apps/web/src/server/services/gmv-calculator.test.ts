import { describe, expect, it } from 'vitest';
import {
  findListingPrice,
  findPrimeCost,
  findSellingPrice,
  type PrimeCostMaster,
} from './gmv-calculator.service';

/**
 * Three-tier version-resolution functions are the load-bearing piece of
 * SRD §5.5 "per-order pricing": each order line's prime cost / selling /
 * listing must be the version active AS OF that order's create_date — NOT
 * the latest version. Get this wrong and historical CM numbers shift
 * retroactively when admin adds a new version.
 *
 * Versions are passed in already DESC-sorted by `effectiveFrom` (matches
 * what `loadPrimeCostMaster` returns from the DB query). The functions
 * scan top-to-bottom and return the first row whose `effectiveFrom` is
 * <= the order date.
 */

const fixtureMaster = (overrides: Partial<PrimeCostMaster> = {}): PrimeCostMaster => ({
  primeCost: 200,
  sellingPrice: 500,
  listingPrice: 600,
  productNameEn: 'Test',
  variationName: '',
  isCombo: false,
  versions: [
    { effectiveFrom: '2026-05-01', primeCost: 200, breakdown: null },
    { effectiveFrom: '2026-03-01', primeCost: 150, breakdown: null },
    { effectiveFrom: '2026-01-01', primeCost: 100, breakdown: null },
  ],
  sellingVersions: [
    { effectiveFrom: '2026-05-01', valueVnd: 500 },
    { effectiveFrom: '2026-01-01', valueVnd: 400 },
  ],
  listingVersions: [
    { effectiveFrom: '2026-05-01', valueVnd: 600 },
    { effectiveFrom: '2026-01-01', valueVnd: 550 },
  ],
  ...overrides,
});

describe('findPrimeCost', () => {
  it('returns 0 when master is undefined (SKU not in cost master)', () => {
    expect(findPrimeCost(undefined, '2026-05-15')).toBe(0);
  });

  it('returns latest cached primeCost when orderDate is empty', () => {
    // Legacy Shopee files without "Ngày đặt hàng" column fall through to
    // master.primeCost (matches comment in gmv-calculator.service:71-74).
    expect(findPrimeCost(fixtureMaster(), '')).toBe(200);
  });

  it('returns latest cached primeCost when version list is empty', () => {
    const m = fixtureMaster({ primeCost: 999, versions: [] });
    expect(findPrimeCost(m, '2026-05-15')).toBe(999);
  });

  it('picks the version active for an order placed on the boundary date', () => {
    // Inclusive lower bound: effectiveFrom=2026-05-01 covers orders on 05/01.
    expect(findPrimeCost(fixtureMaster(), '2026-05-01')).toBe(200);
  });

  it('picks the middle version for an order between two boundaries', () => {
    expect(findPrimeCost(fixtureMaster(), '2026-04-15')).toBe(150);
  });

  it('picks the oldest version for an order on its boundary', () => {
    expect(findPrimeCost(fixtureMaster(), '2026-01-01')).toBe(100);
  });

  it('falls back to latest cached when orderDate is BEFORE oldest version', () => {
    // Best-effort fallback — historically every SKU has a sentinel
    // 1900-01-01 row from `loadPrimeCostMaster` so this branch is rarely
    // hit in practice, but the contract must hold.
    const cost = findPrimeCost(fixtureMaster({ primeCost: 200 }), '2025-12-01');
    expect(cost).toBe(200);
  });

  it('scans DESC by effectiveFrom — does NOT return the first array entry blindly', () => {
    // Defensive: ensure callers can't accidentally pass an
    // un-sorted array and get away with it. We DO assume DESC sort
    // (it's a documented precondition) — this test is here to flag
    // any future change that breaks scanning semantics.
    const m = fixtureMaster();
    // 2026-02-15 falls BEFORE the 2026-03-01 version starts, so the
    // 2026-01-01 version (100) is still the active one.
    expect(findPrimeCost(m, '2026-02-15')).toBe(100);
    // After 2026-05-01 → newest version active.
    expect(findPrimeCost(m, '2026-06-01')).toBe(200);
  });
});

describe('findSellingPrice', () => {
  it('returns 0 when master is undefined', () => {
    expect(findSellingPrice(undefined, '2026-05-15')).toBe(0);
  });

  it('returns cached sellingPrice when version list is empty', () => {
    // SKU exists in master but never had a selling-price version row →
    // calculator just uses the flat master value.
    const m = fixtureMaster({ sellingPrice: 777, sellingVersions: [] });
    expect(findSellingPrice(m, '2026-05-15')).toBe(777);
  });

  it('picks the active version by order date', () => {
    expect(findSellingPrice(fixtureMaster(), '2026-06-15')).toBe(500);
    expect(findSellingPrice(fixtureMaster(), '2026-03-15')).toBe(400);
  });
});

describe('findListingPrice', () => {
  it('returns 0 when master is undefined', () => {
    expect(findListingPrice(undefined, '2026-05-15')).toBe(0);
  });

  it('returns cached listingPrice when version list is empty', () => {
    const m = fixtureMaster({ listingPrice: 888, listingVersions: [] });
    expect(findListingPrice(m, '2026-05-15')).toBe(888);
  });

  it('picks the active version by order date', () => {
    expect(findListingPrice(fixtureMaster(), '2026-06-15')).toBe(600);
    expect(findListingPrice(fixtureMaster(), '2026-03-15')).toBe(550);
  });
});

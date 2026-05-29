import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the Drizzle client BEFORE importing the service. The service module
// constructs its query chain on every call, so we make the mock return an
// object that walks through .select().from().where().orderBy() and finally
// resolves with whatever `mockRows` is set to at test time.
let mockRows: Array<{ vndPerKrw: string | number }> = [];

vi.mock('@v2/db', () => {
  const chain = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    orderBy: () => Promise.resolve(mockRows),
  };
  return {
    db: chain,
    schema: { salFxRates: {} as Record<string, unknown> },
    withEnt: () => ({}),
  };
});

vi.mock('drizzle-orm', () => ({
  and: () => ({}),
  or: () => ({}),
  eq: () => ({}),
  desc: () => ({}),
  isNull: () => ({}),
  lte: () => ({}),
}));

import { getCurrentFxRate } from './fx-rate.service';
import { DEFAULT_VND_PER_KRW } from '@/lib/format';

describe('getCurrentFxRate', () => {
  beforeEach(() => {
    mockRows = [];
  });

  it('returns the first (latest) row when present', () => {
    mockRows = [{ vndPerKrw: '18.5000' }, { vndPerKrw: '17.5430' }];
    return getCurrentFxRate('ent-1').then((r) => expect(r).toBe(18.5));
  });

  it('returns DEFAULT_VND_PER_KRW when no rows match', async () => {
    mockRows = [];
    const r = await getCurrentFxRate('ent-1');
    expect(r).toBe(DEFAULT_VND_PER_KRW);
  });

  it('coerces string numeric value (Drizzle numeric column → string)', async () => {
    // PG NUMERIC always serialises as string through the driver.
    mockRows = [{ vndPerKrw: '17.5430' }];
    const r = await getCurrentFxRate('ent-1');
    expect(typeof r).toBe('number');
    expect(r).toBe(17.543);
  });
});

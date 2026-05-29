import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VND_PER_KRW,
  fmtCompact,
  fmtDate,
  fmtDateTime,
  fmtInt,
  fmtKRW,
  fmtPct,
  fmtTime,
  fmtVND,
  vndToKrw,
  wowDisplay,
} from './format';

describe('DEFAULT_VND_PER_KRW', () => {
  it('matches SRD §5.5 canonical rate (17.543, NOT 17,543)', () => {
    // Regression guard against the magnitude bug that lived in Weekly/Monthly
    // report for months (DEFAULT_KRW_RATE = 17543). If this assertion ever
    // changes, audit every KRW display site — the rate is a load-bearing
    // constant for cross-component display consistency.
    expect(DEFAULT_VND_PER_KRW).toBe(17.543);
  });
});

describe('vndToKrw', () => {
  it('divides VND by the default rate when no override passed', () => {
    // 17,543 VND / 17.543 VND-per-KRW = 1,000 KRW exactly.
    expect(vndToKrw(17543)).toBeCloseTo(1000, 2);
  });

  it('uses caller-supplied rate when provided', () => {
    expect(vndToKrw(20000, 20)).toBe(1000);
  });

  it('produces sensible KRW for realistic prime cost (1M VND ≈ 57K KRW)', () => {
    // 1,000,000 / 17.543 = 57003.36... Catches the 1000x magnitude
    // regression where DEFAULT was 17543 and this would have returned 57.
    expect(Math.round(vndToKrw(1_000_000))).toBe(57_003);
  });
});

describe('fmtDate (DD/MM/YYYY)', () => {
  it('formats an ISO date string with day/month padded', () => {
    expect(fmtDate('2026-05-08')).toBe('08/05/2026');
  });

  it('formats a Date instance the same way', () => {
    expect(fmtDate(new Date(2026, 4, 8))).toBe('08/05/2026');
  });

  it('returns em-dash for null / undefined', () => {
    expect(fmtDate(null)).toBe('—');
    expect(fmtDate(undefined)).toBe('—');
  });

  it('returns em-dash for unparseable input', () => {
    expect(fmtDate('not-a-date')).toBe('—');
  });
});

describe('fmtTime (HH:MM:SS)', () => {
  it('formats local time with zero-padded fields', () => {
    expect(fmtTime(new Date(2026, 0, 1, 9, 5, 3))).toBe('09:05:03');
  });

  it('returns empty string for null', () => {
    expect(fmtTime(null)).toBe('');
  });
});

describe('fmtDateTime', () => {
  it('combines date + time with space separator', () => {
    const d = new Date(2026, 4, 8, 15, 38, 44);
    expect(fmtDateTime(d)).toBe('08/05/2026 15:38:44');
  });
});

describe('fmtVND', () => {
  it('rounds and uses vi-VN thousand separator + ₫ suffix', () => {
    expect(fmtVND(1234567)).toBe('1.234.567 ₫');
  });

  it('returns em-dash for null', () => {
    expect(fmtVND(null)).toBe('—');
  });
});

describe('fmtKRW', () => {
  it('rounds and uses ko-KR thousand separator + ₩ prefix', () => {
    expect(fmtKRW(1234567)).toBe('₩1,234,567');
  });
});

describe('fmtPct', () => {
  it('multiplies ratio by 100 and appends %', () => {
    expect(fmtPct(0.1234)).toBe('12.34%');
  });

  it('respects decimals argument', () => {
    expect(fmtPct(0.5, 0)).toBe('50%');
  });

  it('handles null / NaN', () => {
    expect(fmtPct(null)).toBe('—');
    expect(fmtPct(NaN)).toBe('—');
  });
});

describe('fmtInt', () => {
  it('rounds and uses vi-VN locale grouping', () => {
    expect(fmtInt(1234567)).toBe('1.234.567');
  });
});

describe('fmtCompact', () => {
  it('B for billions', () => {
    expect(fmtCompact(1_500_000_000)).toBe('1.5B');
  });
  it('M for millions, dropping trailing zeros', () => {
    expect(fmtCompact(2_000_000)).toBe('2M');
  });
  it('K for thousands', () => {
    expect(fmtCompact(7_800)).toBe('7.8K');
  });
  it('plain integer below thousand', () => {
    expect(fmtCompact(123)).toBe('123');
  });
  it('preserves sign on negatives', () => {
    expect(fmtCompact(-1_500_000)).toBe('-1.5M');
  });
});

describe('wowDisplay', () => {
  it('returns first-period sentinel when prev is null', () => {
    const r = wowDisplay(100, null);
    expect(r.display).toBe('----');
    expect(r.variant).toBe('first');
  });

  it('returns N/A when previous was zero (per SRD §5.5)', () => {
    const r = wowDisplay(100, 0);
    expect(r.display).toBe('N/A');
    expect(r.variant).toBe('na');
  });

  it('marks a positive change with + sign and "positive" variant', () => {
    const r = wowDisplay(120, 100);
    expect(r.display).toBe('+20.00%');
    expect(r.variant).toBe('positive');
  });

  it('marks a negative change with "negative" variant', () => {
    const r = wowDisplay(80, 100);
    expect(r.display).toBe('-20.00%');
    expect(r.variant).toBe('negative');
  });

  it('zero change is neutral', () => {
    const r = wowDisplay(100, 100);
    expect(r.display).toBe('0.00%');
    expect(r.variant).toBe('neutral');
  });

  it('uses absolute value of prev for denominator (handles negative prev)', () => {
    // Used for CM which can swing across zero. WoW of -50 vs -100 should
    // be +50% (improvement toward zero), not -50%.
    const r = wowDisplay(-50, -100);
    expect(r.display).toBe('+50.00%');
    expect(r.variant).toBe('positive');
  });
});

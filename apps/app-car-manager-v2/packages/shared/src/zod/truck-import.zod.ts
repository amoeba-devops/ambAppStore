import { z } from 'zod';

/**
 * Column order of the import template (18). The labels themselves now come from
 * i18n (`columns.truck`, REQ-20260824) so the template, the import mapper, the
 * trip list and the export all print the SAME word for the same thing; this
 * array only fixes the ORDER, which old files rely on.
 */
export const TRUCK_TEMPLATE_ORDER = [
  'date', 'vehicleHint', 'startTime', 'endTime', 'customer', 'pickup', 'stopover', 'dropoff',
  'odoStart', 'odoEnd', 'fuelLiters', 'fuelPrice', 'toll', 'otherAmount', 'otherNote',
  'bol', 'cdf', 'revenue',
] as const;
export type TruckTemplateColumn = (typeof TRUCK_TEMPLATE_ORDER)[number];

/**
 * Header aliases used to auto-map an uploaded sheet onto the import fields.
 *
 * Must cover EVERY wording a real file can carry, not just today's template:
 * the canonical labels in all three languages, plus the legacy wording shipped
 * before REQ-20260824 (old templates and old exports are still out there).
 * Matching is substring, case-insensitive, on the lower-cased header.
 *
 * `not` is a veto list — a header containing one of those never matches that
 * field. It exists because "Phí nhiên liệu" (money) used to be picked up as
 * "Lượng nhiên liệu" (litres), so an export re-imported charged the fuel COST
 * as a litre count.
 */
export const TRUCK_IMPORT_ALIASES: Record<string, { any: string[]; not?: string[] }> = {
  date: { any: ['ngày', 'date', '날짜'] },
  start_time: { any: ['giờ bắt đầu', 'giờ bđ', 'giờ đi', 'start time', 'start', '시작 시간', '출발 시각'], not: ['odo', '주행'] },
  end_time: { any: ['giờ kết thúc', 'giờ kt', 'giờ về', 'end time', 'end', '종료 시간', '종료 시각'], not: ['odo', '주행'] },
  customer: { any: ['khách', 'customer', '고객'] },
  pickup: { any: ['điểm lấy', 'nơi lấy', 'lấy hàng', 'xuất phát', 'điểm đi', 'pickup', 'from', '상차'] },
  stopover: { any: ['điểm ghé', 'ghé', 'waypoint', 'stopover', '경유'] },
  dropoff: { any: ['điểm giao', 'nơi giao', 'giao hàng', 'điểm đến', 'drop-off', 'dropoff', '하차'] },
  odo_start: { any: ['km đầu', 'đồng hồ đầu', 'odo đầu', 'start odo', 'odo start', '시작 주행', '시작 odo'] },
  odo_end: { any: ['km cuối', 'đồng hồ cuối', 'odo cuối', 'end odo', 'odo end', '종료 주행', '종료 odo'] },
  /* Litres — never the money column. */
  fuel_liters: {
    any: ['lượng nhiên liệu', 'lượng dầu', 'nhiên liệu (l)', 'số lít', 'lít', 'litre', 'liter', 'fuel (l)', '주유량', '연료(l)'],
    not: ['phí', 'chi phí', 'cost', '비용', '연료비', '유류비'],
  },
  fuel_price: { any: ['đơn giá', 'giá dầu', 'unit price', 'fuel unit', '단가', '유가'] },
  toll: { any: ['cầu đường', 'toll', '통행료'] },
  other_amount: { any: ['chi phí phát sinh', 'chi phí khác', 'phát sinh khác', 'phí khác', 'other cost', 'other fee', '기타 비용'], not: ['ghi chú', 'note', 'tên', 'name', '명목', '메모'] },
  other_note: { any: ['ghi chú phát sinh', 'ghi chú chi phí', 'tên phí', 'tên khoản phí', 'other note', 'fee name', '기타 메모', '기타 비용 명목'] },
  bol: { any: ['bol', 'vận đơn', 'bill'] },
  cdf: { any: ['cdf'] },
  revenue: { any: ['doanh thu', 'revenue', 'selling', '매출'], not: ['tháng', 'month'] },
};

/**
 * @deprecated Kept so an existing caller still compiles; the template route now
 * builds its header row from i18n. Vietnamese labels as shipped before
 * REQ-20260824 — also serves as documentation of the legacy file layout.
 */
export const TRUCK_IMPORT_HEADERS = [
  'Ngày',
  'Xe (biển số)',
  'Giờ bắt đầu',
  'Giờ kết thúc',
  'Khách hàng',
  'Điểm lấy hàng',
  'Điểm ghé',
  'Điểm giao hàng',
  'Km đầu',
  'Km cuối',
  'Lượng nhiên liệu (L)',
  'Đơn giá (đ/L)',
  'Phí cầu đường',
  'Chi phí khác',
  'Ghi chú chi phí khác',
  'Số BOL',
  'Số CDF',
  'Doanh thu',
] as const;

/**
 * An Excel date cell → `YYYY-MM-DD`, or null when it can't be read (BUG-260824).
 * Shared by the import UI (normalises before sending) and the server action
 * (rejects anything that still isn't a date instead of crashing on it).
 *
 * Three shapes reach us, and two of them used to be wrong:
 *  - a real Date, which `xlsx` builds at LOCAL midnight (`cellDates: true`).
 *    Reading it back with `toISOString()` shifted every date one day BACK in
 *    any positive-offset zone — 24/08 imported as 23/08 in GMT+7 — silently.
 *    Local components are what the user typed, in every zone.
 *  - text, when the column is formatted as Text or typed with a leading quote.
 *    `new Date('24/08/2026')` is Invalid Date → the action blew up with
 *    CAR-E0500. Vietnamese `dd/MM/yyyy` (also `-` and `.`) is read day-first,
 *    matching the template's own locale; ISO is passed through.
 *  - a raw serial number, when a date column is stored unformatted (days since
 *    1899-12-30, Excel's epoch, with its 1900 leap-year quirk baked in).
 */
export function parseImportDate(value: unknown): string | null {
  if (value == null || value === '') return null;

  const iso = (y: number, m: number, d: number): string | null => {
    if (!Number.isFinite(y) || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const probe = new Date(Date.UTC(y, m - 1, d));
    /* Rejects 31/02 and friends — Date would roll them over silently. */
    if (probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return iso(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    /* Excel serial → UTC ms. Epoch 1899-12-30 absorbs the phantom 1900-02-29. */
    const ms = Math.round(value) * 86400000 + Date.UTC(1899, 11, 30);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  const s = String(value).trim();
  if (s === '') return null;
  /* ISO first (optionally followed by a time), then day-first text. */
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
  if (isoMatch) return iso(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/.exec(s);
  if (dmy) {
    const yy = Number(dmy[3]);
    return iso(yy < 100 ? 2000 + yy : yy, Number(dmy[2]), Number(dmy[1]));
  }
  return null;
}

/**
 * A number cell → JS number, or undefined when there's nothing usable
 * (BUG-260824). A numeric cell arrives as a number and passes straight through;
 * the work here is TEXT cells, which is what a Text-formatted column or a
 * pasted value produces.
 *
 * Vietnamese Excel writes `2.500.000` and `10,5` — dot groups thousands, comma
 * is the decimal mark — the exact opposite of the en-US convention JS `Number`
 * assumes. Reading them naively turned `25.000` đ/L into `25`, `10,5` L into
 * `105`, and `2.500.000` into NaN → the field was silently dropped.
 *
 * Rules, applied to whichever separators are present:
 *  - both `.` and `,` → the LAST one is the decimal mark (`1.234,5` = `1,234.5`);
 *  - one separator, more than two groups → thousands (`2.500.000`);
 *  - one separator, exactly 3 digits after it → thousands (`25.000` = 25000).
 *    This is the vi convention; `25.000` as "twenty-five point zero" does not
 *    occur in these columns (money in đồng, litres to 1–2 decimals);
 *  - otherwise → decimal mark (`10,5` = 10.5, `25.75` = 25.75).
 */
export function parseImportNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;

  let s = String(value).trim();
  if (s === '') return undefined;
  const negative = /^[-(]/.test(s);
  /* Strip sign, spaces (incl. NBSP from Excel) and a đồng symbol. */
  s = s.replace(/^[-+(]|\)$/g, '').replace(/[\s ₫]/g, '');
  if (!/^\d[\d.,]*$/.test(s)) return undefined;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? '.' : ',';
    const thousands = dec === '.' ? /,/g : /\./g;
    normalized = s.replace(thousands, '').replace(dec, '.');
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const parts = s.split(sep);
    const tail = parts[parts.length - 1] ?? '';
    const isThousands = parts.length > 2 || tail.length === 3;
    normalized = isThousands ? parts.join('') : `${parts.slice(0, -1).join('')}.${tail}`;
  } else {
    normalized = s;
  }
  const n = Number(normalized);
  if (!Number.isFinite(n)) return undefined;
  return negative ? -n : n;
}

/** One normalized import row (client maps the sheet → these fields). */
export const truckImportRowSchema = z.object({
  date: z.string().min(1),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  customer: z.string().optional(),
  pickup: z.string().optional(),
  stopover: z.string().optional(),
  dropoff: z.string().optional(),
  odo_start: z.number().int().nonnegative().optional(),
  odo_end: z.number().int().nonnegative().optional(),
  fuel_liters: z.number().nonnegative().optional(),
  fuel_price: z.number().nonnegative().optional(),
  toll: z.number().nonnegative().optional(),
  other_amount: z.number().nonnegative().optional(),
  other_note: z.string().optional(),
  bol: z.string().optional(),
  cdf: z.string().optional(),
  revenue: z.number().nonnegative().optional(),
});
export type TruckImportRow = z.infer<typeof truckImportRowSchema>;

export const importTruckTripsSchema = z.object({
  vehicle_id: z.string().uuid(),
  driver_id: z.string().uuid(),
  file_name: z.string().trim().min(1).max(255),
  rows: z.array(truckImportRowSchema).min(1).max(500),
});
export type ImportTruckTripsInput = z.infer<typeof importTruckTripsSchema>;

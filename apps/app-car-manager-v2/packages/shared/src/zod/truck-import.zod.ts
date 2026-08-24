import { z } from 'zod';

/**
 * Truck Excel import (REQ-20260617, format CR-Vietnam-Truck-v1).
 * Template column order (18). The Vehicle column is informational — the actual
 * truck + driver are chosen in the import UI (one file = one truck per the SRS).
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

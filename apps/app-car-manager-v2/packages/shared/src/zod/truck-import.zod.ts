import { z } from 'zod';

/**
 * ONE column layout for the truck trip-log sheet, shared by the export
 * (`/truck/trips/export`) and the import template (`/truck/import/template`)
 * so the two can't drift apart again (BUG-261015: the template lacked the 4
 * fixed fees of REQ-20260916 and the trip note, ran in a different order and
 * printed money columns without their unit).
 *
 * `key`  = label key in i18n `columns.truck` (REQ-20260824 glossary).
 * `unit` = unit key in `columns.truck`, printed as "Label (unit)".
 * `input: false` = computed or system-assigned (ref, totals, status) — export
 *   only. Every other column is in the template, same order, same label.
 *   `vehicle` / `driver` stay in the template for reference only: the import
 *   screen picks one truck + driver for the whole file.
 */
export const TRUCK_TRIP_SHEET_COLUMNS = [
  { key: 'ref', input: false },
  { key: 'date' },
  { key: 'vehicle' },
  { key: 'driver' },
  { key: 'customer' },
  { key: 'bol' },
  { key: 'cdf' },
  { key: 'startTime' },
  { key: 'endTime' },
  { key: 'pickup' },
  { key: 'stopover' },
  { key: 'dropoff' },
  { key: 'odoStart', unit: 'unitKm' },
  { key: 'odoEnd', unit: 'unitKm' },
  { key: 'kmTotal', input: false },
  { key: 'toll', unit: 'unitMoney' },
  { key: 'cleaning', unit: 'unitMoney' },
  { key: 'repair', unit: 'unitMoney' },
  { key: 'ferry', unit: 'unitMoney' },
  { key: 'loading', unit: 'unitMoney' },
  { key: 'otherAmount', unit: 'unitMoney' },
  { key: 'otherNote' },
  { key: 'fuelPrice', unit: 'unitPricePerL' },
  { key: 'fuelLiters', unit: 'unitLitre' },
  { key: 'fuelActualCost', unit: 'unitMoney', input: false },
  { key: 'revenue', unit: 'unitMoney' },
  { key: 'totalCost', input: false },
  { key: 'profit', input: false },
  { key: 'status', input: false },
  { key: 'notes' },
] as const satisfies readonly {
  key: string;
  unit?: 'unitKm' | 'unitMoney' | 'unitLitre' | 'unitPricePerL';
  input?: false;
}[];
export type TruckSheetColumn = (typeof TRUCK_TRIP_SHEET_COLUMNS)[number];

/**
 * Import-template columns, in order: the sheet layout minus export-only
 * columns. Also the positional fallback when an uploaded header row matches
 * nothing at all.
 */
export const TRUCK_TEMPLATE_COLUMNS = TRUCK_TRIP_SHEET_COLUMNS.filter(
  (c): c is Exclude<TruckSheetColumn, { input: false }> => !('input' in c),
);
export const TRUCK_TEMPLATE_ORDER = TRUCK_TEMPLATE_COLUMNS.map((c) => c.key);
export type TruckTemplateColumn = (typeof TRUCK_TEMPLATE_COLUMNS)[number]['key'];

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
  /* '상하차비' (loading fee) contains '하차' — keep it off the drop-off column. */
  dropoff: { any: ['điểm giao', 'nơi giao', 'giao hàng', 'điểm đến', 'drop-off', 'dropoff', '하차'], not: ['상하차'] },
  odo_start: { any: ['km đầu', 'đồng hồ đầu', 'odo đầu', 'start odo', 'odo start', '시작 주행', '시작 odo'] },
  odo_end: { any: ['km cuối', 'đồng hồ cuối', 'odo cuối', 'end odo', 'odo end', '종료 주행', '종료 odo'] },
  /* Litres — never the money column. */
  fuel_liters: {
    any: ['lượng nhiên liệu', 'lượng dầu', 'nhiên liệu (l)', 'số lít', 'lít', 'litre', 'liter', 'fuel (l)', '주유량', '연료(l)'],
    not: ['phí', 'chi phí', 'cost', '비용', '연료비', '유류비'],
  },
  fuel_price: { any: ['đơn giá', 'giá dầu', 'unit price', 'fuel unit', '단가', '유가'] },
  toll: { any: ['cầu đường', 'toll', '통행료'] },
  /* The 4 fixed trip fees (REQ-20260916) — exported since then, importable
   * since BUG-261015 so an exported sheet re-imports without losing them. */
  cleaning_fee: { any: ['vệ sinh', 'cleaning', '세차'] },
  repair_fee: { any: ['sửa chữa', 'repair', '수리'] },
  ferry_fee: { any: ['cầu phà', 'phà', 'ferry', '도선'] },
  loading_fee: { any: ['bốc dỡ', 'bốc xếp', 'loading', '상하차'] },
  other_amount: { any: ['chi phí phát sinh', 'chi phí khác', 'phát sinh khác', 'phí khác', 'other cost', 'other fee', '기타 비용'], not: ['ghi chú', 'note', 'tên', 'name', '명목', '메모'] },
  other_note: { any: ['ghi chú phát sinh', 'ghi chú chi phí', 'tên phí', 'tên khoản phí', 'other note', 'fee name', '기타 메모', '기타 비용 명목'] },
  bol: { any: ['bol', 'vận đơn', 'bill'] },
  cdf: { any: ['cdf'] },
  revenue: { any: ['doanh thu', 'revenue', 'selling', '매출'], not: ['tháng', 'month'] },
  /* Trip note — only the explicit wording: a bare "Ghi chú"/"Note" would also
   * catch "Ghi chú phát sinh" (the extra-cost note). */
  notes: { any: ['ghi chú chuyến', 'trip note', '운행 메모'] },
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
    /* SheetJS derives a `cellDates` Date from the 1899-12-30 epoch using THAT
     * year's local offset — Asia/Ho_Chi_Minh was LMT +7:06:30 until 1906 — so
     * a typed 27/08 arrives as 26/08 23:59:30 on a Vietnamese machine and the
     * plain local day read one day early (BUG-260930 case 2). Snap to the
     * nearest minute first; the ~30 s drift then collapses onto midnight. */
    const d = roundToMinute(value);
    return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    /* Excel serial → UTC ms. Epoch 1899-12-30 absorbs the phantom 1900-02-29.
     * FLOOR, not round: a date+time serial (46261.7 = 27/08 16:48) must stay
     * on its own day — rounding pushed an afternoon trip to the next day. */
    const ms = Math.floor(value) * 86400000 + Date.UTC(1899, 11, 30);
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

/**
 * "Chi phí phát sinh" + "Ghi chú phát sinh" of one row → the trip's extra-cost
 * items (BUG-261015).
 *
 * The trip-log export writes the note as one "Tên: số tiền" entry per item —
 * `Rửa xe: 50.000, Bến bãi: 30.000` — and the amount column as their total.
 * Re-importing that used to create ONE item named after the whole list, so the
 * next export printed "…: 30.000: 80.000" and every round trip grew the note.
 * When the note parses as such a list AND its amounts add up to the amount
 * column, it is split back into the original items. Anything else (a plain
 * note, a list that doesn't add up) stays one item — the pre-existing
 * behaviour — so a hand-typed sheet is never reinterpreted.
 */
export function splitImportExtraCosts(
  amount: number | undefined,
  note: string | undefined,
  fallbackName = 'Other',
): { name: string; amount: number }[] {
  if (!amount || amount <= 0) return [];
  const text = note?.trim() ?? '';
  const single = [{ name: text || fallbackName, amount }];
  if (!text) return single;

  /* Split on ", " but let a name keep its own commas: an item only ends where
   * the text so far ends in ": <number>". */
  const items: { name: string; amount: number }[] = [];
  let buf = '';
  for (const part of text.split(/,\s*/)) {
    buf = buf ? `${buf}, ${part}` : part;
    const m = /^(.*\S)\s*:\s*(\d[\d.]*)$/.exec(buf);
    const value = m ? parseImportNumber(m[2]) : undefined;
    if (m?.[1] && value != null && value > 0) {
      items.push({ name: m[1].trim(), amount: value });
      buf = '';
    }
  }
  if (buf || items.length === 0) return single;
  const sum = items.reduce((s, i) => s + i.amount, 0);
  return Math.abs(sum - amount) < 0.5 ? items : single;
}

/** Snap an instant to the nearest whole minute (drops SheetJS's LMT drift). */
function roundToMinute(d: Date): Date {
  return new Date(Math.round(d.getTime() / 60_000) * 60_000);
}

/**
 * A "Giờ bắt đầu / Giờ kết thúc" cell → 'HH:MM', or undefined when there is
 * nothing readable (BUG-260930 case 2). Shared by the import UI (normalises
 * before sending) so the preview and the saved value agree.
 *
 * Three shapes reach us:
 *  - an Excel serial NUMBER (the sheet is read with `cellDates: false`): the
 *    fraction of a day — 0.354166 = 08:30. A date+time serial keeps only its
 *    time-of-day here. Arithmetic on the serial is timezone-proof, which is why
 *    the importer stopped asking SheetJS for Dates: on a GMT+7 machine a typed
 *    08:30 came back as an 1899 Date whose UTC hours read 01:47.
 *  - a Date (any caller still passing `cellDates` output): local components
 *    after snapping to the minute — what the user typed, in every zone.
 *  - text: "8:30", "08:30:00", "8h30", "8.30", "8:30 pm".
 */
export function parseImportTime(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  const hhmm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  if (typeof value === 'number' && Number.isFinite(value)) {
    const frac = value - Math.floor(value);
    const mins = Math.round(frac * 1440) % 1440;
    return hhmm(Math.floor(mins / 60), mins % 60);
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    const d = roundToMinute(value);
    return hhmm(d.getHours(), d.getMinutes());
  }

  const s = String(value).trim();
  if (s === '') return undefined;
  const m = /^(\d{1,2})(?:\s*(?::|h|\.)\s*(\d{1,2}))?(?::(\d{1,2}))?\s*(am|pm)?$/i.exec(s);
  if (!m?.[1]) return undefined;
  let h = Number(m[1]);
  const mi = Number(m[2] ?? 0);
  const ap = m[4]?.toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  else if (ap === 'am' && h === 12) h = 0;
  if (h > 23 || mi > 59) return undefined;
  return hhmm(h, mi);
}

/**
 * "Now" as a WALL CLOCK in `timeZone`, encoded the way every trip start/end is
 * stored (UTC components = the clock the user would read — see
 * parseWallClockUtc). Used when a driver ends a trip without typing the time:
 * the old `new Date()` stored the UTC instant, which every reader then printed
 * 7 hours early for a Vietnamese tenant (BUG-260930 case 2).
 */
export function wallClockNowUtc(timeZone: string, now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')));
}

/**
 * "Giờ bắt đầu / Giờ kết thúc" of a trip is a WALL CLOCK the user typed
 * ("08:15"), not an instant — so it must be stored and read back through the
 * same frame or it drifts (REQ-20260824 round-trip test: typed 08:15, exported
 * 01:15 on a GMT+7 machine).
 *
 * Everything that READS these back — the trip-log export, the monthly report,
 * the edit forms — uses UTC components, so this writes UTC too. On Render
 * (server TZ = UTC) that is byte-for-byte what the old `new Date(str)` produced,
 * so stored data and prod behaviour are unchanged; it only stops the value from
 * depending on which timezone the server happens to run in.
 *
 * Accepts "YYYY-MM-DD", optionally followed by "T"/" " and "HH:mm[:ss]".
 */
export function parseWallClockUtc(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(String(value).trim());
  if (!m) return null;
  const d = new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0)),
  );
  return Number.isNaN(d.getTime()) ? null : d;
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
  cleaning_fee: z.number().nonnegative().optional(),
  repair_fee: z.number().nonnegative().optional(),
  ferry_fee: z.number().nonnegative().optional(),
  loading_fee: z.number().nonnegative().optional(),
  other_amount: z.number().nonnegative().optional(),
  other_note: z.string().optional(),
  bol: z.string().optional(),
  cdf: z.string().optional(),
  revenue: z.number().nonnegative().optional(),
  /* Same cap as the trip form's note (truck-trip.zod). */
  notes: z.string().trim().max(2000).optional(),
});
export type TruckImportRow = z.infer<typeof truckImportRowSchema>;

export const importTruckTripsSchema = z.object({
  vehicle_id: z.string().uuid(),
  driver_id: z.string().uuid(),
  file_name: z.string().trim().min(1).max(255),
  rows: z.array(truckImportRowSchema).min(1).max(500),
});
export type ImportTruckTripsInput = z.infer<typeof importTruckTripsSchema>;

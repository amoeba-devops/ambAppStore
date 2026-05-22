import 'server-only';
import type { CarTripStatus, CarExpenseStatus, CarExpenseType } from '@car-v2/db/schema';

/* CSV export formatting helpers — shared giữa các route handler trong /api/v1/*.
 *
 * Mục tiêu:
 *   - Excel mở UTF-8 đúng tiếng Việt + Korean (BOM ở caller, không ở helper)
 *   - Không dump JSON thô vào cell — flatten về `key=value; key=value`
 *   - Datetime hiển thị giờ địa phương vi-VN cho dễ đọc
 *   - Amount integer + thousands separator (VND không có decimal)
 *   - Status / type enum → label tiếng Việt
 */

/** Escape CSV cell: wrap in "..." if contains comma/quote/newline; double inner quotes. */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Build a complete CSV string from header + 2D array. Prepend UTF-8 BOM. */
export function buildCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [header.map(csvCell).join(',')];
  for (const row of rows) lines.push(row.map(csvCell).join(','));
  return '﻿' + lines.join('\r\n');
}

/* ── Datetime ─────────────────────────────────────────────────────────── */

const DT_FMT = new Intl.DateTimeFormat('vi-VN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Ho_Chi_Minh',
});

/** Format Date → "DD/MM/YYYY HH:MM" giờ VN. Empty string nếu null. */
export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  /* Intl format khác locale-by-locale; vi-VN trả "DD/MM/YYYY HH:MM". */
  return DT_FMT.format(date);
}

/** Date-only (YYYY-MM-DD) đã ở format này từ DB type `date`, chỉ chuyển thành DD/MM/YYYY. */
export function fmtDate(s: string | null | undefined): string {
  if (!s) return '';
  /* `s` dạng "2026-05-22"; convert sang DD/MM/YYYY cho Excel VN-friendly. */
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/* ── Amount ──────────────────────────────────────────────────────────── */

const VND_INT_FMT = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

/** Format decimal string/number → integer with thousands separator. VND có
 *  decimal=0 nên drop phần lẻ. Currency khác (USD, KRW) → giữ raw. */
export function fmtAmount(value: string | number | null | undefined, currency = 'VND'): string {
  if (value === null || value === undefined || value === '') return '';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return String(value);
  if (currency === 'VND') return VND_INT_FMT.format(Math.round(n));
  return n.toLocaleString('en-US');
}

/* ── Duration ────────────────────────────────────────────────────────── */

/** Format minutes → "1h 30m" / "45m" / "" empty. */
export function fmtDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/* ── JSON-as-key-value ───────────────────────────────────────────────── */

/** Flatten object JSON → "key=value; key2=value2". Nested object → JSON inline.
 *  Tránh dump nguyên `{...}` block khó đọc trong Excel cell. */
export function fmtJsonAsKv(obj: unknown): string {
  if (obj === null || obj === undefined) return '';
  if (typeof obj !== 'object') return String(obj);
  if (Array.isArray(obj)) return obj.map((v) => fmtJsonAsKv(v)).join('; ');

  const pairs: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    let val: string;
    if (v === null || v === undefined) val = '';
    else if (typeof v === 'object') val = JSON.stringify(v); // nested → JSON inline (cell có thể dài)
    else val = String(v);
    pairs.push(`${k}=${val}`);
  }
  return pairs.join('; ');
}

/* ── Trip status label ───────────────────────────────────────────────── */

const TRIP_STATUS_VI: Record<CarTripStatus, string> = {
  PENDING_ASSIGNMENT:          'Chờ phân công',
  PENDING_DRIVER_CONFIRMATION: 'Chờ tài xế xác nhận',
  CONFIRMED:                   'Đã xác nhận',
  IN_PROGRESS:                 'Đang đi',
  COMPLETED:                   'Hoàn tất',
  REJECTED_BY_DRIVER:          'Tài xế từ chối',
  CANCELLED:                   'Đã huỷ',
};

export function fmtTripStatus(s: CarTripStatus): string {
  return TRIP_STATUS_VI[s] ?? s;
}

/* ── Expense status + type label ─────────────────────────────────────── */

const EXPENSE_STATUS_VI: Record<CarExpenseStatus, string> = {
  PENDING:       'Chờ duyệt',
  APPROVED:      'Đã duyệt',
  AUTO_APPROVED: 'Tự duyệt',
  REJECTED:      'Từ chối',
};

const EXPENSE_TYPE_VI: Record<CarExpenseType, string> = {
  FUEL:       'Xăng dầu',
  OIL:        'Dầu nhớt',
  MEAL:       'Ăn uống',
  REPAIR:     'Sửa chữa',
  PARKING:    'Đỗ xe',
  TOLL:       'Phí cầu đường',
  ACCIDENT:   'Tai nạn',
  INSPECTION: 'Đăng kiểm',
};

export function fmtExpenseStatus(s: CarExpenseStatus): string {
  return EXPENSE_STATUS_VI[s] ?? s;
}

export function fmtExpenseType(s: CarExpenseType): string {
  return EXPENSE_TYPE_VI[s] ?? s;
}

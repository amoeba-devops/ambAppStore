/**
 * Pure helpers used by `importPrimeCostsAction` for CSV row interpretation.
 * Extracted to live in `lib/` so they can be unit-tested without spinning
 * up a server context. The action itself wires DB I/O around them.
 */

/**
 * Strip Excel's `="..."` text wrapper. Excel preserves long numeric IDs
 * (like Shopee's 12-digit product_id) by writing them as `="243646783891"`
 * when the cell is formatted as Text. Otherwise it converts them to
 * scientific notation and loses precision.
 */
export function stripExcelTextWrapper(s: string): string {
  const trimmed = s.trim();
  if (trimmed.length >= 3 && trimmed.startsWith('="') && trimmed.endsWith('"')) {
    return trimmed.slice(2, -1);
  }
  return trimmed;
}

/**
 * Detects Excel's scientific-notation form (e.g. `2.27886E+11`). When this
 * is seen on Product ID / Variation ID fields, Excel has already
 * lost precision — import must either preserve the existing DB value
 * (UPDATE path) or reject the row (INSERT path).
 */
export function looksLikeScientificNotation(s: string): boolean {
  return /^[+-]?\d+(\.\d+)?[Ee][+-]?\d+$/.test(s.trim());
}

/**
 * Parse a money-like string that may use `.` or `,` as thousand separators
 * (Vietnamese typing convention uses `.` for thousands — exactly the
 * opposite of US). Falls back to a comma-only strip if the simple strip
 * yields a non-integer-looking value.
 *
 * Returns `null` for blank / non-numeric input.
 */
export function parseNumericLoose(s: string | undefined | null): number | null {
  if (s == null) return null;
  const trimmed = stripExcelTextWrapper(s.trim());
  if (!trimmed) return null;
  // Strip thousand separators (comma or dot) and any whitespace.
  const cleaned = trimmed.replace(/[,.\s]/g, '');
  if (!/^\d+$/.test(cleaned)) {
    // Looks like a real decimal — strip commas only and let Number parse.
    const n = Number(trimmed.replace(/[,\s]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a date in any of the formats Excel might emit:
 *   - `YYYY-MM-DD` (canonical, our own export)
 *   - `M/D/YYYY` / `MM/DD/YYYY` (US — Excel default on Windows)
 *   - `D/M/YYYY` / `DD/MM/YYYY` (VN — auto-detected when month > 12)
 *
 * Ambiguous slash dates (both parts ≤ 12) are interpreted as US (MM/DD/YYYY)
 * — matches Excel default on Windows even when system locale is vi-VN.
 *
 * Returns canonical `YYYY-MM-DD` or `null` on unparseable input.
 */
export function parseFlexibleDate(s: string): string | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const pad = (n: string) => n.padStart(2, '0');
    return `${iso[1]}-${pad(iso[2]!)}-${pad(iso[3]!)}`;
  }
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const y = slash[3]!;
    let month: number;
    let day: number;
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      month = a;
      day = b;
    } else {
      // Both ≤ 12 — default to US (MM/DD/YYYY).
      month = a;
      day = b;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${y}-${pad(month)}-${pad(day)}`;
  }
  return null;
}

/**
 * Parse a free-form boolean like Is Combo column. Accepts:
 *   1 / yes / y / true / combo → true
 *   0 / no / n / false         → false
 *   blank / unknown            → null (caller should preserve DB value)
 */
export function parseBool(raw: string | undefined | null): boolean | null {
  if (raw == null) return null;
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (['1', 'yes', 'y', 'true', 'combo'].includes(v)) return true;
  if (['0', 'no', 'n', 'false'].includes(v)) return false;
  return null;
}

/** Column slots in `sal_prime_costs` master CSV. */
export type ImportColumn =
  | 'productId'
  | 'variationId'
  | 'variationName'
  | 'productNameVi'
  | 'productNameEn'
  | 'sku'
  | 'gtin'
  | 'hsCode'
  | 'primeCost'
  | 'sellingPrice'
  | 'listingPrice'
  | 'effPrime'
  | 'effSelling'
  | 'effListing'
  | 'isCombo'
  | 'comboComponents';

const HEADER_NAMES: Record<ImportColumn, string> = {
  productId: 'product id',
  variationId: 'variation id',
  variationName: 'variation name',
  productNameVi: 'product (vi)',
  productNameEn: 'product (en)',
  sku: 'sku',
  gtin: 'gtin',
  hsCode: 'hs code',
  primeCost: 'prime cost (vnd)',
  sellingPrice: 'selling price (vnd)',
  listingPrice: 'listing price (vnd)',
  effPrime: 'effective from — prime',
  effSelling: 'effective from — selling',
  effListing: 'effective from — listing',
  isCombo: 'is combo',
  comboComponents: 'combo component skus',
};

const POSITIONAL_FALLBACK: Record<ImportColumn, number> = {
  productId: 0,
  variationId: 1,
  variationName: 2,
  productNameVi: 3,
  productNameEn: 4,
  sku: 5,
  primeCost: 6,
  sellingPrice: 7,
  listingPrice: 8,
  effPrime: 9,
  effSelling: 10,
  effListing: 11,
  isCombo: 12,
  comboComponents: 13,
  // GTIN + HS Code added later — no positional slot in legacy CSVs.
  gtin: -1,
  hsCode: -1,
};

/**
 * Decide whether a CSV's first row is a header row. True when it contains
 * any of the canonical header names (case-insensitive). Field-specific
 * exports (prime-only / selling-only / listing-only) all match too.
 */
export function detectHeader(firstRow: string[]): boolean {
  const lc = firstRow.map((c) => c.trim().toLowerCase());
  return (
    lc.includes('sku') ||
    lc.some((c) => c.includes('product')) ||
    lc.some((c) => c.includes('prime cost')) ||
    lc.some((c) => c.includes('selling price')) ||
    lc.some((c) => c.includes('listing price'))
  );
}

/**
 * Build `column → row index` mapping for header-aware CSV import.
 * When `looksLikeHeader` is true, scans the actual header row. When false
 * (no header row), falls back to legacy positional layout (15 columns,
 * GTIN/HSCode at -1 to mean "not present").
 *
 * Each column returns -1 if not found — caller must check before reading.
 */
export function buildColumnIndex(
  firstRow: string[],
  looksLikeHeader: boolean,
): Record<ImportColumn, number> {
  if (!looksLikeHeader) return { ...POSITIONAL_FALLBACK };
  const lc = firstRow.map((c) => c.trim().toLowerCase());
  const out = {} as Record<ImportColumn, number>;
  for (const key of Object.keys(HEADER_NAMES) as ImportColumn[]) {
    out[key] = lc.indexOf(HEADER_NAMES[key]);
  }
  return out;
}

/** Safe cell-by-index reader that tolerates missing trailing columns. */
export function cell(row: string[], i: number): string | undefined {
  return i >= 0 && i < row.length ? row[i] : undefined;
}

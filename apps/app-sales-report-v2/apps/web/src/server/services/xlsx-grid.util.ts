import 'server-only';
import { unzipSync, strFromU8 } from 'fflate';

/**
 * Tiny xlsx-to-grid reader. Shared by Shopee parsers (Ads, Brand Ads,
 * Off-Platform Ads, etc.) since Seller Center exports xlsx with the same
 * "metadata block + blank row + header + data rows" shape — the only thing
 * that differs is the header label.
 *
 * Output: `Map<rowNum, Map<colIdx, string | number>>` — 1-based row and column
 * indices match xlsx convention.
 *
 * We do not use ExcelJS because Shopee xlsx uses standard well-formed XML
 * (shared strings + a single sheet1.xml) and a 200-line regex parser is
 * faster + has no dependency bloat. The TikTok parser uses its own variant
 * because TikTok writes malformed `<row>` elements — keep them separate.
 */

export class XlsxParseError extends Error {
  constructor(
    message: string,
    public readonly code: 'READ_FAILED' | 'NO_SHEET',
  ) {
    super(message);
    this.name = 'XlsxParseError';
  }
}

/** True iff the buffer's first two bytes are the "PK" ZIP magic (i.e. xlsx). */
export function isXlsx(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

/** "A" → 1, "B" → 2, …, "AA" → 27. */
export function colLetterToIdx(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

function findSheetXml(zip: Record<string, Uint8Array>): string | null {
  // Lowest-numbered xl/worksheets/sheetN.xml. Shopee always uses sheet1.
  const names = Object.keys(zip)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort();
  if (names.length === 0) return null;
  return strFromU8(zip[names[0]!]!);
}

function readSharedStrings(zip: Record<string, Uint8Array>): string[] {
  const file = zip['xl/sharedStrings.xml'];
  if (!file) return [];
  const xml = strFromU8(file);
  const out: string[] = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g;
  let m: RegExpExecArray | null;
  while ((m = siRegex.exec(xml)) !== null) {
    const inner = m[1]!;
    let s = '';
    let t: RegExpExecArray | null;
    while ((t = tRegex.exec(inner)) !== null) s += t[1]!;
    out.push(decodeXmlEntities(s));
  }
  return out;
}

function parseSheetXml(
  xml: string,
  sharedStrings: string[],
): Map<number, Map<number, string | number>> {
  const grid = new Map<number, Map<number, string | number>>();
  const cellRegex = /<c\s+r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m: RegExpExecArray | null;
  while ((m = cellRegex.exec(xml)) !== null) {
    const [, colLetters, rowStr, attrs, inner] = m;
    if (inner == null) continue; // self-closing empty cell
    const colIdx = colLetterToIdx(colLetters!);
    const rowNum = Number(rowStr);
    const typeMatch = attrs!.match(/t="([^"]+)"/);
    const cellType = typeMatch ? typeMatch[1] : null;
    let value: string | number | null = null;
    if (cellType === 'inlineStr') {
      const tMatch = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
      value = tMatch ? decodeXmlEntities(tMatch[1]!) : '';
    } else {
      const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
      if (!vMatch) continue;
      const raw = decodeXmlEntities(vMatch[1]!);
      if (cellType === 's') {
        const idx = Number(raw);
        value = sharedStrings[idx] ?? '';
      } else if (cellType === 'str' || cellType === 'b') {
        value = raw;
      } else {
        value = Number(raw);
      }
    }
    if (value === null) continue;
    if (!grid.has(rowNum)) grid.set(rowNum, new Map());
    grid.get(rowNum)!.set(colIdx, value);
  }
  return grid;
}

/**
 * Unzip + parse the first worksheet of an xlsx file into a row-major grid.
 * Throws `XlsxParseError` on unzip / sheet detection failure.
 */
export function readXlsxGrid(bytes: Uint8Array): Map<number, Map<number, string | number>> {
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(bytes);
  } catch (err) {
    throw new XlsxParseError(
      `Failed to unzip xlsx: ${err instanceof Error ? err.message : String(err)}`,
      'READ_FAILED',
    );
  }
  const sheetXml = findSheetXml(zip);
  if (!sheetXml) {
    throw new XlsxParseError('No worksheet XML found in xlsx', 'NO_SHEET');
  }
  const sharedStrings = readSharedStrings(zip);
  return parseSheetXml(sheetXml, sharedStrings);
}

/** Find the first row whose first non-empty cell (NFC-normalized) starts with `prefix`. */
export function findHeaderRow(
  grid: Map<number, Map<number, string | number>>,
  prefix: string,
): number {
  const target = prefix.normalize('NFC');
  const sorted = [...grid.keys()].sort((a, b) => a - b);
  for (const r of sorted) {
    const cells = grid.get(r)!;
    const first = cells.get(1);
    if (typeof first === 'string' && first.trim().normalize('NFC').startsWith(target)) {
      return r;
    }
  }
  return -1;
}

/**
 * Find the row that contains the most labels from `labels` (NFC-normalized,
 * matched anywhere in the row's cells). Returns -1 if no row matches at least
 * `minMatch` labels. More robust than `findHeaderRow` when the first column
 * varies between CSV ("Thứ tự") and xlsx (skips that column).
 */
export function findHeaderRowByLabels(
  grid: Map<number, Map<number, string | number>>,
  labels: string[],
  minMatch: number,
): number {
  const targets = new Set(labels.map((l) => l.normalize('NFC')));
  let bestRow = -1;
  let bestScore = 0;
  for (const r of [...grid.keys()].sort((a, b) => a - b)) {
    const cells = grid.get(r)!;
    let score = 0;
    for (const v of cells.values()) {
      if (typeof v === 'string' && targets.has(v.trim().normalize('NFC'))) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }
  return bestScore >= minMatch ? bestRow : -1;
}

/**
 * Build `colByField` from a header row + the field→label(s) map. Each field's
 * label may be a single string OR an array of aliases (e.g. `vi` + `en`
 * variants); the first alias found in the header row wins.
 * Returns missing fields for diagnostics (first alias as canonical name).
 */
export function resolveHeaderColumns<F extends string>(
  headerRow: Map<number, string | number>,
  headerMap: Record<F, string | readonly string[]>,
): { colByField: Record<F, number>; missing: string[] } {
  const colByName = new Map<string, number>();
  for (const [c, v] of headerRow) {
    colByName.set(String(v).trim().normalize('NFC'), c);
  }
  const colByField = {} as Record<F, number>;
  const missing: string[] = [];
  for (const [field, labelOrAliases] of Object.entries(headerMap) as Array<
    [F, string | readonly string[]]
  >) {
    const aliases = typeof labelOrAliases === 'string' ? [labelOrAliases] : labelOrAliases;
    let idx: number | undefined;
    for (const alias of aliases) {
      const found = colByName.get(alias.normalize('NFC'));
      if (found != null) {
        idx = found;
        break;
      }
    }
    if (idx == null) missing.push(aliases[0]!);
    else colByField[field] = idx;
  }
  return { colByField, missing };
}

/** Cell → string (trimmed). Empty / null → empty string. */
export function cellText(v: string | number | undefined): string {
  return v == null ? '' : String(v).trim();
}

/** Cell → number. Handles already-numeric and string-with-formatting. */
export function cellNumber(v: string | number | undefined): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[, "%]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

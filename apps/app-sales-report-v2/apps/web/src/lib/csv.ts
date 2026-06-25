// Minimal CSV helpers — RFC 4180 subset: comma delimiter, double-quote escape, CRLF or LF.

const UTF8_BOM_BYTES = new Uint8Array([0xef, 0xbb, 0xbf]);

/**
 * Browser-side download helper. Wraps a CSV string in a Blob with a guaranteed
 * UTF-8 BOM byte prefix and triggers a download. Excel on Windows requires the
 * raw byte BOM (not just a `﻿` JS character) to open multi-byte text
 * correctly — passing the string directly to `new Blob()` worked in dev but
 * Excel still mis-detected the encoding for some users (see screenshot
 * 2026-05-21 — Vietnamese product names rendered as Windows-1252 mojibake).
 *
 * Always emits BOM, even if the input string already has one (BOM mid-stream
 * is a zero-width char, harmless).
 */
export function downloadCsv(csvText: string, filename: string): void {
  if (typeof window === 'undefined') return;
  // Strip a leading `﻿` if present — we'll prepend the raw byte BOM
  // explicitly. Avoids double-BOM (which Excel renders as a literal `?`).
  const stripped = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;
  const body = new TextEncoder().encode(stripped);
  const out = new Uint8Array(UTF8_BOM_BYTES.length + body.length);
  out.set(UTF8_BOM_BYTES, 0);
  out.set(body, UTF8_BOM_BYTES.length);
  const blob = new Blob([out], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function escapeCsvField(value: string | number | null | undefined): string {
  if (value == null) return '';
  const s = typeof value === 'number' ? value.toString() : value;
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function toCsvRow(fields: Array<string | number | null | undefined>): string {
  return fields.map(escapeCsvField).join(',');
}

export function buildCsv(header: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [toCsvRow(header), ...rows.map(toCsvRow)];
  // Prepend BOM so Excel opens UTF-8 correctly
  return '﻿' + lines.join('\r\n');
}

export function parseCsv(text: string): string[][] {
  // Strip BOM if present
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      // Handle CRLF or lone CR
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (input[i + 1] === '\n') i += 2;
      else i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // Flush last field/row if non-empty
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
